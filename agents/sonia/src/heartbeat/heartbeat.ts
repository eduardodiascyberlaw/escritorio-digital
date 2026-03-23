import cron from "node-cron";
import type { CrmAdapter } from "../client/crm-adapter.js";
import type { SupervisedMode } from "../supervised/supervised-mode.js";
import type { EvolutionApiGateway } from "../gateway/evolution-api.js";
import type { VaultReader } from "../obsidian/vault-reader.js";
import type { RgpdCampaignStore } from "../rgpd/rgpd-campaign-store.js";
import { TIMEZONE } from "../schedule/business-hours.js";
import { executeMorningRoutine } from "../schedule/morning-routine.js";
import { sendDailyReport } from "../schedule/daily-report.js";
import { executeCrmAudit } from "../schedule/crm-audit.js";
import { executeRgpdRegularization } from "../rgpd/rgpd-regularization.js";

export interface HeartbeatDeps {
  gateway: EvolutionApiGateway;
  crm: CrmAdapter;
  supervised: SupervisedMode;
  vaultReader: VaultReader;
  campaignStore: RgpdCampaignStore;
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

        console.log("[Heartbeat 09:00] Auditoria CRM...");
        await executeCrmAudit(deps.crm, deps.gateway, deps.controlGroupJid);
      } catch (error) {
        console.error("[Heartbeat 09:00] Erro:", error);
      }
    },
    { timezone: TIMEZONE }
  );

  // ─────────────────────────────────────────────
  // 10:00 Seg-Sex: Campanha regularizacao RGPD
  // ─────────────────────────────────────────────
  cron.schedule(
    "0 10 * * 1-5",
    async () => {
      try {
        console.log("[Heartbeat 10:00] Regularizacao RGPD...");
        await executeRgpdRegularization({
          crm: deps.crm,
          gateway: deps.gateway,
          vaultReader: deps.vaultReader,
          campaignStore: deps.campaignStore,
          controlGroupJid: deps.controlGroupJid,
        });
      } catch (error) {
        console.error("[Heartbeat 10:00] Erro:", error);
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
    `[Heartbeat] Agendado: 5min + 09:00 rotina + 10:00 RGPD + 18:00 relatorio (${TIMEZONE})`
  );
}
