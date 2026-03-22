import { createServer } from "node:http";
import { v4 as uuid } from "uuid";
import { loadConfig } from "./config.js";
import { ClaudeClient } from "./llm/claude-client.js";
import { VaultManager } from "./obsidian/vault-manager.js";
import { LexCorpusClient } from "./corpus/lex-corpus-client.js";
import { draftDocument, reviseDraft } from "./drafting/document-drafter.js";
import type { Ticket } from "@sd-legal/shared";

// ─────────────────────────────────────────────
// Configuração
// ─────────────────────────────────────────────

const config = loadConfig();
const PORT = parseInt(process.env.LEX_PORT ?? "3104", 10);

// ─────────────────────────────────────────────
// Inicialização
// ─────────────────────────────────────────────

const claude = new ClaudeClient(config);
const vault = new VaultManager(config.obsidianVaultPath);
const corpus = new LexCorpusClient(config.lexCorpusUrl);

const ticketQueue: Ticket[] = [];

// Track active drafts
const activeDrafts = new Map<
  string,
  { draft_id: string; processo_id: string; version: number }
>();

// ─────────────────────────────────────────────
// Ticket processing
// ─────────────────────────────────────────────

async function handleTicket(ticket: Ticket): Promise<void> {
  console.log(
    `[Lex] Ticket recebido: ${ticket.tipo} de ${ticket.origem} (${ticket.ticket_id})`
  );

  switch (ticket.tipo) {
    case "pedido_peca":
      await handleDraftRequest(ticket);
      break;

    case "validacao_peca":
      await handleValidation(ticket);
      break;

    default:
      console.log(`[Lex] Tipo não processado: ${ticket.tipo}`);
  }
}

async function handleDraftRequest(ticket: Ticket): Promise<void> {
  const now = new Date().toISOString();

  try {
    const result = await draftDocument(ticket, claude, vault, corpus);

    // Track this draft
    activeDrafts.set(result.draft_id, {
      draft_id: result.draft_id,
      processo_id: ticket.processo_id ?? ticket.cliente_id,
      version: result.versao,
    });

    // Return to Rex for human validation
    const returnTicket: Ticket = {
      ticket_id: uuid(),
      criado_em: now,
      atualizado_em: now,
      origem: "lex",
      destino: "rex",
      tipo: "validacao_peca",
      prioridade: ticket.prioridade,
      cliente_id: ticket.cliente_id,
      processo_id: ticket.processo_id,
      contexto: {
        materia: ticket.contexto.materia,
        resumo: `Rascunho de ${result.tipo_peca} pronto para validação humana`,
      },
      payload: {
        draft_id: result.draft_id,
        tipo_peca: result.tipo_peca,
        versao: result.versao,
        fontes: result.fontes_consultadas,
        playbooks: result.playbooks_usados,
        tamanho_chars: result.conteudo.length,
      },
      retorno_esperado: "peca_validada",
      estado: "aguarda_humano",
      audit_trail: [
        {
          timestamp: now,
          agente: "lex",
          accao: "rascunho_produzido",
          detalhe: `${result.tipo_peca} v${result.versao} — ${result.conteudo.length} chars — ${result.fontes_consultadas.length} fontes`,
        },
      ],
    };

    ticketQueue.push(returnTicket);

    // Notify human via escalation ticket
    ticketQueue.push({
      ticket_id: uuid(),
      criado_em: now,
      atualizado_em: now,
      origem: "lex",
      destino: "humano",
      tipo: "validacao_peca",
      prioridade: ticket.prioridade,
      cliente_id: ticket.cliente_id,
      processo_id: ticket.processo_id,
      contexto: {
        resumo: `RASCUNHO para validação: ${result.tipo_peca}\nVault: /Pecas/${ticket.processo_id ?? ticket.cliente_id}/v${result.versao}_rascunho_${result.draft_id.slice(0, 8)}.md`,
      },
      payload: {
        draft_id: result.draft_id,
        tipo_peca: result.tipo_peca,
      },
      retorno_esperado: "peca_validada",
      estado: "aguarda_humano",
      audit_trail: [
        { timestamp: now, agente: "lex", accao: "aguarda_validacao_humana" },
      ],
    });
  } catch (error) {
    console.error("[Lex] Erro ao gerar rascunho:", error);

    ticketQueue.push({
      ticket_id: uuid(),
      criado_em: now,
      atualizado_em: now,
      origem: "lex",
      destino: "humano",
      tipo: "escalamento_humano",
      prioridade: "urgente",
      cliente_id: ticket.cliente_id,
      processo_id: ticket.processo_id,
      contexto: {
        resumo: `ERRO ao gerar peça processual: ${error instanceof Error ? error.message : "desconhecido"}`,
      },
      payload: {},
      retorno_esperado: "decisao_humana",
      estado: "aguarda_humano",
      audit_trail: [
        { timestamp: now, agente: "lex", accao: "erro_geracao" },
      ],
    });
  }
}

