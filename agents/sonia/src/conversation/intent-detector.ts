/**
 * Detector de intencao de mensagem.
 *
 * Decide se a mensagem do cliente e:
 * - conversa (saudacao, agradecimento, status, duvida geral)
 * - triagem (caso novo, pedido de servico, documento, urgencia)
 *
 * Usa deteccao rapida por padroes primeiro (sem custo LLM).
 * Para mensagens ambiguas, usa o Gemini com prompt curto.
 */

import type { GeminiClient } from "../llm/gemini-client.js";
import { buildPrompt } from "../identity/prompt-builder.js";

export type MessageIntent =
  | "saudacao"
  | "agradecimento"
  | "status_processo"
  | "conversa_geral"
  | "caso_novo"
  | "pedido_servico"
  | "documento"
  | "urgencia"
  | "reclamacao";

export type IntentCategory = "conversa" | "triagem";

export type DetectedLanguage = "pt" | "en" | "fr" | "cv";

export interface IntentResult {
  intent: MessageIntent;
  category: IntentCategory;
  confidence: "alta" | "media";
  language?: DetectedLanguage;
}

// ─── Padroes rapidos (sem LLM) ───

// Saudacoes por lingua — ordem importa: linguas mais especificas primeiro
const GREETING_PATTERNS_FR = [
  /^(bonjour|bonsoir|salut|comment\s*(allez|vas|ça\s*va))/i,
];

const GREETING_PATTERNS_EN = [
  /^(hi|hello|hey|good\s*(morning|afternoon|evening)|how\s*(are\s*you|do\s*you\s*do))/i,
];

const GREETING_PATTERNS_CV = [
  /^(modi\s*ki\s*bu\s*sta|bu\s*sta\s*bon|boa\s*noti|bon\s*dia)/i,
];

const GREETING_PATTERNS_PT = [
  /^(oi|ol[aá]|bom\s*dia|boa\s*(tarde|noite)|e\s*a[ií]|tudo\s*bem|como\s*(vai|est[aá]|vão))/i,
];

// Agregado (para checks que so precisam saber se e saudacao, sem importar a lingua)
const GREETING_PATTERNS = [
  ...GREETING_PATTERNS_FR,
  ...GREETING_PATTERNS_EN,
  ...GREETING_PATTERNS_CV,
  ...GREETING_PATTERNS_PT,
];

/** Detecta lingua a partir de padroes de saudacao. */
function detectGreetingLanguage(text: string): DetectedLanguage | null {
  const trimmed = text.trim();
  for (const p of GREETING_PATTERNS_FR) if (p.test(trimmed)) return "fr";
  for (const p of GREETING_PATTERNS_EN) if (p.test(trimmed)) return "en";
  for (const p of GREETING_PATTERNS_CV) if (p.test(trimmed)) return "cv";
  for (const p of GREETING_PATTERNS_PT) if (p.test(trimmed)) return "pt";
  return null;
}

const THANKS_PATTERNS = [
  /^(obrigad[oa]|valeu|agradec|thank|merci|muito\s*obrigad)/i,
  /^(perfeito|otimo|excelente|ok|tudo\s*certo)/i,
];

const STATUS_PATTERNS = [
  /como\s*(est[aá]|vai|anda).*(processo|caso|pedido|requeri)/i,
  /(alguma|tem)\s*(novidade|news|atualiza)/i,
  /(estado|status|situa[cç][aã]o).*(processo|caso|pedido)/i,
  /(meu|nosso)\s*(processo|caso|pedido)/i,
];

const CASE_PATTERNS = [
  /(preciso|quero|gostaria|necessito).*(advogado|advogar|processo|consulta|requeri|ajuda|tratar|fazer|resolver)/i,
  /(autoriza[cç][aã]o|titulo|resid[eê]ncia|renova|visto|nif|nacionalidade)/i,
  /(reagrupamento|reunifica[cç][aã]o)\s*(familiar)?/i,
  /(despedi|demiti|trabalho|contrato|patr[aã]o|empregador)/i,
  /(casamento|div[oó]rcio|separa[cç][aã]o)/i,
  /(empresa|actividade|constituir|abrir)/i,
  /(insolv[eê]ncia|d[ií]vida|injun[cç][aã]o|cobran[cç]a)/i,
  /(recurso|impugna|contesta|indeferid)/i,
  /(urgente|urg[eê]ncia|prazo|deport|detid)/i,
  /(senten[cç]a|homologa|revis[aã]o)/i,
  /(aima|sef|fronteira|expuls[aã]o|permanência)/i,
  /(apoio\s*judici[aá]rio|custas|honor[aá]rios)/i,
  /(heran[cç]a|invent[aá]rio|partilha)/i,
  /(guarda|pens[aã]o\s*aliment|regula[cç][aã]o.*parental)/i,
];

const DOCUMENT_PATTERNS = [
  /(documento|passaporte|cc|bi|certid[aã]o|comprovativo|contrato)/i,
  /(envio|segue|anexo|aqui\s*est[aá])/i,
];

/**
 * Tenta detectar a intencao por padroes de texto (custo zero).
 * Retorna null se a mensagem for ambigua.
 */
