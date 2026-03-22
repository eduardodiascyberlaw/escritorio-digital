#!/usr/bin/env tsx
/**
 * Migração de clientes do ProJuris para o CRM AG
 * Usa Playwright para extrair dados do ProJuris
 *
 * Uso: tsx scripts/migrate-projuris.ts [--execute]
 */

import { chromium, type Page } from "playwright";

const DRY_RUN = !process.argv.includes("--execute");
const CRM_API = "https://plataforma-crm-juridico.klx2s6.easypanel.host";

// ─── CRM helpers ───

async function crmLogin(): Promise<string> {
  const res = await fetch(`${CRM_API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@escritorio.pt",
      password: "Mariana123mudar#",
    }),
  });
  const data = (await res.json()) as any;
  return data.data.accessToken;
}

async function crmGetExisting(token: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let page = 1;
  while (true) {
    const res = await fetch(`${CRM_API}/api/pessoas?limit=50&page=${page}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json()) as any;
    for (const p of data.data.data) {
      map.set(p.nome.toUpperCase().trim(), p.id);
    }
    if (map.size >= data.data.total) break;
    page++;
  }
  return map;
}

// ─── ProJuris scraper ───

interface ProJurisClient {
  nome: string;
  email?: string;
  telefone?: string;
  cpf_nif?: string;
  observacoes?: string;
  processos: Array<{
    numero: string;
    titulo?: string;
    area?: string;
  }>;
}

