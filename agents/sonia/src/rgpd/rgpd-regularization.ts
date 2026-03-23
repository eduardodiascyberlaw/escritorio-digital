/**
 * Campanha diaria de regularizacao RGPD.
 *
 * Corre as 10:00 seg-sex. Varre o CRM por clientes sem consentimento,
 * selecciona ate 10 por dia, e envia mensagem personalizada.
 * Respostas sao detectadas pelo webhook-handler e auto-registadas.
 */

import type { CrmAdapter } from "../client/crm-adapter.js";
import type { EvolutionApiGateway } from "../gateway/evolution-api.js";
import type { VaultReader } from "../obsidian/vault-reader.js";
import type { RgpdCampaignStore } from "./rgpd-campaign-store.js";

const DAILY_LIMIT = 10;

const CONSENT_TEMPLATE_PATH =
  "Templates/comunicacao_cliente/consentimento_rgpd_v1.0.md";

export interface RgpdRegularizationDeps {
  crm: CrmAdapter;
  gateway: EvolutionApiGateway;
  vaultReader: VaultReader;
  campaignStore: RgpdCampaignStore;
  controlGroupJid: string | null;
}

export async function executeRgpdRegularization(
  deps: RgpdRegularizationDeps
): Promise<number> {
  const { crm, gateway, vaultReader, campaignStore, controlGroupJid } = deps;

  // 1. Buscar clientes incompletos no CRM
  const incomplete = await crm.listIncompleteClients();

  // 2. Filtrar: sem RGPD e com telefone
  const missingRgpd = incomplete
    .filter((c) => c.camposEmFalta.includes("rgpd") && c.telefone)
    .map((c) => ({ phone: c.telefone!, nome: c.nome }));

  if (missingRgpd.length === 0) {
    console.log("[RGPD Regularizacao] Todos os clientes tem consentimento.");
    return 0;
  }

  // 3. Filtrar elegiveis (nao ja resolvidos, respeitar 48h entre tentativas)
  const eligible = campaignStore.filterEligible(missingRgpd, DAILY_LIMIT);

  if (eligible.length === 0) {
    console.log(
      "[RGPD Regularizacao] Sem clientes elegiveis hoje (todos pendentes de resposta ou resolvidos)."
    );
    return 0;
  }

  // 4. Carregar texto de consentimento do Obsidian
  const template = await vaultReader.readTemplate(CONSENT_TEMPLATE_PATH);
  const codeBlockMatch = template.match(
    /### Versão WhatsApp \(curta\)\s*\n```\n([\s\S]*?)\n```/
  );
  const consentBlock =
    codeBlockMatch?.[1] ??
    "O escritorio SD Legal solicita o vosso consentimento para tratamento de dados pessoais. Para confirmar, respondam SIM.";

  // 5. Enviar mensagens
  let sent = 0;
  for (const client of eligible) {
    try {
      const message = `Ola ${client.nome}! Aqui e a Sonia, do escritorio SD Legal.\n\nEstamos a actualizar os nossos registos para cumprir o Regulamento Geral de Proteccao de Dados (RGPD) e precisamos do vosso consentimento:\n\n${consentBlock}`;

      await gateway.sendMessage(client.phone, message);

      const existing = campaignStore.get(client.phone);
      await campaignStore.set(client.phone, {
        nome: client.nome,
        tentativas: (existing?.tentativas ?? 0) + 1,
        ultimaTentativa: new Date().toISOString(),
        estado: "enviado",
      });

      sent++;
      console.log(
        `[RGPD Regularizacao] Enviado a ${client.nome} (${client.phone}) — tentativa ${(existing?.tentativas ?? 0) + 1}`
      );
    } catch (err) {
      console.error(
        `[RGPD Regularizacao] Erro ao enviar a ${client.nome} (${client.phone}):`,
        err
      );
    }
  }

  // 6. Notificar grupo de controlo
  if (controlGroupJid && sent > 0) {
    const pendingTotal = missingRgpd.length;
    await gateway.sendToGroup(
      controlGroupJid,
      `🔒 *REGULARIZACAO RGPD*\n━━━━━━━━━━━━━━━━━━━━\nEnviadas ${sent} mensagens de consentimento.\n${pendingTotal} clientes ainda sem RGPD no total.\n━━━━━━━━━━━━━━━━━━━━\n_Respostas serao auto-registadas. Recusas escalam para humano._`
    );
  }

  return sent;
}
