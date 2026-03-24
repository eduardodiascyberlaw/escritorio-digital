import type { SupervisedMode } from "./supervised-mode.js";
import type { GeminiClient } from "../llm/gemini-client.js";
import type { CrmAdapter } from "../client/crm-adapter.js";
import type { VaultReader } from "../obsidian/vault-reader.js";
import type { VaultWriter } from "../obsidian/vault-writer.js";
import type { PaperclipAdapter } from "../tickets/paperclip-adapter.js";
import type { ZApiGateway } from "../gateway/zapi-gateway.js";
import { AudioTranscriber } from "../stt/audio-transcriber.js";

import { checkDeontologicalLimits } from "../rules/deontological.js";
import { DISCLAIMER, ESCALATION_RESPONSE_TEMPLATE } from "../identity/persona.js";
import { isOutsideHours, OUT_OF_HOURS_MESSAGE } from "../schedule/business-hours.js";
import { addOvernightMessage } from "../schedule/morning-routine.js";
import { trackEvent } from "../schedule/daily-report.js";
import { resolveClient } from "../client/resolver.js";
import { validateNivel1 } from "../client/nivel-validator.js";
// RGPD desactivado — será tratado numa fase posterior
// import { processConsentResponse, recordConsent } from "../rgpd/consent-flow.js";
// import type { RgpdCampaignStore } from "../rgpd/rgpd-campaign-store.js";
import { classifyConversation } from "../classification/classifier.js";
import { createTriagemTicket } from "../tickets/ticket-factory.js";
import { extractDocument } from "../ocr/document-ocr.js";
import { escalateToHuman } from "../escalation/escalation.js";
import type { ChamadoHumano } from "../escalation/types.js";
import { StubProJurisAdapter } from "../client/projuris-adapter.js";
import { StubDriveAdapter } from "../client/drive-adapter.js";
import { detectIntent, hasStatusIntent, type DetectedLanguage } from "../conversation/intent-detector.js";
import { CONVERSATION_PROMPT, buildConversationPromptWithServices } from "../llm/prompts.js";
import { findRelevantServices, getService, formatServicesForPrompt } from "../knowledge/service-kb.js";
import type { ConversationMemory } from "../conversation/conversation-memory.js";
import { MessageBatcher } from "../conversation/message-batcher.js";
import type { CalendarAdapter } from "../calendar/calendar-adapter.js";

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
    audioMessage?: { mimetype: string; url?: string };
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
  private gateway: ZApiGateway;
  private memory: ConversationMemory;
  private calendar: CalendarAdapter;
  private transcriber: AudioTranscriber;
  private controlGroupJid: string | null = null;
  private batcher: MessageBatcher;

  // Dedup: ignore duplicate webhook deliveries (TTL 5 min)
  private seenMessages = new Map<string, number>();
  private static DEDUP_TTL_MS = 5 * 60 * 1000;

  // RGPD campaign tracking — desactivado, será tratado numa fase posterior
  // private campaignStore: RgpdCampaignStore;

  constructor(deps: {
    supervised: SupervisedMode;
    gemini: GeminiClient;
    crm: CrmAdapter;
    vaultReader: VaultReader;
    vaultWriter: VaultWriter;
    paperclip: PaperclipAdapter;
    gateway: ZApiGateway;
    memory: ConversationMemory;
    // campaignStore: RgpdCampaignStore; — RGPD desactivado
    calendar: CalendarAdapter;
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
    // this.campaignStore = deps.campaignStore; — RGPD desactivado
    this.calendar = deps.calendar;
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

    // Deduplicate webhook deliveries
    const messageId = payload.data.key.id;
    if (this.seenMessages.has(messageId)) return;
    this.seenMessages.set(messageId, Date.now());
    this.pruneSeenMessages();

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

      // Download audio — prefer Z-API URL, fallback to messageId
      const mediaUrl = audioMsg.url;
      const audioBuffer = mediaUrl
        ? await this.gateway.downloadMediaFromUrl(mediaUrl)
        : null;
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

    // Indicador de digitacao — mostra "a escrever..." ao cliente enquanto processa
    await this.gateway.sendPresence(phone, "composing");

    // Process the batched message and generate a draft response
    try {
      const { response, context: baseContext, followUp, skipDraft } = await this.processMessage(
        phone,
        name,
        text
      );

      await this.gateway.sendPresence(phone, "paused");

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
      await this.gateway.sendPresence(phone, "paused");
      console.error(`[Webhook] Erro ao processar mensagem:`, error);

      const errorMsg = error instanceof Error ? error.message : "desconhecido";

      // Submeter rascunho fallback para aprovacao humana
      const fallback = this.getFallbackMessage(phone, name);
      await this.supervised.submitDraft(
        phone,
        name,
        text,
        fallback,
        `🔴 FALLBACK LLM — Erro: ${errorMsg}\n_Mensagem pre-escrita. Editar se necessario._`
      );
    }
  }

  /** Mensagens fallback quando o LLM falha — por lingua, com placeholder {nome} para personalizar. */
  private static FALLBACK_TEMPLATES: Record<string, string> = {
    pt: "Oi{nome}! Recebi sua mensagem sim 😊 Deixa eu verificar aqui com a equipe e ja te retorno, tudo bem?",
    en: "Hi{nome}! Got your message 😊 Let me check with the team and I'll get right back to you, okay?",
    fr: "Bonjour{nome} ! J'ai bien recu votre message 😊 Je verifie avec l'equipe et je reviens vers vous tres vite.",
    cv: "Oi{nome}! N risebi bos mensajen 😊 N ta conferí ku ekipa i N ta volta logu, tá?",
  };

  /** Retorna mensagem fallback na lingua do cliente, personalizada com nome. */
  private getFallbackMessage(phone: string, clientName: string | null): string {
    const lang = this.memory.getLanguage(phone) ?? "pt";
    const template = WebhookHandler.FALLBACK_TEMPLATES[lang] ?? WebhookHandler.FALLBACK_TEMPLATES.pt;
    const nome = clientName ? `, ${clientName.split(" ")[0]}` : "";
    return template.replace("{nome}", nome);
  }

  private static LANGUAGE_NAMES: Record<string, string> = {
    pt: "português",
    en: "inglês",
    fr: "francês",
    cv: "crioulo cabo-verdiano",
  };

  /** Constroi instrucao de lingua para injectar no prompt do Gemini. */
  private buildLanguageInstruction(phone: string): string {
    const lang = this.memory.getLanguage(phone);
    if (!lang || lang === "pt") return "";
    const name = WebhookHandler.LANGUAGE_NAMES[lang] ?? lang;
    return `\n\nIDIOMA DO CLIENTE: O cliente comunica em ${name}. Responde SEMPRE em ${name}.`;
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

    // 3. RGPD campaign detection — desactivado, será tratado numa fase posterior

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

      const onboardingLangInstruction = this.buildLanguageInstruction(phone);
      const response = await this.gemini.generateText(
        onboardingPrompt,
        `Nome do cliente: ${name ?? "desconhecido"}\nMensagem: "${text}"\nDados ja recolhidos: ${JSON.stringify(resolved.data, null, 2)}${historyContext}${onboardingLangInstruction}`
      );

      return {
        response,
        context: `📋 Onboarding: ${validation.percentagem}% completo — faltam: ${validation.missing.join(", ")}`,
      };
    }

    // 5. Detect intent — conversa ou triagem?
    const intent = await detectIntent(text, name, this.gemini);

    // Registar lingua detectada (se presente)
    if (intent.language) {
      this.memory.setLanguage(phone, intent.language);
    }
    const langInstruction = this.buildLanguageInstruction(phone);

    // 5a. Conversa — responder naturalmente, sem criar ticket
    if (intent.category === "conversa") {
      // Detectar saudacao que tambem pede novidades/status
      const wantsStatus = intent.intent === "saudacao" && hasStatusIntent(text);

      if (wantsStatus || intent.intent === "status_processo") {
        // Auto-enviar acknowledgment directo ao cliente (sem aprovacao)
        const ackResponse = await this.gemini.generateText(
          CONVERSATION_PROMPT,
          `Nome do cliente: ${name ?? "desconhecido"}\nTelefone: ${phone}\nMensagem: "${text}"${historyContext}${langInstruction}\n\nINSTRUCAO ESPECIAL: O cliente quer saber novidades. Responde com um cumprimento caloroso e diz que vais verificar o estado do processo. NAO inventes informacao — diz apenas que vais consultar e que voltas ja.`
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
            `Nome do cliente: ${name ?? "desconhecido"}\nTelefone: ${phone}\nMensagem original: "${text}"\n\nINFORMACAO DO CRM (apresentar de forma acessivel, sem jargao — nunca mostrar IDs nem dados internos):\n${info}\n\nINSTRUCAO ESPECIAL: Ja cumprimentaste o cliente na mensagem anterior e disseste que ias verificar. Agora apresenta as novidades do processo de forma clara e acessivel. Nao repitas o cumprimento.${historyContext}${langInstruction}`
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
      // Detectar servicos relevantes pelo texto do cliente
      const relevantServices = findRelevantServices(text);
      const conversaPrompt = buildConversationPromptWithServices(relevantServices);

      const response = await this.gemini.generateText(
        conversaPrompt,
        `Nome do cliente: ${name ?? "desconhecido"}\nTelefone: ${phone}\nMensagem: "${text}"${historyContext}${langInstruction}`
      );

      const serviceNames = relevantServices.map((s) => s.codigo).join(", ");
      return {
        response,
        context: `💬 Conversa (${intent.intent})${serviceNames ? ` — servicos detectados: ${serviceNames}` : ""} — sem triagem`,
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

    // Buscar info detalhada do servico classificado
    const classifiedService = getService(classification.classificacao.sub_tipo);
    const triagemServices = classifiedService ? [classifiedService] : findRelevantServices(text);
    const triagemPrompt = buildConversationPromptWithServices(triagemServices);

    // Gerar resposta conversacional (mesmo na triagem, ser humana)
    const response = await this.gemini.generateText(
      triagemPrompt,
      `Nome do cliente: ${name ?? "desconhecido"}\nTelefone: ${phone}\nMensagem: "${text}"\n\nCONTEXTO INTERNO (nao mencionar ao cliente): O caso foi registado como ${classification.classificacao.area} / ${classification.classificacao.sub_tipo}. A equipa vai analisar.${historyContext}${langInstruction}`
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

  private jidToPhone(jid: string): string {
    // "351935267262@s.whatsapp.net" → "+351935267262"
    return "+" + jid.split("@")[0];
  }

  /** Remove entradas de dedup com mais de 5 minutos. */
  private pruneSeenMessages(): void {
    if (this.seenMessages.size < 100) return;
    const cutoff = Date.now() - WebhookHandler.DEDUP_TTL_MS;
    for (const [id, ts] of this.seenMessages) {
      if (ts < cutoff) this.seenMessages.delete(id);
    }
  }
}
