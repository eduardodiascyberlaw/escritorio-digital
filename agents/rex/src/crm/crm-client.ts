/**
 * CRM AG client for Rex — manages cases and client data
 */

export interface CrmClientConfig {
  apiUrl: string;
  email: string;
  password: string;
}

export class CrmClient {
  private config: CrmClientConfig;
  private token: string | null = null;
  private tokenExpiry = 0;

  constructor(config: CrmClientConfig) {
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

    const data = (await res.json()) as any;
    if (!data.success) throw new Error("CRM login failed");

    this.token = data.data.accessToken;
    this.tokenExpiry = Date.now() + 12 * 60 * 1000;
    return this.token!;
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
      console.warn("[Rex CRM] Rate limit — aguardar 30s...");
      await new Promise((r) => setTimeout(r, 30000));
      return this.request(method, path, body);
    }

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`CRM ${method} ${path}: ${res.status} ${error}`);
    }

    return res.json();
  }

  async getAllClients(): Promise<any[]> {
    const items: any[] = [];
    let page = 1;
    while (true) {
      const data = await this.request("GET", `/api/pessoas?limit=50&page=${page}`);
      items.push(...data.data.data);
      if (items.length >= data.data.total) break;
      page++;
    }
    return items;
  }

  async getClient(id: string): Promise<any> {
    const data = await this.request("GET", `/api/pessoas/${id}`);
    return data.data;
  }

  async getAllCases(): Promise<any[]> {
    const items: any[] = [];
    let page = 1;
    while (true) {
      const data = await this.request("GET", `/api/casos?limit=50&page=${page}`);
      items.push(...data.data.data);
      if (items.length >= data.data.total) break;
      page++;
    }
    return items;
  }

  async getCase(id: string): Promise<any> {
    const data = await this.request("GET", `/api/casos/${id}`);
    return data.data;
  }

  async createCase(caso: Record<string, unknown>): Promise<string> {
    const data = await this.request("POST", "/api/casos", caso);
    if (!data.success) throw new Error(`Create case failed: ${JSON.stringify(data)}`);
    console.log(`[Rex CRM] Caso criado: ${data.data.referencia}`);
    return data.data.id;
  }

  async updateCase(id: string, updates: Record<string, unknown>): Promise<void> {
    await this.request("PATCH", `/api/casos/${id}`, updates);
    console.log(`[Rex CRM] Caso actualizado: ${id}`);
  }

  async addClientToCase(casoId: string, clienteId: string, papel: string = "Titular"): Promise<void> {
    await this.request("POST", `/api/casos/${casoId}/clientes`, { clienteId, papel });
  }

  async addResponsavel(casoId: string, clienteId: string, principal: boolean = true): Promise<void> {
    await this.request("POST", `/api/casos/${casoId}/responsaveis`, { clienteId, principal });
  }

  async getCasesByClient(clienteId: string): Promise<any[]> {
    const allCases = await this.getAllCases();
    return allCases.filter((caso: any) =>
      caso.casoClientes?.some((cc: any) => cc.clienteId === clienteId)
    );
  }
}
