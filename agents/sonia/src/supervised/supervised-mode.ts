import type { ZApiGateway } from "../gateway/zapi-gateway.js";
import type { ElevenLabsTts } from "../tts/elevenlabs-tts.js";
import type { VaultWriter } from "../obsidian/vault-writer.js";
import {
  loadSuperiors,
  identifySuperior,
  type AuthorizedSuperior,
} from "../hierarchy/superiors.js";
import {
  handleInstruction,
  handleClearInstructions,
  formatActiveInstructions,
} from "../hierarchy/instruction-handler.js";
import type { ConversationMemory } from "../conversation/conversation-memory.js";

export interface PendingDraft {
  id: string;
  clientPhone: string;
  clientName: string | null;
  clientMessage: string;
  proposedResponse: string;
  timestamp: string;
  context: string; // classificação, estado, etc.
}

export class SupervisedMode {
  private pendingDrafts = new Map<string, PendingDraft>();
  private gateway: ZApiGateway;
  private tts: ElevenLabsTts | null;
  private controlGroupJid: string | null = null;
  private controlGroupName: string;
  private vaultWriter: VaultWriter | null;
  private memory: ConversationMemory | null;
  private superiors: AuthorizedSuperior[];

  constructor(
    gateway: ZApiGateway,
    controlGroupName: string = "SD Legal",
    tts: ElevenLabsTts | null = null,
    vaultWriter: VaultWriter | null = null,
    memory: ConversationMemory | null = null
  ) {
    this.gateway = gateway;
    this.controlGroupName = controlGroupName;
    this.tts = tts;
    this.vaultWriter = vaultWriter;
    this.memory = memory;
    this.superiors = loadSuperiors();
  }

  async initialize(): Promise<void> {
    this.controlGroupJid = await this.gateway.getGroupId(
      this.controlGroupName
    );

    if (this.controlGroupJid) {
      console.log(
        `[Supervisionado] Grupo "${this.controlGroupName}" encontrado: ${this.controlGroupJid}`
      );
    } else {
      console.warn(
        `[Supervisionado] Grupo "${this.controlGroupName}" NÃO encontrado. As respostas serão apenas registadas em log.`
      );
    }
  }

  async submitDraft(
    clientPhone: string,
    clientName: string | null,
    clientMessage: string,
    proposedResponse: string,
    context: string
  ): Promise<string> {
    const id = `d${Date.now().toString(36)}`;
    const draft: PendingDraft = {
      id,
      clientPhone,
      clientName,
      clientMessage,
      proposedResponse,
      timestamp: new Date().toISOString(),
      context,
    };

    this.pendingDrafts.set(id, draft);

    const controlMessage = this.formatDraftMessage(draft);

    if (this.controlGroupJid) {
      await this.gateway.sendToGroup(this.controlGroupJid, controlMessage);
    } else {
      console.log(`[Supervisionado] RASCUNHO (sem grupo):\n${controlMessage}`);
    }

    console.log(
      `[Supervisionado] Rascunho ${id} criado para ${clientPhone}`
    );

    return id;
  }

