import { GoogleGenAI } from "@google/genai";
import type { RexConfig } from "../config.js";

export class GeminiProClient {
  private ai: GoogleGenAI;
  private model: string;

  constructor(config: RexConfig) {
    this.ai = new GoogleGenAI({
      vertexai: true,
      project: config.googleCloudProject,
      location: config.googleCloudLocation,
    });
    this.model = config.geminiModelPro;
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

    console.log(
      `[Rex LLM] tokens: ${response.usageMetadata?.totalTokenCount ?? "?"}`
    );

    return response.text ?? "";
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
    const cleaned = text.replace(/^```json?\n?/g, "").replace(/\n?```$/g, "");

    console.log(
      `[Rex LLM] tokens: ${response.usageMetadata?.totalTokenCount ?? "?"}`
    );

    return JSON.parse(cleaned) as T;
  }
}
