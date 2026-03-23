/**
 * Base de Conhecimento de Servicos — SD Legal
 *
 * Dados estruturados de cada servico do escritorio, usados pela SonIA
 * para responder com precisao sobre servicos, precos, documentos e etapas.
 *
 * Fonte: "Ficha de Servicos — Base de Conhecimento da SonIA" (PDF)
 */

import type { ServicoTipo } from "@sd-legal/shared";

export interface ServiceFAQ {
  pergunta: string;
  resposta: string;
}

export interface ServiceInfo {
  codigo: ServicoTipo;
  nome: string;
  descricao: string | null;
  publico_alvo: string | null;
  documentos_necessarios: string[];
  etapas: string[];
  prazo_estimado: string | null;
  honorarios: string | null;
  forma_pagamento: string | null;
  faqs: ServiceFAQ[];
  sonia_pode_dizer: string | null;
  sonia_nao_deve_dizer: string | null;
  observacoes: string | null;
  preenchido: boolean;
}

// ─────────────────────────────────────────────
// SERVICOS PREENCHIDOS (dados do PDF)
// ─────────────────────────────────────────────

const PEDIDO_AR: ServiceInfo = {
  codigo: "pedido_ar",
  nome: "Autorizacao de Residencia — Primeiro Pedido",
  descricao:
    "O servico de obtencao de autorizacao de residencia pode ser realizado de duas maneiras, a depender do tipo de artigo. Pode ser um servico por via administrativa ou por via judicial. E necessario filtrar a situacao do cliente para explicar qual servico sera oferecido.",
  publico_alvo:
    "Imigrantes que ja estao em Portugal e querem se regularizar, empresarios que querem regularizar funcionarios que ja estao trabalhando.",
  documentos_necessarios: [
    "Passaporte",
    "Comprovante de entrada regular (visto, passagem aerea, passagem de autocarro)",
    "Comprovacao de subsistencia (contrato de trabalho, recibos de vencimento)",
    "Comprovacao de morada",
    "NIF, NISS, registo criminal do pais de origem",
  ],
  etapas: [
    "Se possivel, cadastro no portal da AIMA com submissao de documentos. Se nao possivel, inicio do pedido via CTT com envio dos documentos exigidos.",
    "Pelo portal: aguardar retorno da AIMA com agendamento. Via CTT: enviar interpelacao a AIMA para prosseguimento.",
    "Via CTT: iniciar accao judicial para requerer informacoes do pedido.",
    "Via CTT: possibilidade de obtencao do agendamento durante a accao judicial.",
    "Via CTT: obtencao pos sentenca do agendamento (pode ser necessario outra accao).",
  ],
  prazo_estimado: "3-6 meses (podendo ser menos ou mais tempo)",
  honorarios: "500 EUR via administrativa / 1500 EUR via judicial",
  forma_pagamento: "Transferencia bancaria",
  faqs: [
    {
      pergunta: "Vim como turista, como posso obter o titulo de residencia?",
      resposta:
        "Neste momento nao existe mais manifestacao de interesse nem visto de procura de trabalho. As formas possiveis de regularizacao para quem ja esta em Portugal sao atraves de autorizacao de residencia por reagrupamento familiar ou estudos. O visto de trabalho existe mas tem que ser pedido no consulado portugues ainda no Brasil, antes de vir para Portugal.",
    },
    {
      pergunta:
        "Tenho uma namorada portuguesa, posso me regularizar atraves dela?",
      resposta:
        "E possivel sim, mas e necessario realizar casamento antes para iniciar processo de reagrupamento familiar conjuge cidadao europeu. Trabalhamos tambem com servico de casamento de forma online no Brasil e transcricao em Portugal, ou diretamente em conservatoria portuguesa. Apos transcricao, iniciamos processo por via administrativa.",
    },
    {
      pergunta:
        "Dei entrada para reagrupamento familiar no portal da AIMA mas fazem mais de 6 meses e nao recebi agendamento. O que pode ser feito?",
      resposta:
        "Podemos iniciar accao judicial para requerer informacoes sobre o estado do processo e assim obter resposta sobre o agendamento.",
    },
  ],
  sonia_pode_dizer: "Informar como funciona o servico e valores.",
  sonia_nao_deve_dizer:
    "Nunca dar prazos exactos de decisao da AIMA. Nunca prometer que o agendamento sera obtido. Todo o processo e um auxilio/tentativa, nao podemos prometer exito dependendo da AIMA.",
  observacoes:
    "Informar o cliente das opcoes de processo. Reagrupamento familiar conjuge (mae/pai) e filhos, reagrupamento familiar de conjuge cidadao europeu, estudante de ensino superior: pode ser feito por via administrativa. IMPORTANTE: O visto de trabalho (por conta de outrem ou independente) EXISTE mas tem que ser pedido no consulado portugues ainda no pais de origem (ex: Brasil), antes de vir para Portugal. O visto de procura de trabalho nao esta disponivel. A manifestacao de interesse ja nao existe. Para quem ja esta em Portugal sem visto de trabalho, as opcoes de regularizacao sao: reagrupamento familiar ou estudos. Se for estudo curso tecnico ou reagrupamento familiar de conjuge sem ser cidadao europeu, tem que ser processo tribunal.",
  preenchido: true,
};

