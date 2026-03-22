export interface IncomingMessage {
  phone: string;
  text: string;
  timestamp: string;
  media?: {
    buffer: Buffer;
    mimeType: string;
    filename: string;
  };
}

export interface WhatsAppGateway {
  sendMessage(phone: string, text: string): Promise<void>;
  sendAudio(phone: string, audioBuffer: Buffer): Promise<void>;
  getUnreadMessages(): Promise<IncomingMessage[]>;
}

export class StubWhatsAppGateway implements WhatsAppGateway {
  async sendMessage(phone: string, text: string): Promise<void> {
    console.log(`[WA Stub] → ${phone}: ${text.substring(0, 80)}...`);
  }

  async sendAudio(phone: string): Promise<void> {
    console.log(`[WA Stub] → ${phone}: [áudio]`);
  }

  async getUnreadMessages(): Promise<IncomingMessage[]> {
    return [];
  }
}
