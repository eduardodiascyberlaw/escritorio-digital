import cron from "node-cron";
import { v4 as uuid } from "uuid";
import type { Ticket } from "@sd-legal/shared";

export interface PaymentRecord {
  id: string;
  cliente_id: string;
  processo_id: string | undefined;
  proposta_id: string;
  valor_total: number;
  valor_pago: number;
  parcelas_pagas: number;
  parcelas_total: number;
  estado: "pendente" | "parcial" | "pago" | "atrasado";
  data_contratacao: string;
  data_ultimo_pagamento: string | null;
  proxima_parcela: string | null;
}

export class PaymentTracker {
  // In-memory storage — in production, this will be in the CRM
  private records = new Map<string, PaymentRecord>();

  createRecord(
    clienteId: string,
    processoId: string | undefined,
    propostaId: string,
    valorTotal: number,
    parcelas: number
  ): PaymentRecord {
    const record: PaymentRecord = {
      id: uuid(),
      cliente_id: clienteId,
      processo_id: processoId,
      proposta_id: propostaId,
      valor_total: valorTotal,
      valor_pago: 0,
      parcelas_pagas: 0,
      parcelas_total: parcelas,
      estado: "pendente",
      data_contratacao: new Date().toISOString(),
      data_ultimo_pagamento: null,
      proxima_parcela: this.calcNextPaymentDate(),
    };

    this.records.set(record.id, record);
    console.log(
      `[Iris] Registo de pagamento criado: ${record.id} — €${valorTotal} em ${parcelas}×`
    );
    return record;
  }

  registerPayment(recordId: string, valor: number): void {
    const record = this.records.get(recordId);
    if (!record) return;

    record.valor_pago += valor;
    record.parcelas_pagas++;
    record.data_ultimo_pagamento = new Date().toISOString();

    if (record.valor_pago >= record.valor_total) {
      record.estado = "pago";
      record.proxima_parcela = null;
    } else {
      record.estado = "parcial";
      record.proxima_parcela = this.calcNextPaymentDate();
    }

    console.log(
      `[Iris] Pagamento registado: ${recordId} — €${valor} (total pago: €${record.valor_pago})`
    );
  }

  getOverduePayments(): PaymentRecord[] {
    const now = new Date();
    const overdue: PaymentRecord[] = [];

    for (const record of this.records.values()) {
      if (
        record.estado !== "pago" &&
        record.proxima_parcela &&
        new Date(record.proxima_parcela) < now
      ) {
        record.estado = "atrasado";
        overdue.push(record);
      }
    }

    return overdue;
  }

  getRecordsByClient(clienteId: string): PaymentRecord[] {
    return Array.from(this.records.values()).filter(
      (r) => r.cliente_id === clienteId
    );
  }

  private calcNextPaymentDate(): string {
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    next.setDate(1); // 1st of next month
    return next.toISOString();
  }
}

export function startPaymentMonitor(
  tracker: PaymentTracker,
  onOverdue: (tickets: Ticket[]) => Promise<void>
): void {
  // Weekly: Monday at 09:00
  cron.schedule("0 9 * * 1", async () => {
    console.log("[Iris] Verificação semanal de pagamentos...");

    const overdue = tracker.getOverduePayments();

    if (overdue.length === 0) {
      console.log("[Iris] ✓ Sem pagamentos em atraso");
      return;
    }

    console.log(`[Iris] ⚠️ ${overdue.length} pagamentos em atraso`);

    const tickets: Ticket[] = overdue.map((record) => ({
      ticket_id: uuid(),
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
      origem: "iris",
      destino: "rex",
      tipo: "alerta_prazo",
      prioridade: "normal" as const,
      cliente_id: record.cliente_id,
      processo_id: record.processo_id,
      contexto: {
        resumo: `Pagamento em atraso: €${record.valor_total - record.valor_pago} pendente (${record.parcelas_pagas}/${record.parcelas_total} parcelas pagas)`,
      },
      payload: {
        payment_record_id: record.id,
        valor_em_divida: record.valor_total - record.valor_pago,
      } as Record<string, unknown>,
      retorno_esperado: "decisao_humana" as const,
      estado: "pendente" as const,
      audit_trail: [
        {
          timestamp: new Date().toISOString(),
          agente: "iris" as const,
          accao: "alerta_pagamento_atraso",
        },
      ],
    }));

    await onOverdue(tickets);
  });

  console.log("[Iris] Monitor de pagamentos agendado: segunda-feira 09:00");
}