const RENOVACAO_AR: ServiceInfo = {
  codigo: "renovacao_ar",
  nome: "Autorizacao de Residencia — Renovacao",
  descricao: "Renovar autorizacao de residencia pelo portal disponivel da AIMA.",
  publico_alvo: "Imigrantes com titulo de residencia vencido.",
  documentos_necessarios: [
    "Passaporte",
    "Titulo de residencia vencido",
    "Contrato de trabalho e recibos de vencimento",
  ],
  etapas: [
    "Criar conta no portal da AIMA",
    "Verificar situacao regularizada em financas e seguranca social",
    "Solicitar pedido de renovacao",
    "Enviar referencia para cliente pagar DUC",
    "Submissao de documentos e aguardar analise da AIMA",
  ],
  prazo_estimado:
    "Em torno de 1 semana ate a submissao dos documentos, 2 meses para deferimento do pedido e envio do cartao para emissao.",
  honorarios: "300 EUR",
  forma_pagamento: "Transferencia bancaria",
  faqs: [
    {
      pergunta: "Ja esta disponivel para renovacao o mes de abril de 2026?",
      resposta: "Sim.",
    },
    {
      pergunta: "Ja esta disponivel para renovacao o mes de agosto de 2026?",
      resposta: "Nao.",
    },
  ],
  sonia_pode_dizer: "Etapas do processo, valores, documentos necessarios.",
  sonia_nao_deve_dizer:
    "Nunca dar prazos exactos de decisao da AIMA. Nunca fazer promessas de conclusao de processo se o mesmo tiver algum problema.",
  observacoes:
    "Saber filtrar qual portal sera feito, pois ha solicitacao de documentos diferentes.",
  preenchido: true,
};

const REAGRUPAMENTO_FAMILIAR: ServiceInfo = {
  codigo: "reagrupamento_familiar",
  nome: "Reagrupamento Familiar",
  descricao:
    "Este servico pode ser feito pelos portais disponiveis da AIMA. Se nenhum dos componentes do casal for cidadao europeu e for um reagrupamento so de conjuge, o servico tem que ser por via judicial.",
  publico_alvo: "Imigrantes que desejam reagrupar familiares em Portugal.",
  documentos_necessarios: [
    "Passaporte",
    "Comprovativo de entrada legal",
    "Certidao de casamento e/ou certidao de nascimento",
    "Comprovante de subsistencia",
  ],
  etapas: [
    "Criar pedido no portal da AIMA ou iniciar pedido via CTT",
    "Aguardar agendamento da AIMA ou interpelar a AIMA sobre o agendamento",
    "Se necessario, iniciar processo no tribunal",
  ],
  prazo_estimado: "3-6 meses (podendo ser mais ou menos)",
  honorarios: "500 EUR via administrativa / 1500 EUR via judicial",
  forma_pagamento: "Transferencia bancaria",
  faqs: [
    {
      pergunta:
        "Ja tenho autorizacao de residencia, posso reagrupar meus filhos?",
      resposta:
        "Qual a idade deles? Se forem menores de 18 anos, sim.",
    },
    {
      pergunta: "Namoro uma portuguesa, posso me regularizar atraves dela?",
      resposta:
        "Apos casamento sim, pode ser feito pedido de reagrupamento.",
    },
  ],
  sonia_pode_dizer:
    "Informacoes sobre documentos necessarios, no que consiste o servico, etapas, valores.",
  sonia_nao_deve_dizer:
    "Nunca dar prazos exactos de decisao da AIMA. Nunca prometer 100% de garantia de obtencao do agendamento.",
  observacoes:
    "Dependendo de quem sera reagrupado, difere o tipo de processo — pode ser pelo portal ou tera que ser feito processo judicial.",
  preenchido: true,
};

