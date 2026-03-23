import cron from "node-cron";
import type { CrmAdapter } from "../client/crm-adapter.js";
import type { SupervisedMode } from "../supervised/supervised-mode.js";
import type { EvolutionApiGateway } from "../gateway/evolution-api.js";
import { TIMEZONE } from "../schedule/business-hours.js";
import { executeMorningRoutine } from "../schedule/morning-routine.js";
import { sendDailyReport } from "../schedule/daily-report.js";

export interface HeartbeatDeps {
  gateway: EvolutionApiGateway;
  crm: CrmAdapter;
  supervised: SupervisedMode;
  controlGroupJid: string | null;
}

export function startHeartbeat(deps: HeartbeatDeps): void {
  // ─────────────────────────────────────────────
  // Cada 5 minutos: verificar mensagens nao respondidas
  // ─────────────────────────────────────────────
  cron.schedule("*/5 * * * *", async () => {
    try {
      // TODO: implement when gateway supports message history
      // - Messages unanswered > 2h → alert human
      // - Documents requested > 3 days ago → remind client
      // - Appointments in next 48h without confirmation → remind
      // - Unfulfilled commitments → remind control group
    } catch (error) {
      console.error("[Heartbeat 5min] Erro:", error);
    }
  });

  // ─────────────────────────────────────────────
  // 09:00 Seg-Sex: Rotina matinal
  // ─────────────────────────────────────────────
  cron.schedule(
    "0 9 * * 1-5",
    async () => {
      try {
        console.log("[Heartbeat 09:00] Rotina matinal...");
        await executeMorningRoutine(deps.supervised);

        // TODO: CRM audit — verificar registos incompletos
        // Sera implementado na fase 2.6
      } catch (error) {
        console.error("[Heartbeat 09:00] Erro:", error);
      }
    },
    { timezone: TIMEZONE }
  );

  // ─────────────────────────────────────────────
  // 18:00 Seg-Sex: Relatorio diario
  // ─────────────────────────────────────────────
  cron.schedule(
    "0 18 * * 1-5",
    async () => {
      try {
        console.log("[Heartbeat 18:00] Gerando relatorio diario...");
        await sendDailyReport(deps.gateway, deps.controlGroupJid);
      } catch (error) {
        console.error("[Heartbeat 18:00] Erro:", error);
      }
    },
    { timezone: TIMEZONE }
  );

  console.log(
    `[Heartbeat] Agendado: 5min + 09:00 rotina matinal + 18:00 relatorio (${TIMEZONE})`
  );
}
