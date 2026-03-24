/**
 * Adapts Z-API webhook payloads to the Evolution API format
 * that WebhookHandler already understands.
 *
 * Z-API docs: https://developer.z-api.io/en/webhooks/on-message-received
 */

export interface ZApiIncomingPayload {
  phone?: string;
  fromMe?: boolean;
  isGroup?: boolean;
  participantPhone?: string;
  senderName?: string;
  chatName?: string;
  messageId?: string;
  zapiMessageId?: string;
  text?: { message?: string };
  image?: { caption?: string };
  audio?: {
    mimeType?: string;
    audioUrl?: string;
    fileUrl?: string;
  };
}

export interface EvolutionWebhookFormat {
  event: "messages.upsert";
  instance: string;
  data: {
    key: {
      id: string;
      fromMe: boolean;
      remoteJid: string;
      participant?: string;
    };
    pushName: string | null;
    message: {
      conversation: string | null;
      extendedTextMessage: null;
      imageMessage: { caption: string } | null;
      audioMessage: { mimetype: string; url: string | null } | null;
    };
  };
  _zapiOriginal: ZApiIncomingPayload;
}

export function adaptZApiWebhook(zapiPayload: ZApiIncomingPayload): EvolutionWebhookFormat {
  const isGroup = zapiPayload.isGroup === true;
  const fromMe = zapiPayload.fromMe === true;
  const phone = zapiPayload.phone ?? "";
  const participantPhone = zapiPayload.participantPhone ?? null;
  const senderName = zapiPayload.senderName ?? zapiPayload.chatName ?? null;
  const messageId =
    zapiPayload.messageId ?? zapiPayload.zapiMessageId ?? `zapi-${Date.now()}`;

  // Build remoteJid in Evolution format
  const remoteJid = isGroup
    ? `${phone.replace("-group", "")}@g.us`
    : `${phone}@s.whatsapp.net`;

  // Participant JID (for group messages)
  const participantJid = participantPhone
    ? `${participantPhone}@s.whatsapp.net`
    : undefined;

  // Extract text content
  let conversation: string | null = null;
  let audioMessage: { mimetype: string; url: string | null } | null = null;
  let imageCaption: string | null = null;

  if (zapiPayload.text?.message) {
    conversation = zapiPayload.text.message;
  } else if (zapiPayload.image?.caption) {
    imageCaption = zapiPayload.image.caption;
  } else if (zapiPayload.audio) {
    audioMessage = {
      mimetype: zapiPayload.audio.mimeType ?? "audio/ogg",
      url: zapiPayload.audio.audioUrl ?? zapiPayload.audio.fileUrl ?? null,
    };
  }

  return {
    event: "messages.upsert",
    instance: "zapi",
    data: {
      key: {
        id: messageId,
        fromMe,
        remoteJid,
        participant: participantJid,
      },
      pushName: senderName,
      message: {
        conversation,
        extendedTextMessage: null,
        imageMessage: imageCaption ? { caption: imageCaption } : null,
        audioMessage,
      },
    },
    _zapiOriginal: zapiPayload,
  };
}
