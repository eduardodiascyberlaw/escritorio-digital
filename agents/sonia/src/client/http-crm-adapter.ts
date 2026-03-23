import type { ClienteNivel1 } from "@sd-legal/shared";
import type { CrmAdapter, IncompleteClient, OnboardingState } from "./crm-adapter.js";
import { validateNivel1 } from "./nivel-validator.js";

export interface HttpCrmConfig {
  apiUrl: string;
  email: string;
  password: string;
}

export class HttpCrmAdapter implements CrmAdapter {
  private config: HttpCrmConfig;
  private token: string | null = null;
  private tokenExpiry = 0;
  private onboardingCache = new Map<string, OnboardingState>();

  constructor(config: HttpCrmConfig) {
    this.config = config;
  }

  private async ensureToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiry) {
      return this.token;
    }

    const res = await fetch(`${this.config.apiUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: this.config.email,
        password: this.config.password,
      }),
    });

    if (!res.ok) {
      throw new Error(`CRM login failed: ${res.status}`);
    }

    const data = (await res.json()) as {
      success: boolean;
      data: { accessToken: string };
    };

    if (!data.success) {
      throw new Error("CRM login failed");
    }

    this.token = data.data.accessToken;
    // Token expires in 15min, refresh at 12min
    this.tokenExpiry = Date.now() + 12 * 60 * 1000;
    return this.token;
  }

  private async request(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<any> {
    const token = await this.ensureToken();

    const res = await fetch(`${this.config.apiUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (res.status === 429) {
      console.warn("[CRM] Rate limit — aguardar 30s...");
      await new Promise((r) => setTimeout(r, 30000));
      return this.request(method, path, body);
    }

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`CRM ${method} ${path}: ${res.status} ${errorText}`);
    }

    return res.json();
  }

  async findByPhone(phone: string): Promise<Partial<ClienteNivel1> | null> {
    // Normalize phone: remove +, spaces, dashes
    const normalized = phone.replace(/[+\s-]/g, "");

    try {
      const data = await this.request(
        "GET",
        `/api/pessoas?search=${encodeURIComponent(normalized)}&limit=5`
      );

      const results = data.data?.data ?? [];

      // Search by whatsapp, telemovel, or telefone
      for (const person of results) {
        const wa = (person.whatsapp ?? "").replace(/[+\s-]/g, "");
        const tel = (person.telemovel ?? "").replace(/[+\s-]/g, "");
        const tel2 = (person.telefone ?? "").replace(/[+\s-]/g, "");

        if (wa.includes(normalized) || tel.includes(normalized) || tel2.includes(normalized)) {
          return this.mapToClienteNivel1(person);
        }
      }

      // Fallback: search all and check
      if (results.length === 0) {
        // Try broader search with last 9 digits
        const short = normalized.slice(-9);
        const data2 = await this.request(
          "GET",
          `/api/pessoas?search=${encodeURIComponent(short)}&limit=10`
        );
        for (const person of data2.data?.data ?? []) {
          const wa = (person.whatsapp ?? "").replace(/[+\s-]/g, "");
          if (wa.includes(short)) {
            return this.mapToClienteNivel1(person);
          }
        }
      }

      return null;
    } catch (error) {
      console.error("[CRM] Erro findByPhone:", error);
      return null;
    }
  }

  async create(client: Partial<ClienteNivel1>): Promise<string> {
    const body: Record<string, unknown> = {
      tipoPessoa: "PARTICULAR",
      categoria: "CLIENTE",
      nome: client.nome_completo ?? "Sem nome",
    };

    if (client.email) body.email = client.email;
    if (client.telefone_whatsapp) body.whatsapp = client.telefone_whatsapp;
    if (client.nif) body.nif = client.nif;
    if (client.data_nascimento) {
      body.dataNascimento = new Date(client.data_nascimento).toISOString();
    }
    if (client.nacionalidade) body.nacionalidade = client.nacionalidade;
    if (client.lingua_preferencial) {
      body.observacoes = `Língua: ${client.lingua_preferencial}`;
    }

    const data = await this.request("POST", "/api/pessoas", body);

    if (!data.success) {
      throw new Error(`CRM create failed: ${JSON.stringify(data)}`);
    }

    const id = data.data.id;
    console.log(`[CRM] Cliente criado: ${client.nome_completo} (${id})`);
    return id;
  }

  async update(
    clienteId: string,
    updates: Partial<ClienteNivel1>
  ): Promise<void> {
    const body: Record<string, unknown> = {};

    if (updates.nome_completo) body.nome = updates.nome_completo;
    if (updates.email) body.email = updates.email;
    if (updates.telefone_whatsapp) body.whatsapp = updates.telefone_whatsapp;
    if (updates.nif) body.nif = updates.nif;
    if (updates.nacionalidade) body.nacionalidade = updates.nacionalidade;
    if (updates.data_nascimento) {
      body.dataNascimento = new Date(updates.data_nascimento).toISOString();
    }

    // Handle RGPD — store in observacoes for now
    if (updates.rgpd) {
      const existing = await this.request("GET", `/api/pessoas/${clienteId}`);
      const obs = existing.data?.observacoes ?? "";
      const rgpdNote = `\nRGPD: consentimento=${updates.rgpd.consentimento_dados_pessoais}, hash=${updates.rgpd.hash_sha256}, data=${updates.rgpd.data_consentimento}`;
      body.observacoes = obs + rgpdNote;
    }

    if (Object.keys(body).length === 0) return;

    await this.request("PATCH", `/api/pessoas/${clienteId}`, body);
    console.log(`[CRM] Cliente actualizado: ${clienteId}`);
  }

  async getOnboardingState(
    clienteId: string
  ): Promise<OnboardingState | null> {
    // Onboarding state is stored in-memory for now
    // TODO: persist in CRM observacoes or custom field
    return this.onboardingCache.get(clienteId) ?? null;
  }

  async setOnboardingState(
    clienteId: string,
    state: OnboardingState
  ): Promise<void> {
    this.onboardingCache.set(clienteId, state);
  }

  async findByName(name: string): Promise<Partial<ClienteNivel1> | null> {
    try {
      const data = await this.request(
        "GET",
        `/api/pessoas?search=${encodeURIComponent(name)}&limit=5`
      );

      for (const person of data.data?.data ?? []) {
        if (person.nome.toUpperCase().includes(name.toUpperCase())) {
          return this.mapToClienteNivel1(person);
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  async listIncompleteClients(): Promise<IncompleteClient[]> {
    try {
      // Fetch recent clients (last 100, sorted by creation date desc)
      const data = await this.request(
        "GET",
        "/api/pessoas?limit=100&categoria=CLIENTE&orderBy=createdAt&order=desc"
      );

      const results: IncompleteClient[] = [];

      for (const person of data.data?.data ?? []) {
        const mapped = this.mapToClienteNivel1(person);
        const validation = validateNivel1(mapped);

        if (!validation.complete) {
          results.push({
            id: person.id,
            nome: person.nome ?? "Sem nome",
            telefone: person.whatsapp ?? person.telemovel ?? undefined,
            percentagem: validation.percentagem,
            camposEmFalta: validation.missing,
          });
        }
      }

      return results;
    } catch (error) {
      console.error("[CRM] Erro listIncompleteClients:", error);
      return [];
    }
  }

  private mapToClienteNivel1(person: any): Partial<ClienteNivel1> & { id: string } {
    return {
      id: person.id,
      nome_completo: person.nome,
      email: person.email ?? undefined,
      telefone_whatsapp: person.whatsapp ?? person.telemovel ?? undefined,
      nif: person.nif ?? undefined,
      data_nascimento: person.dataNascimento ?? undefined,
      nacionalidade: person.nacionalidade ?? undefined,
      lingua_preferencial: "pt",
      data_primeiro_contacto: person.createdAt,
    } as Partial<ClienteNivel1> & { id: string };
  }
}
