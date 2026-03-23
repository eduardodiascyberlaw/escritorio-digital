export interface SoniaConfig {
  // LLM — Vertex AI
  googleCloudProject: string;
  googleCloudLocation: string;
  geminiModelFlash: string;

  // Obsidian
  obsidianVaultPath: string;

  // WhatsApp Gateway (OpenClaw)
  whatsappGatewayUrl: string;

  // CRM AG
  crmApiUrl: string;
  crmApiKey: string;

  // Paperclip
  paperclipApiUrl: string;
  paperclipApiKey: string;

  // Google Drive
  googleDrivePastaMaeId: string;

  // ElevenLabs (TTS)
  elevenlabsApiKey: string;
  elevenlabsVoiceId: string;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.warn(`[Sónia] Variável ${name} não definida — a usar valor vazio`);
    return "";
  }
  return value;
}

export function loadConfig(): SoniaConfig {
  return {
    googleCloudProject: required("GOOGLE_CLOUD_PROJECT"),
    googleCloudLocation: required("GOOGLE_CLOUD_LOCATION"),
    geminiModelFlash: process.env.GEMINI_MODEL_FLASH ?? "gemini-2.5-flash",
    obsidianVaultPath: process.env.OBSIDIAN_VAULT_PATH ?? "./obsidian-vault",
    whatsappGatewayUrl: process.env.WHATSAPP_GATEWAY_URL ?? "",
    crmApiUrl: required("CRM_AG_API_URL"),
    crmApiKey: process.env.CRM_AG_API_KEY ?? "",
    paperclipApiUrl: process.env.PAPERCLIP_API_URL ?? "http://localhost:3100",
    paperclipApiKey: process.env.PAPERCLIP_API_KEY ?? "",
    googleDrivePastaMaeId: process.env.GOOGLE_DRIVE_PASTA_MAE_ID ?? "",
    elevenlabsApiKey: process.env.ELEVENLABS_API_KEY ?? "",
    elevenlabsVoiceId: process.env.ELEVENLABS_VOICE_ID_SONIA ?? "",
  };
}