async function handleValidation(ticket: Ticket): Promise<void> {
  const payload = ticket.payload as Record<string, unknown>;
  const draftId = payload.draft_id as string;
  const feedback = payload.feedback as string;
  const approved = payload.approved as boolean;
  const validatedBy = payload.validated_by as string ?? "advogado";

  if (!draftId) return;

  const draftInfo = activeDrafts.get(draftId);
  if (!draftInfo) {
    console.warn(`[Lex] Draft não encontrado: ${draftId}`);
    return;
  }

  if (approved) {
    // Read current draft and save as validated
    const content = await vault.readDraft(
      draftInfo.processo_id,
      draftId,
      draftInfo.version
    );
    if (content) {
      await vault.writeValidatedVersion(
        draftInfo.processo_id,
        draftId,
        content,
        validatedBy
      );
    }
    activeDrafts.delete(draftId);
    console.log(`[Lex] ✓ Peça validada: ${draftId}`);
  } else if (feedback) {
    // Revise based on feedback
    const revised = await reviseDraft(
      draftId,
      feedback,
      claude,
      vault,
      draftInfo.processo_id,
      draftInfo.version
    );

    draftInfo.version = revised.versao;
    console.log(`[Lex] Revisão v${revised.versao} gerada`);

    // Send back for validation again
    const now = new Date().toISOString();
    ticketQueue.push({
      ticket_id: uuid(),
      criado_em: now,
      atualizado_em: now,
      origem: "lex",
      destino: "humano",
      tipo: "validacao_peca",
      prioridade: "normal",
      cliente_id: ticket.cliente_id,
      processo_id: ticket.processo_id,
      contexto: {
        resumo: `Rascunho REVISTO (v${revised.versao}) para nova validação`,
      },
      payload: { draft_id: draftId, versao: revised.versao },
      retorno_esperado: "peca_validada",
      estado: "aguarda_humano",
      audit_trail: [
        { timestamp: now, agente: "lex", accao: "revisao_submetida" },
      ],
    });
  }
}

// ─────────────────────────────────────────────
// HTTP Server
// ─────────────────────────────────────────────

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    const corpusOk = await corpus.healthCheck();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        agent: "lex",
        model: config.anthropicModel,
        lexCorpus: corpusOk ? "connected" : "unavailable",
        activeDrafts: activeDrafts.size,
        pendingTickets: ticketQueue.length,
      })
    );
    return;
  }

  if (req.method === "POST" && req.url === "/api/tickets") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const ticket = JSON.parse(body) as Ticket;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ received: true, ticket_id: ticket.ticket_id }));
        await handleTicket(ticket).catch((err) =>
          console.error(`[Lex] Erro: ${err}`)
        );
      } catch {
        res.writeHead(400);
        res.end("Invalid ticket");
      }
    });
    return;
  }

  if (req.method === "GET" && req.url === "/api/tickets/pending") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(ticketQueue));
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

// ─────────────────────────────────────────────
// Arranque
// ─────────────────────────────────────────────

async function start(): Promise<void> {
  console.log("╔════════════════════════════════════════════╗");
  console.log("║  LEX — Agente de Contencioso SD Legal      ║");
  console.log("╚════════════════════════════════════════════╝");
  console.log("");
  console.log(`[Lex] LLM: Claude Sonnet 4.6 via Anthropic API`);
  console.log(`[Lex] Vault: ${config.obsidianVaultPath}`);

  const corpusOk = await corpus.healthCheck();
  console.log(`[Lex] Lex-Corpus: ${corpusOk ? "✓ conectado" : "✗ não disponível"} (${config.lexCorpusUrl})`);

  server.listen(PORT, () => {
    console.log("");
    console.log(`[Lex] Servidor HTTP na porta ${PORT}`);
    console.log(`[Lex] Tickets: POST http://localhost:${PORT}/api/tickets`);
    console.log(`[Lex] Health: http://localhost:${PORT}/health`);
    console.log("");
    console.log("[Lex] ✓ Pronto para redigir peças processuais.");
    console.log("[Lex] ⚠ TODA peça é RASCUNHO — requer validação humana obrigatória.");
  });
}

start().catch((error) => {
  console.error("[Lex] Erro fatal:", error);
  process.exit(1);
});
