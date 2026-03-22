export interface RexConfig {
  googleCloudProject: string;
  googleCloudLocation: string;
  geminiModelPro: string;
  obsidianVaultPath: string;
  paperclipApiUrl: string;
  paperclipApiKey: string;
  crmApiUrl: string;
  crmEmail: string;
  crmPassword: string;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.warn(`[Rex] Variável ${name} não definida — a usar valor vazio`);
    return "";
  }
  return value;
}

export function loadConfig(): RexConfig {
  return {
    googleCloudProject: required("GOOGLE_CLOUD_PROJECT"),
    googleCloudLocation: required("GOOGLE_CLOUD_LOCATION"),
    geminiModelPro: process.env.GEMINI_MODEL_PRO ?? "gemini-2.5-pro",
    obsidianVaultPath: process.env.OBSIDIAN_VAULT_PATH ?? "./obsidian-vault",
    paperclipApiUrl: process.env.PAPERCLIP_API_URL ?? "http://localhost:3100",
    paperclipApiKey: required("PAPERCLIP_API_KEY"),
    crmApiUrl: required("CRM_AG_API_URL"),
    crmEmail: required("CRM_AG_EMAIL"),
    crmPassword: required("CRM_AG_PASSWORD"),
  };
}
