/**
 * Speech-to-Text — transcreve audios de clientes via Gemini 2.5 Flash
 * O Gemini tem capacidade multimodal nativa para audio
 */

import type { GeminiClient } from "../llm/gemini-client.js";
import { TRANSCRIPTION_PROMPT } from "../llm/prompts.js";

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
        "Transcreve este audio do cliente."
      );

      const trimmed = text.trim();

      if (!trimmed || trimmed === "[audio sem conteudo]") {
        console.log("[STT] Audio sem conteudo");
        return "";
      }

      console.log(
        `[STT] Transcrito: "${trimmed.substring(0, 80)}${trimmed.length > 80 ? "..." : ""}"`
      );

      return trimmed;
    } catch (error) {
      console.error("[STT] Erro na transcricao:", error);
      return "";
    }
  }
}
