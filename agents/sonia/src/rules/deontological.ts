export interface DeontologicalCheck {
  mustEscalate: boolean;
  reason?: string;
}

const ESCALATION_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /tenho\s+direito\s+a/i,
    reason: "Pergunta sobre direitos específicos — requer análise jurídica",
  },
  {
    pattern: /posso\s+(fazer|ir|ficar|trabalhar|viajar|recorrer)/i,
    reason: "Pergunta sobre possibilidades legais — requer análise jurídica",
  },
  {
    pattern: /prazo\s+(para|de|processual|legal|judicial)/i,
    reason: "Pergunta sobre prazo processual específico",
  },
  {
    pattern: /quantos?\s+dias?\s+(tenho|faltam|rest)/i,
    reason: "Pergunta sobre prazo processual específico",
  },
  {
    pattern: /(detido|detenção|detençao|preso|cadeia|cela)/i,
    reason: "Situação de detenção ou restrição de liberdade",
  },
  {
    pattern: /(deporta[çc]|expuls|afasta|remov)/i,
    reason: "Ameaça de deportação ou afastamento",
  },
  {
    pattern: /(menor|criança|filho.*menor|beb[ée])/i,
    reason: "Menor de idade envolvido",
  },
  {
    pattern: /(interpreta[çc]|significa.*documento|quer\s+dizer\s+este)/i,
    reason: "Pedido de interpretação de documento jurídico",
  },
  {
    pattern: /(violência|agress|ameaç|perigo\s+de\s+vida)/i,
    reason: "Situação de violência ou perigo — escalamento urgente",
  },
  {
    pattern: /(asilo|refúgio|proteç[ãa]o\s+internacional)/i,
    reason: "Pedido de protecção internacional — requer advogado",
  },
];

export function checkDeontologicalLimits(
  message: string
): DeontologicalCheck {
  for (const { pattern, reason } of ESCALATION_PATTERNS) {
    if (pattern.test(message)) {
      return { mustEscalate: true, reason };
    }
  }
  return { mustEscalate: false };
}
