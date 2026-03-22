import AdmZip from "adm-zip";
import type { WhatsAppMessage, WhatsAppHistory } from "./types.js";

const ANDROID_PATTERN =
  /^(\d{2}\/\d{2}\/\d{2,4}),?\s+(\d{2}:\d{2})\s+-\s+([^:]+):\s+(.+)$/;
const IOS_PATTERN =
  /^\[(\d{2}\/\d{2}\/\d{4}),\s+(\d{2}:\d{2}:\d{2})\]\s+([^:]+):\s+(.+)$/;

const MEDIA_INDICATORS = [
  "<Media omitted>",
  "<Multimédia omitido>",
  "<Mídia omitida>",
  "image omitted",
  "audio omitted",
  "video omitted",
  "document omitted",
  "sticker omitted",
  ".opus (file attached)",
  ".jpg (file attached)",
  ".mp4 (file attached)",
  ".pdf (file attached)",
  ".webp (file attached)",
];

function detectMediaType(
  content: string
): WhatsAppMessage["tipo"] {
  const lower = content.toLowerCase();
  if (lower.includes("audio") || lower.includes(".opus"))
    return "audio";
  if (lower.includes("image") || lower.includes(".jpg") || lower.includes(".webp"))
    return "imagem";
  if (lower.includes("video") || lower.includes(".mp4"))
    return "video";
  if (lower.includes("document") || lower.includes(".pdf"))
    return "documento";
  if (lower.includes("contact") || lower.includes("contacto"))
    return "contacto";
  return "documento";
}

function isMediaMessage(content: string): boolean {
  const lower = content.toLowerCase();
  return MEDIA_INDICATORS.some((ind) => lower.includes(ind.toLowerCase()));
}

function parseDate(dateStr: string, timeStr: string): string {
  // Handle DD/MM/YY or DD/MM/YYYY
  const parts = dateStr.split("/");
  if (parts.length !== 3) return new Date().toISOString();

  let [day, month, year] = parts;
  if (year.length === 2) {
    year = `20${year}`;
  }

  // Handle HH:MM or HH:MM:SS
  const timeParts = timeStr.split(":");
  const hours = timeParts[0];
  const minutes = timeParts[1];
  const seconds = timeParts[2] ?? "00";

  return new Date(
    `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hours}:${minutes}:${seconds}`
  ).toISOString();
}

function detectSender(
  senderName: string,
  knownOfficeNames: string[]
): WhatsAppMessage["remetente"] {
  const lower = senderName.toLowerCase().trim();
  // Known office identifiers
  const officeIndicators = [
    "sd legal",
    "escritório",
    "escritorio",
    "eduardo",
    "dr.",
    "advogad",
    ...knownOfficeNames.map((n) => n.toLowerCase()),
  ];
  return officeIndicators.some((ind) => lower.includes(ind))
    ? "escritorio"
    : "cliente";
}

export function parseWhatsAppChat(
  chatText: string,
  knownOfficeNames: string[] = []
): WhatsAppMessage[] {
  const lines = chatText.split("\n");
  const messages: WhatsAppMessage[] = [];
  let currentMessage: WhatsAppMessage | null = null;

  for (const line of lines) {
    // Try Android format first
    let match = ANDROID_PATTERN.exec(line);
    let format: "android" | "ios" | null = match ? "android" : null;

    // Try iOS format
    if (!match) {
      match = IOS_PATTERN.exec(line);
      format = match ? "ios" : null;
    }

    if (match) {
      // Save previous message
      if (currentMessage) {
        messages.push(currentMessage);
      }

      const [, dateStr, timeStr, sender, content] = match;
      const isMedia = isMediaMessage(content);

      currentMessage = {
        timestamp: parseDate(dateStr, timeStr),
        remetente: detectSender(sender, knownOfficeNames),
        tipo: isMedia ? detectMediaType(content) : "texto",
        conteudo: content,
        media_path: isMedia ? content : undefined,
      };
    } else if (currentMessage) {
      // Continuation of previous message (multiline)
      currentMessage.conteudo += "\n" + line;
    }
  }

  // Don't forget the last message
  if (currentMessage) {
    messages.push(currentMessage);
  }

  return messages;
}

export function parseWhatsAppZip(
  zipBuffer: Buffer,
  knownOfficeNames: string[] = []
): WhatsAppHistory {
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();

  let chatText = "";
  const mediaFiles: string[] = [];

  for (const entry of entries) {
    const name = entry.entryName;
    if (name.endsWith(".txt") && (name.includes("chat") || name.includes("_chat"))) {
      chatText = entry.getData().toString("utf8");
    } else if (!entry.isDirectory) {
      mediaFiles.push(name);
    }
  }

  if (!chatText) {
    // Fallback: use first .txt file
    const txtEntry = entries.find((e) => e.entryName.endsWith(".txt"));
    if (txtEntry) {
      chatText = txtEntry.getData().toString("utf8");
    }
  }

  const messages = parseWhatsAppChat(chatText, knownOfficeNames);

  const timestamps = messages
    .map((m) => new Date(m.timestamp).getTime())
    .filter((t) => !isNaN(t));

  return {
    numero_cliente: "", // To be filled by caller
    periodo: {
      inicio: timestamps.length
        ? new Date(Math.min(...timestamps)).toISOString()
        : "",
      fim: timestamps.length
        ? new Date(Math.max(...timestamps)).toISOString()
        : "",
    },
    total_mensagens: messages.length,
    mensagens: messages,
    media_files: mediaFiles,
  };
}
