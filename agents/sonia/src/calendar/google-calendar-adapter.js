/**
 * Google Calendar Adapter — implementacao real com ADC
 *
 * Consulta slots livres na agenda do advogado, cria pre-bloqueios
 * e cancela eventos. Autenticacao via Application Default Credentials.
 */

import { google } from "googleapis";

const TIMEZONE = "Europe/Lisbon";

const DEFAULT_CONFIG = {
  calendarId: process.env.GOOGLE_CALENDAR_ID ?? "eduardodias@eduardodiasadvogado.com",
  slotDurations: { short: 30, long: 60 },
  businessHours: { start: 9, end: 18 },
};

export class GoogleCalendarAdapter {
  config;
  calendar;

  constructor(config) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    const auth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });

    this.calendar = google.calendar({ version: "v3", auth });
  }

  async getFreeSlots(days) {
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

  async createAppointment(slot, clientName, materia) {
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

    const eventId = event.data.id;
    console.log(`[Calendar] Evento criado: ${eventId} — ${clientName} (${materia})`);
    return eventId;
  }

  async cancelAppointment(eventId) {
    await this.calendar.events.delete({
      calendarId: this.config.calendarId,
      eventId,
    });
    console.log(`[Calendar] Evento cancelado: ${eventId}`);
  }

  computeFreeSlots(rangeStart, rangeEnd, busy) {
    const slots = [];
    const { start: hStart, end: hEnd } = this.config.businessHours;
    const minSlotMinutes = this.config.slotDurations.short;

    const current = new Date(rangeStart);
    current.setHours(0, 0, 0, 0);

    while (current <= rangeEnd) {
      const dayOfWeek = this.getDayInTimezone(current);

      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const dayStart = this.setHourInTimezone(current, hStart);
        const dayEnd = this.setHourInTimezone(current, hEnd);

        const effectiveStart = dayStart < rangeStart ? rangeStart : dayStart;
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

  findGapsInDay(dayStart, dayEnd, busy, minMinutes) {
    const dayBusy = busy
      .filter((b) => b.start && b.end)
      .map((b) => ({
        start: new Date(b.start),
        end: new Date(b.end),
      }))
      .filter((b) => b.start < dayEnd && b.end > dayStart)
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    const slots = [];
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

  getDayInTimezone(date) {
    const str = date.toLocaleDateString("en-US", {
      timeZone: TIMEZONE,
      weekday: "short",
    });
    const map = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    return map[str] ?? date.getDay();
  }

  setHourInTimezone(date, hour) {
    const dateStr = date.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
    const hourStr = String(hour).padStart(2, "0");
    return new Date(`${dateStr}T${hourStr}:00:00`);
  }

  roundUpTo30Min(date) {
    const ms = date.getTime();
    const thirtyMin = 30 * 60 * 1000;
    return new Date(Math.ceil(ms / thirtyMin) * thirtyMin);
  }
}
