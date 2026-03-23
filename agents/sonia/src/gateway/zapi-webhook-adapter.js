/**
 * Adapts Z-API webhook payloads to the Evolution API format
 * that WebhookHandler already understands.
 *
 * Z-API docs: https://developer.z-api.io/en/webhooks/on-message-received
 */
export function adaptZApiWebhook(zapiPayload) {
    // Z-API incoming message has: phone, fromMe, text, image, audio, etc.
    const isGroup = zapiPayload.isGroup === true;
    const fromMe = zapiPayload.fromMe === true;
    const phone = zapiPayload.phone ?? "";
    const participantPhone = zapiPayload.participantPhone ?? null;
    const senderName = zapiPayload.senderName ?? zapiPayload.chatName ?? null;
    const messageId = zapiPayload.messageId ?? zapiPayload.zapiMessageId ?? `zapi-${Date.now()}`;

    // Build remoteJid in Evolution format
    const remoteJid = isGroup
        ? `${phone.replace("-group", "")}@g.us`
        : `${phone}@s.whatsapp.net`;

    // Participant JID (for group messages)
    const participantJid = participantPhone
        ? `${participantPhone}@s.whatsapp.net`
        : undefined;

    // Extract text content
    let conversation = null;
    let audioMessage = null;
    let imageCaption = null;

    if (zapiPayload.text?.message) {
        conversation = zapiPayload.text.message;
    } else if (zapiPayload.image?.caption) {
        imageCaption = zapiPayload.image.caption;
    } else if (zapiPayload.audio) {
        audioMessage = {
            mimetype: zapiPayload.audio.mimeType ?? "audio/ogg",
            // Z-API provides a URL to download the audio
            url: zapiPayload.audio.audioUrl ?? zapiPayload.audio.fileUrl ?? null,
        };
    }

    // Return in Evolution API webhook format
    return {
        event: "messages.upsert",
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
        // Keep original Z-API payload for media download
        _zapiOriginal: zapiPayload,
    };
}
