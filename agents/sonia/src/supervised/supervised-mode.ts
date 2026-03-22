import type { EvolutionApiGateway } from "../gateway/evolution-api.js";

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
  private gateway: EvolutionApiGateway;
  private controlGroupJid: string | null = null;
  private controlGroupName: string;

  constructor(
    gateway: EvolutionApiGateway,
    controlGroupName: string = "SD Legal"
  ) {
    this.gateway = gateway;
    this.controlGroupName = controlGroupName;
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
    responseText: string
  ): Promise<{ action: "sent" | "edited" | "ignored" | "unknown"; draftId?: string }> {
    const text = responseText.trim();

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

→ *ENVIAR ${draft.id}* para aprovar
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
