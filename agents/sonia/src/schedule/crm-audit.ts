/**
 * Auditoria diaria do CRM — rotina das 09:00
 *
 * Verifica registos de clientes com campos incompletos no Nivel 1
 * e envia relatorio ao grupo de controlo para accao humana.
 */

import type { CrmAdapter, IncompleteClient } from "../client/crm-adapter.js";
import type { ZApiGateway } from "../gateway/zapi-gateway.js";

/**
 * Executa a auditoria de registos incompletos no CRM.
 * Retorna o numero de clientes com dados em falta.
 */
export async function executeCrmAudit(
  crm: CrmAdapter,
  gateway: ZApiGateway,
  controlGroupJid: string | null
): Promise<number> {
  const incomplete = await crm.listIncompleteClients();

  if (incomplete.length === 0) {
    console.log("[CRM Audit] Todos os registos estao completos.");
    return 0;
  }

  console.log(
    `[CRM Audit] ${incomplete.length} registo(s) incompleto(s) encontrado(s).`
  );

  const message = formatAuditMessage(incomplete);

  if (controlGroupJid) {
    await gateway.sendToGroup(controlGroupJid, message);
  } else {
    console.log(`[CRM Audit] Relatorio (sem grupo):\n${message}`);
  }

  return incomplete.length;
}

function formatAuditMessage(clients: IncompleteClient[]): string {
  const lines = clients.map((c, idx) => {
    const tel = c.telefone ? ` (${c.telefone})` : "";
    const campos = c.camposEmFalta.join(", ");
    return `${idx + 1}. *${c.nome}*${tel} — ${c.percentagem}%\n   Faltam: ${campos}`;
  });

  return `📋 *AUDITORIA CRM — ${new Date().toLocaleDateString("pt-PT")}*
━━━━━━━━━━━━━━━━━━━━
${clients.length} registo(s) com dados incompletos:

${lines.join("\n\n")}
━━━━━━━━━━━━━━━━━━━━
_Completar os dados em falta para que a SonIA possa avancar com a triagem._`;
}
