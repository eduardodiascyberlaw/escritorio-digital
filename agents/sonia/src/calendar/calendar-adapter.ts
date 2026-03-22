import type { Materia } from "@sd-legal/shared";

export interface TimeSlot {
  start: string; // ISO 8601
  end: string; // ISO 8601
}

export interface CalendarAdapter {
  getFreeSlots(days: number): Promise<TimeSlot[]>;
  createAppointment(
    slot: TimeSlot,
    clientName: string,
    materia: Materia
  ): Promise<string>;
  cancelAppointment(eventId: string): Promise<void>;
}

export class StubCalendarAdapter implements CalendarAdapter {
  async getFreeSlots(days: number): Promise<TimeSlot[]> {
    console.log(`[Calendar Stub] Próximos ${days} dias — não implementado`);
    return [];
  }

  async createAppointment(): Promise<string> {
    console.log("[Calendar Stub] Criar evento — não implementado");
    return "stub_event_id";
  }

  async cancelAppointment(): Promise<void> {
    console.log("[Calendar Stub] Cancelar evento — não implementado");
  }
}
