import { writeFile, mkdir, access } from "node:fs/promises";
import { join, dirname } from "node:path";

export class VaultWriter {
  constructor(private vaultPath: string) {}

  async writeClientFile(
    clienteId: string,
    content: string
  ): Promise<void> {
    const filePath = join(this.vaultPath, "Clientes", `${clienteId}.md`);
    await this.ensureDir(filePath);
    await writeFile(filePath, content, "utf-8");
    console.log(`[Vault] Escrito: Clientes/${clienteId}.md`);
  }

  async appendAudit(
    subpath: string,
    filename: string,
    content: string
  ): Promise<void> {
    const filePath = join(this.vaultPath, "Audit", subpath, filename);
    await this.ensureDir(filePath);

    // Immutability: never overwrite existing audit files
    try {
      await access(filePath);
      console.warn(
        `[Vault] ALERTA: Ficheiro de audit já existe, não será sobrescrito: ${filename}`
      );
      return;
    } catch {
      // File doesn't exist — safe to write
    }

    await writeFile(filePath, content, "utf-8");
    console.log(`[Vault] Audit escrito: ${subpath}/${filename}`);
  }

  private async ensureDir(filePath: string): Promise<void> {
    await mkdir(dirname(filePath), { recursive: true });
  }
}
