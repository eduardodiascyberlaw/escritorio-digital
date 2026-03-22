import { v4 as uuid } from "uuid";
import type { Ticket } from "@sd-legal/shared";
import type { ClassificationResult } from "../classification/types.js";

export function createTriagemTicket(
  clienteId: string,
  classification: ClassificationResult,
  nivel1Complete: boolean,
  nivel2Complete: boolean
): Ticket | null {
  // Governance rule: Nivel 1 must be complete before creating ticket for Rex
  if (!nivel1Complete) {
    console.log(
      "[Ticket] Nível 1 incompleto — não criar ticket para Rex"
    );
    return null;
  }

  const now = new Date().toISOString();

  return {
    ticket_id: uuid(),
    criado_em: now,
    atualizado_em: now,

    origem: "sonia",
    destino: "rex",
    tipo: "triagem_novo_cliente",
    prioridade: classification.classificacao.urgencia,

    cliente_id: clienteId,
    processo_id: undefined,

    contexto: {
      materia: classification.classificacao.area,
      urgencia_processual:
        classification.classificacao.urgencia === "urgente"
          ? "prazo_curto"
          : "normal",
      resumo: classification.notas_contexto,
      documentos: classification.documentos_partilhados.map(
        (d) => `${d.tipo}: ${d.descricao}`
      ),
    },

    payload: {
      nivel1_completo: true,
      nivel2_completo: nivel2Complete,
      intencao_cliente: classification.intencao,
      conflito_interesses_verificado: false, // Rex will verify
      classificacao_area: classification.classificacao.area,
      classificacao_sub_tipo: classification.classificacao.sub_tipo,
      dados_em_falta_nivel2: nivel2Complete
        ? []
        : classification.dados_em_falta,
      notas_adicionais: classification.notas_contexto,
    },

    retorno_esperado: "processo_aberto",
    estado: "pendente",

    audit_trail: [
      {
        timestamp: now,
        agente: "sonia",
        accao: "ticket_criado",
        detalhe: `Triagem concluída — ${classification.classificacao.area} / ${classification.classificacao.urgencia}`,
      },
    ],
  };
}
