import { loadConfig } from "./config.js";
import { GeminiClient } from "./llm/gemini-client.js";
import { DISCLAIMER } from "./llm/prompts.js";
import { parseWhatsAppZip } from "./whatsapp/parser.js";
import { classifyConversation } from "./classification/classifier.js";
import { resolveClient } from "./client/resolver.js";
import { validateNivel1 } from "./client/nivel-validator.js";
import {
  sendConsentRequest,
  processConsentResponse,
  recordConsent,
} from "./rgpd/consent-flow.js";
import { checkDeontologicalLimits } from "./rules/deontological.js";
import { createTriagemTicket } from "./tickets/ticket-factory.js";
import { escalateToHuman } from "./escalation/escalation.js";
import { extractDocument } from "./ocr/document-ocr.js";
import { startHeartbeat } from "./heartbeat/heartbeat.js";
import { VaultReader } from "./obsidian/vault-reader.js";
import { VaultWriter } from "./obsidian/vault-writer.js";

// Adapters (stubs for now)
import { StubCrmAdapter } from "./client/crm-adapter.js";
import { StubProJurisAdapter } from "./client/projuris-adapter.js";
import { StubDriveAdapter } from "./client/drive-adapter.js";
import { StubWhatsAppGateway } from "./gateway/whatsapp-gateway.js";
import { StubPaperclipAdapter } from "./tickets/paperclip-adapter.js";
import { StubCalendarAdapter } from "./calendar/calendar-adapter.js";

import type { ChamadoHumano } from "./escalation/types.js";
import type { IncomingMessage } from "./gateway/whatsapp-gateway.js";

// ─────────────────────────────────────────────
// Inicialização
// ─────────────────────────────────────────────

const config = loadConfig();
const gemini = new GeminiClient(config);
const vaultReader = new VaultReader(config.obsidianVaultPath);
const vaultWriter = new VaultWriter(config.obsidianVaultPath);

// Adapters — replace stubs with real implementations when available
const crm = new StubCrmAdapter();
const projuris = new StubProJurisAdapter();
const drive = new StubDriveAdapter();
const gateway = new StubWhatsAppGateway();
const paperclip = new StubPaperclipAdapter();
const calendar = new StubCalendarAdapter();

// Client state tracking (in-memory for now)
const consentState = new Map<string, "nao_enviado" | "enviado" | "aceite">();

// ─────────────────────────────────────────────
// Handler principal — mensagem individual
// ─────────────────────────────────────────────

