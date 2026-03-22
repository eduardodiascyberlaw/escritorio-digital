import { v4 as uuid } from "uuid";
import type { Ticket } from "@sd-legal/shared";
import type { ChamadoHumano } from "./types.js";
import type { WhatsAppGateway } from "../gateway/whatsapp-gateway.js";
import type { PaperclipAdapter } from "../tickets/paperclip-adapter.js";

export async function escalateToHuman(
  chamado: ChamadoHumano,
  gateway: WhatsAppGateway,
  paperclip: PaperclipAdapter,
  teamPhone?: string
): Promise<void> {
  const now = new Date().toISOString();

  // Create Paperclip ticket
  const ticket: Ticket = {
    ticket_id: chamado.ticket_id || uuid(),
    criado_em: now,
    atualizado_em: now,
    origem: "sonia",
    destino: "humano",
    tipo: "escalamento_humano",
    prioridade: chamado.urgencia === "imediata" ? "urgente" : "normal",
    cliente_id: chamado.cliente_id,
    contexto: {
      resumo: chamado.descricao,
    },
    payload: {
      tipo_chamado: chamado.tipo,
      campos_em_falta: chamado.campos_em_falta,
      responsavel_sugerido: chamado.responsavel_sugerido,
    },
    retorno_esperado: "decisao_humana",
    deadline: chamado.prazo,
    estado: "aguarda_humano",
    audit_trail: [
      {
        timestamp: now,
        agente: "sonia",
        accao: "escalamento_humano",
        detalhe: `${chamado.tipo}: ${chamado.descricao}`,
      },
    ],
  };

  await paperclip.submitTicket(ticket);

  // Notify team via WhatsApp if phone provided
  if (teamPhone) {
    const urgencyEmoji =
      chamado.urgencia === "imediata"
        ? "🔴"
        : chamado.urgencia === "hoje"
          ? "🟡"
          : "🟢";

    await gateway.sendMessage(
      teamPhone,
      `${urgencyEmoji} CHAMADO SD LEGAL\n\nTipo: ${chamado.tipo}\nCliente: ${chamado.cliente_id}\n\n${chamado.descricao}`
    );
  }

  console.log(
    `[Escalamento] ${chamado.tipo} — cliente ${chamado.cliente_id} — ${chamado.urgencia}`
  );
}
