import Anthropic from "@anthropic-ai/sdk";
import type { LexConfig } from "../config.js";

export class ClaudeClient {
  private client: Anthropic;
  private model: string;

  constructor(config: LexConfig) {
    this.client = new Anthropic({
      apiKey: config.anthropicApiKey,
    });
    this.model = config.anthropicModel;
  }

  async generateDocument(
    systemPrompt: string,
    instruction: string,
    context: string,
    maxTokens: number = 8192
  ): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `${instruction}\n\n---\nCONTEXTO DO CASO:\n${context}`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    console.log(
      `[Lex LLM] ${response.usage.input_tokens} in + ${response.usage.output_tokens} out tokens`
    );

    return text;
  }

  async refineDocument(
    systemPrompt: string,
    originalDraft: string,
    feedback: string,
    maxTokens: number = 8192
  ): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `RASCUNHO ORIGINAL:\n${originalDraft}\n\n---\nFEEDBACK DO ADVOGADO:\n${feedback}\n\n---\nProduz uma versão revista incorporando o feedback.`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    console.log(
      `[Lex LLM] Revisão: ${response.usage.input_tokens} in + ${response.usage.output_tokens} out`
    );

    return text;
  }
}
