import type { GeminiProClient } from "../llm/gemini-client.js";
import { CONFLICT_CHECK_PROMPT } from "../llm/prompts.js";
import type { CrmClient } from "../crm/crm-client.js";

export interface ConflictResult {
  conflito_detectado: boolean;
  tipo_conflito: string | null;
  clientes_envolvidos: string[];
  recomendacao: string;
}

export async function checkConflictOfInterest(
  clienteId: string,
  clienteNome: string,
  materia: string,
  adverso: string | undefined,
  crm: CrmClient,
  gemini: GeminiProClient
): Promise<ConflictResult> {
  // Get all existing clients and their cases
  const existingClients = await crm.getAllClients();
  const existingCases = await crm.getAllCases();

  // Build context for Gemini
  const context = {
    novo_cliente: {
      id: clienteId,
      nome: clienteNome,
      materia,
      adverso: adverso ?? "não identificado",
    },
    clientes_existentes: existingClients.map((c: any) => ({
      nome: c.nome,
      categoria: c.categoria,
      casos: existingCases
        .filter((caso: any) =>
          caso.casoClientes?.some((cc: any) => cc.clienteId === c.id)
        )
        .map((caso: any) => ({
          titulo: caso.titulo,
          categoria: caso.categoria,
          partes_adversas: caso.casoPartesAdversas?.map(
            (pa: any) => pa.cliente?.nome
          ),
        })),
    })),
  };

  try {
    const result = await gemini.generateJson<ConflictResult>(
      CONFLICT_CHECK_PROMPT,
      JSON.stringify(context)
    );

    if (result.conflito_detectado) {
      console.log(
        `[Rex] ⚠️ CONFLITO DETECTADO: ${result.tipo_conflito} — ${result.clientes_envolvidos.join(", ")}`
      );
    } else {
      console.log(`[Rex] ✓ Sem conflito de interesses para ${clienteNome}`);
    }

    return result;
  } catch (error) {
    console.error("[Rex] Erro na verificação de conflito:", error);
    // Default to no conflict but flag for human review
    return {
      conflito_detectado: false,
      tipo_conflito: null,
      clientes_envolvidos: [],
      recomendacao:
        "Verificação automática falhou — requer análise manual",
    };
  }
}
