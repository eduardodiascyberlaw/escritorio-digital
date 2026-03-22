import type { WhatsAppGateway } from "../gateway/whatsapp-gateway.js";
import type { VaultReader } from "../obsidian/vault-reader.js";
import type { VaultWriter } from "../obsidian/vault-writer.js";
import type { CrmAdapter } from "../client/crm-adapter.js";
import { createConsentAuditRecord } from "./consent-audit.js";
import type { RgpdConsentimento } from "@sd-legal/shared";

export type ConsentState =
  | "nao_enviado"
  | "enviado"
  | "aceite"
  | "recusa_parcial"
  | "recusado";

export interface ConsentResult {
  state: ConsentState;
  rgpd?: Partial<RgpdConsentimento>;
  escalateToHuman: boolean;
  responseToClient?: string;
}

const CONSENT_TEMPLATE_PATH =
  "Templates/comunicacao_cliente/consentimento_rgpd_v1.0.md";

export async function sendConsentRequest(
  phone: string,
  gateway: WhatsAppGateway,
  vaultReader: VaultReader
): Promise<void> {
  const template = await vaultReader.readTemplate(CONSENT_TEMPLATE_PATH);

  // Extract WhatsApp version from template (between first pair of ```)
  const codeBlockMatch = template.match(
    /### Versão WhatsApp \(curta\)\s*\n```\n([\s\S]*?)\n```/
  );
  const consentText =
    codeBlockMatch?.[1] ??
    `O escritório SD Legal solicita o vosso consentimento para:

✅ Tratamento dos vossos dados pessoais para prestação de serviços jurídicos
✅ Partilha com tribunais e entidades administrativas quando necessário
✅ Conservação dos dados durante o período legal obrigatório após conclusão do processo

Opcional:
☐ Recepção de informações sobre serviços e novidades do escritório

Para confirmar, respondam SIM.
Para recusar qualquer ponto, indiquem qual.`;

  await gateway.sendMessage(phone, consentText);
}

export function processConsentResponse(response: string): ConsentResult {
  const normalized = response.trim().toUpperCase();

  if (normalized === "SIM" || normalized === "YES" || normalized === "ACEITO") {
    return {
      state: "aceite",
      rgpd: {
        consentimento_dados_pessoais: true,
        consentimento_partilha_tribunais: true,
        consentimento_retencao_pos_processo: true,
        consentimento_comunicacoes: false,
        canal_consentimento: "whatsapp",
        versao_texto_consentimento: "v1.0",
      },
      escalateToHuman: false,
      responseToClient:
        "Obrigado. O vosso consentimento ficou registado. Vamos avançar com o vosso caso.",
    };
  }

  if (normalized === "NÃO" || normalized === "NAO" || normalized === "NO") {
    return {
      state: "recusado",
      escalateToHuman: true,
      responseToClient:
        "Compreendemos. Sem o vosso consentimento não nos é possível prestar serviços jurídicos. Se mudarem de ideias, estamos disponíveis.",
    };
  }

  // Partial refusal or unclear response — needs human review
  return {
    state: "recusa_parcial",
    escalateToHuman: true,
    responseToClient:
      "Obrigado pela resposta. Vamos analisar os pontos que indicou e o Dr. Eduardo vai contactá-lo(a) para esclarecer.",
  };
}

export async function recordConsent(
  clienteId: string,
  phone: string,
  messageSent: string,
  clientResponse: string,
  result: ConsentResult,
  crm: CrmAdapter,
  vaultWriter: VaultWriter
): Promise<void> {
  const timestamp = new Date().toISOString();

  // Create immutable audit record
  const audit = createConsentAuditRecord(
    clienteId,
    messageSent,
    clientResponse,
    timestamp
  );

  // Write to Obsidian /Audit/consentimentos_rgpd/
  const filename = `${clienteId}_${timestamp.replace(/[:.]/g, "-")}.md`;
  await vaultWriter.appendAudit(
    "consentimentos_rgpd",
    filename,
    audit.markdownContent
  );

  // Update CRM if consent was given
  if (result.rgpd) {
    await crm.update(clienteId, {
      rgpd: {
        ...result.rgpd,
        data_consentimento: timestamp,
        hash_sha256: audit.hash,
      } as RgpdConsentimento,
    });
  }
}
