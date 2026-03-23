/**
 * Base de Conhecimento de Servicos — SD Legal
 *
 * Dados estruturados de cada servico do escritorio, usados pela SonIA
 * para responder com precisao sobre servicos, precos, documentos e etapas.
 *
 * Fonte: "Ficha de Servicos — Base de Conhecimento da SonIA" (DOCX — Mar 2026)
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
  /** Servico que exige consulta previa com o advogado antes de iniciar. */
  requer_consulta?: boolean;
}

// ─────────────────────────────────────────────
// INFORMACOES GERAIS DO ESCRITORIO
// ─────────────────────────────────────────────

export const OFFICE_INFO = {
  nome: "SD Legal",
  morada: "Rua Antonio Nobre",
  email: "eduardodias@eduardodiasadvogado.com",
  horario: "Segunda a Sexta, 09:00 - 18:00",
  formas_pagamento: "Transferencia bancaria",
  consulta_inicial: "Videochamada: 70 EUR (30 min) ou 150 EUR (1 hora). Presencial: 200 EUR (ate 1 hora). Urgente: 250 EUR.",
  linguas: "Portugues, ingles, espanhol",
  advogados: [
    { nome: "Eduardo Dias", especialidade: "Administrativa, laboral, familia, nacionalidade, migracao, casamento" },
  ],
  tom_comunicacao: "Profissional mas acolhedor",
  frases_proibidas: [
    "Nunca prometa prazos, sempre estimativa e se possivel nem isso",
    "Nunca diga que vai haver devolucao de pagamento",
    "Nao faca promessas",
  ],
  mensagem_boas_vindas: "De acordo com o horario, bom dia ou boa tarde, seguido de: sou assistente do Dr. Eduardo Dias, em que posso ajudar?",
};

// ─────────────────────────────────────────────
// 1. AUTORIZACAO DE RESIDENCIA — PRIMEIRO PEDIDO
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
        "Neste momento nao existe mais manifestacao de interesse. As formas possiveis de regularizacao sao atraves de autorizacao de residencia por reagrupamento familiar ou estudos.",
    },
    {
      pergunta: "Tenho uma namorada portuguesa, posso me regularizar atraves dela?",
      resposta:
        "E possivel sim, mas e necessario realizar casamento antes para iniciar processo de reagrupamento familiar conjuge cidadao europeu. Trabalhamos tambem com servico de casamento de forma online no Brasil e transcricao em Portugal, ou diretamente em conservatoria portuguesa. Apos transcricao, iniciamos processo por via administrativa.",
    },
    {
      pergunta: "Dei entrada para reagrupamento familiar no portal da AIMA mas fazem mais de 6 meses e nao recebi agendamento. O que pode ser feito?",
      resposta:
        "Podemos iniciar accao judicial para requerer informacoes sobre o estado do processo e assim obter resposta sobre o agendamento.",
    },
  ],
  sonia_pode_dizer: "Informar como funciona o servico e valores.",
  sonia_nao_deve_dizer:
    "Nunca dar prazos exactos de decisao da AIMA. Nunca prometer que o agendamento sera obtido. Todo o processo e um auxilio/tentativa, nao podemos prometer exito dependendo da AIMA.",
  observacoes:
    "Informar o cliente das opcoes de processo. Reagrupamento familiar conjuge (mae/pai) e filhos, reagrupamento familiar de conjuge cidadao europeu, estudante de ensino superior: pode ser feito por via administrativa. Atualmente nao tem como se regularizar por artigo de trabalhador por conta de outrem e trabalhador independente. Se for estudo curso tecnico ou reagrupamento familiar de conjuge sem ser cidadao europeu, tem que ser processo tribunal.",
  preenchido: true,
};

