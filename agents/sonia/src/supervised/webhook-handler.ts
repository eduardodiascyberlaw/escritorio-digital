import type { SupervisedMode } from "./supervised-mode.js";
import type { GeminiClient } from "../llm/gemini-client.js";
import type { CrmAdapter } from "../client/crm-adapter.js";
import type { VaultReader } from "../obsidian/vault-reader.js";
import type { VaultWriter } from "../obsidian/vault-writer.js";
import type { PaperclipAdapter } from "../tickets/paperclip-adapter.js";
import type { EvolutionApiGateway } from "../gateway/evolution-api.js";
import { AudioTranscriber } from "../stt/audio-transcriber.js";

import { checkDeontologicalLimits } from "../rules/deontological.js";
import { DISCLAIMER, ESCALATION_RESPONSE_TEMPLATE } from "../identity/persona.js";
import { resolveClient } from "../client/resolver.js";
import { validateNivel1 } from "../client/nivel-validator.js";
import {
  sendConsentRequest,
  processConsentResponse,
  recordConsent,
} from "../rgpd/consent-flow.js";
import { classifyConversation } from "../classification/classifier.js";
import { createTriagemTicket } from "../tickets/ticket-factory.js";
import { extractDocument } from "../ocr/document-ocr.js";
import { escalateToHuman } from "../escalation/escalation.js";
import type { ChamadoHumano } from "../escalation/types.js";
import { StubProJurisAdapter } from "../client/projuris-adapter.js";
import { StubDriveAdapter } from "../client/drive-adapter.js";

// Evolution API webhook payload types
interface WebhookMessage {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message?: {
    conversation?: string;
    extendedTextMessage?: { text: string };
    imageMessage?: { mimetype: string; caption?: string };
    documentMessage?: { mimetype: string; fileName?: string };
    audioMessage?: { mimetype: string };
  };
  messageType?: string;
  pushName?: string;
}

interface WebhookPayload {
  event: string;
  instance: string;
  data: WebhookMessage;
}

export class WebhookHandler {
  private supervised: SupervisedMode;
  private gemini: GeminiClient;
  private crm: CrmAdapter;
  private vaultReader: VaultReader;
  private vaultWriter: VaultWriter;
  private paperclip: PaperclipAdapter;
  private gateway: EvolutionApiGateway;
  private transcriber: AudioTranscriber;
  private controlGroupJid: string | null = null;

  // Track consent state (in-memory; move to CRM later)
  private consentState = new Map<
    string,
    "nao_enviado" | "enviado" | "aceite"
  >();

  constructor(deps: {
    supervised: SupervisedMode;
    gemini: GeminiClient;
    crm: CrmAdapter;
    vaultReader: VaultReader;
    vaultWriter: VaultWriter;
    paperclip: PaperclipAdapter;
    gateway: EvolutionApiGateway;
    controlGroupJid: string | null;
  }) {
    this.supervised = deps.supervised;
    this.gemini = deps.gemini;
    this.crm = deps.crm;
    this.vaultReader = deps.vaultReader;
    this.vaultWriter = deps.vaultWriter;
    this.paperclip = deps.paperclip;
    this.gateway = deps.gateway;
    this.controlGroupJid = deps.controlGroupJid;
    this.transcriber = new AudioTranscriber(deps.gemini);
  }

  async handleWebhook(payload: WebhookPayload): Promise<void> {
    // Only process incoming messages
    if (payload.event !== "messages.upsert") return;
    if (payload.data.key.fromMe) return;

    const remoteJid = payload.data.key.remoteJid;
    const phone = this.jidToPhone(remoteJid);
    const pushName = payload.data.pushName ?? null;

    // Check if message is from the control group
    if (remoteJid.endsWith("@g.us")) {
      if (this.controlGroupJid && remoteJid === this.controlGroupJid) {
        const text = this.extractText(payload.data);
        if (text) {
          await this.supervised.handleControlResponse(text);
        }
      }
      // Ignore other groups
      return;
    }

    let text = this.extractText(payload.data);
    let isAudioMessage = false;

    // If no text, check for audio message
    if (!text && payload.data.message?.audioMessage) {
      const audioMsg = payload.data.message.audioMessage;
      const mimeType = audioMsg.mimetype ?? "audio/ogg";
      const messageId = payload.data.key.id;

      console.log(`[Webhook] 🎤 Áudio recebido de ${pushName ?? phone} (${mimeType})`);

      // Download audio from Evolution API
      const audioBuffer = await this.downloadMedia(messageId);
      if (audioBuffer) {
        text = await this.transcriber.transcribe(audioBuffer, mimeType);
        isAudioMessage = true;
      }

      if (!text) {
        console.log(`[Webhook] Áudio não transcrito de ${phone}`);
        return;
      }
    }

    if (!text) {
      console.log(`[Webhook] Mensagem sem conteúdo de ${phone} — ignorar`);
      return;
    }

    console.log(
      `[Webhook] ← ${pushName ?? phone}${isAudioMessage ? " 🎤" : ""}: ${text.substring(0, 60)}...`
    );

    // Process the message and generate a draft response
    try {
      const { response, context: baseContext } = await this.processMessage(
        phone,
        pushName,
        text
      );
      const context = isAudioMessage
        ? `🎤 Áudio transcrito: "${text.substring(0, 100)}${text.length > 100 ? "..." : ""}"\n${baseContext}`
        : baseContext;

      // Submit draft for human approval
      await this.supervised.submitDraft(
        phone,
        pushName,
        text,
        response,
        context
      );
    } catch (error) {
      console.error(`[Webhook] Erro ao processar mensagem:`, error);

      // Notify control group about the error
      if (this.controlGroupJid) {
        await this.gateway.sendToGroup(
          this.controlGroupJid,
          `⚠️ *ERRO* ao processar mensagem de ${pushName ?? phone}:\n${text.substring(0, 100)}...\n\nErro: ${error instanceof Error ? error.message : "desconhecido"}\n\n_Responder manualmente._`
        );
      }
    }
  }

