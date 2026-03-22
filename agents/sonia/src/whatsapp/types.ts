export interface WhatsAppMessage {
  timestamp: string; // ISO 8601
  remetente: "cliente" | "escritorio";
  tipo: "texto" | "audio" | "imagem" | "documento" | "video" | "contacto";
  conteudo: string;
  media_path?: string;
}

export interface WhatsAppHistory {
  numero_cliente: string;
  periodo: { inicio: string; fim: string };
  total_mensagens: number;
  mensagens: WhatsAppMessage[];
  media_files: string[];
}
