// ─────────────────────────────────────────────
// Schema de Tickets — Protocolo de comunicação inter-agentes
// Conforme CLAUDE.md secção 3
// ─────────────────────────────────────────────

export type AgentId = "sonia" | "rex" | "iris" | "lex" | "nova" | "humano";

export type TicketTipo =
  | "triagem_novo_cliente"
  | "triagem_cliente_existente"
  | "abertura_processo"
  | "pedido_honorarios"
  | "confirmacao_pagamento"
  | "pedido_peca"
  | "pedido_pesquisa"
  | "update_cliente"
  | "alerta_prazo"
  | "escalamento_humano"
  | "validacao_peca";

export type RetornoTipo =
  | "ficha_cliente"
  | "processo_aberto"
  | "proposta_honorarios"
  | "confirmacao_financeira"
  | "rascunho_peca"
  | "peca_validada"
  | "memo_pesquisa"
  | "update_estado"
  | "decisao_humana";

export type Prioridade = "urgente" | "normal" | "baixa";

export type TicketEstado =
  | "pendente"
  | "em_curso"
  | "aguarda_humano"
  | "concluido"
  | "cancelado";

export type Materia =
  | "imigracao"
  | "laboral"
  | "administrativo"
  | "familia"
  | "nacionalidade"
  | "outro";

export type UrgenciaProcessual = "cautelar" | "prazo_curto" | "normal";

export interface AuditEntry {
  timestamp: string;
  agente: AgentId;
  accao: string;
  detalhe?: string;
}

export interface TicketContexto {
  materia?: Materia;
  urgencia_processual?: UrgenciaProcessual;
  resumo: string;
  documentos?: string[];
  dados_adicionais?: Record<string, unknown>;
}

export interface Ticket {
  ticket_id: string;
  criado_em: string;
  atualizado_em: string;

  origem: AgentId;
  destino: AgentId;
  tipo: TicketTipo;
  prioridade: Prioridade;

  cliente_id: string;
  processo_id?: string;

  contexto: TicketContexto;
  payload: Record<string, unknown>;
  retorno_esperado: RetornoTipo;
  deadline?: string;

  estado: TicketEstado;
  audit_trail: AuditEntry[];
}
