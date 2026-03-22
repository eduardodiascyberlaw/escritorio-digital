import { createServer } from "node:http";
import { v4 as uuid } from "uuid";
import { loadConfig } from "./config.js";
import { generateProposal, type HonorariosProposal } from "./proposal/proposal-generator.js";
import { PaymentTracker, startPaymentMonitor } from "./billing/payment-tracker.js";
import { assessLegalAidEligibility, generateLegalAidText } from "./aid/legal-aid-checker.js";
import type { Ticket } from "@sd-legal/shared";

// ─────────────────────────────────────────────
// Configuração
// ─────────────────────────────────────────────

const config = loadConfig();
const PORT = parseInt(process.env.IRIS_PORT ?? "3103", 10);

// ─────────────────────────────────────────────
// Inicialização
// ─────────────────────────────────────────────

const paymentTracker = new PaymentTracker();
const ticketQueue: Ticket[] = [];
const proposals = new Map<string, HonorariosProposal>();

// ─────────────────────────────────────────────
// Ticket processing
// ─────────────────────────────────────────────

async function handleTicket(ticket: Ticket): Promise<void> {
  console.log(
    `[Iris] Ticket recebido: ${ticket.tipo} de ${ticket.origem} (${ticket.ticket_id})`
  );

  switch (ticket.tipo) {
    case "pedido_honorarios":
      await handleHonorariosRequest(ticket);
      break;

    case "confirmacao_pagamento":
      await handlePaymentConfirmation(ticket);
      break;

    default:
      console.log(`[Iris] Tipo de ticket não processado: ${ticket.tipo}`);
  }
}

async function handleHonorariosRequest(ticket: Ticket): Promise<void> {
  const now = new Date().toISOString();

  // Generate proposal based on tariff
  const proposal = generateProposal(ticket);

  if (!proposal) {
    console.log("[Iris] Não foi possível gerar proposta — escalar para humano");
    ticketQueue.push({
      ticket_id: uuid(),
      criado_em: now,
      atualizado_em: now,
      origem: "iris",
      destino: "humano",
      tipo: "escalamento_humano",
      prioridade: "normal",
      cliente_id: ticket.cliente_id,
      processo_id: ticket.processo_id,
      contexto: {
        resumo: "Tarifa não encontrada para este tipo de processo — definir honorários manualmente",
      },
      payload: { ticket_original: ticket.ticket_id },
      retorno_esperado: "decisao_humana",
      estado: "aguarda_humano",
      audit_trail: [
        { timestamp: now, agente: "iris", accao: "tarifa_nao_encontrada" },
      ],
    });
    return;
  }

  // Store proposal
  proposals.set(proposal.id, proposal);

  console.log(
    `[Iris] Proposta gerada: ${proposal.servico} — €${proposal.valor_total} (${proposal.id})`
  );

  // Return to Rex with the proposal
  const returnTicket: Ticket = {
    ticket_id: uuid(),
    criado_em: now,
    atualizado_em: now,
    origem: "iris",
    destino: "rex",
    tipo: "pedido_honorarios",
    prioridade: ticket.prioridade,
    cliente_id: ticket.cliente_id,
    processo_id: ticket.processo_id,
    contexto: {
      resumo: `Proposta de honorários: ${proposal.servico} — €${proposal.valor_total}`,
    },
    payload: {
      proposta_id: proposal.id,
      servico: proposal.servico,
      valor_total: proposal.valor_total,
      texto_proposta: proposal.texto_proposta,
    },
    retorno_esperado: "proposta_honorarios",
    estado: "concluido",
    audit_trail: [
      {
        timestamp: now,
        agente: "iris",
        accao: "proposta_gerada",
        detalhe: `€${proposal.valor_total} — ${proposal.servico}`,
      },
    ],
  };

  ticketQueue.push(returnTicket);

  // Also generate ticket for Sónia to present to client
  const soniaTicket: Ticket = {
    ticket_id: uuid(),
    criado_em: now,
    atualizado_em: now,
    origem: "iris",
    destino: "sonia",
    tipo: "update_cliente",
    prioridade: "normal",
    cliente_id: ticket.cliente_id,
    processo_id: ticket.processo_id,
    contexto: {
      resumo: "Apresentar proposta de honorários ao cliente",
    },
    payload: {
      mensagem_para_cliente: proposal.texto_proposta,
      proposta_id: proposal.id,
      aguarda_resposta: true,
    },
    retorno_esperado: "confirmacao_financeira",
    estado: "pendente",
    audit_trail: [
      { timestamp: now, agente: "iris", accao: "enviar_proposta_via_sonia" },
    ],
  };

  ticketQueue.push(soniaTicket);
}

