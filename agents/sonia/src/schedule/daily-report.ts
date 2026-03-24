/**
 * Relatorio diario das 18:00
 *
 * Gera e envia ao grupo de controlo um resumo de todas as
 * actividades do dia: clientes atendidos, accoes, pendencias.
 */

import type { ZApiGateway } from "../gateway/zapi-gateway.js";

// ─────────────────────────────────────────────
// Activity tracking
// ─────────────────────────────────────────────

export interface ActivityEvent {
  timestamp: string;
  clientPhone: string;
  clientName: string | null;
  type:
    | "message_received"
    | "draft_created"
    | "draft_approved"
    | "draft_edited"
    | "draft_ignored"
    | "escalation"
    | "crm_updated"
    | "consent_sent"
    | "consent_received";
  detail: string;
}

const dailyEvents: ActivityEvent[] = [];

export function trackEvent(event: ActivityEvent): void {
  dailyEvents.push(event);
}

export function getDailyEvents(): ActivityEvent[] {
  return [...dailyEvents];
}

// ─────────────────────────────────────────────
// Report generation
// ─────────────────────────────────────────────

export function generateReport(): string {
  const events = [...dailyEvents];
  const today = new Date().toISOString().split("T")[0];

  // Agrupar por cliente
  const clients = new Map<
    string,
    { name: string | null; events: ActivityEvent[] }
  >();

  for (const evt of events) {
    const key = evt.clientPhone;
    if (!clients.has(key)) {
      clients.set(key, { name: evt.clientName, events: [] });
    }
    clients.get(key)!.events.push(evt);
    // Actualizar nome se disponivel
    if (evt.clientName) {
      clients.get(key)!.name = evt.clientName;
    }
  }

  // Estatisticas
  const totalMessages = events.filter(
    (e) => e.type === "message_received"
  ).length;
  const totalApproved = events.filter(
    (e) => e.type === "draft_approved"
  ).length;
  const totalEdited = events.filter(
    (e) => e.type === "draft_edited"
  ).length;
  const totalEscalations = events.filter(
    (e) => e.type === "escalation"
  ).length;

  // Gerar texto
  const lines: string[] = [
    `📊 *RELATORIO DIARIO — ${today}*`,
    "━━━━━━━━━━━━━━━━━━━━━━",
    "",
    `*CLIENTES ATENDIDOS:* ${clients.size}`,
    `*MENSAGENS RECEBIDAS:* ${totalMessages}`,
    `*RASCUNHOS APROVADOS:* ${totalApproved}`,
    `*RASCUNHOS EDITADOS:* ${totalEdited}`,
    `*ESCALAMENTOS:* ${totalEscalations}`,
    "",
    "━━━━━━━━━━━━━━━━━━━━━━",
  ];

  if (clients.size === 0) {
    lines.push("", "_Nenhuma actividade registada hoje._");
  } else {
    let idx = 1;
    for (const [phone, data] of clients) {
      const displayName = data.name ?? phone;
      lines.push("", `*${idx}. ${displayName}*`);

      for (const evt of data.events) {
        const time = evt.timestamp.split("T")[1]?.substring(0, 5) ?? "";
        const icon = EVENT_ICONS[evt.type] ?? "•";
        lines.push(`   ${icon} ${time} — ${evt.detail}`);
      }

      idx++;
    }
  }

  lines.push("", "━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("_Relatorio gerado automaticamente pela SonIA._");

  return lines.join("\n");
}

const EVENT_ICONS: Record<string, string> = {
  message_received: "📩",
  draft_created: "📝",
  draft_approved: "✅",
  draft_edited: "✏️",
  draft_ignored: "🚫",
  escalation: "⚠️",
  crm_updated: "🗂️",
  consent_sent: "🔒",
  consent_received: "🔓",
};

/**
 * Gera o relatorio e envia ao grupo de controlo.
 * Limpa os eventos do dia apos envio.
 */
export async function sendDailyReport(
  gateway: ZApiGateway,
  controlGroupJid: string | null
): Promise<void> {
  const report = generateReport();

  if (controlGroupJid) {
    await gateway.sendToGroup(controlGroupJid, report);
    console.log("[Relatorio 18:00] Enviado ao grupo de controlo.");
  } else {
    console.log("[Relatorio 18:00] Sem grupo — log apenas:");
    console.log(report);
  }

  // Limpar eventos do dia
  dailyEvents.length = 0;
}
