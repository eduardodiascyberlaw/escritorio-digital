import cron from "node-cron";
import { v4 as uuid } from "uuid";
import type { Ticket } from "@sd-legal/shared";
import type { GeminiProClient } from "../llm/gemini-client.js";
import { DEADLINE_ANALYSIS_PROMPT } from "../llm/prompts.js";
import type { CrmClient } from "../crm/crm-client.js";

export interface DeadlineAlert {
  caso_id: string;
  cliente: string;
  tipo_prazo: string;
  data_limite: string;
  dias_restantes: number;
  consequencia: string;
  accao_necessaria: string;
  urgencia: "critica" | "alta" | "normal";
}

export async function checkDeadlines(
  crm: CrmClient,
  gemini: GeminiProClient
): Promise<DeadlineAlert[]> {
  console.log("[Rex] Verificação de prazos...");

  const cases = await crm.getAllCases();
  const activeCases = cases.filter((c: any) => c.estado === "ABERTO");

  if (activeCases.length === 0) {
    console.log("[Rex] Nenhum caso activo");
    return [];
  }

  // Prepare context for Gemini
  const casesContext = activeCases.map((c: any) => ({
    id: c.id,
    referencia: c.referencia,
    titulo: c.titulo,
    categoria: c.categoria,
    tipo_caso: c.tipoCaso,
    data_inicio: c.dataInicio,
    numero_processo: c.numeroProcesso || c.numeroProcessoAdmin,
    observacoes: c.observacoes,
    clientes: c.casoClientes?.map((cc: any) => cc.cliente?.nome),
  }));

  try {
    const result = await gemini.generateJson<{ alertas: DeadlineAlert[] }>(
      DEADLINE_ANALYSIS_PROMPT,
      JSON.stringify({ casos_activos: casesContext, data_actual: new Date().toISOString() })
    );

    const alerts = result.alertas ?? [];

    if (alerts.length > 0) {
      console.log(`[Rex] ${alerts.length} alertas de prazo detectados`);
      for (const a of alerts) {
        const emoji =
          a.urgencia === "critica" ? "🔴" : a.urgencia === "alta" ? "🟡" : "🟢";
        console.log(
          `  ${emoji} ${a.cliente}: ${a.tipo_prazo} — ${a.dias_restantes} dias`
        );
      }
    } else {
      console.log("[Rex] ✓ Sem prazos críticos");
    }

    return alerts;
  } catch (error) {
    console.error("[Rex] Erro na verificação de prazos:", error);
    return [];
  }
}

export function generateDeadlineTickets(
  alerts: DeadlineAlert[]
): Ticket[] {
  const now = new Date().toISOString();
  const tickets: Ticket[] = [];

  for (const alert of alerts) {
    if (alert.urgencia === "critica" || alert.urgencia === "alta") {
      // Alert human
      tickets.push({
        ticket_id: uuid(),
        criado_em: now,
        atualizado_em: now,
        origem: "rex",
        destino: "humano",
        tipo: "alerta_prazo",
        prioridade: alert.urgencia === "critica" ? "urgente" : "normal",
        cliente_id: "",
        processo_id: alert.caso_id,
        contexto: {
          resumo: `PRAZO: ${alert.tipo_prazo} — ${alert.cliente} — ${alert.dias_restantes} dias — ${alert.consequencia}`,
        },
        payload: { ...alert } as Record<string, unknown>,
        retorno_esperado: "decisao_humana",
        estado: "pendente",
        audit_trail: [
          {
            timestamp: now,
            agente: "rex",
            accao: "alerta_prazo",
            detalhe: `${alert.tipo_prazo}: ${alert.dias_restantes} dias`,
          },
        ],
      });

      // Instruct Sónia to inform client
      tickets.push({
        ticket_id: uuid(),
        criado_em: now,
        atualizado_em: now,
        origem: "rex",
        destino: "sonia",
        tipo: "update_cliente",
        prioridade: "normal",
        cliente_id: "",
        processo_id: alert.caso_id,
        contexto: {
          resumo: `Informar cliente sobre estado do processo (prazo em curso)`,
        },
        payload: {
          mensagem_para_cliente: `Informamos que o vosso processo está em fase activa. ${alert.accao_necessaria}`,
        },
        retorno_esperado: "update_estado",
        estado: "pendente",
        audit_trail: [
          { timestamp: now, agente: "rex", accao: "instrucao_sonia_prazo" },
        ],
      });
    }
  }

  return tickets;
}

export function startDeadlineMonitor(
  crm: CrmClient,
  gemini: GeminiProClient,
  onAlerts: (tickets: Ticket[]) => Promise<void>
): void {
  // Daily at 08:00
  cron.schedule("0 8 * * *", async () => {
    try {
      const alerts = await checkDeadlines(crm, gemini);
      const tickets = generateDeadlineTickets(alerts);
      if (tickets.length > 0) {
        await onAlerts(tickets);
      }
    } catch (error) {
      console.error("[Rex] Erro no monitor de prazos:", error);
    }
  });

  console.log("[Rex] Monitor de prazos agendado: diário às 08:00");
}
