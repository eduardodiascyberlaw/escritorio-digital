/**
 * Rotina matinal das 09:00
 *
 * Verifica mensagens recebidas fora do horario e gera saudacoes
 * personalizadas para cada cliente, enviadas como rascunho ao
 * grupo de controlo.
 */

import type { SupervisedMode } from "../supervised/supervised-mode.js";

export interface OvernightMessage {
  phone: string;
  name: string | null;
  text: string;
  receivedAt: string; // ISO 8601
}

/**
 * Fila de mensagens recebidas fora do horario.
 * O webhook-handler adiciona mensagens aqui quando detecta que esta
 * fora do horario util. A rotina matinal processa e limpa a fila.
 */
const overnightQueue: OvernightMessage[] = [];

export function addOvernightMessage(msg: OvernightMessage): void {
  // Evitar duplicados do mesmo telefone
  const existing = overnightQueue.find((m) => m.phone === msg.phone);
  if (!existing) {
    overnightQueue.push(msg);
  }
}

export function getOvernightQueue(): OvernightMessage[] {
  return [...overnightQueue];
}

/**
 * Executa a rotina matinal: para cada cliente que enviou mensagem
 * durante a noite/fim-de-semana, gera uma saudacao personalizada
 * e submete como rascunho para aprovacao.
 */
export async function executeMorningRoutine(
  supervised: SupervisedMode
): Promise<number> {
  const messages = [...overnightQueue];
  overnightQueue.length = 0; // limpar fila

  if (messages.length === 0) {
    console.log("[Rotina 09:00] Nenhuma mensagem da noite para processar.");
    return 0;
  }

  console.log(
    `[Rotina 09:00] ${messages.length} cliente(s) com mensagens da noite.`
  );

  for (const msg of messages) {
    const nome = msg.name ?? "cliente";
    const greeting = `Bom dia, ${nome}! Vi a sua mensagem e ja estou analisando. Volto em breve com uma resposta!`;

    await supervised.submitDraft(
      msg.phone,
      msg.name,
      msg.text,
      greeting,
      `🌅 Rotina matinal — mensagem recebida fora do horario (${msg.receivedAt})`
    );
  }

  console.log(
    `[Rotina 09:00] ${messages.length} saudacao(oes) enviada(s) ao grupo de controlo.`
  );

  return messages.length;
}
