/**
 * Sistema de hierarquia — identifica e autoriza superiores da SonIA.
 *
 * Os numeros de telefone sao carregados via variaveis de ambiente para
 * nao hardcodar dados pessoais no codigo.
 */

export interface AuthorizedSuperior {
  nome: string;
  referencia: string;
  cargo: "chefe" | "superiora" | "colega";
  /** Nivel de autoridade (maior = mais autoridade) */
  nivel: number;
  phone: string;
}

/**
 * Carrega superiores autorizados a partir de variaveis de ambiente.
 * Formato esperado:
 *   SONIA_SUPERIOR_EDUARDO=+351...
 *   SONIA_SUPERIOR_CAROL=+351...
 *   SONIA_SUPERIOR_MARI=+351...
 */
export function loadSuperiors(): AuthorizedSuperior[] {
  const superiors: AuthorizedSuperior[] = [];

  const eduardo = process.env.SONIA_SUPERIOR_EDUARDO;
  if (eduardo) {
    superiors.push({
      nome: "Eduardo Dias",
      referencia: "Dr. Eduardo",
      cargo: "chefe",
      nivel: 3,
      phone: eduardo,
    });
  }

  const carol = process.env.SONIA_SUPERIOR_CAROL;
  if (carol) {
    superiors.push({
      nome: "Carolina Pontes",
      referencia: "Dona Carol",
      cargo: "superiora",
      nivel: 2,
      phone: carol,
    });
  }

  const mari = process.env.SONIA_SUPERIOR_MARI;
  if (mari) {
    superiors.push({
      nome: "Mariana Portugal",
      referencia: "Mari",
      cargo: "colega",
      nivel: 1,
      phone: mari,
    });
  }

  return superiors;
}

/**
 * Identifica um superior pelo numero de telefone (JID ou E.164).
 */
export function identifySuperior(
  phone: string,
  superiors: AuthorizedSuperior[]
): AuthorizedSuperior | null {
  // Normalizar: remover @s.whatsapp.net e garantir +
  const normalized = phone.replace(/@.*$/, "").replace(/^(\d)/, "+$1");

  return (
    superiors.find(
      (s) => s.phone === normalized || s.phone === normalized.replace("+", "")
    ) ?? null
  );
}
