import type { ClienteNivel1 } from "@sd-legal/shared";
import type { CrmAdapter } from "./crm-adapter.js";
import type { ProJurisAdapter } from "./projuris-adapter.js";
import type { DriveAdapter } from "./drive-adapter.js";
import { validateNivel1 } from "./nivel-validator.js";

export interface ResolvedClient {
  clienteId: string;
  source: "crm" | "projuris" | "drive" | "new";
  data: Partial<ClienteNivel1>;
  nivel1Complete: boolean;
  missing: string[];
  pendingValidation: boolean;
}

export async function resolveClient(
  phone: string,
  name: string | null,
  adapters: {
    crm: CrmAdapter;
    projuris: ProJurisAdapter;
    drive: DriveAdapter;
  }
): Promise<ResolvedClient> {
  // 1. Search CRM AG by phone number
  let crmAvailable = true;
  try {
    const crmClient = await adapters.crm.findByPhone(phone);
    if (crmClient) {
      const validation = validateNivel1(crmClient);
      const clienteId =
        (crmClient as Record<string, unknown>)["id"] as string ?? phone;
      return {
        clienteId,
        source: "crm",
        data: crmClient,
        nivel1Complete: validation.complete,
        missing: validation.missing,
        pendingValidation: false,
      };
    }
  } catch (err) {
    console.error(`[Resolver] CRM indisponivel — continuando sem dados de cliente:`, (err as Error).message);
    crmAvailable = false;
  }

  // 2. Check Google Drive for client folder
  if (name) {
    const folderId = await adapters.drive.findClientFolder(name);
    if (folderId && crmAvailable) {
      console.log(
        `[Resolver] Pasta encontrada no Drive para "${name}" — criar registo`
      );
      const clienteId = await adapters.crm.create({
        nome_completo: name,
        telefone_whatsapp: phone,
        data_primeiro_contacto: new Date().toISOString(),
      });
      return {
        clienteId,
        source: "drive",
        data: { nome_completo: name, telefone_whatsapp: phone },
        nivel1Complete: false,
        missing: validateNivel1({ nome_completo: name, telefone_whatsapp: phone }).missing,
        pendingValidation: false,
      };
    }
  }

  // 3. Search ProJuris (legacy CRM)
  if (name) {
    const projurisResult = await adapters.projuris.searchClient(name, phone);
    if (projurisResult && crmAvailable) {
      console.log(
        `[Resolver] Cliente encontrado no ProJuris: ${projurisResult.projuris_nome}`
      );
      const data: Partial<ClienteNivel1> = {
        nome_completo: projurisResult.projuris_nome,
        data_nascimento: projurisResult.projuris_data_nascimento,
        nif: projurisResult.projuris_nif,
        telefone_whatsapp: projurisResult.projuris_telefone || phone,
        email: projurisResult.projuris_email,
        data_primeiro_contacto: new Date().toISOString(),
      };
      const clienteId = await adapters.crm.create(data);
      // ProJuris data ALWAYS requires human validation
      return {
        clienteId,
        source: "projuris",
        data,
        nivel1Complete: false,
        missing: validateNivel1(data).missing,
        pendingValidation: true, // CRITICAL: must be validated by human
      };
    }
  }

  // 4. New client — create minimal record (or skip CRM if unavailable)
  let clienteId = phone; // fallback ID when CRM is down
  const partialData: Partial<ClienteNivel1> = {
    telefone_whatsapp: phone,
    ...(name ? { nome_completo: name } : {}),
  };

  if (crmAvailable) {
    try {
      clienteId = await adapters.crm.create({
        ...partialData,
        data_primeiro_contacto: new Date().toISOString(),
      });
    } catch (err) {
      console.error(`[Resolver] CRM create falhou:`, (err as Error).message);
    }
  }

  return {
    clienteId,
    source: "new",
    data: partialData,
    nivel1Complete: false,
    missing: validateNivel1(partialData).missing,
    pendingValidation: false,
  };
}
