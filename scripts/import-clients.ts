#!/usr/bin/env tsx
/**
 * Script de importação de clientes do Google Drive para o CRM AG
 * Lê as pastas de clientes, parseia ZIPs do WhatsApp, e cria registos no CRM
 *
 * Uso: tsx scripts/import-clients.ts [--dry-run] [--execute]
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

// ─────────────────────────────────────────────
// Configuração
// ─────────────────────────────────────────────

const CRM_API = "https://plataforma-crm-juridico.klx2s6.easypanel.host";
const DRIVE_BASE =
  "/Users/eduardodias/Library/CloudStorage/GoogleDrive-eduardodias@eduardodiasadvogado.com/O meu disco/PASTA CLIENTES AÇÕES";

const DRY_RUN = !process.argv.includes("--execute");

// ─────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────

async function login(): Promise<string> {
  const res = await fetch(`${CRM_API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@escritorio.pt",
      password: "Mariana123mudar#",
    }),
  });
  const data = (await res.json()) as any;
  if (!data.success) throw new Error("Login falhou");
  return data.data.accessToken;
}

// ─────────────────────────────────────────────
// CRM API helpers
// ─────────────────────────────────────────────

async function getExistingClients(
  token: string
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let page = 1;
  let total = 0;

  do {
    const res = await fetch(
      `${CRM_API}/api/pessoas?limit=50&page=${page}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = (await res.json()) as any;
    total = data.data.total;

    for (const p of data.data.data) {
      map.set(p.nome.toUpperCase().trim(), p.id);
    }
    page++;
  } while (map.size < total);

  return map;
}

async function createClient(
  token: string,
  client: Record<string, any>
): Promise<string> {
  const res = await fetch(`${CRM_API}/api/pessoas`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(client),
  });
  const data = (await res.json()) as any;
  if (!data.success) {
    console.error(`  ✗ Erro ao criar ${client.nome}:`, data.message || data);
    throw new Error(data.message || "Erro ao criar cliente");
  }
  return data.data.id;
}

async function createCase(
  token: string,
  caso: Record<string, any>
): Promise<string> {
  const res = await fetch(`${CRM_API}/api/casos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(caso),
  });
  const data = (await res.json()) as any;
  if (!data.success) {
    console.error(`  ✗ Erro ao criar caso:`, data.message || data);
    throw new Error(data.message || "Erro ao criar caso");
  }
  return data.data.id;
}

// ─────────────────────────────────────────────
// Scan Google Drive folders
// ─────────────────────────────────────────────

interface ClientFolder {
  name: string;
  area: string;
  path: string;
  hasWhatsAppZip: boolean;
  zipFiles: string[];
  otherFiles: string[];
  subClients: string[]; // Sub-pastas que podem ser clientes individuais
}

function categorizeArea(folderName: string): {
  categoria: string;
  tipoCaso: string;
} {
  const lower = folderName.toLowerCase();
  if (lower.includes("laboral") || lower.includes("laborais"))
    return { categoria: "CONTENCIOSO", tipoCaso: "Acao Comum (Laboral)" };
  if (lower.includes("cautelar") || lower.includes("sis"))
    return {
      categoria: "PROC_ADMINISTRATIVO",
      tipoCaso: "Providência Cautelar",
    };
  if (lower.includes("104") || lower.includes("87"))
    return {
      categoria: "PROC_ADMINISTRATIVO",
      tipoCaso: "Autorização de Residência",
    };
  if (lower.includes("familia"))
    return { categoria: "OUTROS", tipoCaso: "Família" };
  if (lower.includes("nacionalidade"))
    return { categoria: "PROC_ADMINISTRATIVO", tipoCaso: "Nacionalidade" };
  if (lower.includes("injun"))
    return { categoria: "CONTENCIOSO", tipoCaso: "Injunção" };
  return { categoria: "OUTROS", tipoCaso: "Outro" };
}

function scanClientFolders(): ClientFolder[] {
  const results: ClientFolder[] = [];

  if (!existsSync(DRIVE_BASE)) {
    console.error("Pasta do Drive não encontrada:", DRIVE_BASE);
    return results;
  }

  const areaFolders = readdirSync(DRIVE_BASE);

  for (const areaFolder of areaFolders) {
    const areaPath = join(DRIVE_BASE, areaFolder);
    if (!statSync(areaPath).isDirectory()) continue;

    // Check if this is an area folder with sub-client folders or a direct client folder
    const contents = readdirSync(areaPath);
    const hasSubDirs = contents.some((c) => {
      try {
        return statSync(join(areaPath, c)).isDirectory();
      } catch {
        return false;
      }
    });

    if (
      areaFolder.includes("LABORAIS") ||
      areaFolder.includes("CAUTELAR") ||
      areaFolder.includes("104") ||
      areaFolder.includes("FAMILIA") ||
      areaFolder.includes("NACIONALIDADE") ||
      areaFolder.includes("DTSM")
    ) {
      // This is an area folder — scan sub-folders as clients
      for (const clientFolder of contents) {
        const clientPath = join(areaPath, clientFolder);
        if (!statSync(clientPath).isDirectory()) continue;

        // Skip meta-folders
        if (
          clientFolder === "JA PROTOCOLADOS" ||
          clientFolder === "PROTOCOLADOS"
        ) {
          // Scan inside these too
          const protocolados = readdirSync(clientPath);
          for (const proto of protocolados) {
            const protoPath = join(clientPath, proto);
            if (!statSync(protoPath).isDirectory()) continue;
            results.push(scanSingleFolder(proto, areaFolder, protoPath));
          }
          continue;
        }

        // Special: DTSM/CONTRATO DE TRABALHOS E RECIBOS has individual client folders
        if (clientFolder === "CONTRATO DE TRABALHOS E RECIBOS") {
          const workers = readdirSync(clientPath);
          for (const worker of workers) {
            const workerPath = join(clientPath, worker);
            if (statSync(workerPath).isDirectory()) {
              results.push(scanSingleFolder(worker, "LABORAL (DTSM)", workerPath));
            }
          }
          continue;
        }

        // Skip non-client folders
        if (
          [
            "APOLICE DE SEGURO",
            "BALANCETE 2024",
            "FICHA MEDICA",
            "REGISTO DE TRABALHADORES",
            "A1 DESTACAMENTO",
          ].includes(clientFolder)
        )
          continue;

        results.push(scanSingleFolder(clientFolder, areaFolder, clientPath));
      }
    } else {
      // This might be a direct client folder at root level
      results.push(scanSingleFolder(areaFolder, "OUTRO", areaPath));
    }
  }

  return results;
}

function scanSingleFolder(
  name: string,
  area: string,
  path: string
): ClientFolder {
  let allFiles: string[] = [];
  try {
    allFiles = readdirSync(path);
  } catch {
    /* ignore */
  }

  const zipFiles = allFiles.filter(
    (f) => f.endsWith(".zip") && f.toLowerCase().includes("whatsapp")
  );

  const otherFiles = allFiles.filter(
    (f) =>
      !f.startsWith(".") &&
      (f.endsWith(".pdf") ||
        f.endsWith(".docx") ||
        f.endsWith(".jpg") ||
        f.endsWith(".jpeg") ||
        f.endsWith(".png"))
  );

  const subClients = allFiles.filter((f) => {
    try {
      return statSync(join(path, f)).isDirectory();
    } catch {
      return false;
    }
  });

  return {
    name: name.trim(),
    area,
    path,
    hasWhatsAppZip: zipFiles.length > 0,
    zipFiles,
    otherFiles,
    subClients,
  };
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