  async handleControlResponse(
    responseText: string,
    senderPhone?: string
  ): Promise<{ action: string; draftId?: string }> {
    const text = responseText.trim();

    // ─── Hierarchy commands (require sender identification) ───

    // INSTRUCAO: [texto] — add instruction from superior
    const instrucaoMatch = text.match(/^INSTRUC[AÃ]O:?\s+([\s\S]+)/i);
    if (instrucaoMatch) {
      return this.handleInstrucaoCommand(instrucaoMatch[1].trim(), senderPhone);
    }

    // LIMPAR INSTRUCOES — clear all active instructions
    if (/^LIMPAR\s+INSTRUC[OÕ]ES$/i.test(text)) {
      return this.handleLimparCommand(senderPhone);
    }

    // INSTRUCOES — list active instructions
    if (/^INSTRUC[OÕ]ES$/i.test(text)) {
      const formatted = formatActiveInstructions();
      if (this.controlGroupJid) {
        await this.gateway.sendToGroup(this.controlGroupJid, formatted);
      }
      return { action: "listed" };
    }

    // ─── Draft commands ───

    // ENVIAR [id] — approve and send as-is
    const enviarMatch = text.match(/^ENVIAR\s+(\S+)/i);
    if (enviarMatch) {
      const draftId = enviarMatch[1];
      return this.approveDraft(draftId);
    }

    // ENVIAR (without id) — approve most recent
    if (/^ENVIAR$/i.test(text)) {
      const lastDraft = this.getMostRecentDraft();
      if (lastDraft) {
        return this.approveDraft(lastDraft.id);
      }
      return { action: "unknown" };
    }

    // EDITAR [id] [new text] — edit and send
    const editarMatch = text.match(/^EDITAR\s+(\S+)\s+([\s\S]+)/i);
    if (editarMatch) {
      const draftId = editarMatch[1];
      const newText = editarMatch[2].trim();
      return this.editAndSendDraft(draftId, newText);
    }

    // EDITAR [new text] (without id) — edit most recent
    const editarSimpleMatch = text.match(/^EDITAR\s+([\s\S]+)/i);
    if (editarSimpleMatch) {
      const lastDraft = this.getMostRecentDraft();
      if (lastDraft) {
        const newText = editarSimpleMatch[1].trim();
        return this.editAndSendDraft(lastDraft.id, newText);
      }
      return { action: "unknown" };
    }

    // AUDIO [id] — approve and send as text + audio
    const audioMatch = text.match(/^AUDIO\s*(\S*)/i);
    if (audioMatch) {
      const draftId = audioMatch[1] || this.getMostRecentDraft()?.id;
      if (draftId) {
        return this.approveDraftWithAudio(draftId);
      }
      return { action: "unknown" };
    }

    // IGNORAR [id] — discard draft
    const ignorarMatch = text.match(/^IGNORAR\s*(\S*)/i);
    if (ignorarMatch) {
      const draftId = ignorarMatch[1] || this.getMostRecentDraft()?.id;
      if (draftId) {
        this.pendingDrafts.delete(draftId);
        console.log(`[Supervisionado] Rascunho ${draftId} ignorado`);
        return { action: "ignored", draftId };
      }
      return { action: "unknown" };
    }

    return { action: "unknown" };
  }

  private async handleInstrucaoCommand(
    texto: string,
    senderPhone?: string
  ): Promise<{ action: string }> {
    if (!senderPhone) {
      console.warn("[Supervisionado] INSTRUCAO recebida sem sender — ignorar");
      return { action: "unauthorized" };
    }

    const superior = identifySuperior(senderPhone, this.superiors);
    if (!superior) {
      console.warn(
        `[Supervisionado] INSTRUCAO de numero nao autorizado: ${senderPhone}`
      );
      if (this.controlGroupJid) {
        await this.gateway.sendToGroup(
          this.controlGroupJid,
          `⚠️ Instrucao ignorada — numero ${senderPhone} nao reconhecido como superior autorizado.`
        );
      }
      return { action: "unauthorized" };
    }

    if (!this.vaultWriter) {
      console.warn("[Supervisionado] VaultWriter nao disponivel — instrucao nao auditada");
      return { action: "error" };
    }

    const result = await handleInstruction(texto, superior, this.vaultWriter);
    if (result.accepted && this.controlGroupJid) {
      await this.gateway.sendToGroup(
        this.controlGroupJid,
        `✅ Instrucao *${result.id}* de ${superior.referencia} registada e activa.\n\n_"${texto}"_`
      );
    }

    return { action: result.accepted ? "instruction_added" : "error" };
  }

  private async handleLimparCommand(
    senderPhone?: string
  ): Promise<{ action: string }> {
    if (!senderPhone) {
      return { action: "unauthorized" };
    }

    const superior = identifySuperior(senderPhone, this.superiors);
    if (!superior) {
      if (this.controlGroupJid) {
        await this.gateway.sendToGroup(
          this.controlGroupJid,
          `⚠️ Comando ignorado — numero nao reconhecido como superior autorizado.`
        );
      }
      return { action: "unauthorized" };
    }

    if (!this.vaultWriter) {
      return { action: "error" };
    }

    const result = await handleClearInstructions(superior, this.vaultWriter);
    if (result.accepted && this.controlGroupJid) {
      await this.gateway.sendToGroup(
        this.controlGroupJid,
        `🗑️ ${result.count} instrucoes removidas por ${superior.referencia}.`
      );
    } else if (!result.accepted && this.controlGroupJid) {
      await this.gateway.sendToGroup(
        this.controlGroupJid,
        `⚠️ ${superior.referencia} nao tem autorizacao para limpar instrucoes (requer nivel >= Dona Carol).`
      );
    }

    return { action: result.accepted ? "instructions_cleared" : "unauthorized" };
  }

