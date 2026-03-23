/**
 * Gestor de instrucoes dos superiores.
 *
 * Recebe instrucoes via comando INSTRUCAO: no grupo de controlo,
 * valida autorizacao, resolve conflitos por hierarquia, e regista
 * em auditoria no Obsidian Vault.
 */

import { addInstruction, getActiveInstructions, clearInstructions } from "../identity/prompt-builder.js";
import type { VaultWriter } from "../obsidian/vault-writer.js";
import type { AuthorizedSuperior } from "./superiors.js";

export interface StoredInstruction {
  id: string;
  texto: string;
  autor: AuthorizedSuperior;
  timestamp: string;
  activa: boolean;
}

let instructions: StoredInstruction[] = [];

/**
 * Processa uma instrucao recebida de um superior.
 * Valida autorizacao, adiciona ao prompt-builder, e regista em auditoria.
 */
export async function handleInstruction(
  texto: string,
  autor: AuthorizedSuperior,
  vaultWriter: VaultWriter
): Promise<{ accepted: true; id: string } | { accepted: false; reason: string }> {
  const id = `i${Date.now().toString(36)}`;
  const timestamp = new Date().toISOString();

  const stored: StoredInstruction = {
    id,
    texto,
    autor,
    timestamp,
    activa: true,
  };

  instructions.push(stored);

  // Injectar no prompt-builder
  addInstruction(`[${autor.referencia}] ${texto}`);

  // Registar em auditoria (imutavel)
  const auditContent = `# Instrucao ${id}

| Campo | Valor |
|-------|-------|
| ID | ${id} |
| Data | ${timestamp} |
| Autor | ${autor.nome} (${autor.referencia}) |
| Cargo | ${autor.cargo} |
| Nivel | ${autor.nivel} |

## Texto da instrucao

${texto}
`;

  await vaultWriter.appendAudit(
    "instrucoes_superiores",
    `${id}_${timestamp.replace(/[:.]/g, "-")}.md`,
    auditContent
  );

  console.log(
    `[Hierarquia] Instrucao ${id} de ${autor.referencia} registada: "${texto.substring(0, 60)}..."`
  );

  return { accepted: true, id };
}

/**
 * Processa LIMPAR INSTRUCOES — remove todas as instrucoes activas.
 * So aceita de superiores com nivel >= 2 (Dona Carol ou Dr. Eduardo).
 */
export async function handleClearInstructions(
  autor: AuthorizedSuperior,
  vaultWriter: VaultWriter
): Promise<{ accepted: true; count: number } | { accepted: false; reason: string }> {
  if (autor.nivel < 2) {
    return {
      accepted: false,
      reason: `${autor.referencia} nao tem autorizacao para limpar instrucoes (nivel ${autor.nivel} < 2)`,
    };
  }

  const count = instructions.filter((i) => i.activa).length;
  instructions = instructions.map((i) => ({ ...i, activa: false }));
  clearInstructions();

  const timestamp = new Date().toISOString();
  const auditContent = `# Limpeza de instrucoes

| Campo | Valor |
|-------|-------|
| Data | ${timestamp} |
| Autor | ${autor.nome} (${autor.referencia}) |
| Instrucoes removidas | ${count} |
`;

  await vaultWriter.appendAudit(
    "instrucoes_superiores",
    `clear_${timestamp.replace(/[:.]/g, "-")}.md`,
    auditContent
  );

  console.log(
    `[Hierarquia] ${count} instrucoes limpas por ${autor.referencia}`
  );

  return { accepted: true, count };
}

/**
 * Lista instrucoes activas (para comando INSTRUCOES no grupo).
 */
export function listActiveInstructions(): StoredInstruction[] {
  return instructions.filter((i) => i.activa);
}

/**
 * Retorna as instrucoes activas formatadas para o grupo de controlo.
 */
export function formatActiveInstructions(): string {
  const active = listActiveInstructions();
  if (active.length === 0) {
    return "Nenhuma instrucao activa.";
  }

  const lines = active.map(
    (i, idx) =>
      `${idx + 1}. [${i.autor.referencia}] ${i.texto}\n   _${i.id} — ${new Date(i.timestamp).toLocaleString("pt-PT")}_`
  );

  return `*INSTRUCOES ACTIVAS (${active.length}):*\n\n${lines.join("\n\n")}`;
}
