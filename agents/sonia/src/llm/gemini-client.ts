import { GoogleGenAI } from "@google/genai";
import type { SoniaConfig } from "../config.js";

export class GeminiClient {
  private ai: GoogleGenAI;
  private model: string;

  constructor(config: SoniaConfig) {
    this.ai = new GoogleGenAI({
      vertexai: true,
      project: config.googleCloudProject,
      location: config.googleCloudLocation,
    });
    this.model = config.geminiModelFlash;
  }

  async generateText(
    systemPrompt: string,
    userContent: string
  ): Promise<string> {
    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: userContent,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.2,
      },
    });

    const text = response.text ?? "";

    console.log(
      `[Sónia LLM] tokens: ${response.usageMetadata?.totalTokenCount ?? "?"}`
    );

    return text;
  }

  async generateJson<T>(
    systemPrompt: string,
    userContent: string
  ): Promise<T> {
    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: userContent,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });

    const text = response.text ?? "{}";

    console.log(
      `[Sónia LLM] tokens: ${response.usageMetadata?.totalTokenCount ?? "?"}`
    );

    // Strip markdown code fences if present
    const cleaned = text.replace(/^```json?\n?/g, "").replace(/\n?```$/g, "");
    return JSON.parse(cleaned) as T;
  }

  async generateWithImage(
    systemPrompt: string,
    imageBuffer: Buffer,
    mimeType: string,
    textPrompt: string
  ): Promise<string> {
    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: imageBuffer.toString("base64"),
                mimeType,
              },
            },
            { text: textPrompt },
          ],
        },
      ],
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.1,
      },
    });

    console.log(
      `[Sónia OCR] tokens: ${response.usageMetadata?.totalTokenCount ?? "?"}`
    );

    return response.text ?? "";
  }
}