async function scrapeProJuris(): Promise<ProJurisClient[]> {
  console.log("🌐 A abrir ProJuris...\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Login
    await page.goto("https://app.projuris.com.br/app/", {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    console.log("   Página de login carregada");

    // Fill credentials
    await page.fill('input[type="email"], input[placeholder*="mail"]', "assistentejuridica2@gmail.com");
    await page.fill('input[type="password"]', "Ed974003@");
    await page.click('button[type="submit"], button:has-text("Acessar")');

    console.log("   Credenciais enviadas, a aguardar...");

    // Wait for dashboard
    await page.waitForNavigation({ timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(5000);

    const currentUrl = page.url();
    console.log(`   URL actual: ${currentUrl}`);

    // Check if login succeeded
    if (currentUrl.includes("login") || currentUrl.includes("recovery")) {
      console.log("   ✗ Login falhou — verificar credenciais");
      await browser.close();
      return [];
    }

    console.log("   ✓ Login bem-sucedido\n");

    // Navigate to contacts/clients list
    // ProJuris typically has: /app/contacts or /app/pessoas or sidebar navigation
    const clients: ProJurisClient[] = [];

    // Try to find the contacts/clients section
    // First, let's see what navigation options exist
    const navLinks = await page.evaluate(() => {
      const links: Array<{ text: string; href: string }> = [];
      document.querySelectorAll("a, button, [role='menuitem']").forEach((el) => {
        const text = (el as HTMLElement).innerText?.trim();
        const href = (el as HTMLAnchorElement).href || "";
        if (text && text.length < 50) {
          links.push({ text, href });
        }
      });
      return links;
    });

    console.log("   Menu items encontrados:");
    for (const link of navLinks.slice(0, 20)) {
      console.log(`     • ${link.text} ${link.href ? `(${link.href})` : ""}`);
    }

    // Look for contacts/clients link
    const contactLink = navLinks.find(
      (l) =>
        l.text.toLowerCase().includes("contato") ||
        l.text.toLowerCase().includes("pessoa") ||
        l.text.toLowerCase().includes("cliente") ||
        l.text.toLowerCase().includes("parte")
    );

    if (contactLink?.href) {
      console.log(`\n   A navegar para: ${contactLink.text}`);
      await page.goto(contactLink.href, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(3000);
    } else {
      // Try common ProJuris URLs
      const paths = [
        "/app/contacts",
        "/app/pessoas",
        "/app/clientes",
        "/app/partes",
        "/app/contatos",
      ];

      for (const path of paths) {
        try {
          console.log(`   Tentando: ${path}`);
          await page.goto(`https://app.projuris.com.br${path}`, {
            waitUntil: "networkidle",
            timeout: 10000,
          });
          const url = page.url();
          if (!url.includes("login") && !url.includes("404")) {
            console.log(`   ✓ Encontrado: ${path}`);
            break;
          }
        } catch {
          continue;
        }
      }
    }

    await page.waitForTimeout(3000);

    // Take screenshot for debugging
    await page.screenshot({ path: "/tmp/projuris-clients.png", fullPage: false });
    console.log("\n   📸 Screenshot: /tmp/projuris-clients.png");

    // Try to extract data from the current page
    const pageContent = await page.evaluate(() => {
      // Get all visible text content in table rows or list items
      const rows: Array<Record<string, string>> = [];

      // Try table format
      const tables = document.querySelectorAll("table");
      tables.forEach((table) => {
        const headers: string[] = [];
        table.querySelectorAll("th").forEach((th) => {
          headers.push(th.innerText.trim());
        });

        table.querySelectorAll("tbody tr").forEach((tr) => {
          const row: Record<string, string> = {};
          tr.querySelectorAll("td").forEach((td, i) => {
            const key = headers[i] || `col_${i}`;
            row[key] = td.innerText.trim();
          });
          if (Object.keys(row).length > 0) {
            rows.push(row);
          }
        });
      });

      // Try card/list format
      if (rows.length === 0) {
        document.querySelectorAll("[class*='card'], [class*='list-item'], [class*='contact']").forEach((el) => {
          const text = (el as HTMLElement).innerText.trim();
          if (text.length > 5 && text.length < 500) {
            rows.push({ content: text });
          }
        });
      }

      return { url: window.location.href, rows, bodyText: document.body.innerText.substring(0, 5000) };
    });

    console.log(`\n   URL: ${pageContent.url}`);
    console.log(`   Registos encontrados: ${pageContent.rows.length}`);

    if (pageContent.rows.length > 0) {
      console.log("\n   Primeiros registos:");
      for (const row of pageContent.rows.slice(0, 10)) {
        console.log(`     ${JSON.stringify(row).substring(0, 150)}`);
      }
    } else {
      console.log("\n   Conteúdo da página (primeiros 2000 chars):");
      console.log(pageContent.bodyText.substring(0, 2000));
    }

    // Also intercept API calls to find the data endpoint
    const apiCalls: string[] = [];
    page.on("response", (response) => {
      const url = response.url();
      if (url.includes("api") || url.includes("contato") || url.includes("pessoa")) {
        apiCalls.push(`${response.status()} ${url}`);
      }
    });

    // Reload to capture API calls
    await page.reload({ waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3000);

    if (apiCalls.length > 0) {
      console.log("\n   API calls detectados:");
      for (const call of apiCalls.slice(0, 10)) {
        console.log(`     ${call}`);
      }
    }

    await browser.close();
    return clients;
  } catch (error) {
    console.error("   ✗ Erro:", error);
    await browser.close();
    return [];
  }
}

// ─── Main ───

async function main() {
  console.log("╔════════════════════════════════════════════╗");
  console.log("║  SD Legal — Migração ProJuris → CRM AG     ║");
  console.log(`║  Modo: ${DRY_RUN ? "DRY RUN" : "EXECUÇÃO"}                            ║`);
  console.log("╚════════════════════════════════════════════╝\n");

  // Step 1: Scrape ProJuris
  const projurisClients = await scrapeProJuris();

  console.log(`\n📊 Total extraído do ProJuris: ${projurisClients.length}`);

  if (projurisClients.length === 0) {
    console.log("\n⚠️  Nenhum cliente extraído. Precisa de análise manual da estrutura do ProJuris.");
    console.log("   Ver screenshot: /tmp/projuris-clients.png");
    return;
  }
}

main().catch(console.error);