async function main() {
  console.log("╔════════════════════════════════════════════╗");
  console.log("║  SD Legal — Importação de Clientes         ║");
  console.log(`║  Modo: ${DRY_RUN ? "DRY RUN (simulação)" : "EXECUÇÃO REAL"}              ║`);
  console.log("╚════════════════════════════════════════════╝\n");

  // 1. Scan Drive folders
  console.log("📁 A analisar pastas do Google Drive...\n");
  const folders = scanClientFolders();

  // 2. Login CRM
  console.log("🔑 A autenticar no CRM AG...");
  const token = await login();
  console.log("   ✓ Autenticado\n");

  // 3. Get existing clients
  console.log("📋 A carregar clientes existentes do CRM...");
  const existingClients = await getExistingClients(token);
  console.log(`   ✓ ${existingClients.size} clientes no CRM\n`);

  // 4. Analyze what needs importing
  const toImport: ClientFolder[] = [];
  const alreadyExists: ClientFolder[] = [];
  const skipped: ClientFolder[] = [];

  for (const folder of folders) {
    const nameUpper = folder.name.toUpperCase().trim();

    // Check if client already exists (fuzzy match by first name)
    let found = false;
    for (const [existingName] of existingClients) {
      if (
        existingName.includes(nameUpper) ||
        nameUpper.includes(existingName.split(" ")[0])
      ) {
        found = true;
        break;
      }
    }

    if (found) {
      alreadyExists.push(folder);
    } else {
      toImport.push(folder);
    }
  }

  // 5. Print report
  console.log("═══════════════════════════════════════════");
  console.log("  RELATÓRIO DE IMPORTAÇÃO");
  console.log("═══════════════════════════════════════════\n");

  console.log(`✅ JÁ EXISTEM NO CRM (${alreadyExists.length}):`);
  for (const f of alreadyExists) {
    console.log(`   • ${f.name} (${f.area})`);
  }

  console.log(`\n🆕 A IMPORTAR (${toImport.length}):`);
  for (const f of toImport) {
    const { tipoCaso } = categorizeArea(f.area);
    console.log(
      `   • ${f.name} — ${f.area} (${tipoCaso}) ${f.hasWhatsAppZip ? "📱" : ""} ${f.otherFiles.length > 0 ? `📄×${f.otherFiles.length}` : ""}`
    );
  }

  console.log(`\n📊 RESUMO:`);
  console.log(`   Total pastas analisadas: ${folders.length}`);
  console.log(`   Já no CRM: ${alreadyExists.length}`);
  console.log(`   A importar: ${toImport.length}`);

  // 6. Execute import (if not dry run)
  if (DRY_RUN) {
    console.log(
      "\n⚠️  MODO DRY RUN — nenhum cliente foi criado."
    );
    console.log(
      "   Para executar: tsx scripts/import-clients.ts --execute\n"
    );
    return;
  }

  console.log("\n🚀 A IMPORTAR...\n");

  // Get Eduardo's ID as responsável
  const eduardoId = "e59b40e3-79b6-4db4-8b4c-0116b9f6a283";

  let created = 0;
  let errors = 0;

  for (const folder of toImport) {
    const { categoria, tipoCaso } = categorizeArea(folder.area);

    try {
      // Create client
      const clientId = await createClient(token, {
        tipoPessoa: "PARTICULAR",
        categoria: "CLIENTE",
        nome: folder.name
          .split(" ")
          .map(
            (w) =>
              w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
          )
          .join(" "),
        observacoes: `Importado do Google Drive — ${folder.area}\nFicheiros: ${folder.otherFiles.length}\nWhatsApp ZIPs: ${folder.zipFiles.length}`,
      });

      console.log(`   ✓ Cliente criado: ${folder.name} (${clientId})`);

      // Create case
      try {
        const casoId = await createCase(token, {
          titulo: `${tipoCaso} — ${folder.name}`,
          categoria,
          tipoCaso,
          estado: "ABERTO",
          observacoes: `Importado do Google Drive\nPasta: ${folder.path}`,
          responsaveis: [{ clienteId: eduardoId, principal: true }],
          clientes: [{ clienteId: clientId, papel: "Titular" }],
        });
        console.log(`   ✓ Caso criado: ${tipoCaso} (${casoId})`);
      } catch (e) {
        console.log(`   ⚠ Caso não criado (cliente criado): ${e}`);
      }

      created++;
    } catch (e) {
      console.error(`   ✗ ERRO ${folder.name}: ${e}`);
      errors++;
    }

    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  CONCLUÍDO: ${created} criados, ${errors} erros`);
  console.log(`═══════════════════════════════════════════\n`);
}

main().catch(console.error);
