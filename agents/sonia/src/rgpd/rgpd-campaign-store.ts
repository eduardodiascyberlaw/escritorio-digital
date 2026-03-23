/**
 * Tracking persistente da campanha de regularizacao RGPD.
 *
 * Regista quais clientes foram contactados, quantas tentativas,
 * e o estado actual. Persiste em JSON no disco.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export interface CampaignRecord {
  nome: string;
  tentativas: number;
  ultimaTentativa: string; // ISO 8601
  estado: "enviado" | "aceite" | "recusado" | "escalado";
}

export class RgpdCampaignStore {
  private records = new Map<string, CampaignRecord>();
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async load(): Promise<void> {
    try {
      const raw = await readFile(this.filePath, "utf-8");
      const data = JSON.parse(raw) as Record<string, CampaignRecord>;
      this.records = new Map(Object.entries(data));
      console.log(
        `[RgpdCampaign] Carregados ${this.records.size} registos de ${this.filePath}`
      );
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        console.log("[RgpdCampaign] Ficheiro nao existe — estado vazio");
        return;
      }
      throw err;
    }
  }

  get(phone: string): CampaignRecord | undefined {
    return this.records.get(phone);
  }

  async set(phone: string, record: CampaignRecord): Promise<void> {
    this.records.set(phone, record);
    await this.persist();
  }

  /**
   * Retorna phones elegiveis para contacto:
   * - Nunca contactados (nao estao no store)
   * - Contactados ha mais de 48h sem resposta (re-tentar, max 3 tentativas)
   *
   * Recebe lista de phones candidatos (do CRM) e filtra.
   */
  filterEligible(
    candidates: Array<{ phone: string; nome: string }>,
    limit: number
  ): Array<{ phone: string; nome: string }> {
    const now = Date.now();
    const MS_48H = 48 * 60 * 60 * 1000;
    const eligible: Array<{ phone: string; nome: string }> = [];

    for (const c of candidates) {
      if (eligible.length >= limit) break;

      const record = this.records.get(c.phone);

      if (!record) {
        // Nunca contactado
        eligible.push(c);
        continue;
      }

      // Ja resolvido — ignorar
      if (
        record.estado === "aceite" ||
        record.estado === "recusado" ||
        record.estado === "escalado"
      ) {
        continue;
      }

      // Enviado mas sem resposta — re-tentar apos 48h, max 3 tentativas
      if (
        record.estado === "enviado" &&
        record.tentativas < 3 &&
        now - new Date(record.ultimaTentativa).getTime() > MS_48H
      ) {
        eligible.push(c);
      }
    }

    return eligible;
  }

  private async persist(): Promise<void> {
    const data = Object.fromEntries(this.records);
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(data, null, 2), "utf-8");
  }
}
