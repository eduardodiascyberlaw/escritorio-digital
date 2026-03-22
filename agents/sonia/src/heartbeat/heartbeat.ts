import cron from "node-cron";
import type { WhatsAppGateway } from "../gateway/whatsapp-gateway.js";
import type { CrmAdapter } from "../client/crm-adapter.js";

export interface HeartbeatDeps {
  gateway: WhatsAppGateway;
  crm: CrmAdapter;
}

export function startHeartbeat(deps: HeartbeatDeps): void {
  // Every 5 minutes: check unanswered messages
  cron.schedule("*/5 * * * *", async () => {
    try {
      console.log("[Heartbeat 5min] A verificar mensagens não respondidas...");
      // TODO: implement when gateway supports message history
      // - Messages unanswered > 2h → alert human
      // - Documents requested > 3 days ago → remind client
      // - Appointments in next 48h without confirmation → remind
    } catch (error) {
      console.error("[Heartbeat 5min] Erro:", error);
    }
  });

  // Daily at 07:30: check expiring documents and deadlines
  cron.schedule("30 7 * * *", async () => {
    try {
      console.log("[Heartbeat diário] Verificação matinal...");
      // TODO: implement when CRM has document expiry tracking
      // - Titles expiring in 90 days → notify client
      // - Critical deadlines → alert Rex
      // - Incomplete onboardings > 7 days → reactivate or close
    } catch (error) {
      console.error("[Heartbeat diário] Erro:", error);
    }
  });

  console.log("[Heartbeat] Agendado: 5min + diário 07:30");
}
