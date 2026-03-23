/**
 * Z-API WhatsApp Gateway
 * Docs: https://developer.z-api.io/en/
 */
export class ZApiGateway {
    config;
    constructor(config) {
        this.config = config;
    }

    /** Base URL for all Z-API requests. */
    get baseUrl() {
        return `https://api.z-api.io/instances/${this.config.instanceId}/token/${this.config.token}`;
    }

    /** Common headers for Z-API requests. */
    get headers() {
        return {
            "Content-Type": "application/json",
            "Client-Token": this.config.clientToken,
        };
    }

    async sendMessage(phone, text) {
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

    async sendAudio(phone, audioBuffer) {
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
    async sendPresence(phone, state) {
        // Z-API não tem endpoint de presença dedicado.
        // Usa-se delayTyping no próximo send, ou ignora-se.
        // Falha silenciosa — typing indicator não é crítico.
    }

    async getUnreadMessages() {
        // Messages arrive via webhook, not polling
        return [];
    }

    async getInstanceStatus() {
        try {
            const response = await fetch(`${this.baseUrl}/status`, {
                headers: this.headers,
            });
            if (!response.ok) return "error";
            const data = await response.json();
            // Z-API returns { connected: true/false, ... }
            return data.connected ? "open" : "close";
        } catch {
            return "error";
        }
    }

    async getGroupId(groupName) {
        try {
            const response = await fetch(`${this.baseUrl}/groups`, {
                headers: this.headers,
            });
            if (!response.ok) return null;
            const groups = await response.json();
            const match = groups.find(
                (g) => g.name?.toLowerCase().includes(groupName.toLowerCase())
            );
            // Z-API group phone format: "55119999-group" — return as-is
            return match?.phone ?? null;
        } catch {
            return null;
        }
    }

    async sendToGroup(groupPhone, text) {
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
    async downloadMediaFromUrl(mediaUrl) {
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
    normalizePhone(phone) {
        return phone.replace(/[+\s-]/g, "");
    }
}
