import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Tarifário do escritório — valores carregados do Obsidian Vault
 * Fonte: /Financeiro/tarifario.md
 */

export interface TariffEntry {
  servico: string;
  valor: number;
  observacao: string;
}

export interface TariffTable {
  consultas: TariffEntry[];
  imigracao_ar: TariffEntry[];
  contencioso: TariffEntry[];
  nacionalidade: TariffEntry[];
  laboral: TariffEntry[];
  administrativo: TariffEntry[];
  modalidades: {
    reparticao_contratacao: number; // 30%
    reparticao_judicial: number;    // 70%
    minimo_parcela: number;         // 150
    max_parcelas: number;           // 10
    valor_hora: number;             // 150
    percentagem_exito: number;      // 20%
  };
  descontos: {
    segundo_processo: number;       // 10%
    referencia: number;             // 10%
    pagamento_integral: number;     // 10%
  };
}

// Hard-coded from the tarifário approved by Eduardo
const TARIFF: TariffTable = {
  consultas: [
    { servico: "Consulta videoconferência (30 min)", valor: 70, observacao: "" },
    { servico: "Consulta videoconferência (1 hora)", valor: 150, observacao: "" },
    { servico: "Consulta urgente (fora de horário)", valor: 250, observacao: "Sábados ou após 19h" },
  ],
  imigracao_ar: [
    { servico: "Primeira AR (fase administrativa)", valor: 500, observacao: "+€1.200 se necessária acção judicial" },
    { servico: "Primeira AR (trabalho independente)", valor: 500, observacao: "+€1.200 se necessária acção judicial" },
    { servico: "Primeira AR (formação profissional)", valor: 500, observacao: "+€1.200 se necessária acção judicial" },
    { servico: "Renovação de AR (standard)", valor: 300, observacao: "" },
    { servico: "Renovação de AR (com complicações)", valor: 800, observacao: "" },
    { servico: "Reagrupamento familiar", valor: 500, observacao: "" },
    { servico: "AR para estudantes", valor: 500, observacao: "" },
    { servico: "AR permanente", valor: 800, observacao: "" },
  ],
  contencioso: [
    { servico: "Providência cautelar contra AIMA", valor: 1500, observacao: "Inclui eventuais recursos" },
    { servico: "Acção administrativa (impugnação + condenação)", valor: 1500, observacao: "Inclui eventuais recursos" },
    { servico: "Providência cautelar + acção principal (pacote)", valor: 1500, observacao: "Inclui eventuais recursos" },
    { servico: "Contestação de indicação SIS II", valor: 800, observacao: "" },
    { servico: "Recurso hierárquico", valor: 300, observacao: "" },
  ],
  nacionalidade: [
    { servico: "Nacionalidade (qualquer via)", valor: 800, observacao: "" },
    { servico: "Recurso de indeferimento de nacionalidade", valor: 800, observacao: "" },
  ],
  laboral: [
    { servico: "Acção de impugnação de despedimento", valor: 1500, observacao: "Inclui eventuais recursos" },
    { servico: "Reconhecimento de contrato de trabalho", valor: 1500, observacao: "Provisionamento + 20% êxito" },
    { servico: "Créditos laborais", valor: 0, observacao: "20% sobre valor recuperado, deduz provisionamento" },
    { servico: "Assédio laboral", valor: 1500, observacao: "Inclui eventuais recursos" },
  ],
  administrativo: [
    { servico: "Recurso de contra-ordenação", valor: 800, observacao: "" },
    { servico: "Impugnação de acto administrativo", valor: 1500, observacao: "" },
    { servico: "Intimação para protecção de direitos", valor: 1500, observacao: "" },
  ],
  modalidades: {
    reparticao_contratacao: 30,
    reparticao_judicial: 70,
    minimo_parcela: 150,
    max_parcelas: 10,
    valor_hora: 150,
    percentagem_exito: 20,
  },
  descontos: {
    segundo_processo: 10,
    referencia: 10,
    pagamento_integral: 10,
  },
};

export function getTariff(): TariffTable {
  return TARIFF;
}

export function findServicePrice(
  materia: string,
  tipoProcesso: string,
  complexidade: string
): TariffEntry | null {
  const m = materia.toLowerCase();
  const t = tipoProcesso.toLowerCase();

  // Imigração
  if (m.includes("imigracao") || m.includes("imigração")) {
    if (t.includes("cautelar")) return TARIFF.contencioso[0];
    if (t.includes("impugnação") || t.includes("impugnacao") || t.includes("condenação")) return TARIFF.contencioso[1];
    if (t.includes("sis")) return TARIFF.contencioso[3];
    if (t.includes("recurso hierárquico") || t.includes("recurso hierarquico")) return TARIFF.contencioso[4];
    if (t.includes("renovação") || t.includes("renovacao")) {
      return complexidade === "alta" ? TARIFF.imigracao_ar[4] : TARIFF.imigracao_ar[3];
    }
    if (t.includes("reagrupamento")) return TARIFF.imigracao_ar[5];
    if (t.includes("estudant")) return TARIFF.imigracao_ar[6];
    if (t.includes("permanent")) return TARIFF.imigracao_ar[7];
    // Default: primeira AR
    return TARIFF.imigracao_ar[0];
  }

  // Laboral
  if (m.includes("laboral")) {
    if (t.includes("despedimento")) return TARIFF.laboral[0];
    if (t.includes("reconhecimento")) return TARIFF.laboral[1];
    if (t.includes("crédito") || t.includes("credito") || t.includes("salário")) return TARIFF.laboral[2];
    if (t.includes("assédio") || t.includes("assedio")) return TARIFF.laboral[3];
    return TARIFF.laboral[0]; // Default laboral
  }

  // Nacionalidade
  if (m.includes("nacionalidade")) {
    if (t.includes("recurso") || t.includes("indeferimento")) return TARIFF.nacionalidade[1];
    return TARIFF.nacionalidade[0];
  }

  // Administrativo
  if (m.includes("administrativo")) {
    if (t.includes("contra-ordenação") || t.includes("contraordenacao")) return TARIFF.administrativo[0];
    if (t.includes("intimação") || t.includes("intimacao")) return TARIFF.administrativo[2];
    return TARIFF.administrativo[1];
  }

  // Família
  if (m.includes("familia") || m.includes("família")) {
    return { servico: "Processo de família", valor: 800, observacao: "Valor a confirmar" };
  }

  return null;
}
