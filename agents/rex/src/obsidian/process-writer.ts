import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { TriageAnalysis } from "../triage/triage-processor.js";

export class ProcessWriter {
  constructor(private vaultPath: string) {}

  async writeProcessFile(
    processoId: string,
    clienteNome: string,
    analysis: TriageAnalysis,
    casoRef: string
  ): Promise<void> {
    const now = new Date().toISOString();

    const content = `---
processo_id: ${processoId}
referencia: ${casoRef}
cliente: ${clienteNome}
tipo: ${analysis.classificacao.tipo_processo}
entidade: ${analysis.classificacao.entidade_competente}
urgencia: ${analysis.classificacao.urgencia_real}
complexidade: ${analysis.complexidade}
data_abertura: ${now}
estado: aberto
---

# ${casoRef} — ${clienteNome}

## Classificação
- **Tipo:** ${analysis.classificacao.tipo_processo}
- **Entidade:** ${analysis.classificacao.entidade_competente}
- **Urgência:** ${analysis.classificacao.urgencia_real}
- **Complexidade:** ${analysis.complexidade}

## Viabilidade
- **Mérito:** ${analysis.viabilidade.merito ? "Sim" : "Não"}
- **Probabilidade:** ${analysis.viabilidade.probabilidade}
- **Fundamentação:** ${analysis.viabilidade.fundamentacao}

## Plano de Acção
${analysis.plano_accao.map((p) => `${p.passo}. ${p.accao} → **${p.responsavel}**`).join("\n")}

## Documentos Necessários
${analysis.documentos_necessarios.map((d) => `- [ ] ${d}`).join("\n")}

## Notas de Estratégia
${analysis.notas_estrategia}

${analysis.necessita_cautelar ? "⚠️ **NECESSITA PROVIDÊNCIA CAUTELAR**" : ""}
${analysis.necessita_pesquisa ? "📚 **NECESSITA PESQUISA JURÍDICA (Nova)**" : ""}

## Timeline
- ${now.split("T")[0]} — Processo aberto pelo Rex (análise de triagem)
`;

    const filePath = join(this.vaultPath, "Processos", `${processoId}.md`);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content, "utf-8");
    console.log(`[Rex Vault] Processo escrito: ${processoId}.md`);
  }

  async appendToTimeline(
    processoId: string,
    entry: string
  ): Promise<void> {
    const { readFile } = await import("node:fs/promises");
    const filePath = join(this.vaultPath, "Processos", `${processoId}.md`);

    try {
      const existing = await readFile(filePath, "utf-8");
      const now = new Date().toISOString().split("T")[0];
      const updated = existing + `- ${now} — ${entry}\n`;
      await writeFile(filePath, updated, "utf-8");
    } catch {
      console.warn(`[Rex Vault] Ficheiro não encontrado: ${processoId}.md`);
    }
  }
}
