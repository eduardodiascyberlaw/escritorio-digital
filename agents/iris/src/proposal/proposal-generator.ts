import { v4 as uuid } from "uuid";
import type { Ticket, Materia } from "@sd-legal/shared";
import { findServicePrice, getTariff, type TariffEntry } from "../tariff/tariff-engine.js";

export interface HonorariosProposal {
  id: string;
  cliente_id: string;
  processo_id: string | undefined;
  servico: string;
  valor_total: number;
  valor_contratacao: number; // 30%
  valor_judicial: number;    // 70%
  tem_exito: boolean;
  percentagem_exito: number;
  parcelas_possiveis: number;
  valor_parcela: number;
  observacoes: string;
  desconto_aplicado: number; // percentage
  valor_com_desconto: number;
  texto_proposta: string;    // formatted text for client
}

export function generateProposal(
  ticket: Ticket,
  isSecondProcess: boolean = false,
  isReferral: boolean = false
): HonorariosProposal | null {
  const materia = (ticket.contexto.materia ?? "outro") as string;
  const tipoProcesso = (ticket.payload as Record<string, unknown>).tipo_processo as string ?? "";
  const complexidade = (ticket.payload as Record<string, unknown>).complexidade as string ?? "media";

  const tariffEntry = findServicePrice(materia, tipoProcesso, complexidade);

  if (!tariffEntry) {
    console.log(`[Iris] Tarifa não encontrada: ${materia} / ${tipoProcesso}`);
    return null;
  }

  const tariff = getTariff();
  const id = uuid();

  // Calculate discount
  let desconto = 0;
  if (isSecondProcess) desconto = tariff.descontos.segundo_processo;
  else if (isReferral) desconto = tariff.descontos.referencia;

  const valorBase = tariffEntry.valor;
  const valorComDesconto = valorBase * (1 - desconto / 100);

  // Payment split
  const valorContratacao = Math.round(valorComDesconto * tariff.modalidades.reparticao_contratacao / 100);
  const valorJudicial = valorComDesconto - valorContratacao;

  // Check if this is a success-fee service
  const temExito = tariffEntry.observacao.toLowerCase().includes("êxito") ||
    tariffEntry.observacao.toLowerCase().includes("recuperado");

  // Installments
  const maxParcelas = Math.min(
    tariff.modalidades.max_parcelas,
    Math.floor(valorComDesconto / tariff.modalidades.minimo_parcela)
  );
  const valorParcela = maxParcelas > 0
    ? Math.ceil(valorComDesconto / maxParcelas)
    : valorComDesconto;

  // Generate text
  const texto = generateProposalText(
    tariffEntry,
    valorComDesconto,
    valorContratacao,
    valorJudicial,
    temExito,
    tariff.modalidades.percentagem_exito,
    maxParcelas,
    valorParcela,
    desconto
  );

  return {
    id,
    cliente_id: ticket.cliente_id,
    processo_id: ticket.processo_id,
    servico: tariffEntry.servico,
    valor_total: valorComDesconto,
    valor_contratacao: valorContratacao,
    valor_judicial: valorJudicial,
    tem_exito: temExito,
    percentagem_exito: temExito ? tariff.modalidades.percentagem_exito : 0,
    parcelas_possiveis: maxParcelas,
    valor_parcela: valorParcela,
    observacoes: tariffEntry.observacao,
    desconto_aplicado: desconto,
    valor_com_desconto: valorComDesconto,
    texto_proposta: texto,
  };
}

function generateProposalText(
  entry: TariffEntry,
  valorTotal: number,
  valorContratacao: number,
  valorJudicial: number,
  temExito: boolean,
  percExito: number,
  parcelas: number,
  valorParcela: number,
  desconto: number
): string {
  let text = `📋 *Proposta de Honorários*\n`;
  text += `━━━━━━━━━━━━━━━━━━━━\n`;
  text += `*Serviço:* ${entry.servico}\n`;
  text += `💰 *Valor:* €${valorTotal.toFixed(2)}\n`;

  if (desconto > 0) {
    text += `🏷️ Desconto de ${desconto}% aplicado\n`;
  }

  if (entry.observacao) {
    text += `ℹ️ ${entry.observacao}\n`;
  }

  text += `━━━━━━━━━━━━━━━━━━━━\n`;

  if (temExito) {
    text += `*Modalidade:* Provisionamento + ${percExito}% de êxito\n`;
    text += `• Provisionamento: €${valorTotal.toFixed(2)} na contratação\n`;
    text += `• Êxito: ${percExito}% sobre o valor recuperado (deduzido o provisionamento)\n`;
  } else if (valorJudicial > 0) {
    text += `*Pagamento:*\n`;
    text += `• 30% na contratação: €${valorContratacao.toFixed(2)}\n`;
    text += `• 70% no início da fase judicial: €${valorJudicial.toFixed(2)}\n`;
  } else {
    text += `*Pagamento:* €${valorTotal.toFixed(2)} na contratação\n`;
  }

  if (parcelas > 1) {
    text += `\n📅 *Plano de parcelas disponível:*\n`;
    text += `• Até ${parcelas}× de €${valorParcela.toFixed(2)}\n`;
  }

  text += `━━━━━━━━━━━━━━━━━━━━\n`;
  text += `Os valores já incluem IVA, quando incidente.\n`;
  text += `O valor da consulta jurídica é deduzido dos honorários em caso de contratação.\n`;
  text += `\nProposta válida por 30 dias.\n`;
  text += `\nPara aceitar, respondam *ACEITO*.`;

  return text;
}
