import type { GeminiClient } from "../llm/gemini-client.js";
import { CLASSIFICATION_PROMPT } from "../llm/prompts.js";
import type { WhatsAppHistory } from "../whatsapp/types.js";
import type { ClassificationResult } from "./types.js";

export async function classifyConversation(
  history: WhatsAppHistory,
  gemini: GeminiClient
): Promise<ClassificationResult> {
  const conversationText = history.mensagens
    .map(
      (m) =>
        `[${m.timestamp}] ${m.remetente === "cliente" ? "CLIENTE" : "ESCRITÓRIO"}: ${m.tipo === "texto" ? m.conteudo : `[${m.tipo}: ${m.conteudo}]`}`
    )
    .join("\n");

  const userContent = `Histórico de conversa WhatsApp (${history.total_mensagens} mensagens, de ${history.periodo.inicio} a ${history.periodo.fim}):\n\n${conversationText}`;

  try {
    const result = await gemini.generateJson<ClassificationResult>(
      CLASSIFICATION_PROMPT,
      userContent
    );

    // Validate essential fields with defaults
    return {
      identificacao: result.identificacao ?? {
        nome: null,
        dados_pessoais: {},
        lingua: "pt",
      },
      classificacao: {
        area: result.classificacao?.area ?? "outro",
        sub_tipo: result.classificacao?.sub_tipo ?? "",
        urgencia: result.classificacao?.urgencia ?? "normal",
        indicadores_prazo: result.classificacao?.indicadores_prazo ?? [],
      },
      intencao: result.intencao ?? "outro",
      documentos_partilhados: result.documentos_partilhados ?? [],
      dados_em_falta: result.dados_em_falta ?? [],
      notas_contexto: result.notas_contexto ?? "",
    };
  } catch (error) {
    console.error("[Sónia] Erro na classificação:", error);
    return {
      identificacao: { nome: null, dados_pessoais: {}, lingua: "pt" },
      classificacao: {
        area: "outro",
        sub_tipo: "",
        urgencia: "normal",
        indicadores_prazo: [],
      },
      intencao: "outro",
      documentos_partilhados: [],
      dados_em_falta: [],
      notas_contexto: "Classificação falhou — requer análise manual",
    };
  }
}
