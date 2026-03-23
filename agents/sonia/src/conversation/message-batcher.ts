/**
 * Batching de mensagens por cliente.
 *
 * Quando um cliente envia varias mensagens seguidas (e.g. 3 msgs em 10s),
 * o batcher agrupa-as numa unica string antes de processar.
 *
 * Mecanismo: debounce — o timer reinicia a cada nova mensagem.
 * Quando o timer dispara (30s por defeito), concatena tudo com \n\n
 * e chama o callback uma unica vez.
 */

interface BatchedMessage {
  text: string;
  isAudio: boolean;
}

interface PendingBatch {
  name: string | null;
  messages: BatchedMessage[];
  timer: ReturnType<typeof setTimeout>;
}

export type BatchCallback = (
  phone: string,
  name: string | null,
  text: string,
  hasAudio: boolean
) => Promise<void>;

export class MessageBatcher {
  private batches = new Map<string, PendingBatch>();
  private windowMs: number;
  private onFlush: BatchCallback;

  constructor(windowMs: number, onFlush: BatchCallback) {
    this.windowMs = windowMs;
    this.onFlush = onFlush;
  }

  add(phone: string, name: string | null, text: string, isAudio = false): void {
    const existing = this.batches.get(phone);

    if (existing) {
      clearTimeout(existing.timer);
      existing.messages.push({ text, isAudio });
      if (name) existing.name = name;

      console.log(
        `[Batcher] +${phone} — ${existing.messages.length} msgs pendentes, 30s reset`
      );

      existing.timer = setTimeout(() => this.flush(phone), this.windowMs);
    } else {
      const timer = setTimeout(() => this.flush(phone), this.windowMs);
      this.batches.set(phone, {
        name,
        messages: [{ text, isAudio }],
        timer,
      });
    }
  }

  private flush(phone: string): void {
    const batch = this.batches.get(phone);
    if (!batch) return;

    this.batches.delete(phone);

    const combinedText = batch.messages.map((m) => m.text).join("\n\n");
    const hasAudio = batch.messages.some((m) => m.isAudio);
    const count = batch.messages.length;

    if (count > 1) {
      console.log(
        `[Batcher] Batch disparado para ${phone} (${count} msgs agrupadas)`
      );
    }

    this.onFlush(phone, batch.name, combinedText, hasAudio).catch((err) => {
      console.error(`[Batcher] Erro ao processar batch de ${phone}:`, err);
    });
  }

  /** Numero de batches pendentes (para debug/testes). */
  get pendingCount(): number {
    return this.batches.size;
  }
}