function detectByPattern(text: string): IntentResult | null {
  const trimmed = text.trim();

  // Mensagens muito curtas (< 15 chars) que sejam saudacao
  if (trimmed.length < 15) {
    const lang = detectGreetingLanguage(trimmed);
    if (lang) {
      return { intent: "saudacao", category: "conversa", confidence: "alta", language: lang };
    }
    for (const pattern of GREETING_PATTERNS) {
      if (pattern.test(trimmed)) {
        return { intent: "saudacao", category: "conversa", confidence: "alta" };
      }
    }
    for (const pattern of THANKS_PATTERNS) {
      if (pattern.test(trimmed)) {
        return { intent: "agradecimento", category: "conversa", confidence: "alta" };
      }
    }
  }

  // Saudacoes mais longas (ex: "bom dia, tudo bem?")
  const lang = detectGreetingLanguage(trimmed);
  if (lang && trimmed.length < 60) {
    // Se tambem tem padrao de caso, e triagem
    for (const casePattern of CASE_PATTERNS) {
      if (casePattern.test(trimmed)) {
        return null; // ambiguo — delegar ao LLM
      }
    }
    return { intent: "saudacao", category: "conversa", confidence: "alta", language: lang };
  }
  for (const pattern of GREETING_PATTERNS) {
    if (pattern.test(trimmed) && trimmed.length < 60) {
      for (const casePattern of CASE_PATTERNS) {
        if (casePattern.test(trimmed)) {
          return null;
        }
      }
      return { intent: "saudacao", category: "conversa", confidence: "alta" };
    }
  }

  // Agradecimentos
  for (const pattern of THANKS_PATTERNS) {
    if (pattern.test(trimmed) && trimmed.length < 80) {
      return { intent: "agradecimento", category: "conversa", confidence: "alta" };
    }
  }

  // Status do processo
  for (const pattern of STATUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { intent: "status_processo", category: "conversa", confidence: "alta" };
    }
  }

  // Caso novo / servico (padroes fortes)
  for (const pattern of CASE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { intent: "caso_novo", category: "triagem", confidence: "alta" };
    }
  }

  // Documento
  for (const pattern of DOCUMENT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { intent: "documento", category: "triagem", confidence: "media" };
    }
  }

  return null; // ambiguo
}

// ─── Fallback LLM para mensagens ambiguas ───

const INTENT_PROMPT = buildPrompt(
  `TAREFA: Classifica a intencao da mensagem do cliente em UMA das categorias:

- "saudacao" — cumprimento, oi, bom dia, etc.
- "agradecimento" — obrigado, valeu, perfeito, etc.
- "status_processo" — pergunta sobre estado de processo existente
- "conversa_geral" — duvida generica, informacao, conversa casual
- "caso_novo" — quer contratar servico, tem problema juridico novo
- "pedido_servico" — pede servico especifico (AR, nacionalidade, NIF, etc.)
- "documento" — esta a enviar ou a referir documentos
- "urgencia" — situacao urgente (detencao, deportacao, prazo iminente)
- "reclamacao" — reclamacao sobre o escritorio ou servico

Responde EXCLUSIVAMENTE em JSON:
{ "intent": string, "category": "conversa" | "triagem", "language": "pt" | "en" | "fr" | "cv" }`
);

interface LlmIntentResult {
  intent: MessageIntent;
  category: IntentCategory;
  language?: DetectedLanguage;
}

async function detectByLlm(
  text: string,
  clientName: string | null,
  gemini: GeminiClient
): Promise<IntentResult> {
  try {
    const result = await gemini.generateJson<LlmIntentResult>(
      INTENT_PROMPT,
      `Nome do cliente: ${clientName ?? "desconhecido"}\nMensagem: "${text}"`
    );

    return {
      intent: result.intent ?? "conversa_geral",
      category: result.category ?? "conversa",
      confidence: "media",
      language: result.language,
    };
  } catch {
    // Em caso de erro, tratar como conversa (mais seguro que criar ticket errado)
    return { intent: "conversa_geral", category: "conversa", confidence: "media" };
  }
}

// ─── API publica ───

/**
 * Verifica se o texto contem padrao de pedido de status/novidade.
 * Util para detectar intencao composta (saudacao + status).
 */
export function hasStatusIntent(text: string): boolean {
  return STATUS_PATTERNS.some((p) => p.test(text));
}

/**
 * Detecta a intencao da mensagem.
 * Tenta primeiro por padroes (gratis). Se ambiguo, usa Gemini.
 */
export async function detectIntent(
  text: string,
  clientName: string | null,
  gemini: GeminiClient
): Promise<IntentResult> {
  const patternResult = detectByPattern(text);
  if (patternResult) {
    const langTag = patternResult.language ? ` [${patternResult.language}]` : "";
    console.log(
      `[Intent] Padrao: ${patternResult.intent} (${patternResult.category})${langTag} — "${text.substring(0, 40)}..."`
    );
    return patternResult;
  }

  console.log(`[Intent] Ambiguo — usando LLM para: "${text.substring(0, 40)}..."`);
  const llmResult = await detectByLlm(text, clientName, gemini);
  const langTag = llmResult.language ? ` [${llmResult.language}]` : "";
  console.log(
    `[Intent] LLM: ${llmResult.intent} (${llmResult.category})${langTag}`
  );
  return llmResult;
}
