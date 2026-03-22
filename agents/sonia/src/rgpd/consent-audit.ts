import { createHash } from "node:crypto";

export interface ConsentAuditRecord {
  hash: string;
  markdownContent: string;
}

export function createConsentAuditRecord(
  clienteId: string,
  messageSent: string,
  clientResponse: string,
  timestamp: string,
  canal: "whatsapp" | "email" | "presencial" | "portal" = "whatsapp",
  ipOrigem?: string
): ConsentAuditRecord {
  const hashInput = `${messageSent}|${clientResponse}|${timestamp}`;
  const hash = createHash("sha256").update(hashInput).digest("hex");

  const responseUpper = clientResponse.trim().toUpperCase();
  const accepted = responseUpper === "SIM" || responseUpper === "YES";

  const markdownContent = `---
cliente_id: ${clienteId}
timestamp: ${timestamp}
canal: ${canal}
versao_texto: "v1.0"
hash_sha256: ${hash}
---

## Consentimento RGPD

**Mensagem enviada:**
${messageSent}

**Resposta do cliente:**
${clientResponse}

**Timestamp resposta:** ${timestamp}
${ipOrigem ? `**IP origem:** ${ipOrigem}` : ""}

### Consentimentos registados
- [${accepted ? "x" : " "}] Dados pessoais para serviços jurídicos
- [${accepted ? "x" : " "}] Partilha com tribunais
- [${accepted ? "x" : " "}] Retenção pós-processo
- [ ] Comunicações marketing

### Hash SHA-256
${hash}
`;

  return { hash, markdownContent };
}