  private async processMessage(
    phone: string,
    name: string | null,
    text: string
  ): Promise<{ response: string; context: string }> {
    // 1. Deontological check
    const deontoCheck = checkDeontologicalLimits(text);
    if (deontoCheck.mustEscalate) {
      return {
        response: ESCALATION_RESPONSE_TEMPLATE(name),
        context: `⚠️ ESCALAMENTO DEONTOLOGICO: ${deontoCheck.reason}`,
      };
    }

    // 2. Resolve client
    const resolved = await resolveClient(phone, name, {
      crm: this.crm,
      projuris: new StubProJurisAdapter(),
      drive: new StubDriveAdapter(),
    });

    // 3. Check RGPD consent
    const currentConsent =
      this.consentState.get(phone) ?? "nao_enviado";

    if (currentConsent === "nao_enviado") {
      this.consentState.set(phone, "enviado");
      const template = await this.vaultReader.readTemplate(
        "Templates/comunicacao_cliente/consentimento_rgpd_v1.0.md"
      );
      // Extract WhatsApp version
      const codeBlockMatch = template.match(
        /### Versão WhatsApp \(curta\)\s*\n```\n([\s\S]*?)\n```/
      );
      const consentText =
        codeBlockMatch?.[1] ??
        "O escritório SD Legal solicita o vosso consentimento para tratamento de dados pessoais. Para confirmar, respondam SIM.";

      return {
        response: consentText,
        context: `🔒 RGPD: Primeiro contacto — enviar consentimento`,
      };
    }

    if (currentConsent === "enviado") {
      const consentResult = processConsentResponse(text);

      if (consentResult.state === "aceite") {
        this.consentState.set(phone, "aceite");
        await recordConsent(
          resolved.clienteId,
          phone,
          "[consentimento RGPD v1.0]",
          text,
          consentResult,
          this.crm,
          this.vaultWriter
        );
      }

      return {
        response:
          consentResult.responseToClient ??
          "Obrigado pela resposta.",
        context: `🔒 RGPD: Resposta ao consentimento — ${consentResult.state}`,
      };
    }

    // 4. Check onboarding completeness
    const validation = validateNivel1(resolved.data);
    if (!validation.complete) {
      const { buildPrompt } = await import("../identity/prompt-builder.js");
      const onboardingPrompt = buildPrompt(
        `TAREFA: Estas a recolher dados de um cliente. Faltam estes campos: ${validation.missing.join(", ")}.
O perfil esta ${validation.percentagem}% completo.
REGRAS:
- Pede no maximo 2 dados por mensagem.
- Sempre trata o cliente por Sr./Sra. + primeiro nome.
- Tom profissional mas caloroso.
- Nao des pareceres juridicos.`
      );

      const response = await this.gemini.generateText(
        onboardingPrompt,
        `Nome do cliente: ${name ?? "desconhecido"}\nMensagem: "${text}"\nDados ja recolhidos: ${JSON.stringify(resolved.data, null, 2)}`
      );

      return {
        response,
        context: `📋 Onboarding: ${validation.percentagem}% completo — faltam: ${validation.missing.join(", ")}`,
      };
    }

    // 5. Classify and generate response
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

    const classification = await classifyConversation(
      miniHistory,
      this.gemini
    );

    const ticket = createTriagemTicket(
      resolved.clienteId,
      classification,
      true,
      false
    );

    if (ticket) {
      await this.paperclip.submitTicket(ticket);
    }

    const nomeCliente = name ?? "";
    const saudacao = nomeCliente ? `${nomeCliente}, o` : "O";

    return {
      response: `${saudacao} seu caso foi registado e ja estou encaminhando para analise pela equipa do escritorio. Assim que houver novidades, entro em contacto!`,
      context: `📌 Classificacao: ${classification.classificacao.area} / ${classification.classificacao.sub_tipo} / ${classification.classificacao.urgencia} — Intencao: ${classification.intencao}`,
    };
  }

  private extractText(data: WebhookMessage): string | null {
    return (
      data.message?.conversation ??
      data.message?.extendedTextMessage?.text ??
      data.message?.imageMessage?.caption ??
      null
    );
  }

  private async downloadMedia(messageId: string): Promise<Buffer | null> {
    try {
      const instance = process.env.EVOLUTION_INSTANCE ?? "sd-legal";
      const apiUrl = process.env.EVOLUTION_API_URL ?? "http://localhost:8080";
      const apiKey = process.env.EVOLUTION_API_KEY ?? "";

      // Evolution API v2: download media by message ID
      const res = await fetch(
        `${apiUrl}/chat/getBase64FromMediaMessage/${instance}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: apiKey,
          },
          body: JSON.stringify({
            message: { key: { id: messageId } },
          }),
        }
      );

      if (!res.ok) {
        console.error(`[Webhook] Download media falhou: ${res.status}`);
        return null;
      }

      const data = (await res.json()) as { base64?: string };
      if (!data.base64) return null;

      return Buffer.from(data.base64, "base64");
    } catch (error) {
      console.error("[Webhook] Erro ao descarregar media:", error);
      return null;
    }
  }

  private jidToPhone(jid: string): string {
    // "351935267262@s.whatsapp.net" → "+351935267262"
    return "+" + jid.split("@")[0];
  }
}
