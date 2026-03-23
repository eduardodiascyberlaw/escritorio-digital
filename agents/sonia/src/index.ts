import { createServer } from "node:http";
import { loadConfig } from "./config.js";
import { GeminiClient } from "./llm/gemini-client.js";
import { EvolutionApiGateway } from "./gateway/evolution-api.js";
import { SupervisedMode } from "./supervised/supervised-mode.js";
import { WebhookHandler } from "./supervised/webhook-handler.js";
import { VaultReader } from "./obsidian/vault-reader.js";
import { VaultWriter } from "./obsidian/vault-writer.js";
import { StubCrmAdapter } from "./client/crm-adapter.js";
import { HttpCrmAdapter } from "./client/http-crm-adapter.js";
import { StubPaperclipAdapter } from "./tickets/paperclip-adapter.js";
import { startHeartbeat } from "./heartbeat/heartbeat.js";
import { ElevenLabsTts } from "./tts/elevenlabs-tts.js";
import type { CrmAdapter } from "./client/crm-adapter.js";

// ─────────────────────────────────────────────
// Configuração
// ─────────────────────────────────────────────

const config = loadConfig();
const PORT = parseInt(process.env.SONIA_PORT ?? "3101", 10);

const EVOLUTION_API_URL =
  process.env.EVOLUTION_API_URL ?? "http://localhost:8080";
const EVOLUTION_API_KEY =
  process.env.EVOLUTION_API_KEY ?? "";
const EVOLUTION_INSTANCE =
  process.env.EVOLUTION_INSTANCE ?? "sd-legal";
const CONTROL_GROUP_NAME =
  process.env.CONTROL_GROUP_NAME ?? "SD Legal";

// ─────────────────────────────────────────────
// Inicialização dos componentes
// ─────────────────────────────────────────────

const gemini = new GeminiClient(config);
const vaultReader = new VaultReader(config.obsidianVaultPath);
const vaultWriter = new VaultWriter(config.obsidianVaultPath);

// CRM — usar adapter real se credenciais configuradas, stub caso contrário
const CRM_EMAIL = process.env.CRM_AG_EMAIL ?? "";
const CRM_PASSWORD = process.env.CRM_AG_PASSWORD ?? "";

const crm: CrmAdapter = CRM_EMAIL && CRM_PASSWORD
  ? new HttpCrmAdapter({
      apiUrl: config.crmApiUrl,
      email: CRM_EMAIL,
      password: CRM_PASSWORD,
    })
  : new StubCrmAdapter();

console.log(`[Sónia] CRM: ${CRM_EMAIL ? "API real" : "stub (sem credenciais)"}`);

const paperclip = new StubPaperclipAdapter();

const gateway = new EvolutionApiGateway({
  baseUrl: EVOLUTION_API_URL,
  apiKey: EVOLUTION_API_KEY,
  instanceName: EVOLUTION_INSTANCE,
});

// TTS — ElevenLabs
const tts = new ElevenLabsTts({
  apiKey: config.elevenlabsApiKey,
  voiceId: config.elevenlabsVoiceId,
});

const supervised = new SupervisedMode(gateway, CONTROL_GROUP_NAME, tts);

// ─────────────────────────────────────────────
// Servidor HTTP (recebe webhooks da Evolution API)
// ─────────────────────────────────────────────

let webhookHandler: WebhookHandler;

const server = createServer(async (req, res) => {
  // Health check
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        agent: "sonia",
        mode: "supervisionado",
        pendingDrafts: supervised.getPendingCount(),
      })
    );
    return;
  }

  // Webhook da Evolution API
  if (req.method === "POST" && req.url === "/api/webhooks/evolution") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      res.writeHead(200);
      res.end("OK");

      try {
        const payload = JSON.parse(body);
        await webhookHandler.handleWebhook(payload);
      } catch (error) {
        console.error("[Webhook] Erro ao processar:", error);
      }
    });
    return;
  }

  // Listar rascunhos pendentes
  if (req.method === "GET" && req.url === "/api/drafts") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(supervised.getPendingDrafts()));
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
  console.log("║  SÓNIA — Agente Recepcionista SD Legal     ║");
  console.log("║  Modo: SUPERVISIONADO                      ║");
  console.log("╚════════════════════════════════════════════╝");
  console.log("");

  // Check Evolution API connection
  const status = await gateway.getInstanceStatus().catch(() => "error");
  console.log(`[Sónia] Evolution API: ${EVOLUTION_API_URL}`);
  console.log(`[Sónia] Instância: ${EVOLUTION_INSTANCE} (${status})`);
  console.log(
    `[Sónia] LLM: Gemini 2.5 Flash via Vertex AI (${config.googleCloudLocation})`
  );
  console.log(`[Sónia] Vault: ${config.obsidianVaultPath}`);

  // Initialize supervised mode (find control group)
  await supervised.initialize();

  // Get control group JID for webhook handler
  const controlGroupJid = await gateway
    .getGroupId(CONTROL_GROUP_NAME)
    .catch(() => null);

  // Initialize webhook handler
  webhookHandler = new WebhookHandler({
    supervised,
    gemini,
    crm,
    vaultReader,
    vaultWriter,
    paperclip,
    gateway,
    controlGroupJid,
  });

  // Start heartbeat
  startHeartbeat({ gateway, crm, supervised, controlGroupJid });

  // Start HTTP server
  server.listen(PORT, () => {
    console.log("");
    console.log(`[Sónia] Servidor HTTP na porta ${PORT}`);
    console.log(
      `[Sónia] Webhook URL: http://localhost:${PORT}/api/webhooks/evolution`
    );
    console.log(`[Sónia] Health: http://localhost:${PORT}/health`);
    console.log("");
    console.log("[Sónia] ✓ Pronta para receber mensagens.");
    console.log(
      "[Sónia] ✓ Respostas serão enviadas ao grupo de controlo para aprovação."
    );
  });
}

start().catch((error) => {
  console.error("[Sónia] Erro fatal ao arrancar:", error);
  process.exit(1);
});
