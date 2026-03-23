/**
 * Prompt Builder — constroi system prompts dinamicamente
 *
 * Combina a personalidade base da SonIA (persona.ts) com instrucoes
 * especificas de cada tarefa e instrucoes activas dos superiores.
 */

import { PERSONA_INSTRUCTION } from "./persona.js";

/**
 * Lista de instrucoes activas recebidas dos superiores via grupo de controlo.
 * Injectadas em todos os prompts que interagem com clientes.
 */
let activeInstructions: string[] = [];

export function addInstruction(instruction: string): void {
  activeInstructions.push(instruction);
}

export function getActiveInstructions(): string[] {
  return [...activeInstructions];
}

export function clearInstructions(): void {
  activeInstructions = [];
}

/**
 * Constroi um system prompt completo combinando:
 * 1. Personalidade base (PERSONA_INSTRUCTION)
 * 2. Instrucoes especificas da tarefa
 * 3. Instrucoes activas dos superiores
 */
export function buildPrompt(taskInstructions: string): string {
  const parts = [PERSONA_INSTRUCTION, "", taskInstructions];

  if (activeInstructions.length > 0) {
    parts.push(
      "",
      "INSTRUCOES ADICIONAIS DOS SUPERIORES (aplicar imediatamente):",
      ...activeInstructions.map((i, idx) => `${idx + 1}. ${i}`)
    );
  }

  return parts.join("\n");
}