async function handlePaymentConfirmation(ticket: Ticket): Promise<void> {
  const propostaId = (ticket.payload as Record<string, unknown>).proposta_id as string;
  const valor = (ticket.payload as Record<string, unknown>).valor as number;

  if (!propostaId) return;

  const proposal = proposals.get(propostaId);
  if (!proposal) return;

  // Create payment record if first payment
  const existingRecords = paymentTracker.getRecordsByClient(proposal.cliente_id);
  let record = existingRecords.find((r) => r.proposta_id === propostaId);

  if (!record) {
    record = paymentTracker.createRecord(
      proposal.cliente_id,
      proposal.processo_id,
      propostaId,
      proposal.valor_total,
      proposal.parcelas_possiveis || 1
    );
  }

  if (valor) {
    paymentTracker.registerPayment(record.id, valor);
  }

  // Notify Rex that payment is confirmed → process can advance
  const now = new Date().toISOString();
  ticketQueue.push({
    ticket_id: uuid(),
    criado_em: now,
    atualizado_em: now,
    origem: "iris",
    destino: "rex",
    tipo: "confirmacao_pagamento",
    prioridade: "normal",
    cliente_id: proposal.cliente_id,
    processo_id: proposal.processo_id,
    contexto: {
      resumo: `Pagamento confirmado: €${valor ?? proposal.valor_contratacao} — processo pode avançar`,
    },
    payload: {
      proposta_id: propostaId,
      valor_pago: record.valor_pago,
      estado_pagamento: record.estado,
    },
    retorno_esperado: "confirmacao_financeira",
    estado: "concluido",
    audit_trail: [
      { timestamp: now, agente: "iris", accao: "pagamento_confirmado" },
    ],
  });
}

// ─────────────────────────────────────────────
// HTTP Server
// ─────────────────────────────────────────────

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        agent: "iris",
        pendingTickets: ticketQueue.length,
        activeProposals: proposals.size,
      })
    );
    return;
  }

  // Receive ticket
  if (req.method === "POST" && req.url === "/api/tickets") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const ticket = JSON.parse(body) as Ticket;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ received: true, ticket_id: ticket.ticket_id }));
        await handleTicket(ticket).catch((err) =>
          console.error(`[Iris] Erro: ${err}`)
        );
      } catch {
        res.writeHead(400);
        res.end("Invalid ticket");
      }
    });
    return;
  }

  // Get pending tickets
  if (req.method === "GET" && req.url === "/api/tickets/pending") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(ticketQueue));
    return;
  }

  // Check legal aid eligibility
  if (req.method === "POST" && req.url === "/api/legal-aid/check") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const { rendimento } = JSON.parse(body) as { rendimento: number };
        const assessment = assessLegalAidEligibility(rendimento);
        const text = generateLegalAidText(assessment);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ assessment, text }));
      } catch {
        res.writeHead(400);
        res.end("Invalid request");
      }
    });
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
  console.log("║  IRIS — Agente Financeiro SD Legal          ║");
  console.log("╚════════════════════════════════════════════╝");
  console.log("");
  console.log(`[Iris] LLM: Gemini 2.5 Flash via Vertex AI (${config.googleCloudLocation})`);
  console.log(`[Iris] Vault: ${config.obsidianVaultPath}`);

  // Start payment monitor
  startPaymentMonitor(paymentTracker, async (tickets) => {
    for (const t of tickets) {
      ticketQueue.push(t);
      console.log(`[Iris] Alerta pagamento: ${t.contexto.resumo}`);
    }
  });

  server.listen(PORT, () => {
    console.log("");
    console.log(`[Iris] Servidor HTTP na porta ${PORT}`);
    console.log(`[Iris] Tickets: POST http://localhost:${PORT}/api/tickets`);
    console.log(`[Iris] Apoio judiciário: POST http://localhost:${PORT}/api/legal-aid/check`);
    console.log(`[Iris] Health: http://localhost:${PORT}/health`);
    console.log("");
    console.log("[Iris] ✓ Pronta para calcular honorários.");
  });
}

start().catch((error) => {
  console.error("[Iris] Erro fatal:", error);
  process.exit(1);
});
