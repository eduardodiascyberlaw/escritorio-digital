/**
 * Speech-to-Text — transcreve áudios de clientes via Gemini 2.5 Flash
 * O Gemini tem capacidade multimodal nativa para áudio
 */

import type { GeminiClient } from "../llm/gemini-client.js";

const TRANSCRIPTION_PROMPT = `És a Sónia, assistente do escritório SD Legal.
Transcreve o áudio enviado pelo cliente.

REGRAS:
- Transcreve exactamente o que o cliente disse
- Mantém a língua original (português, inglês, francês, crioulo)
- Se houver ruído ou partes inaudíveis, indica [inaudível]
- Não interpretes nem resumas — transcreve fielmente
- Se o áudio estiver vazio ou só com ruído, responde: [áudio sem conteúdo]`;

export class AudioTranscriber {
  private gemini: GeminiClient;

  constructor(gemini: GeminiClient) {
    this.gemini = gemini;
  }

  async transcribe(
    audioBuffer: Buffer,
    mimeType: string
  ): Promise<string> {
    try {
      const text = await this.gemini.generateWithImage(
        TRANSCRIPTION_PROMPT,
        audioBuffer,
        mimeType,
        "Transcreve este áudio do cliente."
      );

      const trimmed = text.trim();

      if (!trimmed || trimmed === "[áudio sem conteúdo]") {
        console.log("[STT] Áudio sem conteúdo");
        return "";
      }

      console.log(
        `[STT] Transcrito: "${trimmed.substring(0, 80)}${trimmed.length > 80 ? "..." : ""}"`
      );

      return trimmed;
    } catch (error) {
      console.error("[STT] Erro na transcrição:", error);
      return "";
    }
  }
}
