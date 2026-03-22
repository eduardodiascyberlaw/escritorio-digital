import { readFile } from "node:fs/promises";
import { join } from "node:path";

export class VaultReader {
  constructor(private vaultPath: string) {}

  async readTemplate(relativePath: string): Promise<string> {
    const fullPath = join(this.vaultPath, relativePath);
    return readFile(fullPath, "utf-8");
  }

  async readPlaybook(name: string): Promise<string> {
    return this.readTemplate(`Playbooks/${name}.md`);
  }

  async readLegislacao(name: string): Promise<string> {
    return this.readTemplate(`Legislacao/${name}.md`);
  }
}
