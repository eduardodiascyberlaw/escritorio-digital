import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";

export class VaultManager {
  constructor(private vaultPath: string) {}

  // ─── Playbooks ───

  findRelevantPlaybooks(materia: string, tipoPeca: string): string[] {
    const m = materia.toLowerCase();
    const t = tipoPeca.toLowerCase();
    const relevant: string[] = [];

    if (m.includes("imigracao") || m.includes("imigração")) {
      if (t.includes("cautelar")) relevant.push("cautelar_imigracao");
      if (t.includes("sis")) relevant.push("sis_indicacao");
      if (t.includes("formação") || t.includes("92")) relevant.push("art92_formacao");
      relevant.push("primeira_ar", "renovacao_ar_standard");
    }

    if (t.includes("custas")) relevant.push("custas_de_parte");

    return relevant;
  }

  async readPlaybook(name: string): Promise<string | null> {
    try {
      const path = join(this.vaultPath, "Playbooks", `${name}.md`);
      return await readFile(path, "utf-8");
    } catch {
      return null;
    }
  }

  async readLegislacao(name: string): Promise<string | null> {
    try {
      const path = join(this.vaultPath, "Legislacao", `${name}.md`);
      return await readFile(path, "utf-8");
    } catch {
      return null;
    }
  }

  async readTemplate(name: string): Promise<string | null> {
    try {
      const path = join(this.vaultPath, "Templates", "pecas_processuais", `${name}.md`);
      return await readFile(path, "utf-8");
    } catch {
      return null;
    }
  }

  // ─── Drafts ───

  async writeDraft(
    processoId: string,
    draftId: string,
    content: string,
    version: number
  ): Promise<void> {
    const dir = join(this.vaultPath, "Pecas", processoId);
    await mkdir(dir, { recursive: true });

    const filename = `v${version}_rascunho_${draftId.slice(0, 8)}.md`;
    const path = join(dir, filename);
    await writeFile(path, content, "utf-8");
    console.log(`[Lex Vault] Escrito: Pecas/${processoId}/${filename}`);
  }

  async readDraft(
    processoId: string,
    draftId: string,
    version: number
  ): Promise<string | null> {
    try {
      const dir = join(this.vaultPath, "Pecas", processoId);
      const files = await readdir(dir);
      const target = files.find(
        (f) => f.includes(`v${version}`) && f.includes(draftId.slice(0, 8))
      );
      if (!target) return null;
      return await readFile(join(dir, target), "utf-8");
    } catch {
      return null;
    }
  }

  async writeRevisionNotes(
    processoId: string,
    draftId: string,
    version: number,
    notes: string
  ): Promise<void> {
    const dir = join(this.vaultPath, "Pecas", processoId);
    await mkdir(dir, { recursive: true });

    const filename = `v${version}_revisao_${draftId.slice(0, 8)}.md`;
    const now = new Date().toISOString();

    const content = `---
draft_id: ${draftId}
versao: ${version}
data: ${now}
---

# Notas de Revisão — v${version}

${notes}
`;

    await writeFile(join(dir, filename), content, "utf-8");
  }

  async writeValidatedVersion(
    processoId: string,
    draftId: string,
    content: string,
    validatedBy: string
  ): Promise<void> {
    const dir = join(this.vaultPath, "Pecas", processoId);
    await mkdir(dir, { recursive: true });

    const now = new Date().toISOString();
    const filename = `validado_${draftId.slice(0, 8)}.md`;

    const header = `---
draft_id: ${draftId}
validado_por: ${validatedBy}
data_validacao: ${now}
---

`;

    // Remove RASCUNHO headers from validated version
    const cleanContent = content
      .replace(/╔[═╗\n║\s\w.áàãâéêíóõôúçÁÀÃÂÉÊÍÓÕÔÚÇ,—]*╝\n\n/g, "")
      .replace(/\n─+\nRASCUNHO[^─]*─+/g, "");

    await writeFile(join(dir, filename), header + cleanContent, "utf-8");
    console.log(`[Lex Vault] Versão validada: Pecas/${processoId}/${filename}`);
  }
}
