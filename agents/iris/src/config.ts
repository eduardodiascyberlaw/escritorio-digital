export interface IrisConfig {
  googleCloudProject: string;
  googleCloudLocation: string;
  geminiModelFlash: string;
  obsidianVaultPath: string;
  crmApiUrl: string;
  crmEmail: string;
  crmPassword: string;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.warn(`[Iris] Variável ${name} não definida — a usar valor vazio`);
    return "";
  }
  return value;
}

export function loadConfig(): IrisConfig {
  return {
    googleCloudProject: required("GOOGLE_CLOUD_PROJECT"),
    googleCloudLocation: required("GOOGLE_CLOUD_LOCATION"),
    geminiModelFlash: process.env.GEMINI_MODEL_FLASH ?? "gemini-2.5-flash",
    obsidianVaultPath: process.env.OBSIDIAN_VAULT_PATH ?? "./obsidian-vault",
    crmApiUrl: required("CRM_AG_API_URL"),
    crmEmail: required("CRM_AG_EMAIL"),
    crmPassword: required("CRM_AG_PASSWORD"),
  };
}
