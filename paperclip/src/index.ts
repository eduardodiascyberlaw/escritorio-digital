import type { Ticket } from "@sd-legal/shared";

const PORT = process.env.PORT ?? 3100;

console.log("[Paperclip] SD Legal — Orquestrador de agentes");
console.log(`[Paperclip] A iniciar na porta ${PORT}...`);
console.log("[Paperclip] PostgreSQL:", process.env.DATABASE_URL ? "configurado" : "não configurado");

// TODO: Fase 0 — inicializar servidor HTTP, rotas de tickets, heartbeats, budgets
