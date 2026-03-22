import { v4 as uuid } from "uuid";
import type { Ticket } from "@sd-legal/shared";
import type { GeminiProClient } from "../llm/gemini-client.js";
import { TRIAGE_ANALYSIS_PROMPT } from "../llm/prompts.js";
import type { CrmClient } from "../crm/crm-client.js";
import { checkConflictOfInterest } from "../conflict/conflict-checker.js";

export interface TriageAnalysis {
  viabilidade: {
    merito: boolean;
    fundamentacao: string;
    probabilidade: "alta" | "media" | "baixa";
  };
  classificacao: {
    tipo_processo: string;
    entidade_competente: string;
    urgencia_real: "urgente" | "normal" | "baixa";
    prazo_dias: number | null;
  };
  plano_accao: Array<{
    passo: number;
    accao: string;
    responsavel: string;
  }>;
  documentos_necessarios: string[];
  necessita_cautelar: boolean;
  necessita_pesquisa: boolean;
  complexidade: "baixa" | "media" | "alta";
  notas_estrategia: string;
}

export async function processTriageTicket(
  ticket: Ticket,
  gemini: GeminiProClient,
  crm: CrmClient,
  eduardoId: string
): Promise<{
  analysis: TriageAnalysis;
  casoId: string | null;
  conflito: boolean;
  tickets_gerados: Ticket[];
}> {
  const now = new Date().toISOString();
  const tickets_gerados: Ticket[] = [];

  console.log(
    `[Rex] Processar triagem: ${ticket.ticket_id} (${ticket.contexto.materia})`
  );

  // 1. Get client info
  const clienteInfo = await crm.getClient(ticket.cliente_id).catch(() => null);
  const clienteNome = clienteInfo?.nome ?? ticket.cliente_id;

  // 2. Check conflict of interest
  const conflictResult = await checkConflictOfInterest(
    ticket.cliente_id,
    clienteNome,
    ticket.contexto.materia ?? "outro",
    undefined,
    crm,
    gemini
  );

  if (conflictResult.conflito_detectado) {
    // Escalate to human
    const escTicket: Ticket = {
      ticket_id: uuid(),
      criado_em: now,
      atualizado_em: now,
      origem: "rex",
      destino: "humano",
      tipo: "escalamento_humano",
      prioridade: "urgente",
      cliente_id: ticket.cliente_id,
      contexto: {
        resumo: `CONFLITO DE INTERESSES: ${conflictResult.tipo_conflito} — ${conflictResult.recomendacao}`,
      },
      payload: { conflito: conflictResult },
      retorno_esperado: "decisao_humana",
      estado: "aguarda_humano",
      audit_trail: [
        {
          timestamp: now,
          agente: "rex",
          accao: "conflito_detectado",
          detalhe: conflictResult.tipo_conflito ?? "",
        },
      ],
    };
    tickets_gerados.push(escTicket);

    return {
      analysis: {} as TriageAnalysis,
      casoId: null,
      conflito: true,
      tickets_gerados,
    };
  }

  // 3. Analyse with Gemini Pro
  const analysis = await gemini.generateJson<TriageAnalysis>(
    TRIAGE_ANALYSIS_PROMPT,
    JSON.stringify({
      ticket,
      cliente: clienteInfo,
    })
  );

  console.log(
    `[Rex] Análise: ${analysis.classificacao.tipo_processo} / ${analysis.viabilidade.probabilidade} / complexidade ${analysis.complexidade}`
  );

  // 4. Create case in CRM
  let casoId: string | null = null;

  // Check if client already has a case for this matter
  const existingCases = await crm.getCasesByClient(ticket.cliente_id);
  const sameMatterCase = existingCases.find(
    (c: any) => c.estado === "ABERTO" && c.tipoCaso?.includes(analysis.classificacao.tipo_processo)
  );

  if (sameMatterCase) {
    console.log(`[Rex] Caso existente encontrado: ${sameMatterCase.referencia}`);
    casoId = sameMatterCase.id;
  } else {
    // Map to CRM category
    const materia = ticket.contexto.materia ?? "outro";
    let categoria = "OUTROS";
    let jurisdicao: string | undefined;

    if (["imigracao", "administrativo", "nacionalidade"].includes(materia)) {
      categoria = "PROC_ADMINISTRATIVO";
    } else if (["laboral"].includes(materia)) {
      categoria = "CONTENCIOSO";
      jurisdicao = "TRIBUNAIS_JUDICIAIS";
    }

    const casoBody: Record<string, unknown> = {
      titulo: `${analysis.classificacao.tipo_processo} — ${clienteNome}`,
      categoria,
      tipoCaso: analysis.classificacao.tipo_processo,
      estado: "ABERTO",
      observacoes: analysis.notas_estrategia,
      responsaveis: [{ clienteId: eduardoId, principal: true }],
      clientes: [{ clienteId: ticket.cliente_id, papel: "Titular" }],
    };

    if (jurisdicao) casoBody.jurisdicao = jurisdicao;

    try {
      casoId = await crm.createCase(casoBody);
    } catch (error) {
      console.error(`[Rex] Erro ao criar caso: ${error}`);
    }
  }

  // 5. Generate follow-up tickets based on plan

  // Ticket for Iris (honorários)
  const irisTicket: Ticket = {
    ticket_id: uuid(),
    criado_em: now,
    atualizado_em: now,
    origem: "rex",
    destino: "iris",
    tipo: "pedido_honorarios",
    prioridade: ticket.prioridade,
    cliente_id: ticket.cliente_id,
    processo_id: casoId ?? undefined,
    contexto: {
      materia: ticket.contexto.materia,
      resumo: `Calcular honorários para: ${analysis.classificacao.tipo_processo} (complexidade: ${analysis.complexidade})`,
    },
    payload: {
      tipo_processo: analysis.classificacao.tipo_processo,
      complexidade: analysis.complexidade,
      necessita_cautelar: analysis.necessita_cautelar,
    },
    retorno_esperado: "proposta_honorarios",
    estado: "pendente",
    audit_trail: [
      {
        timestamp: now,
        agente: "rex",
        accao: "pedido_honorarios",
        detalhe: `${analysis.classificacao.tipo_processo} — ${analysis.complexidade}`,
      },
    ],
  };
  tickets_gerados.push(irisTicket);

  // Ticket for Sónia (update client)
  const soniaTicket: Ticket = {
    ticket_id: uuid(),
    criado_em: now,
    atualizado_em: now,
    origem: "rex",
    destino: "sonia",
    tipo: "update_cliente",
    prioridade: "normal",
    cliente_id: ticket.cliente_id,
    processo_id: casoId ?? undefined,
    contexto: {
      resumo: `Informar cliente que o caso foi analisado e está a ser preparada uma proposta de honorários.`,
      dados_adicionais: {
        documentos_em_falta: analysis.documentos_necessarios,
      },
    },
    payload: {
      mensagem_para_cliente: `O vosso caso foi analisado pelo escritório. Estamos a preparar uma proposta de honorários e entraremos em contacto em breve.`,
      documentos_pedir: analysis.documentos_necessarios,
    },
    retorno_esperado: "update_estado",
    estado: "pendente",
    audit_trail: [
      {
        timestamp: now,
        agente: "rex",
        accao: "instrucao_sonia",
        detalhe: "Informar cliente sobre análise + pedir documentos em falta",
      },
    ],
  };
  tickets_gerados.push(soniaTicket);

  // If needs research, ticket for Nova
  if (analysis.necessita_pesquisa) {
    const novaTicket: Ticket = {
      ticket_id: uuid(),
      criado_em: now,
      atualizado_em: now,
      origem: "rex",
      destino: "nova",
      tipo: "pedido_pesquisa",
      prioridade: ticket.prioridade,
      cliente_id: ticket.cliente_id,
      processo_id: casoId ?? undefined,
      contexto: {
        materia: ticket.contexto.materia,
        resumo: `Pesquisar jurisprudência e legislação para: ${analysis.classificacao.tipo_processo}`,
      },
      payload: {
        query: analysis.notas_estrategia,
        tipo_processo: analysis.classificacao.tipo_processo,
      },
      retorno_esperado: "memo_pesquisa",
      estado: "pendente",
      audit_trail: [
        {
          timestamp: now,
          agente: "rex",
          accao: "pedido_pesquisa",
        },
      ],
    };
    tickets_gerados.push(novaTicket);
  }

  // Update original ticket
  ticket.estado = "concluido";
  ticket.audit_trail.push({
    timestamp: now,
    agente: "rex",
    accao: "triagem_concluida",
    detalhe: `Caso ${casoId ?? "não criado"} — ${tickets_gerados.length} tickets gerados`,
  });

  return {
    analysis,
    casoId,
    conflito: false,
    tickets_gerados,
  };
}
