export interface LexConfig {
  anthropicApiKey: string;
  anthropicModel: string;
  obsidianVaultPath: string;
  lexCorpusUrl: string;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.warn(`[Lex] Variável ${name} não definida — a usar valor vazio`);
    return "";
  }
  return value;
}

export function loadConfig(): LexConfig {
  return {
    anthropicApiKey: required("ANTHROPIC_API_KEY"),
    anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6-20250514",
    obsidianVaultPath: process.env.OBSIDIAN_VAULT_PATH ?? "./obsidian-vault",
    lexCorpusUrl: process.env.LEX_CORPUS_URL ?? "http://localhost:3010",
  };
}
