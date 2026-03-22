import type { Ticket, TicketEstado } from "@sd-legal/shared";

export interface PaperclipAdapter {
  submitTicket(ticket: Ticket): Promise<void>;
  getTicketStatus(ticketId: string): Promise<TicketEstado>;
}

export class StubPaperclipAdapter implements PaperclipAdapter {
  private tickets = new Map<string, Ticket>();

  async submitTicket(ticket: Ticket): Promise<void> {
    this.tickets.set(ticket.ticket_id, ticket);
    console.log(
      `[Paperclip Stub] Ticket submetido: ${ticket.ticket_id} (${ticket.tipo}) → ${ticket.destino}`
    );
  }

  async getTicketStatus(ticketId: string): Promise<TicketEstado> {
    const ticket = this.tickets.get(ticketId);
    return ticket?.estado ?? "pendente";
  }
}