  private async approveDraft(
    draftId: string
  ): Promise<{ action: "sent" | "unknown"; draftId?: string }> {
    const draft = this.pendingDrafts.get(draftId);
    if (!draft) {
      console.warn(
        `[Supervisionado] Rascunho ${draftId} não encontrado`
      );
      return { action: "unknown" };
    }

    await this.gateway.sendMessage(draft.clientPhone, draft.proposedResponse);
    this.pendingDrafts.delete(draftId);
    this.memory?.add(draft.clientPhone, "out", draft.proposedResponse);

    if (this.controlGroupJid) {
      await this.gateway.sendToGroup(
        this.controlGroupJid,
        `✅ Resposta ${draftId} enviada a ${draft.clientName ?? draft.clientPhone}`
      );
    }

    console.log(
      `[Supervisionado] Rascunho ${draftId} aprovado e enviado a ${draft.clientPhone}`
    );

    return { action: "sent", draftId };
  }

  private async approveDraftWithAudio(
    draftId: string
  ): Promise<{ action: "sent" | "unknown"; draftId?: string }> {
    const draft = this.pendingDrafts.get(draftId);
    if (!draft) {
      console.warn(`[Supervisionado] Rascunho ${draftId} não encontrado`);
      return { action: "unknown" };
    }

    // Send only audio
    if (this.tts?.isEnabled()) {
      const audio = await this.tts.textToSpeech(draft.proposedResponse);
      if (audio) {
        await this.gateway.sendAudio(draft.clientPhone, audio);
        console.log(`[Supervisionado] Áudio enviado a ${draft.clientPhone}`);
      } else {
        // Fallback to text if audio generation fails
        await this.gateway.sendMessage(draft.clientPhone, draft.proposedResponse);
        console.log("[Supervisionado] Áudio falhou — texto enviado como fallback");
      }
    } else {
      // Fallback to text if TTS not available
      await this.gateway.sendMessage(draft.clientPhone, draft.proposedResponse);
      console.log("[Supervisionado] TTS não disponível — texto enviado como fallback");
    }

    this.pendingDrafts.delete(draftId);
    this.memory?.add(draft.clientPhone, "out", draft.proposedResponse);

    if (this.controlGroupJid) {
      await this.gateway.sendToGroup(
        this.controlGroupJid,
        `🔊 Resposta ${draftId} enviada (áudio) a ${draft.clientName ?? draft.clientPhone}`
      );
    }

    return { action: "sent", draftId };
  }

  private async editAndSendDraft(
    draftId: string,
    newText: string
  ): Promise<{ action: "edited" | "unknown"; draftId?: string }> {
    const draft = this.pendingDrafts.get(draftId);
    if (!draft) {
      console.warn(
        `[Supervisionado] Rascunho ${draftId} não encontrado`
      );
      return { action: "unknown" };
    }

    await this.gateway.sendMessage(draft.clientPhone, newText);
    this.pendingDrafts.delete(draftId);
    this.memory?.add(draft.clientPhone, "out", newText);

    if (this.controlGroupJid) {
      await this.gateway.sendToGroup(
        this.controlGroupJid,
        `✏️ Resposta ${draftId} editada e enviada a ${draft.clientName ?? draft.clientPhone}`
      );
    }

    console.log(
      `[Supervisionado] Rascunho ${draftId} editado e enviado a ${draft.clientPhone}`
    );

    return { action: "edited", draftId };
  }

  private getMostRecentDraft(): PendingDraft | null {
    let latest: PendingDraft | null = null;
    for (const draft of this.pendingDrafts.values()) {
      if (!latest || draft.timestamp > latest.timestamp) {
        latest = draft;
      }
    }
    return latest;
  }

  private formatDraftMessage(draft: PendingDraft): string {
    return `📨 *NOVA MENSAGEM*
━━━━━━━━━━━━━━━━━━━━
*De:* ${draft.clientName ?? "Desconhecido"} (${draft.clientPhone})
*Mensagem:* ${draft.clientMessage}
━━━━━━━━━━━━━━━━━━━━
${draft.context ? `ℹ️ ${draft.context}\n━━━━━━━━━━━━━━━━━━━━\n` : ""}✏️ *RESPOSTA PROPOSTA:*
${draft.proposedResponse}
━━━━━━━━━━━━━━━━━━━━
🆔 *${draft.id}*

→ *ENVIAR ${draft.id}* para aprovar (texto)
→ *AUDIO ${draft.id}* para aprovar (só áudio)
→ *EDITAR ${draft.id}* seguido do novo texto
→ *IGNORAR ${draft.id}* para descartar`;
  }

  getPendingCount(): number {
    return this.pendingDrafts.size;
  }

  getPendingDrafts(): PendingDraft[] {
    return Array.from(this.pendingDrafts.values());
  }
}
