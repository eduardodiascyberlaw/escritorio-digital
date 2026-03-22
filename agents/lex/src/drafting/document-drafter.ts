import { v4 as uuid } from "uuid";
import type { Ticket } from "@sd-legal/shared";
import type { ClaudeClient } from "../llm/claude-client.js";
import {
  SYSTEM_PROMPT,
  CAUTELAR_PROMPT,
  ACCAO_ADMINISTRATIVA_PROMPT,
  ACCAO_LABORAL_PROMPT,
  RECURSO_PROMPT,
  DRAFT_HEADER,
  DRAFT_FOOTER,
} from "../llm/prompts.js";
import type { VaultManager } from "../obsidian/vault-manager.js";
import type { LexCorpusClient } from "../corpus/lex-corpus-client.js";

export interface DraftResult {
  draft_id: string;
  tipo_peca: string;
  conteudo: string;
  versao: number;
  fontes_consultadas: string[];
  playbooks_usados: string[];
}

function selectPrompt(tipoPeca: string): string {
  const t = tipoPeca.toLowerCase();
  if (t.includes("cautelar") || t.includes("suspensão")) return CAUTELAR_PROMPT;
  if (t.includes("administrativa") || t.includes("impugnação") || t.includes("condenação"))
    return ACCAO_ADMINISTRATIVA_PROMPT;
  if (t.includes("laboral") || t.includes("trabalho") || t.includes("despedimento"))
    return ACCAO_LABORAL_PROMPT;
  if (t.includes("recurso") || t.includes("apelação")) return RECURSO_PROMPT;
  return "Redige a peça processual solicitada com estrutura formal portuguesa.";
}

export async function draftDocument(
  ticket: Ticket,
  claude: ClaudeClient,
  vault: VaultManager,
  corpus: LexCorpusClient
): Promise<DraftResult> {
  const payload = ticket.payload as Record<string, unknown>;
  const tipoPeca = (payload.tipo_peca as string) ?? "peça processual";
  const instrucao = (payload.instrucao as string) ?? ticket.contexto.resumo;
  const materia = ticket.contexto.materia ?? "outro";

  console.log(`[Lex] A redigir: ${tipoPeca} (${materia})`);

  // 1. Consult playbooks from Obsidian
  const playbooks: string[] = [];
  const playbookNames: string[] = [];

  try {
    const relevantPlaybooks = vault.findRelevantPlaybooks(materia, tipoPeca);
    for (const name of relevantPlaybooks) {
      const content = await vault.readPlaybook(name);
      if (content) {
        playbooks.push(`--- PLAYBOOK: ${name} ---\n${content}`);
        playbookNames.push(name);
      }
    }
    console.log(`[Lex] Playbooks consultados: ${playbookNames.join(", ") || "nenhum"}`);
  } catch (e) {
    console.warn("[Lex] Erro ao ler playbooks:", e);
  }

  // 2. Consult Lex-Corpus (RAG over DGSI decisions)
  let jurisprudencia = "";
  const fontesConsultadas: string[] = [];

  try {
    const searchQuery = `${materia} ${tipoPeca} ${instrucao.substring(0, 200)}`;
    const results = await corpus.search(searchQuery);
    if (results.length > 0) {
      jurisprudencia = results
        .map((r) => `[${r.tribunal} ${r.processo} ${r.data}]\n${r.sumario}`)
        .join("\n\n");
      fontesConsultadas.push(...results.map((r) => `${r.tribunal} ${r.processo}`));
      console.log(`[Lex] Jurisprudência: ${results.length} decisões encontradas`);
    }
  } catch (e) {
    console.warn("[Lex] Lex-Corpus não disponível:", e);
  }

  // 3. Build context
  const context = [
    `MATÉRIA: ${materia}`,
    `TIPO DE PEÇA: ${tipoPeca}`,
    `INSTRUÇÃO: ${instrucao}`,
    ticket.contexto.dados_adicionais
      ? `DADOS ADICIONAIS: ${JSON.stringify(ticket.contexto.dados_adicionais)}`
      : "",
    playbooks.length > 0
      ? `\nPLAYBOOKS DO ESCRITÓRIO:\n${playbooks.join("\n\n")}`
      : "",
    jurisprudencia
      ? `\nJURISPRUDÊNCIA RELEVANTE (Lex-Corpus):\n${jurisprudencia}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  // 4. Generate draft with Claude Sonnet 4.6
  const specificPrompt = selectPrompt(tipoPeca);
  const rawDraft = await claude.generateDocument(
    SYSTEM_PROMPT,
    specificPrompt + "\n\n" + instrucao,
    context
  );

  // 5. Add RASCUNHO headers
  const draftId = uuid();
  const conteudo = DRAFT_HEADER + rawDraft + DRAFT_FOOTER;

  // 6. Save to Obsidian Vault
  const processoId = ticket.processo_id ?? ticket.cliente_id;
  await vault.writeDraft(processoId, draftId, conteudo, 1);

  console.log(`[Lex] Rascunho gerado: ${draftId} (${conteudo.length} chars)`);

  return {
    draft_id: draftId,
    tipo_peca: tipoPeca,
    conteudo,
    versao: 1,
    fontes_consultadas: fontesConsultadas,
    playbooks_usados: playbookNames,
  };
}

export async function reviseDraft(
  draftId: string,
  feedback: string,
  claude: ClaudeClient,
  vault: VaultManager,
  processoId: string,
  currentVersion: number
): Promise<DraftResult> {
  console.log(`[Lex] A rever rascunho ${draftId} (v${currentVersion})`);

  // Read current draft
  const currentDraft = await vault.readDraft(processoId, draftId, currentVersion);
  if (!currentDraft) {
    throw new Error(`Rascunho não encontrado: ${draftId} v${currentVersion}`);
  }

  // Strip headers for revision
  const cleanDraft = currentDraft
    .replace(DRAFT_HEADER, "")
    .replace(DRAFT_FOOTER, "");

  // Generate revised version
  const revised = await claude.refineDocument(SYSTEM_PROMPT, cleanDraft, feedback);

  const newVersion = currentVersion + 1;
  const conteudo = DRAFT_HEADER + revised + DRAFT_FOOTER;

  // Save new version
  await vault.writeDraft(processoId, draftId, conteudo, newVersion);
  // Save feedback
  await vault.writeRevisionNotes(processoId, draftId, newVersion, feedback);

  console.log(`[Lex] Revisão v${newVersion} guardada`);

  return {
    draft_id: draftId,
    tipo_peca: "",
    conteudo,
    versao: newVersion,
    fontes_consultadas: [],
    playbooks_usados: [],
  };
}