export async function handleIncomingMessage(
  message: IncomingMessage
): Promise<void> {
  const { phone, text, media } = message;
  console.log(`[Sónia] ← ${phone}: ${text.substring(0, 60)}...`);

  // 1. Deontological check (BEFORE any LLM call)
  const deontoCheck = checkDeontologicalLimits(text);
  if (deontoCheck.mustEscalate) {
    console.log(`[Sónia] Escalamento deontológico: ${deontoCheck.reason}`);

    const chamado: ChamadoHumano = {
      ticket_id: `esc_${Date.now()}`,
      tipo: "escalamento_juridico",
      urgencia: "hoje",
      cliente_id: phone,
      descricao: deontoCheck.reason!,
    };
    await escalateToHuman(chamado, gateway, paperclip);

    await gateway.sendMessage(
      phone,
      `Obrigado pela sua questão. Vou encaminhar para o Dr. Eduardo que poderá dar-lhe uma resposta mais precisa.\n\n${DISCLAIMER}`
    );
    return;
  }

  // 2. Resolve client
  const resolved = await resolveClient(phone, null, { crm, projuris, drive });

  // If from ProJuris, needs human validation first
  if (resolved.pendingValidation) {
    const chamado: ChamadoHumano = {
      ticket_id: `val_${Date.now()}`,
      tipo: "validacao_migracao",
      urgencia: "hoje",
      cliente_id: resolved.clienteId,
      descricao: `Cliente importado do ProJuris — aguarda validação humana`,
    };
    await escalateToHuman(chamado, gateway, paperclip);
  }

  // 3. Check RGPD consent
  const currentConsent = consentState.get(phone) ?? "nao_enviado";

  if (currentConsent === "nao_enviado") {
    await sendConsentRequest(phone, gateway, vaultReader);
    consentState.set(phone, "enviado");
    return;
  }

  if (currentConsent === "enviado") {
    // Process consent response
    const consentResult = processConsentResponse(text);

    if (consentResult.state === "aceite") {
      consentState.set(phone, "aceite");
      await recordConsent(
        resolved.clienteId,
        phone,
        "[consentimento RGPD v1.0]",
        text,
        consentResult,
        crm,
        vaultWriter
      );
    }

    if (consentResult.responseToClient) {
      await gateway.sendMessage(phone, consentResult.responseToClient);
    }

    if (consentResult.escalateToHuman) {
      const chamado: ChamadoHumano = {
        ticket_id: `rgpd_${Date.now()}`,
        tipo: "decisao_critica",
        urgencia: "hoje",
        cliente_id: resolved.clienteId,
        descricao: `Consentimento RGPD: ${consentResult.state}`,
      };
      await escalateToHuman(chamado, gateway, paperclip);
    }
    return;
  }

  // 4. Handle media (OCR)
  if (media) {
    const extraction = await extractDocument(
      media.buffer,
      media.mimeType,
      gemini
    );

    if (!extraction.legivel) {
      await gateway.sendMessage(
        phone,
        "Não conseguimos ler o documento enviado. Pode enviar uma nova foto com melhor iluminação e sem reflexos?"
      );
      return;
    }

    // Update CRM with extracted data
    const updateData: Record<string, unknown> = {};
    for (const [campo, info] of Object.entries(extraction.campos)) {
      if (info.confianca !== "baixo") {
        updateData[campo] = info.valor;
      }
    }

    if (Object.keys(updateData).length > 0) {
      await crm.update(resolved.clienteId, updateData);
    }

    await gateway.sendMessage(
      phone,
      `Documento recebido e processado (${extraction.tipo_documento}). Obrigado!${extraction.alertas.length > 0 ? `\n\n⚠️ ${extraction.alertas.join("\n⚠️ ")}` : ""}`
    );
    return;
  }

  // 5. Check if onboarding is complete
  const validation = validateNivel1(resolved.data);
  if (!validation.complete) {
    // Continue onboarding — use Gemini for natural conversation
    const response = await gemini.generateText(
      `És a Sónia, recepcionista do escritório SD Legal.
Estás a recolher dados de um cliente. Faltam estes campos: ${validation.missing.join(", ")}.
O perfil está ${validation.percentagem}% completo.
REGRA: pede no máximo 2 dados por mensagem. Tom profissional e acolhedor. Tratamento formal.`,
      `Mensagem do cliente: "${text}"\n\nDados já recolhidos: ${JSON.stringify(resolved.data, null, 2)}`
    );

    await gateway.sendMessage(phone, response);
    return;
  }

  // 6. Nivel 1 complete — classify and create triage ticket
  // Build a minimal WhatsApp history from the current message
  const miniHistory = {
    numero_cliente: phone,
    periodo: {
      inicio: new Date().toISOString(),
      fim: new Date().toISOString(),
    },
    total_mensagens: 1,
    mensagens: [
      {
        timestamp: new Date().toISOString(),
        remetente: "cliente" as const,
        tipo: "texto" as const,
        conteudo: text,
      },
    ],
    media_files: [],
  };

  const classification = await classifyConversation(miniHistory, gemini);

  const ticket = createTriagemTicket(
    resolved.clienteId,
    classification,
    true,
    false // Nivel 2 not checked yet — Rex will handle
  );

  if (ticket) {
    await paperclip.submitTicket(ticket);
    await gateway.sendMessage(
      phone,
      `Obrigado, ${resolved.data.nome_completo ?? ""}. O vosso caso (${classification.classificacao.area}) foi registado e encaminhado para análise. Entraremos em contacto em breve.`
    );
  }
}

// ─────────────────────────────────────────────
// Handler — ZIP WhatsApp
// ─────────────────────────────────────────────

export async function handleWhatsAppZip(
  phone: string,
  zipBuffer: Buffer
): Promise<void> {
  console.log(`[Sónia] ZIP recebido de ${phone}`);

  const history = parseWhatsAppZip(zipBuffer);
  history.numero_cliente = phone;

  const classification = await classifyConversation(history, gemini);

  console.log(
    `[Sónia] Classificação: ${classification.classificacao.area} / ${classification.classificacao.urgencia}`
  );
  console.log(
    `[Sónia] Intenção: ${classification.intencao}`
  );
  console.log(
    `[Sónia] Nome: ${classification.identificacao.nome ?? "não identificado"}`
  );

  // Resolve client using identified name
  const resolved = await resolveClient(
    phone,
    classification.identificacao.nome,
    { crm, projuris, drive }
  );

  // Update CRM with extracted data
  if (classification.identificacao.dados_pessoais) {
    await crm.update(
      resolved.clienteId,
      classification.identificacao.dados_pessoais as Record<string, unknown>
    );
  }

  // Check consent state and respond accordingly
  const validation = validateNivel1(resolved.data);

  if (!validation.complete) {
    await gateway.sendMessage(
      phone,
      `Obrigado pelo histórico de conversa. Analisei as ${history.total_mensagens} mensagens.\n\nPara podermos avançar, preciso ainda de alguns dados. O vosso perfil está ${validation.percentagem}% completo.`
    );
  }

  console.log(
    `[Sónia] Dados em falta: ${validation.missing.join(", ") || "nenhum"}`
  );
}

// ─────────────────────────────────────────────
// Arranque
// ─────────────────────────────────────────────

console.log("[Sónia] SD Legal — Agente Recepcionista");
console.log(`[Sónia] LLM: Gemini 2.5 Flash via Vertex AI (${config.googleCloudLocation})`);
console.log(`[Sónia] Vault: ${config.obsidianVaultPath}`);

startHeartbeat({ gateway, crm });

console.log("[Sónia] Pronta para receber mensagens.");
