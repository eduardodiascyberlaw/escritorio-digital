export interface ProJurisMapeamento {
  projuris_nome: string;
  projuris_data_nascimento: string;
  projuris_nif: string;
  projuris_telefone: string;
  projuris_email: string;
}

export interface ProJurisAdapter {
  searchClient(
    name: string,
    phone?: string
  ): Promise<ProJurisMapeamento | null>;
}

export class StubProJurisAdapter implements ProJurisAdapter {
  async searchClient(): Promise<ProJurisMapeamento | null> {
    console.log("[ProJuris Stub] Pesquisa — não implementado (Playwright)");
    return null;
  }
}