// ─────────────────────────────────────────────
// SERVICOS NAO PREENCHIDOS (stub — aguardam dados do Eduardo)
// ─────────────────────────────────────────────

function stubService(codigo: ServicoTipo, nome: string): ServiceInfo {
  return {
    codigo,
    nome,
    descricao: null,
    publico_alvo: null,
    documentos_necessarios: [],
    etapas: [],
    prazo_estimado: null,
    honorarios: null,
    forma_pagamento: null,
    faqs: [],
    sonia_pode_dizer: null,
    sonia_nao_deve_dizer: null,
    observacoes: null,
    preenchido: false,
  };
}

// ─────────────────────────────────────────────
// CATALOGO COMPLETO
// ─────────────────────────────────────────────

const SERVICE_CATALOG = new Map<ServicoTipo, ServiceInfo>([
  ["pedido_ar", PEDIDO_AR],
  ["renovacao_ar", RENOVACAO_AR],
  ["reagrupamento_familiar", REAGRUPAMENTO_FAMILIAR],
  ["nacionalidade_pt", stubService("nacionalidade_pt", "Nacionalidade Portuguesa")],
  ["emissao_nif", stubService("emissao_nif", "Emissao de NIF")],
  ["constituicao_empresa", stubService("constituicao_empresa", "Constituicao de Empresa")],
  ["abertura_actividade", stubService("abertura_actividade", "Abertura de Actividade")],
  ["processo_laboral", stubService("processo_laboral", "Processo Laboral")],
  ["recurso_ar_indeferida", stubService("recurso_ar_indeferida", "Recurso — AR Indeferida")],
  ["suspensao_saida_voluntaria", stubService("suspensao_saida_voluntaria", "Suspensao de Saida Voluntaria")],
  ["casamento_portugal", stubService("casamento_portugal", "Casamento em Portugal")],
  ["casamento_brasil", stubService("casamento_brasil", "Casamento no Brasil")],
  ["divorcio_portugal", stubService("divorcio_portugal", "Divorcio em Portugal")],
  ["divorcio_brasil", stubService("divorcio_brasil", "Divorcio no Brasil")],
  ["revisao_sentenca_pt", stubService("revisao_sentenca_pt", "Revisao de Sentenca Estrangeira (Portugal)")],
  ["homologacao_sentenca_br", stubService("homologacao_sentenca_br", "Homologacao de Sentenca (Brasil)")],
  ["injuncao_pagamento", stubService("injuncao_pagamento", "Injuncao de Pagamento")],
  ["insolvencia_empresa", stubService("insolvencia_empresa", "Insolvencia de Empresa")],
  ["insolvencia_pessoal", stubService("insolvencia_pessoal", "Insolvencia Pessoal")],
]);

// ─────────────────────────────────────────────
// API PUBLICA
// ─────────────────────────────────────────────

/** Retorna info detalhada de um servico pelo codigo. */
export function getService(codigo: ServicoTipo): ServiceInfo | undefined {
  return SERVICE_CATALOG.get(codigo);
}

/** Retorna todos os servicos preenchidos. */
export function getFilledServices(): ServiceInfo[] {
  return [...SERVICE_CATALOG.values()].filter((s) => s.preenchido);
}

/** Lista todos os nomes de servicos (para referencia geral). */
export function getAllServiceNames(): string[] {
  return [...SERVICE_CATALOG.values()].map((s) => `- ${s.nome}`);
}

/**
 * Tenta encontrar servicos relevantes com base no texto do cliente.
 * Usa patterns simples para match rapido (sem custo LLM).
 */
