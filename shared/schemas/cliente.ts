// ─────────────────────────────────────────────
// Schema CRM AG — Campos de cliente
// Conforme CLAUDE.md secção 4
// ─────────────────────────────────────────────

// ── Nível 1 — Obrigatório para abrir qualquer processo ──

export interface RgpdConsentimento {
  consentimento_dados_pessoais: boolean;
  consentimento_partilha_tribunais: boolean;
  consentimento_comunicacoes: boolean;
  consentimento_retencao_pos_processo: boolean;
  data_consentimento: string;
  canal_consentimento: "whatsapp" | "email" | "presencial" | "portal";
  hash_sha256: string;
  versao_texto_consentimento: string;
  ip_origem?: string;
}

export interface ClienteNivel1 {
  nome_completo: string;
  data_nascimento: string;
  nacionalidade: string;
  tipo_documento_id:
    | "passaporte"
    | "cc"
    | "bi"
    | "titulo_residencia"
    | "outro";
  numero_documento_id: string;
  validade_documento_id: string;

  telefone_whatsapp: string;
  email: string;
  lingua_preferencial: string;

  nif?: string;
  justificacao_ausencia_nif?: string;

  rgpd: RgpdConsentimento;

  como_chegou:
    | "referencia"
    | "pesquisa_web"
    | "cliente_anterior"
    | "redes_sociais"
    | "outro";
  referencia_detalhe?: string;
  data_primeiro_contacto: string;
}

// ── Nível 2 — Obrigatório por área de prática ──

export interface ClienteImigracao {
  pais_nascimento: string;
  pais_residencia_actual: string;
  tipo_titulo_actual?: string;
  numero_titulo_residencia?: string;
  validade_titulo_actual?: string;
  data_entrada_portugal?: string;
  niss?: string;
  numero_passaporte?: string;
  processos_anteriores_aima: boolean;
  referencia_processo_aima?: string;
}

export interface ClienteLaboral {
  entidade_empregadora?: string;
  nif_empregadora?: string;
  data_inicio_contrato?: string;
  tipo_contrato?:
    | "prazo_certo"
    | "indeterminado"
    | "prestacao_servicos"
    | "outro";
  situacao_actual: "activo" | "despedido" | "baixa" | "outro";
}

export interface ClienteAdministrativo {
  entidade_publica: string;
  referencia_processo_administrativo?: string;
  data_acto_administrativo?: string;
  data_notificacao_acto?: string;
}

export interface ClienteNacionalidade {
  grau_ligacao: "nascimento" | "ascendencia" | "casamento" | "residencia";
  anos_residencia_legal?: number;
  cert_registo_criminal_pt: "existe" | "nao_existe" | "a_obter";
  cert_registo_criminal_origem: "existe" | "nao_existe" | "a_obter";
}

// ── Nível 3 — Importante mas não bloqueante ──

export interface ClienteNivel3 {
  morada_portugal?: string;
  morada_pais_origem?: string;
  contacto_emergencia?: {
    nome: string;
    telefone: string;
    relacao: string;
  };
  estado_civil?:
    | "solteiro"
    | "casado"
    | "uniao_facto"
    | "divorciado"
    | "viuvo";
  profissao?: string;
  habilitacoes?: string;
  filhos_menores?: number;
  conjuge?: { nome: string; nacionalidade: string };
  outras_linguas?: string[];
  acessibilidade?: string;
  horario_preferido?: string;
  canal_comunicacao_preferido?: "whatsapp" | "email" | "telefone";
  observacoes?: string;
}
