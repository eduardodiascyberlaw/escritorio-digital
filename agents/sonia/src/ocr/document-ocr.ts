import type { GeminiClient } from "../llm/gemini-client.js";
import { OCR_PROMPT } from "../llm/prompts.js";

export interface ExtractedField {
  valor: string;
  confianca: "alto" | "medio" | "baixo";
}

export interface DocumentExtractionResult {
  tipo_documento: string;
  legivel: boolean;
  campos: Record<string, ExtractedField>;
  expirado: boolean;
  alertas: string[];
}

export async function extractDocument(
  imageBuffer: Buffer,
  mimeType: string,
  gemini: GeminiClient
): Promise<DocumentExtractionResult> {
  try {
    const responseText = await gemini.generateWithImage(
      OCR_PROMPT,
      imageBuffer,
      mimeType,
      "Analisa este documento e extrai os campos. Responde em JSON."
    );

    const cleaned = responseText
      .replace(/^```json?\n?/g, "")
      .replace(/\n?```$/g, "");

    return JSON.parse(cleaned) as DocumentExtractionResult;
  } catch (error) {
    console.error("[OCR] Erro na extracção:", error);
    return {
      tipo_documento: "outro",
      legivel: false,
      campos: {},
      expirado: false,
      alertas: ["Extracção falhou — pedir nova foto ou análise manual"],
    };
  }
}

export function validateNif(nif: string): boolean {
  if (!/^\d{9}$/.test(nif)) return false;

  const weights = [9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += parseInt(nif[i]) * weights[i];
  }

  const remainder = sum % 11;
  const checkDigit = remainder < 2 ? 0 : 11 - remainder;

  return checkDigit === parseInt(nif[8]);
}
