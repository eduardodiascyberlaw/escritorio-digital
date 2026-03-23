/**
 * Memoria de conversa in-memory.
 *
 * Guarda as ultimas N mensagens (entrada + saida) por telefone do cliente.
 * Permite injectar historico nos prompts do Gemini para manter contexto.
 *
 * Perdido ao reiniciar — aceitavel porque dados criticos (CRM, tickets)
 * sao persistidos noutros sistemas.
 */

import type { WhatsAppMessage } from "../whatsapp/types.js";

export interface ConversationEntry {
  timestamp: string; // ISO 8601
  direction: "in" | "out";
  content: string;
}

export class ConversationMemory {
  private store = new Map<string, ConversationEntry[]>();
  private maxPerClient: number;

  constructor(maxPerClient = 20) {
    this.maxPerClient = maxPerClient;
  }

  /** Adiciona entrada ao historico. Trunca automaticamente a maxPerClient. */
  add(phone: string, direction: "in" | "out", content: string): void {
    const history = this.store.get(phone) ?? [];
    history.push({
      timestamp: new Date().toISOString(),
      direction,
      content,
    });

    if (history.length > this.maxPerClient) {
      history.splice(0, history.length - this.maxPerClient);
    }

    this.store.set(phone, history);
  }

  /** Retorna ultimas N entradas para um telefone. */
  get(phone: string, limit?: number): ConversationEntry[] {
    const history = this.store.get(phone) ?? [];
    if (limit && history.length > limit) {
      return history.slice(-limit);
    }
    return [...history];
  }

  /**
   * Formata historico como texto para injectar no prompt do Gemini.
   * Retorna string vazia se nao ha historico.
   */
  format(phone: string, clientName: string | null): string {
    const history = this.get(phone);
    if (history.length === 0) return "";

    const name = clientName ?? "Cliente";
    const lines = history.map((e) =>
      e.direction === "in"
        ? `${name}: ${e.content}`
        : `Sonia: ${e.content}`
    );

    return `\n\nHISTORICO DA CONVERSA (ultimas ${history.length} mensagens — usar para manter contexto e continuidade, NAO repetir informacoes ja dadas):\n${lines.join("\n")}`;
  }

  /**
   * Converte historico para formato WhatsAppMessage[] para o classifier.
   */
  toWhatsAppMessages(phone: string): WhatsAppMessage[] {
    return this.get(phone).map((e) => ({
      timestamp: e.timestamp,
      remetente: e.direction === "in" ? ("cliente" as const) : ("escritorio" as const),
      tipo: "texto" as const,
      conteudo: e.content,
    }));
  }
}
