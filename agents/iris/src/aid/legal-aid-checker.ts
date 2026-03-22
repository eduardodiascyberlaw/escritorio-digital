/**
 * Verificação de elegibilidade para apoio judiciário
 * Base: Lei 34/2004 — rendimento do agregado ≤ 1,5× IAS
 */

const IAS_2026 = 522.50; // Indexante dos Apoios Sociais
const LIMIAR_AJ = IAS_2026 * 1.5; // €783,75

export interface LegalAidAssessment {
  elegivel: boolean;
  rendimento_declarado: number;
  limiar: number;
  ias: number;
  recomendacao: string;
  modalidade_sugerida: "dispensa_custas" | "patrono_nomeado" | "dispensa_e_patrono" | "nao_elegivel";
}

export function assessLegalAidEligibility(
  rendimentoMensal: number
): LegalAidAssessment {
  const elegivel = rendimentoMensal <= LIMIAR_AJ;

  let modalidade: LegalAidAssessment["modalidade_sugerida"];
  let recomendacao: string;

  if (rendimentoMensal <= IAS_2026) {
    modalidade = "dispensa_e_patrono";
    recomendacao =
      "Rendimento muito baixo — elegível para dispensa total de custas e nomeação de patrono. O escritório pode ser nomeado como patrono escolhido (Art. 33.º Lei 34/2004).";
  } else if (rendimentoMensal <= LIMIAR_AJ) {
    modalidade = "dispensa_custas";
    recomendacao =
      "Elegível para apoio judiciário. Recomendamos pedir dispensa de custas. O cliente paga os honorários do escritório normalmente, mas fica isento de taxas judiciais.";
  } else {
    modalidade = "nao_elegivel";
    recomendacao =
      "Não elegível para apoio judiciário. Processo segue com tarifário normal do escritório.";
  }

  return {
    elegivel,
    rendimento_declarado: rendimentoMensal,
    limiar: LIMIAR_AJ,
    ias: IAS_2026,
    recomendacao,
    modalidade_sugerida: modalidade,
  };
}

export function generateLegalAidText(assessment: LegalAidAssessment): string {
  if (!assessment.elegivel) {
    return "";
  }

  return `ℹ️ *Apoio Judiciário*

Pela informação disponível, pode ter direito a apoio judiciário, o que reduz os custos do processo.

O limiar para 2026 é de €${assessment.limiar.toFixed(2)}/mês (1,5× IAS).

${assessment.modalidade_sugerida === "dispensa_e_patrono"
    ? "Poderá ficar isento de custas judiciais e ter advogado pago pelo Estado."
    : "Poderá ficar isento de custas judiciais (taxas do tribunal)."}

Quer que o ajudemos a pedir apoio judiciário na Segurança Social?`;
}