export function findRelevantServices(text: string): ServiceInfo[] {
  const lower = text.toLowerCase();
  const matches: ServiceInfo[] = [];

  const patterns: Array<[RegExp, ServicoTipo[]]> = [
    [/autoriza[cç][aã]o.*resid[eê]ncia|primeiro.*pedido|regulariz/i, ["pedido_ar"]],
    [/renov(?:a[cç][aã]o|ar).*(?:t[ií]tulo|resid[eê]ncia|ar\b)/i, ["renovacao_ar"]],
    [/reagrupamento|reuni(?:fica|r).*fam[ií]li/i, ["reagrupamento_familiar"]],
    [/nacionalidade/i, ["nacionalidade_pt"]],
    [/\bnif\b/i, ["emissao_nif"]],
    [/empresa.*(?:abrir|constituir|criar)/i, ["constituicao_empresa"]],
    [/abertura.*actividade|actividade.*abrir/i, ["abertura_actividade"]],
    [/laboral|trabalho.*processo|despedi/i, ["processo_laboral"]],
    [/recurso.*indeferid|ar.*indeferid/i, ["recurso_ar_indeferida"]],
    [/sa[ií]da.*volunt[aá]ria/i, ["suspensao_saida_voluntaria"]],
    [/casamento.*portug/i, ["casamento_portugal"]],
    [/casamento.*brasil/i, ["casamento_brasil"]],
    [/casamento|casar/i, ["casamento_portugal", "casamento_brasil"]],
    [/div[oó]rcio.*portug/i, ["divorcio_portugal"]],
    [/div[oó]rcio.*brasil/i, ["divorcio_brasil"]],
    [/div[oó]rcio|separar|separa[cç][aã]o/i, ["divorcio_portugal", "divorcio_brasil"]],
    [/revis[aã]o.*senten[cç]a/i, ["revisao_sentenca_pt"]],
    [/homologa[cç][aã]o.*senten[cç]a/i, ["homologacao_sentenca_br"]],
    [/injun[cç][aã]o.*pagamento/i, ["injuncao_pagamento"]],
    [/insolv[eê]ncia.*empresa/i, ["insolvencia_empresa"]],
    [/insolv[eê]ncia.*pessoal/i, ["insolvencia_pessoal"]],
    [/insolv[eê]ncia|d[ií]vida/i, ["insolvencia_empresa", "insolvencia_pessoal"]],
    // Termos comuns de imigracao que apontam para pedido_ar
    [/(?:turista|visto).*(?:ficar|regulariz)/i, ["pedido_ar"]],
    [/namorad[oa].*portugu[eê]s/i, ["pedido_ar", "reagrupamento_familiar", "casamento_portugal"]],
    [/(?:aima|agendamento).*(?:demora|espera|6 meses)/i, ["pedido_ar", "reagrupamento_familiar"]],
  ];

  const seen = new Set<ServicoTipo>();
  for (const [pattern, codigos] of patterns) {
    if (pattern.test(lower)) {
      for (const codigo of codigos) {
        if (!seen.has(codigo)) {
          seen.add(codigo);
          const svc = SERVICE_CATALOG.get(codigo);
          if (svc) matches.push(svc);
        }
      }
    }
  }

  return matches;
}

/**
 * Formata info de servico para injectar no prompt do Gemini.
 * Se o servico esta preenchido, inclui todos os detalhes.
 * Se nao, inclui apenas o nome.
 */
export function formatServiceForPrompt(service: ServiceInfo): string {
  if (!service.preenchido) {
    return `SERVICO: ${service.nome}\n(Informacao detalhada ainda nao disponivel — encaminhar ao advogado para detalhes)`;
  }

  const parts = [
    `SERVICO: ${service.nome}`,
    `Codigo: ${service.codigo}`,
    "",
    `Descricao: ${service.descricao}`,
    `Publico-alvo: ${service.publico_alvo}`,
    "",
    "Documentos necessarios:",
    ...service.documentos_necessarios.map((d) => `  - ${d}`),
    "",
    "Etapas do processo:",
    ...service.etapas.map((e, i) => `  ${i + 1}. ${e}`),
    "",
    `Prazo estimado: ${service.prazo_estimado}`,
    `Honorarios: ${service.honorarios}`,
    `Forma de pagamento: ${service.forma_pagamento}`,
  ];

  if (service.faqs.length > 0) {
    parts.push("", "Perguntas frequentes:");
    for (const faq of service.faqs) {
      parts.push(`  P: ${faq.pergunta}`);
      parts.push(`  R: ${faq.resposta}`);
    }
  }

  parts.push(
    "",
    `O que PODES dizer ao cliente: ${service.sonia_pode_dizer}`,
    `O que NAO deves dizer: ${service.sonia_nao_deve_dizer}`
  );

  if (service.observacoes) {
    parts.push(`Observacoes internas: ${service.observacoes}`);
  }

  return parts.join("\n");
}

/**
 * Formata multiplos servicos relevantes para o prompt.
 */
export function formatServicesForPrompt(services: ServiceInfo[]): string {
  if (services.length === 0) return "";
  return (
    "INFORMACAO DETALHADA DOS SERVICOS RELEVANTES:\n" +
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
    services.map(formatServiceForPrompt).join("\n\n---\n\n") +
    "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
    "USA esta informacao para responder ao cliente de forma precisa. " +
    "Nao copies o texto tal como esta — adapta a linguagem para ser natural e conversacional."
  );
}
