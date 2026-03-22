import { createServer } from "node:http";
import { loadConfig } from "./config.js";
import { GeminiProClient } from "./llm/gemini-client.js";
import { CrmClient } from "./crm/crm-client.js";
import { processTriageTicket } from "./triage/triage-processor.js";
import { startDeadlineMonitor } from "./deadlines/deadline-monitor.js";
import { ProcessWriter } from "./obsidian/process-writer.js";
import type { Ticket } from "@sd-legal/shared";

// ─────────────────────────────────────────────
// Configuração
// ─────────────────────────────────────────────

const config = loadConfig();
const PORT = parseInt(process.env.REX_PORT ?? "3102", 10);

// Eduardo's ID in the CRM (advogado responsável)
const EDUARDO_ID = "e59b40e3-79b6-4db4-8b4c-0116b9f6a283";

// ─────────────────────────────────────────────
// Inicialização
// ─────────────────────────────────────────────

const gemini = new GeminiProClient(config);

const crm = new CrmClient({
  apiUrl: config.crmApiUrl,
  email: config.crmEmail,
  password: config.crmPassword,
});

const processWriter = new ProcessWriter(config.obsidianVaultPath);

// Ticket queue (in-memory; Paperclip will manage this in production)
const ticketQueue: Ticket[] = [];

// ─────────────────────────────────────────────
// Ticket processing
// ─────────────────────────────────────────────

async function handleTicket(ticket: Ticket): Promise<void> {
  console.log(
    `[Rex] Ticket recebido: ${ticket.tipo} de ${ticket.origem} (${ticket.ticket_id})`
  );

  switch (ticket.tipo) {
    case "triagem_novo_cliente":
    case "triagem_cliente_existente":
      await handleTriageTicket(ticket);
      break;

    case "confirmacao_pagamento":
      await handlePaymentConfirmation(ticket);
      break;

    default:
      console.log(`[Rex] Tipo de ticket não processado: ${ticket.tipo}`);
  }
}

async function handleTriageTicket(ticket: Ticket): Promise<void> {
  const result = await processTriageTicket(
    ticket,
    gemini,
    crm,
    EDUARDO_ID
  );

  if (result.conflito) {
    console.log("[Rex] ⚠️ Caso parado por conflito de interesses");
  } else {
    console.log(
      `[Rex] Triagem concluída: caso ${result.casoId ?? "não criado"}, ${result.tickets_gerados.length} tickets gerados`
    );

    // Write process file to Obsidian
    if (result.casoId) {
      await processWriter.writeProcessFile(
        result.casoId,
        ticket.cliente_id,
        result.analysis,
        result.casoId
      );
    }
  }

  // Enqueue generated tickets
  for (const t of result.tickets_gerados) {
    ticketQueue.push(t);
    console.log(`  → ${t.tipo} → ${t.destino}`);
  }
}

async function handlePaymentConfirmation(ticket: Ticket): Promise<void> {
  // Payment confirmed by Iris → Rex can now activate Lex/Nova
  const processoId = ticket.processo_id;
  if (!processoId) return;

  console.log(`[Rex] Pagamento confirmado para processo ${processoId}`);

  // Update process in Obsidian
  await processWriter.appendToTimeline(
    processoId,
    "Pagamento confirmado — processo pode avançar"
  );

  // TODO: Generate tickets for Lex and/or Nova based on the case plan
}

// ─────────────────────────────────────────────
// Deadline alerts handler
// ─────────────────────────────────────────────

async function handleDeadlineAlerts(tickets: Ticket[]): Promise<void> {
  for (const t of tickets) {
    ticketQueue.push(t);
    console.log(`[Rex] Alerta de prazo: ${t.contexto.resumo}`);
  }
}

// ─────────────────────────────────────────────
// HTTP Server
// ─────────────────────────────────────────────

const server = createServer(async (req, res) => {
  // Health check
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        agent: "rex",
        pendingTickets: ticketQueue.length,
      })
    );
    return;
  }

  // Receive ticket from Paperclip/Sónia
  if (req.method === "POST" && req.url === "/api/tickets") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const ticket = JSON.parse(body) as Ticket;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ received: true, ticket_id: ticket.ticket_id }));

        // Process asynchronously
        await handleTicket(ticket).catch((err) =>
          console.error(`[Rex] Erro ao processar ticket: ${err}`)
        );
      } catch (error) {
        res.writeHead(400);
        res.end("Invalid ticket");
      }
    });
    return;
  }

  // Get pending tickets (for other agents to poll)
  if (req.method === "GET" && req.url === "/api/tickets/pending") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(ticketQueue));
    return;
  }

  // Manual trigger: check deadlines
  if (req.method === "POST" && req.url === "/api/deadlines/check") {
    res.writeHead(200);
    res.end("OK");

    const { checkDeadlines } = await import("./deadlines/deadline-monitor.js");
    const { generateDeadlineTickets } = await import(
      "./deadlines/deadline-monitor.js"
    );
    const alerts = await checkDeadlines(crm, gemini);
    const tickets = generateDeadlineTickets(alerts);
    await handleDeadlineAlerts(tickets);
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
  console.log("║  REX — Controller Jurídico SD Legal         ║");
  console.log("╚════════════════════════════════════════════╝");
  console.log("");
  console.log(`[Rex] LLM: Gemini 2.5 Pro via Vertex AI (${config.googleCloudLocation})`);
  console.log(`[Rex] CRM: ${config.crmApiUrl}`);
  console.log(`[Rex] Vault: ${config.obsidianVaultPath}`);

  // Start deadline monitor
  startDeadlineMonitor(crm, gemini, handleDeadlineAlerts);

  // Start server
  server.listen(PORT, () => {
    console.log("");
    console.log(`[Rex] Servidor HTTP na porta ${PORT}`);
    console.log(`[Rex] Tickets: POST http://localhost:${PORT}/api/tickets`);
    console.log(`[Rex] Health: http://localhost:${PORT}/health`);
    console.log("");
    console.log("[Rex] ✓ Pronto para receber tickets.");
  });
}

start().catch((error) => {
  console.error("[Rex] Erro fatal:", error);
  process.exit(1);
});
