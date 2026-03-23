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
import { isOutsideHours, OUT_OF_HOURS_MESSAGE } from "../schedule/business-hours.js";
import { addOvernightMessage } from "../schedule/morning-routine.js";
import { trackEvent } from "../schedule/daily-report.js";
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
import { detectIntent, hasStatusIntent } from "../conversation/intent-detector.js";
import { CONVERSATION_PROMPT } from "../llm/prompts.js";
import type { ConversationMemory } from "../conversation/conversation-memory.js";
import { MessageBatcher } from "../conversation/message-batcher.js";

// Evolution API webhook payload types
interface WebhookMessage {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
    participant?: string; // sender JID in group messages
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
  private memory: ConversationMemory;
  private transcriber: AudioTranscriber;
  private controlGroupJid: string | null = null;
  private batcher: MessageBatcher;

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
    memory: ConversationMemory;
    controlGroupJid: string | null;
  }) {
    this.supervised = deps.supervised;
    this.gemini = deps.gemini;
    this.crm = deps.crm;
    this.vaultReader = deps.vaultReader;
    this.vaultWriter = deps.vaultWriter;
    this.paperclip = deps.paperclip;
    this.gateway = deps.gateway;
    this.memory = deps.memory;
    this.controlGroupJid = deps.controlGroupJid;
    this.transcriber = new AudioTranscriber(deps.gemini);
    this.batcher = new MessageBatcher(30_000, (phone, name, text, hasAudio) =>
      this.processBatch(phone, name, text, hasAudio)
    );
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
          const senderPhone = payload.data.key.participant
            ? this.jidToPhone(payload.data.key.participant)
            : undefined;
          await this.supervised.handleControlResponse(text, senderPhone);
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

    // Track message received
    trackEvent({
      timestamp: new Date().toISOString(),
      clientPhone: phone,
      clientName: pushName,
      type: "message_received",
      detail: text.substring(0, 80),
    });

    // Store incoming message in conversation memory (each msg individually)
    this.memory.add(phone, "in", text);

    // Add to batcher — will be processed after 30s of inactivity
    this.batcher.add(phone, pushName, text, isAudioMessage);
  }

  /**
   * Chamado pelo batcher quando a janela de 30s expira.
   * Recebe o texto concatenado de todas as mensagens do cliente.
   */
  private async processBatch(
    phone: string,
    name: string | null,
    text: string,
    hasAudio: boolean
  ): Promise<void> {
    // Check business hours — outside hours, queue for morning routine
    if (isOutsideHours()) {
      addOvernightMessage({
        phone,
        name,
        text,
        receivedAt: new Date().toISOString(),
      });

      await this.supervised.submitDraft(
        phone,
        name,
        text,
        OUT_OF_HOURS_MESSAGE,
        "🌙 Fora do horario de trabalho — resposta automatica"
      );
      return;
    }

    // Process the batched message and generate a draft response
    try {
      const { response, context: baseContext, followUp, skipDraft } = await this.processMessage(
        phone,
        name,
        text
      );

      // Some flows handle sending directly (e.g. ack auto-sent + orientation requested)
      if (skipDraft) return;

      const context = hasAudio
        ? `🎤 Áudio transcrito: "${text.substring(0, 100)}${text.length > 100 ? "..." : ""}"\n${baseContext}`
        : baseContext;

      // Submit draft for human approval
      await this.supervised.submitDraft(
        phone,
        name,
        text,
        response,
        context
      );

      // Submit follow-up draft if present (e.g. status after greeting)
      if (followUp) {
        await this.supervised.submitDraft(
          phone,
          name,
          text,
          followUp.response,
          followUp.context
        );
      }
    } catch (error) {
      console.error(`[Webhook] Erro ao processar mensagem:`, error);

      // Notify control group about the error
      if (this.controlGroupJid) {
        await this.gateway.sendToGroup(
          this.controlGroupJid,
          `⚠️ *ERRO* ao processar mensagem de ${name ?? phone}:\n${text.substring(0, 100)}...\n\nErro: ${error instanceof Error ? error.message : "desconhecido"}\n\n_Responder manualmente._`
        );
      }
    }
  }

  private async processMessage(
    phone: string,
    name: string | null,
    text: string
  ): Promise<{ response: string; context: string; followUp?: { response: string; context: string }; skipDraft?: boolean }> {
    // Build conversation history context (excludes current message, already stored)
    const historyContext = this.memory.format(phone, name);

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
        `Nome do cliente: ${name ?? "desconhecido"}\nMensagem: "${text}"\nDados ja recolhidos: ${JSON.stringify(resolved.data, null, 2)}${historyContext}`
      );

      return {
        response,
        context: `📋 Onboarding: ${validation.percentagem}% completo — faltam: ${validation.missing.join(", ")}`,
      };
    }

    // 5. Detect intent — conversa ou triagem?
    const intent = await detectIntent(text, name, this.gemini);

    // 5a. Conversa — responder naturalmente, sem criar ticket
    if (intent.category === "conversa") {
      // Detectar saudacao que tambem pede novidades/status
      const wantsStatus = intent.intent === "saudacao" && hasStatusIntent(text);

      if (wantsStatus || intent.intent === "status_processo") {
        // Auto-enviar acknowledgment directo ao cliente (sem aprovacao)
        const ackResponse = await this.gemini.generateText(
          CONVERSATION_PROMPT,
          `Nome do cliente: ${name ?? "desconhecido"}\nTelefone: ${phone}\nMensagem: "${text}"${historyContext}\n\nINSTRUCAO ESPECIAL: O cliente quer saber novidades. Responde com um cumprimento caloroso e diz que vais verificar o estado do processo. NAO inventes informacao — diz apenas que vais consultar e que voltas ja.`
        );

        await this.gateway.sendMessage(phone, ackResponse);
        this.memory.add(phone, "out", ackResponse);
        console.log(`[Webhook] ↑ Ack auto-enviado a ${name ?? phone}: "${ackResponse.substring(0, 60)}..."`);

        // Notificar grupo de controlo que o ack foi enviado
        if (this.controlGroupJid) {
          await this.gateway.sendToGroup(
            this.controlGroupJid,
            `⚡ *ACK AUTO-ENVIADO* a ${name ?? phone}:\n"${ackResponse.substring(0, 200)}${ackResponse.length > 200 ? "..." : ""}"`
          );
        }

        // Consultar CRM para follow-up
        const processos = await this.crm.getClientProcesses(resolved.clienteId);

        if (processos.length > 0) {
          const info = processos
            .map((p) => {
              const parts = [`Processo: ${p.referencia ?? p.id}`, `Area: ${p.area}`, `Estado: ${p.estado}`];
              if (p.ultimo_andamento) parts.push(`Ultimo andamento: ${p.ultimo_andamento}`);
              if (p.data_ultimo_andamento) parts.push(`Data: ${new Date(p.data_ultimo_andamento).toLocaleDateString("pt-PT")}`);
              if (p.advogado_responsavel) parts.push(`Advogado: ${p.advogado_responsavel}`);
              if (p.proxima_accao) parts.push(`Proxima accao: ${p.proxima_accao}`);
              return parts.join(" | ");
            })
            .join("\n");

          const followUpResponse = await this.gemini.generateText(
            CONVERSATION_PROMPT,
            `Nome do cliente: ${name ?? "desconhecido"}\nTelefone: ${phone}\nMensagem original: "${text}"\n\nINFORMACAO DO CRM (apresentar de forma acessivel, sem jargao — nunca mostrar IDs nem dados internos):\n${info}\n\nINSTRUCAO ESPECIAL: Ja cumprimentaste o cliente na mensagem anterior e disseste que ias verificar. Agora apresenta as novidades do processo de forma clara e acessivel. Nao repitas o cumprimento.${historyContext}`
          );

          return {
            response: followUpResponse,
            context: `📂 Follow-up status — ${processos.length} processo(s) encontrado(s)`,
          };
        }

        // Sem processos no CRM — pedir orientacao ao superior
        if (this.controlGroupJid) {
          await this.gateway.sendToGroup(
            this.controlGroupJid,
            `⚠️ *ORIENTAÇÃO NECESSÁRIA*\n━━━━━━━━━━━━━━━━━━━━\n*Cliente:* ${name ?? "Desconhecido"} (${phone})\n*Mensagem:* "${text}"\n━━━━━━━━━━━━━━━━━━━━\nNão encontrei processos no CRM para este cliente.\nJá enviei um ack a dizer que vou verificar.\n\n*Dr. Eduardo, como devo responder?*`
          );
        }
        console.log(`[Webhook] ⚠️ Sem processos no CRM para ${name ?? phone} — pedido orientação ao superior`);

        // Não submeter rascunho — aguardar instrução do superior
        return {
          response: "",
          context: `📂 Status processo — sem processos, orientação pedida ao superior`,
          skipDraft: true,
        };
      }

      // Conversa normal (saudacao, agradecimento, conversa_geral)
      const response = await this.gemini.generateText(
        CONVERSATION_PROMPT,
        `Nome do cliente: ${name ?? "desconhecido"}\nTelefone: ${phone}\nMensagem: "${text}"${historyContext}`
      );

      return {
        response,
        context: `💬 Conversa (${intent.intent}) — sem triagem`,
      };
    }

    // 5b. Triagem — classificar e criar ticket para o Rex
    const priorMessages = this.memory.toWhatsAppMessages(phone);
    const allMessages = priorMessages.length > 0
      ? priorMessages
      : [{ timestamp: new Date().toISOString(), remetente: "cliente" as const, tipo: "texto" as const, conteudo: text }];
    const miniHistory = {
      numero_cliente: phone,
      periodo: {
        inicio: allMessages[0].timestamp,
        fim: allMessages[allMessages.length - 1].timestamp,
      },
      total_mensagens: allMessages.length,
      mensagens: allMessages,
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

    // Gerar resposta conversacional (mesmo na triagem, ser humana)
    const response = await this.gemini.generateText(
      CONVERSATION_PROMPT,
      `Nome do cliente: ${name ?? "desconhecido"}\nTelefone: ${phone}\nMensagem: "${text}"\n\nCONTEXTO INTERNO (nao mencionar ao cliente): O caso foi registado como ${classification.classificacao.area} / ${classification.classificacao.sub_tipo}. A equipa vai analisar.${historyContext}`
    );

    return {
      response,
      context: `📌 Triagem: ${classification.classificacao.area} / ${classification.classificacao.sub_tipo} / ${classification.classificacao.urgencia} — Intencao: ${classification.intencao}`,
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
