import type {
  ClienteNivel1,
  ClienteImigracao,
  ClienteLaboral,
  ClienteAdministrativo,
  ClienteNacionalidade,
  Materia,
} from "@sd-legal/shared";

export interface ValidationResult {
  complete: boolean;
  missing: string[];
  percentagem: number;
}

const NIVEL1_FIELDS: Array<keyof ClienteNivel1> = [
  "nome_completo",
  "data_nascimento",
  "nacionalidade",
  "tipo_documento_id",
  "numero_documento_id",
  "validade_documento_id",
  "telefone_whatsapp",
  "email",
  "lingua_preferencial",
  "rgpd",
  "como_chegou",
  "data_primeiro_contacto",
];

const NIVEL2_IMIGRACAO: Array<keyof ClienteImigracao> = [
  "pais_nascimento",
  "pais_residencia_actual",
  "processos_anteriores_aima",
];

const NIVEL2_LABORAL: Array<keyof ClienteLaboral> = ["situacao_actual"];

const NIVEL2_ADMINISTRATIVO: Array<keyof ClienteAdministrativo> = [
  "entidade_publica",
];

const NIVEL2_NACIONALIDADE: Array<keyof ClienteNacionalidade> = [
  "grau_ligacao",
  "cert_registo_criminal_pt",
  "cert_registo_criminal_origem",
];

export function validateNivel1(
  client: Partial<ClienteNivel1>
): ValidationResult {
  const missing: string[] = [];

  for (const field of NIVEL1_FIELDS) {
    if (field === "rgpd") {
      if (!client.rgpd?.consentimento_dados_pessoais) {
        missing.push("rgpd");
      }
    } else if (field === "nif") {
      // NIF is optional if justification is provided
      continue;
    } else {
      const value = client[field as keyof typeof client];
      if (value === undefined || value === null || value === "") {
        missing.push(field);
      }
    }
  }

  const total = NIVEL1_FIELDS.length;
  const filled = total - missing.length;

  return {
    complete: missing.length === 0,
    missing,
    percentagem: Math.round((filled / total) * 100),
  };
}

export function validateNivel2(
  client: Record<string, unknown>,
  materia: Materia
): ValidationResult {
  let requiredFields: string[];

  switch (materia) {
    case "imigracao":
      requiredFields = NIVEL2_IMIGRACAO as string[];
      break;
    case "laboral":
      requiredFields = NIVEL2_LABORAL as string[];
      break;
    case "administrativo":
      requiredFields = NIVEL2_ADMINISTRATIVO as string[];
      break;
    case "nacionalidade":
      requiredFields = NIVEL2_NACIONALIDADE as string[];
      break;
    default:
      return { complete: true, missing: [], percentagem: 100 };
  }

  const missing = requiredFields.filter((field) => {
    const value = client[field];
    return value === undefined || value === null || value === "";
  });

  const total = requiredFields.length;
  const filled = total - missing.length;

  return {
    complete: missing.length === 0,
    missing,
    percentagem: total > 0 ? Math.round((filled / total) * 100) : 100,
  };
}