// ─────────────────────────────────────────────
// 2. AUTORIZACAO DE RESIDENCIA — RENOVACAO
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
// 3. REAGRUPAMENTO FAMILIAR
// ─────────────────────────────────────────────

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
      pergunta: "Ja tenho autorizacao de residencia, posso reagrupar meus filhos?",
      resposta: "Qual a idade deles? Se forem menores de 18 anos, sim.",
    },
    {
      pergunta: "Namoro uma portuguesa, posso me regularizar atraves dela?",
      resposta: "Apos casamento sim, pode ser feito pedido de reagrupamento.",
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
// 4. NACIONALIDADE PORTUGUESA
// ─────────────────────────────────────────────

const NACIONALIDADE_PT: ServiceInfo = {
  codigo: "nacionalidade_pt",
  nome: "Nacionalidade Portuguesa",
  descricao:
    "Este servico consiste em solicitar pedido pelo portal do IRN: nacionalidade por tempo de residencia, por parentesco (pai/mae/avos), ou por casamento.",
  publico_alvo:
    "Imigrantes que ja completaram tempo de residencia de 5 anos, que tem manifestacao de residencia de 5 anos, que sao casados com portugues, que sao filhos ou netos de portugues.",
  documentos_necessarios: [
    "Passaporte",
    "Certidao de nascimento inteiro teor apostilada",
  ],
  etapas: [
    "Reuniao de todos os documentos necessarios",
    "Protocolo no portal do IRN",
    "Aguardar chave de acesso e numero do processo",
    "Acompanhar pedido e aguardar processo de analise",
  ],
  prazo_estimado: "24-29 meses, podendo ser mais",
  honorarios: "800 EUR (nao esta inclusa taxa de conservatoria)",
  forma_pagamento: "Transferencia bancaria",
  faqs: [
    {
      pergunta: "Posso iniciar meu processo de nacionalidade pelo tempo de manifestacao de interesse?",
      resposta:
        "Sim, ainda neste momento pode ser pelo tempo de protocolo de manifestacao de interesse, se tiver completado 5 anos.",
    },
    {
      pergunta: "Nao tenho como pedir minha certidao de nascimento, voces trabalham com isso tambem?",
      resposta: "Sim, temos convenio com cartorio brasileiro.",
    },
  ],
  sonia_pode_dizer: "Informacoes sobre documentos necessarios, no que consiste o servico, etapas, valores.",
  sonia_nao_deve_dizer:
    "Nunca dar prazos exactos. Nunca prometer 100% de garantia de sucesso.",
  observacoes:
    "Valores de taxa de conservatoria mudam de acordo com artigo de nacionalidade, tal como documentos necessarios.",
  preenchido: true,
};

// ─────────────────────────────────────────────
// 5. EMISSAO DE NIF
// ─────────────────────────────────────────────

const EMISSAO_NIF: ServiceInfo = {
  codigo: "emissao_nif",
  nome: "Emissao de NIF",
  descricao:
    "Este servico de emissao de NIF tem um prazo de um ano de representacao fiscal, devendo o cliente prosseguir com alteracao de morada antes de completar este periodo para nao haver coimas na declaracao de IRS.",
  publico_alvo: "Imigrantes.",
  documentos_necessarios: [
    "Passaporte",
    "Comprovante de morada do pais de origem em seu nome",
  ],
  etapas: [
    "Reuniao dos documentos e assinatura de procuracao",
    "Pedido no eBalcao",
    "Aguardar prazo das financas",
    "NIF emitido e solicitada senha das financas",
  ],
  prazo_estimado: "Em media 2 semanas",
  honorarios: "150 EUR",
  forma_pagamento: "Transferencia bancaria",
  faqs: [
    {
      pergunta: "E rapido o pedido?",
      resposta: "Leva em torno de 2 semanas.",
    },
    {
      pergunta: "Estou regular com este documento?",
      resposta: "Nao, o NIF nao regulariza a situacao migratoria.",
    },
  ],
  sonia_pode_dizer: "Informacoes sobre documentos necessarios, no que consiste o servico, etapas, valores.",
  sonia_nao_deve_dizer:
    "Nunca dar prazos exactos. Nunca prometer 100% de garantia de sucesso.",
  observacoes:
    "Cliente devera alterar morada fiscal o quanto antes devido a coima imposta pelas financas para nao residentes fiscais no ato da declaracao de IRS.",
  preenchido: true,
};

// ─────────────────────────────────────────────
// 6. CONSTITUICAO DE EMPRESA
// ─────────────────────────────────────────────

const CONSTITUICAO_EMPRESA: ServiceInfo = {
  codigo: "constituicao_empresa",
  nome: "Constituicao de Empresa",
  descricao:
    "Este servico consiste apenas na abertura de empresa junto ao IRN e declaracao de beneficiario efetivo (RCBE).",
  publico_alvo: "Futuros empresarios.",
  documentos_necessarios: [
    "Nome da empresa",
    "Documento de identificacao e NIF dos socios",
    "Actividades a serem exercidas",
    "Capital e domicilio da sede da empresa",
    "Numero de gerentes",
  ],
  etapas: [
    "Caso pretenda escolher o nome, solicitar certificado de admissibilidade e aguardar aprovacao. Se preferir, pode ser pelo nome dos socios ou escolher da lista dos pre-aprovados.",
    "Pedido de abertura",
    "Pagamento da taxa e aguardar analise da conservatoria responsavel",
    "Certidao permanente emitida",
    "Emissao de RCBE",
  ],
  prazo_estimado: "Depende da escolha do nome, em media 30-60 dias",
  honorarios: "920 EUR",
  forma_pagamento: "Transferencia bancaria",
  faqs: [
    {
      pergunta: "Quanto tempo leva para a empresa ja poder funcionar?",
      resposta:
        "Apos conclusao da abertura da empresa, necessita realizar abertura de conta bancaria empresa e iniciar atividade nas financas. Depois ja pode comecar a funcionar.",
    },
  ],
  sonia_pode_dizer: "Informacoes sobre documentos necessarios, no que consiste o servico, etapas, valores.",
  sonia_nao_deve_dizer:
    "Nunca dar prazos exactos. Nunca prometer 100% de garantia de sucesso.",
  observacoes: null,
  preenchido: true,
};

// ─────────────────────────────────────────────
// 7. ABERTURA DE ACTIVIDADE
// ─────────────────────────────────────────────

const ABERTURA_ACTIVIDADE: ServiceInfo = {
  codigo: "abertura_actividade",
  nome: "Abertura de Actividade",
  descricao:
    "Este servico e a abertura de atividade nas financas pelo portal do cliente (se ja tiver morada fiscal) ou por representacao fiscal de IVA.",
  publico_alvo: "Imigrantes.",
  documentos_necessarios: [
    "Passaporte",
    "NIF",
    "Atividade a ser exercida",
    "Comprovativo de IBAN no nome do cliente",
  ],
  etapas: [
    "Se for pelo portal do cliente, e feita a solicitacao e em 30 min esta pronto.",
    "Sendo pelo portal do advogado, inicia o pedido pelo eBalcao e aguarda resposta das financas (2 semanas).",
  ],
  prazo_estimado: "2 semanas",
  honorarios: "185 EUR",
  forma_pagamento: "Transferencia bancaria",
  faqs: [],
  sonia_pode_dizer: "Informacoes sobre documentos necessarios, no que consiste o servico, etapas, valores.",
  sonia_nao_deve_dizer:
    "Nunca dar prazos exactos. Nunca prometer 100% de garantia de sucesso.",
  observacoes:
    "O cliente deve estar ciente de que se nao tem morada fiscal portuguesa, tem obrigacao de emitir os recibos verdes com IVA.",
  preenchido: true,
};

// ─────────────────────────────────────────────
// 8. PROCESSO LABORAL
// ─────────────────────────────────────────────

const PROCESSO_LABORAL: ServiceInfo = {
  codigo: "processo_laboral",
  nome: "Processo Laboral",
  descricao:
    "Este servico so pode ser iniciado apos consulta com o advogado. Destina-se a trabalhadores com problemas laborais.",
  publico_alvo: "Imigrantes, trabalhadores com problemas laborais.",
  documentos_necessarios: [
    "Contrato de trabalho",
    "Documento de identificacao",
  ],
  etapas: [
    "Informar ao cliente as opcoes de consulta: videochamada ou presencial",
    "Apos consulta e enviada proposta de honorarios",
  ],
  prazo_estimado: null,
  honorarios: "Consulta: Videochamada 70 EUR (30 min) ou 150 EUR (1 hora). Presencial 200 EUR (ate 1 hora). Urgente 250 EUR.",
  forma_pagamento: "Transferencia bancaria",
  faqs: [],
  sonia_pode_dizer: "Informacoes sobre documentos necessarios, no que consiste o servico, etapas, valores da consulta.",
  sonia_nao_deve_dizer:
    "Nunca dar prazos exactos. Nunca prometer 100% de garantia de sucesso.",
  observacoes: null,
  preenchido: true,
  requer_consulta: true,
};

// ─────────────────────────────────────────────
// 9. RECURSO — AR INDEFERIDA
// ─────────────────────────────────────────────

const RECURSO_AR_INDEFERIDA: ServiceInfo = {
  codigo: "recurso_ar_indeferida",
  nome: "Recurso — AR Indeferida",
  descricao:
    "Este servico consiste em iniciar accao judicial. Se o cliente recebeu o projeto de indeferimento: accao cautelar e accao administrativa. Se nao recebeu: primeiro e feita accao de pedido de informacao e passagem de certidao para verificar o estado do processo.",
  publico_alvo: "Imigrantes com autorizacao de residencia indeferida.",
  documentos_necessarios: [
    "Projeto de indeferimento / print do portal da AIMA",
    "Passaporte",
    "Acesso ao portal da AIMA",
    "Email recebido comprovando presenca na entrevista",
    "Todos os emails recebidos da AIMA",
  ],
  etapas: [
    "Se tiver o projeto de indeferimento: inicio de accao cautelar seguida de accao administrativa para refutar notificacao de saida de Portugal e retorno do processo para obtencao da AR.",
    "Se nao tiver o projeto de indeferimento: primeiro interpelacao a AIMA, seguido de accao judicial para pedir estado do processo.",
  ],
  prazo_estimado: "3-6 meses (podendo ser menos ou mais)",
  honorarios: "1500 EUR. Se nao tiver o projeto de indeferimento: 500 + 1500 = 2000 EUR.",
  forma_pagamento: "Transferencia bancaria",
  faqs: [
    {
      pergunta: "Verifiquei no portal da AIMA que meu processo tem um projeto de indeferimento, mas nao recebi nenhuma notificacao. O que pode ser feito?",
      resposta:
        "Primeiro precisamos identificar se ha realmente um projeto de indeferimento, atraves de accao no tribunal requerendo informacoes e passagem de certidao. Havendo realmente um projeto de indeferimento e que podemos entrar com accao requerendo o cancelamento.",
    },
    {
      pergunta: "Recebi uma notificacao de afastamento para sair de Portugal, como posso reverter isso?",
      resposta:
        "Temos que iniciar accao judicial cautelar e administrativa para poder reverter essa notificacao.",
    },
  ],
  sonia_pode_dizer: "Informacoes sobre documentos necessarios, no que consiste o servico, etapas, valores.",
  sonia_nao_deve_dizer:
    "Nunca dar prazos exactos. Nunca prometer 100% de garantia de sucesso.",
  observacoes:
    "E necessario saber se o cliente recebeu ou nao a notificacao de projeto de indeferimento/NAV para poder guiar nas informacoes e valores. Pode sugerir tambem agendamento de consulta com o advogado.",
  preenchido: true,
};

// ─────────────────────────────────────────────
// 10. SUSPENSAO DE SAIDA VOLUNTARIA
// ─────────────────────────────────────────────

const SUSPENSAO_SAIDA_VOLUNTARIA: ServiceInfo = {
  codigo: "suspensao_saida_voluntaria",
  nome: "Suspensao de Saida Voluntaria",
  descricao:
    "Suspender atraves de accao judicial a notificacao para sair de Portugal.",
  publico_alvo: "Imigrantes com notificacao de saida voluntaria.",
  documentos_necessarios: [
    "Projeto de indeferimento / NAV",
    "Passaporte",
    "Comprovativo de processo de autorizacao de residencia",
  ],
  etapas: [
    "Accao cautelar seguida de accao administrativa para suspender a saida voluntaria",
    "Aguardar andamento do processo",
  ],
  prazo_estimado: null,
  honorarios: "1500 EUR",
  forma_pagamento: "Transferencia bancaria",
  faqs: [],
  sonia_pode_dizer: "Informacoes sobre documentos necessarios, no que consiste o servico, etapas, valores.",
  sonia_nao_deve_dizer:
    "Nunca dar prazos exactos. Nunca prometer 100% de garantia de sucesso.",
  observacoes:
    "Serao necessarios outros documentos alem dos da lista, mas vai depender de cada situacao.",
  preenchido: true,
};

// ─────────────────────────────────────────────
// 11. CASAMENTO EM PORTUGAL
// ─────────────────────────────────────────────

const CASAMENTO_PORTUGAL: ServiceInfo = {
  codigo: "casamento_portugal",
  nome: "Casamento em Portugal",
  descricao:
    "Este servico e para submissao do pedido de casamento em uma conservatoria de Portugal, representando um nubente ou os dois tanto no ato do pedido como na celebracao do casamento.",
  publico_alvo: "Imigrantes e portugueses.",
  documentos_necessarios: [
    "Certidao de nascimento dos nubentes (quem nao for portugues tem que ser inteiro teor apostilada)",
    "Cartao cidadao e/ou titulo de residencia",
    "Procuracao",
  ],
  etapas: [
    "Reuniao dos documentos e solicitacao de agendamento na conservatoria para entrega do pedido",
    "Protocolar pedido",
    "Se um dos nubentes nao for portugues e nao tiver AR, o processo e enviado a AIMA para analise",
    "Pedido deferido da analise, e agendada a celebracao",
    "Emissao da certidao de casamento",
  ],
  prazo_estimado: "Se o nubente estrangeiro tiver AR: 30-60 dias. Se nao tiver AR: acima de 90 dias.",
  honorarios: "600 EUR + taxa da conservatoria",
  forma_pagamento: "Transferencia bancaria",
  faqs: [],
  sonia_pode_dizer: "Informacoes sobre documentos necessarios, no que consiste o servico, etapas, valores.",
  sonia_nao_deve_dizer:
    "Nunca dar prazos exactos. Nunca prometer 100% de garantia de sucesso.",
  observacoes:
    "Informar o cliente que se um dos nubentes nao possuir AR, havera analise por parte da AIMA e so apos deferimento e que pode realizar o casamento. Perguntar se algum dos nubentes ira adquirir o sobrenome do outro. Perguntar qual regime de casamento — se nao for comunhao de adquiridos, devera ser feito pacto nupcial antes (nao incluso nos honorarios, verificar valor no notario).",
  preenchido: true,
};

// ─────────────────────────────────────────────
// 12. CASAMENTO NO BRASIL
// ─────────────────────────────────────────────

const CASAMENTO_BRASIL: ServiceInfo = {
  codigo: "casamento_brasil",
  nome: "Casamento no Brasil",
  descricao:
    "Este servico e feito de forma online atraves de procuracao pelo cartorio brasileiro.",
  publico_alvo: "Imigrantes, nubentes.",
  documentos_necessarios: [
    "CPF dos nubentes",
    "Certidao de nascimento dos nubentes",
    "Informacoes pessoais dos nubentes (estado civil, profissao, telefone e email)",
    "Documento de identificacao dos nubentes",
  ],
  etapas: [
    "Caso um dos nubentes nao possua CPF, solicitacao de CPF",
    "Emissao de certificado digital",
    "Procuracao",
    "Celebracao do casamento",
    "Emissao da certidao de casamento",
  ],
  prazo_estimado: "1 a 3 semanas, a depender do CPF",
  honorarios: "900 EUR",
  forma_pagamento: "Transferencia bancaria",
  faqs: [
    {
      pergunta: "Posso me casar com meu namorado portugues no Brasil?",
      resposta:
        "Sim, solicitamos o CPF dele e o casamento e realizado online, sem precisar se deslocar.",
    },
    {
      pergunta: "Estou morando em outra cidade, longe da minha noiva, consigo casar?",
      resposta: "Sim, atraves de casamento via online no Brasil.",
    },
  ],
  sonia_pode_dizer: "Informacoes sobre documentos necessarios, no que consiste o servico, etapas, valores.",
  sonia_nao_deve_dizer:
    "Nunca dar prazos exactos. Nunca prometer 100% de garantia de sucesso.",
  observacoes:
    "E necessario saber se ambos nubentes possuem CPF — se nao, tem que ser solicitado antes. Registar: nome completo, data de nascimento, CPF, documento de identificacao, endereco, profissao, telefone, email. Perguntar se algum dos nubentes ira adquirir o sobrenome do outro. Qual o regime de casamento — se for separacao de bens ou comunhao total, devera ser feito pacto nupcial antes (verificar valor, nao incluso).",
  preenchido: true,
};

// ─────────────────────────────────────────────
// 13. DIVORCIO EM PORTUGAL (sem dados detalhados)
// ─────────────────────────────────────────────

const DIVORCIO_PORTUGAL: ServiceInfo = {
  codigo: "divorcio_portugal",
  nome: "Divorcio em Portugal",
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

// ─────────────────────────────────────────────
// 14. DIVORCIO NO BRASIL
// ─────────────────────────────────────────────

const DIVORCIO_BRASIL: ServiceInfo = {
  codigo: "divorcio_brasil",
  nome: "Divorcio no Brasil",
  descricao:
    "Este servico so pode ser iniciado apos consulta com o advogado.",
  publico_alvo: "Imigrantes.",
  documentos_necessarios: [
    "Certidao de casamento",
    "Lista de bens, morada de familia, existencia de filhos e animais de estimacao",
    "Documento de identificacao",
  ],
  etapas: [
    "Informar ao cliente as opcoes de consulta: videochamada ou presencial",
    "Apos consulta e enviada proposta de honorarios",
  ],
  prazo_estimado: null,
  honorarios: "Consulta: Videochamada 70 EUR (30 min) ou 150 EUR (1 hora). Presencial 200 EUR (ate 1 hora). Urgente 250 EUR.",
  forma_pagamento: "Transferencia bancaria",
  faqs: [],
  sonia_pode_dizer: "Informacoes sobre documentos necessarios, no que consiste o servico, etapas, valores da consulta.",
  sonia_nao_deve_dizer:
    "Nunca dar prazos exactos. Nunca prometer 100% de garantia de sucesso.",
  observacoes: null,
  preenchido: true,
  requer_consulta: true,
};

// ─────────────────────────────────────────────
// 15. REVISAO DE SENTENCA ESTRANGEIRA (PORTUGAL)
// ─────────────────────────────────────────────

const REVISAO_SENTENCA_PT: ServiceInfo = {
  codigo: "revisao_sentenca_pt",
  nome: "Revisao de Sentenca Estrangeira (Portugal)",
  descricao:
    "Este servico so pode ser iniciado apos consulta com o advogado.",
  publico_alvo: "Imigrantes, portugueses.",
  documentos_necessarios: [
    "Documentos do processo a ser revisado",
    "Documento de identificacao",
  ],
  etapas: [
    "Informar ao cliente as opcoes de consulta: videochamada ou presencial",
    "Apos consulta e enviada proposta de honorarios",
  ],
  prazo_estimado: null,
  honorarios: "Consulta: Videochamada 70 EUR (30 min) ou 150 EUR (1 hora). Presencial 200 EUR (ate 1 hora). Urgente 250 EUR.",
  forma_pagamento: "Transferencia bancaria",
  faqs: [],
  sonia_pode_dizer: "Informacoes sobre documentos necessarios, no que consiste o servico, etapas, valores da consulta.",
  sonia_nao_deve_dizer:
    "Nunca dar prazos exactos. Nunca prometer 100% de garantia de sucesso.",
  observacoes: null,
  preenchido: true,
  requer_consulta: true,
};

// ─────────────────────────────────────────────
// 16. HOMOLOGACAO DE SENTENCA (BRASIL)
// ─────────────────────────────────────────────

const HOMOLOGACAO_SENTENCA_BR: ServiceInfo = {
  codigo: "homologacao_sentenca_br",
  nome: "Homologacao de Sentenca (Brasil)",
  descricao:
    "Este servico so pode ser iniciado apos consulta com o advogado.",
  publico_alvo: "Imigrantes.",
  documentos_necessarios: [
    "Documentos do processo a ser homologado",
    "Documento de identificacao",
  ],
  etapas: [
    "Informar ao cliente as opcoes de consulta: videochamada ou presencial",
    "Apos consulta e enviada proposta de honorarios",
  ],
  prazo_estimado: null,
  honorarios: "Consulta: Videochamada 70 EUR (30 min) ou 150 EUR (1 hora). Presencial 200 EUR (ate 1 hora). Urgente 250 EUR.",
  forma_pagamento: "Transferencia bancaria",
  faqs: [],
  sonia_pode_dizer: "Informacoes sobre documentos necessarios, no que consiste o servico, etapas, valores da consulta.",
  sonia_nao_deve_dizer:
    "Nunca dar prazos exactos. Nunca prometer 100% de garantia de sucesso.",
  observacoes: null,
  preenchido: true,
  requer_consulta: true,
};

// ─────────────────────────────────────────────
// 17. INJUNCAO DE PAGAMENTO
// ─────────────────────────────────────────────

const INJUNCAO_PAGAMENTO: ServiceInfo = {
  codigo: "injuncao_pagamento",
  nome: "Injuncao de Pagamento",
  descricao:
    "Este servico so pode ser iniciado apos consulta com o advogado.",
  publico_alvo: "Imigrantes, empresarios.",
  documentos_necessarios: [
    "Fatura vencida ou contrato",
    "Documento de identificacao",
  ],
  etapas: [
    "Informar ao cliente as opcoes de consulta: videochamada ou presencial",
    "Apos consulta e enviada proposta de honorarios",
  ],
  prazo_estimado: null,
  honorarios: "Consulta: Videochamada 70 EUR (30 min) ou 150 EUR (1 hora). Presencial 200 EUR (ate 1 hora). Urgente 250 EUR.",
  forma_pagamento: "Transferencia bancaria",
  faqs: [],
  sonia_pode_dizer: "Informacoes sobre documentos necessarios, no que consiste o servico, etapas, valores da consulta.",
  sonia_nao_deve_dizer:
    "Nunca dar prazos exactos. Nunca prometer 100% de garantia de sucesso.",
  observacoes: null,
  preenchido: true,
  requer_consulta: true,
};

// ─────────────────────────────────────────────
// 18. INSOLVENCIA DE EMPRESA
// ─────────────────────────────────────────────

const INSOLVENCIA_EMPRESA: ServiceInfo = {
  codigo: "insolvencia_empresa",
  nome: "Insolvencia de Empresa",
  descricao:
    "Este servico so pode ser iniciado apos consulta com o advogado.",
  publico_alvo: "Imigrantes, empresarios.",
  documentos_necessarios: [
    "Documentos da empresa: certidao permanente, RCBE, ultima ata",
    "Documento de identificacao",
  ],
  etapas: [
    "Informar ao cliente as opcoes de consulta: videochamada ou presencial",
    "Apos consulta e enviada proposta de honorarios",
  ],
  prazo_estimado: null,
  honorarios: "Consulta: Videochamada 70 EUR (30 min) ou 150 EUR (1 hora). Presencial 200 EUR (ate 1 hora). Urgente 250 EUR.",
  forma_pagamento: "Transferencia bancaria",
  faqs: [],
  sonia_pode_dizer: "Informacoes sobre documentos necessarios, no que consiste o servico, etapas, valores da consulta.",
  sonia_nao_deve_dizer:
    "Nunca dar prazos exactos. Nunca prometer 100% de garantia de sucesso.",
  observacoes: null,
  preenchido: true,
  requer_consulta: true,
};

// ─────────────────────────────────────────────
// 19. INSOLVENCIA PESSOAL
// ─────────────────────────────────────────────

const INSOLVENCIA_PESSOAL: ServiceInfo = {
  codigo: "insolvencia_pessoal",
  nome: "Insolvencia Pessoal",
  descricao:
    "Este servico so pode ser iniciado apos consulta com o advogado.",
  publico_alvo: "Imigrantes, portugueses, empresarios.",
  documentos_necessarios: [
    "Documentos relacionados com as dividas",
    "Documento de identificacao",
  ],
  etapas: [
    "Informar ao cliente as opcoes de consulta: videochamada ou presencial",
    "Apos consulta e enviada proposta de honorarios",
  ],
  prazo_estimado: null,
  honorarios: "Consulta: Videochamada 70 EUR (30 min) ou 150 EUR (1 hora). Presencial 200 EUR (ate 1 hora). Urgente 250 EUR.",
  forma_pagamento: "Transferencia bancaria",
  faqs: [],
  sonia_pode_dizer: "Informacoes sobre documentos necessarios, no que consiste o servico, etapas, valores da consulta.",
  sonia_nao_deve_dizer:
    "Nunca dar prazos exactos. Nunca prometer 100% de garantia de sucesso.",
  observacoes: null,
  preenchido: true,
  requer_consulta: true,
};

// ─────────────────────────────────────────────
// CATALOGO COMPLETO
// ─────────────────────────────────────────────

const SERVICE_CATALOG = new Map<ServicoTipo, ServiceInfo>([
  ["pedido_ar", PEDIDO_AR],
  ["renovacao_ar", RENOVACAO_AR],
  ["reagrupamento_familiar", REAGRUPAMENTO_FAMILIAR],
  ["nacionalidade_pt", NACIONALIDADE_PT],
  ["emissao_nif", EMISSAO_NIF],
  ["constituicao_empresa", CONSTITUICAO_EMPRESA],
  ["abertura_actividade", ABERTURA_ACTIVIDADE],
  ["processo_laboral", PROCESSO_LABORAL],
  ["recurso_ar_indeferida", RECURSO_AR_INDEFERIDA],
  ["suspensao_saida_voluntaria", SUSPENSAO_SAIDA_VOLUNTARIA],
  ["casamento_portugal", CASAMENTO_PORTUGAL],
  ["casamento_brasil", CASAMENTO_BRASIL],
  ["divorcio_portugal", DIVORCIO_PORTUGAL],
  ["divorcio_brasil", DIVORCIO_BRASIL],
  ["revisao_sentenca_pt", REVISAO_SENTENCA_PT],
  ["homologacao_sentenca_br", HOMOLOGACAO_SENTENCA_BR],
  ["injuncao_pagamento", INJUNCAO_PAGAMENTO],
  ["insolvencia_empresa", INSOLVENCIA_EMPRESA],
  ["insolvencia_pessoal", INSOLVENCIA_PESSOAL],
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
    [/empresa.*(?:abrir|constituir|criar)|abrir.*empresa/i, ["constituicao_empresa"]],
    [/abertura.*actividade|actividade.*abrir|recibos?\s*verdes?/i, ["abertura_actividade"]],
    [/laboral|trabalho.*processo|despedi|salario|ordenado/i, ["processo_laboral"]],
    [/recurso.*indeferid|ar.*indeferid|projeto.*indeferimento/i, ["recurso_ar_indeferida"]],
    [/sa[ií]da.*volunt[aá]ria|notifica[cç][aã]o.*afastamento|sair.*portugal/i, ["suspensao_saida_voluntaria"]],
    [/casamento.*portug|casar.*portug|conservat[oó]ria/i, ["casamento_portugal"]],
    [/casamento.*brasil|casar.*brasil|cart[oó]rio/i, ["casamento_brasil"]],
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
  ];

  if (service.requer_consulta) {
    parts.push("⚠️ REQUER CONSULTA PREVIA COM O ADVOGADO antes de iniciar.");
  }

  parts.push(
    "",
    `Descricao: ${service.descricao}`,
    `Publico-alvo: ${service.publico_alvo}`,
    "",
    "Documentos necessarios:",
    ...service.documentos_necessarios.map((d) => `  - ${d}`),
    "",
    "Etapas do processo:",
    ...service.etapas.map((e, i) => `  ${i + 1}. ${e}`),
  );

  if (service.prazo_estimado) {
    parts.push("", `Prazo estimado: ${service.prazo_estimado}`);
  }

  parts.push(
    `Honorarios: ${service.honorarios}`,
    `Forma de pagamento: ${service.forma_pagamento}`,
  );

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
