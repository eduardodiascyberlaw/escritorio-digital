/**
 * ElevenLabs Text-to-Speech — gera áudio para a Sónia enviar via WhatsApp
 */

export interface TtsConfig {
  apiKey: string;
  voiceId: string;
}

export class ElevenLabsTts {
  private config: TtsConfig;
  private enabled: boolean;

  constructor(config: TtsConfig) {
    this.config = config;
    this.enabled = !!(config.apiKey && config.voiceId);

    if (!this.enabled) {
      console.log("[TTS] ElevenLabs não configurada — áudio desativado");
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async textToSpeech(text: string): Promise<Buffer | null> {
    if (!this.enabled) return null;

    // Limitar texto para controlar custos (max ~500 chars por áudio)
    const trimmed = text.length > 500 ? text.substring(0, 497) + "..." : text;

    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${this.config.voiceId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": this.config.apiKey,
          },
          body: JSON.stringify({
            text: trimmed,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.6,
              similarity_boost: 0.75,
              style: 0.3,
              use_speaker_boost: true,
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error(`[TTS] Erro ${response.status}: ${error}`);
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      console.log(
        `[TTS] Áudio gerado: ${buffer.length} bytes (${trimmed.length} chars)`
      );

      return buffer;
    } catch (error) {
      console.error("[TTS] Erro:", error);
      return null;
    }
  }

  async getQuotaRemaining(): Promise<number | null> {
    if (!this.enabled) return null;

    try {
      const response = await fetch(
        "https://api.elevenlabs.io/v1/user/subscription",
        {
          headers: { "xi-api-key": this.config.apiKey },
        }
      );

      if (!response.ok) return null;

      const data = (await response.json()) as {
        character_count: number;
        character_limit: number;
      };

      const remaining = data.character_limit - data.character_count;
      console.log(
        `[TTS] Quota: ${remaining} caracteres restantes (${data.character_count}/${data.character_limit})`
      );
      return remaining;
    } catch {
      return null;
    }
  }
}
