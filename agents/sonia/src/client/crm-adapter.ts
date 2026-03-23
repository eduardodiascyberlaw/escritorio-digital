import type { ClienteNivel1 } from "@sd-legal/shared";

export interface OnboardingState {
  step:
    | "aguarda_nome"
    | "aguarda_nascimento"
    | "aguarda_nacionalidade"
    | "aguarda_documento"
    | "aguarda_nif"
    | "aguarda_email"
    | "aguarda_como_chegou"
    | "aguarda_nivel2"
    | "completo";
  dados_recolhidos: Partial<ClienteNivel1>;
  percentagem: number;
}

export interface IncompleteClient {
  id: string;
  nome: string;
  telefone?: string;
  percentagem: number;
  camposEmFalta: string[];
}

export interface ProcessoResumo {
  id: string;
  referencia?: string;
  area: string;
  estado: string;
  ultimo_andamento?: string;
  data_ultimo_andamento?: string;
  advogado_responsavel?: string;
  proxima_accao?: string;
}

export interface CrmAdapter {
  findByPhone(phone: string): Promise<Partial<ClienteNivel1> | null>;
  create(client: Partial<ClienteNivel1>): Promise<string>;
  update(clienteId: string, data: Partial<ClienteNivel1>): Promise<void>;
  getOnboardingState(clienteId: string): Promise<OnboardingState | null>;
  setOnboardingState(
    clienteId: string,
    state: OnboardingState
  ): Promise<void>;
  listIncompleteClients(): Promise<IncompleteClient[]>;
  getClientProcesses(clienteId: string): Promise<ProcessoResumo[]>;
}

export class StubCrmAdapter implements CrmAdapter {
  private clients = new Map<string, Partial<ClienteNivel1>>();
  private onboarding = new Map<string, OnboardingState>();
  private phoneIndex = new Map<string, string>();

  async findByPhone(phone: string): Promise<Partial<ClienteNivel1> | null> {
    const id = this.phoneIndex.get(phone);
    if (!id) return null;
    return this.clients.get(id) ?? null;
  }

  async create(client: Partial<ClienteNivel1>): Promise<string> {
    const id = `cli_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.clients.set(id, client);
    if (client.telefone_whatsapp) {
      this.phoneIndex.set(client.telefone_whatsapp, id);
    }
    console.log(`[CRM Stub] Cliente criado: ${id}`);
    return id;
  }

  async update(
    clienteId: string,
    data: Partial<ClienteNivel1>
  ): Promise<void> {
    const existing = this.clients.get(clienteId) ?? {};
    this.clients.set(clienteId, { ...existing, ...data });
    console.log(`[CRM Stub] Cliente actualizado: ${clienteId}`);
  }

  async getOnboardingState(
    clienteId: string
  ): Promise<OnboardingState | null> {
    return this.onboarding.get(clienteId) ?? null;
  }

  async setOnboardingState(
    clienteId: string,
    state: OnboardingState
  ): Promise<void> {
    this.onboarding.set(clienteId, state);
  }

  async listIncompleteClients(): Promise<IncompleteClient[]> {
    return [];
  }

  async getClientProcesses(): Promise<ProcessoResumo[]> {
    return [];
  }
}
