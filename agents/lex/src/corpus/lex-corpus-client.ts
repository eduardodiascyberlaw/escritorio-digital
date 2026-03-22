/**
 * Client for Lex-Corpus — RAG over 139K+ DGSI decisions
 * Running on the VPS at port 3010
 */

export interface CorpusResult {
  id: string;
  tribunal: string;
  processo: string;
  data: string;
  sumario: string;
  score: number;
}

export class LexCorpusClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async search(query: string, limit: number = 5): Promise<CorpusResult[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, limit }),
      });

      if (!res.ok) {
        console.warn(`[Lex-Corpus] Pesquisa falhou: ${res.status}`);
        return [];
      }

      const data = (await res.json()) as { results?: CorpusResult[] };
      return data.results ?? [];
    } catch (error) {
      console.warn("[Lex-Corpus] Não disponível:", error);
      return [];
    }
  }

  async getDecision(id: string): Promise<string | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/decisions/${id}`);
      if (!res.ok) return null;
      const data = (await res.json()) as { text?: string };
      return data.text ?? null;
    } catch {
      return null;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/health`);
      return res.ok;
    } catch {
      return false;
    }
  }
}
