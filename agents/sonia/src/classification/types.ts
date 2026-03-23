import type { Materia, ServicoTipo } from "@sd-legal/shared";

export interface ClassificationResult {
  identificacao: {
    nome: string | null;
    dados_pessoais: Record<string, string>;
    lingua: string;
  };
  classificacao: {
    area: Materia;
    sub_tipo: ServicoTipo;
    urgencia: "urgente" | "normal" | "baixa";
    indicadores_prazo: string[];
  };
  intencao:
    | "informacao_geral"
    | "consulta"
    | "contratacao"
    | "reclamacao"
    | "outro";
  documentos_partilhados: Array<{ tipo: string; descricao: string }>;
  dados_em_falta: string[];
  notas_contexto: string;
}
