import type { IncomingMessage, WhatsAppGateway } from "./whatsapp-gateway.js";

export interface ZApiConfig {
  instanceId: string;
  token: string;
  clientToken: string;
}

export class ZApiGateway implements WhatsAppGateway {
  private config: ZApiConfig;

  constructor(config: ZApiConfig) {
    this.config = config;
  }

  /** Base URL for all Z-API requests. */
  private get baseUrl(): string {
    return `https://api.z-api.io/instances/${this.config.instanceId}/token/${this.config.token}`;
  }

  /** Common headers for Z-API requests. */
  private get headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "Client-Token": this.config.clientToken,
    };
  }

  async sendMessage(phone: string, text: string): Promise<void> {
    const number = this.normalizePhone(phone);
    const response = await fetch(`${this.baseUrl}/send-text`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ phone: number, message: text }),
    });
    if (!response.ok) {
      const error = await response.text();
      console.error(`[Z-API] Erro ao enviar para ${phone}: ${error}`);
      throw new Error(`Z-API error: ${response.status}`);
    }
    console.log(`[Z-API] → ${phone}: ${text.substring(0, 60)}...`);
  }

  async sendAudio(phone: string, audioBuffer: Buffer): Promise<void> {
    const number = this.normalizePhone(phone);
    const base64 = `data:audio/ogg;base64,${audioBuffer.toString("base64")}`;
    const response = await fetch(`${this.baseUrl}/send-audio`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ phone: number, audio: base64 }),
    });
    if (!response.ok) {
      console.error(`[Z-API] Erro ao enviar áudio para ${phone}`);
    }
  }

  /** Envia indicador de presenca (composing/paused). */
  async sendPresence(_phone: string, _state: "composing" | "paused"): Promise<void> {
    // Z-API não tem endpoint de presença dedicado.
    // Usa-se delayTyping no próximo send, ou ignora-se.
    // Falha silenciosa — typing indicator não é crítico.
  }

  async getUnreadMessages(): Promise<IncomingMessage[]> {
    // Messages arrive via webhook, not polling
    return [];
  }

  async getInstanceStatus(): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/status`, {
        headers: this.headers,
      });
      if (!response.ok) return "error";
      const data = (await response.json()) as { connected?: boolean };
      return data.connected ? "open" : "close";
    } catch {
      return "error";
    }
  }

  async getGroupId(groupName: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseUrl}/groups`, {
        headers: this.headers,
      });
      if (!response.ok) return null;
      const groups = (await response.json()) as Array<{
        name?: string;
        phone?: string;
      }>;
      const match = groups.find((g) =>
        g.name?.toLowerCase().includes(groupName.toLowerCase())
      );
      return match?.phone ?? null;
    } catch {
      return null;
    }
  }

  async sendToGroup(groupPhone: string, text: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/send-text`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ phone: groupPhone, message: text }),
    });
    if (!response.ok) {
      const error = await response.text();
      console.error(`[Z-API] Erro ao enviar para grupo: ${error}`);
      throw new Error(`Z-API group error: ${response.status}`);
    }
  }

  /** Download media from Z-API URL (used for audio transcription). */
  async downloadMediaFromUrl(mediaUrl: string): Promise<Buffer | null> {
    try {
      const response = await fetch(mediaUrl);
      if (!response.ok) return null;
      const buffer = Buffer.from(await response.arrayBuffer());
      return buffer;
    } catch {
      return null;
    }
  }

  /**
   * Normaliza telefone para formato Z-API: DDI+DDD+NUMBER sem +, espaços ou hífens.
   * Ex: "+351914940749" → "351914940749"
   */
  normalizePhone(phone: string): string {
    return phone.replace(/[+\s-]/g, "");
  }
}
