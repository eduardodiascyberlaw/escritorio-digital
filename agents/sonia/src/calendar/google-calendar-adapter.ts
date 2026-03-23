/**
 * Google Calendar Adapter — implementacao real com ADC
 *
 * Consulta slots livres na agenda do advogado, cria pre-bloqueios
 * e cancela eventos. Autenticacao via Application Default Credentials.
 */

import { google } from "googleapis";
import type { calendar_v3 } from "googleapis";
import type { Materia } from "@sd-legal/shared";
import type { CalendarAdapter, TimeSlot } from "./calendar-adapter.js";
import { TIMEZONE } from "../schedule/business-hours.js";

export interface GoogleCalendarConfig {
  calendarId: string; // email do advogado
  slotDurations: { short: number; long: number }; // minutos
  businessHours: { start: number; end: number }; // 9–18
}

const DEFAULT_CONFIG: GoogleCalendarConfig = {
  calendarId: process.env.GOOGLE_CALENDAR_ID ?? "eduardodias@eduardodiasadvogado.com",
  slotDurations: { short: 30, long: 60 },
  businessHours: { start: 9, end: 18 },
};

export class GoogleCalendarAdapter implements CalendarAdapter {
  private config: GoogleCalendarConfig;
  private calendar: calendar_v3.Calendar;

  constructor(config?: Partial<GoogleCalendarConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    const auth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });

    this.calendar = google.calendar({ version: "v3", auth });
  }

  /**
   * Retorna slots livres nos proximos N dias uteis (seg-sex, 09-18, Europe/Lisbon).
   * Cada slot tem a duracao do intervalo livre real (minimo 30 min).
   */
  async getFreeSlots(days: number): Promise<TimeSlot[]> {
    const now = new Date();
    const end = new Date();
    end.setDate(end.getDate() + days);

    const busyResponse = await this.calendar.freebusy.query({
      requestBody: {
        timeMin: now.toISOString(),
        timeMax: end.toISOString(),
        timeZone: TIMEZONE,
        items: [{ id: this.config.calendarId }],
      },
    });

    const busySlots =
      busyResponse.data.calendars?.[this.config.calendarId]?.busy ?? [];

    return this.computeFreeSlots(now, end, busySlots);
  }

  /**
   * Cria um evento de consulta (pre-bloqueio) na agenda.
   * Retorna o eventId para referencia futura.
   */
  async createAppointment(
    slot: TimeSlot,
    clientName: string,
    materia: Materia
  ): Promise<string> {
    const event = await this.calendar.events.insert({
      calendarId: this.config.calendarId,
      requestBody: {
        summary: `Consulta — ${clientName} — ${materia}`,
        description: `Pre-agendamento via SonIA. Aguarda comprovativo de pagamento.`,
        start: { dateTime: slot.start, timeZone: TIMEZONE },
        end: { dateTime: slot.end, timeZone: TIMEZONE },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "popup", minutes: 60 },
            { method: "popup", minutes: 1440 },
          ],
        },
      },
    });

    const eventId = event.data.id!;
    console.log(`[Calendar] Evento criado: ${eventId} — ${clientName} (${materia})`);
    return eventId;
  }

  /**
   * Cancela (apaga) um evento da agenda.
   */
  async cancelAppointment(eventId: string): Promise<void> {
    await this.calendar.events.delete({
      calendarId: this.config.calendarId,
      eventId,
    });
    console.log(`[Calendar] Evento cancelado: ${eventId}`);
  }

  /**
   * Calcula slots livres a partir dos periodos ocupados.
   * So retorna slots dentro do horario util (seg-sex, 09-18).
   */
  private computeFreeSlots(
    rangeStart: Date,
    rangeEnd: Date,
    busy: Array<{ start?: string | null; end?: string | null }>
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const { start: hStart, end: hEnd } = this.config.businessHours;
    const minSlotMinutes = this.config.slotDurations.short;

    // Iterar dia a dia
    const current = new Date(rangeStart);
    current.setHours(0, 0, 0, 0);

    while (current <= rangeEnd) {
      const dayOfWeek = this.getDayInTimezone(current);

      // Ignorar fins de semana
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const dayStart = this.setHourInTimezone(current, hStart);
        const dayEnd = this.setHourInTimezone(current, hEnd);

        // Nao sugerir slots no passado
        const effectiveStart = dayStart < rangeStart ? rangeStart : dayStart;

        // Arredondar para o proximo intervalo de 30 min
        const roundedStart = this.roundUpTo30Min(effectiveStart);

        if (roundedStart < dayEnd) {
          const daySlots = this.findGapsInDay(
            roundedStart,
            dayEnd,
            busy,
            minSlotMinutes
          );
          slots.push(...daySlots);
        }
      }

      current.setDate(current.getDate() + 1);
    }

    return slots;
  }

  /**
   * Encontra intervalos livres num dia especifico.
   */
  private findGapsInDay(
    dayStart: Date,
    dayEnd: Date,
    busy: Array<{ start?: string | null; end?: string | null }>,
    minMinutes: number
  ): TimeSlot[] {
    // Filtrar eventos ocupados que intersectam este dia
    const dayBusy = busy
      .filter((b) => b.start && b.end)
      .map((b) => ({
        start: new Date(b.start!),
        end: new Date(b.end!),
      }))
      .filter((b) => b.start < dayEnd && b.end > dayStart)
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    const slots: TimeSlot[] = [];
    let cursor = new Date(dayStart);

    for (const event of dayBusy) {
      if (cursor < event.start) {
        const gapMinutes =
          (event.start.getTime() - cursor.getTime()) / 60000;
        if (gapMinutes >= minMinutes) {
          slots.push({
            start: cursor.toISOString(),
            end: event.start.toISOString(),
          });
        }
      }
      if (event.end > cursor) {
        cursor = new Date(event.end);
      }
    }

    // Intervalo apos o ultimo evento ate ao fim do dia
    if (cursor < dayEnd) {
      const gapMinutes = (dayEnd.getTime() - cursor.getTime()) / 60000;
      if (gapMinutes >= minMinutes) {
        slots.push({
          start: cursor.toISOString(),
          end: dayEnd.toISOString(),
        });
      }
    }

    return slots;
  }

  private getDayInTimezone(date: Date): number {
    const str = date.toLocaleDateString("en-US", {
      timeZone: TIMEZONE,
      weekday: "short",
    });
    const map: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    return map[str] ?? date.getDay();
  }

  private setHourInTimezone(date: Date, hour: number): Date {
    const dateStr = date.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
    const hourStr = String(hour).padStart(2, "0");
    return new Date(`${dateStr}T${hourStr}:00:00`);
  }

  private roundUpTo30Min(date: Date): Date {
    const ms = date.getTime();
    const thirtyMin = 30 * 60 * 1000;
    const rounded = new Date(Math.ceil(ms / thirtyMin) * thirtyMin);
    return rounded;
  }
}
