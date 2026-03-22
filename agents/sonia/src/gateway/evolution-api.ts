import type { IncomingMessage, WhatsAppGateway } from "./whatsapp-gateway.js";

export interface EvolutionApiConfig {
  baseUrl: string; // http://localhost:8080
  apiKey: string;
  instanceName: string; // "sd-legal"
}

export class EvolutionApiGateway implements WhatsAppGateway {
  private config: EvolutionApiConfig;

  constructor(config: EvolutionApiConfig) {
    this.config = config;
  }

  async sendMessage(phone: string, text: string): Promise<void> {
    const jid = this.toJid(phone);

    const response = await fetch(
      `${this.config.baseUrl}/message/sendText/${this.config.instanceName}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: this.config.apiKey,
        },
        body: JSON.stringify({
          number: jid,
          text,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(`[Evolution] Erro ao enviar para ${phone}: ${error}`);
      throw new Error(`Evolution API error: ${response.status}`);
    }

    console.log(`[Evolution] → ${phone}: ${text.substring(0, 60)}...`);
  }

  async sendAudio(phone: string, audioBuffer: Buffer): Promise<void> {
    const jid = this.toJid(phone);

    const response = await fetch(
      `${this.config.baseUrl}/message/sendWhatsAppAudio/${this.config.instanceName}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: this.config.apiKey,
        },
        body: JSON.stringify({
          number: jid,
          audio: audioBuffer.toString("base64"),
        }),
      }
    );

    if (!response.ok) {
      console.error(`[Evolution] Erro ao enviar áudio para ${phone}`);
    }
  }

  async getUnreadMessages(): Promise<IncomingMessage[]> {
    // Messages arrive via webhook, not polling
    return [];
  }

  async getInstanceStatus(): Promise<string> {
    const response = await fetch(
      `${this.config.baseUrl}/instance/connectionState/${this.config.instanceName}`,
      {
        headers: { apikey: this.config.apiKey },
      }
    );

    if (!response.ok) return "error";
    const data = (await response.json()) as { instance?: { state?: string } };
    return data.instance?.state ?? "unknown";
  }

  async getGroupId(groupName: string): Promise<string | null> {
    const response = await fetch(
      `${this.config.baseUrl}/group/fetchAllGroups/${this.config.instanceName}?getParticipants=false`,
      {
        headers: { apikey: this.config.apiKey },
      }
    );

    if (!response.ok) return null;

    const groups = (await response.json()) as Array<{
      id: string;
      subject: string;
    }>;

    const match = groups.find((g) =>
      g.subject.toLowerCase().includes(groupName.toLowerCase())
    );

    return match?.id ?? null;
  }

  async sendToGroup(groupJid: string, text: string): Promise<void> {
    const response = await fetch(
      `${this.config.baseUrl}/message/sendText/${this.config.instanceName}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: this.config.apiKey,
        },
        body: JSON.stringify({
          number: groupJid,
          text,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(`[Evolution] Erro ao enviar para grupo: ${error}`);
      throw new Error(`Evolution API group error: ${response.status}`);
    }
  }

  private toJid(phone: string): string {
    // Remove +, spaces, dashes
    return phone.replace(/[+\s-]/g, "");
  }
}
