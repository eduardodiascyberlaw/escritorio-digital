# SD LEGAL — DOCUMENTO DE IMPLEMENTAÇÃO
## Para uso com Claude Code

**Projecto:** SD Legal — Escritório de Advocacia Digital  
**Stack base:** Paperclip + OpenClaw + CRM AG + Obsidian + Lex-Corpus  
**VPS:** Contabo EU — Alemanha (já operacional com Sistema Silva)  
**Data:** 2026-03  
**Versão:** 2.0

---

## DECISÕES DE ARQUITECTURA TOMADAS

### LLM — Modelos e autenticação

| Agente | Modelo | Plataforma | Justificação |
|---|---|---|---|
| Sónia | Gemini 2.5 Flash | Vertex AI | Custo-eficiência, multimodalidade nativa (OCR, áudio) |
| Rex | Gemini 2.5 Pro | Vertex AI | Raciocínio complexo, orquestração de processos |
| Iris | Gemini 2.5 Flash | Vertex AI | Tarefas financeiras estruturadas, baixo custo |
| Nova | Gemini 2.5 Pro | Vertex AI | Pesquisa jurídica, análise de contexto longo |
| **Lex** | **Claude Sonnet 4.6** | **Anthropic API** | **Único agente que produz peças jurídicas com consequências legais** |

### Google Cloud — Configuração RGPD

| Item | Valor |
|---|---|
| Projecto ID | 514934487167 |
| Nome do projecto | Default Gemini Project |
| Região | europe-west4 (Países Baixos) |
| Conta de serviço | sd-legal-agents |
| Autenticação | Application Default Credentials (ADC) |
| Chaves JSON | ❌ Não usadas (política de segurança da organização) |
| Residência de dados EU | ✅ Garantida pelo Vertex AI europe-west4 |
| Dados usados para treino Google | ❌ Nunca (política Vertex AI enterprise) |

**Porquê Vertex AI e não plano Pro consumer:**
O plano Pro consumer não garante residência de dados na EU. O Vertex AI com região `europe-west4` garante que todos os dados dos clientes são processados exclusivamente em território UE, tornando o sistema defensável perante a CNPD portuguesa e conforme com o RGPD.

**Porquê ADC e não ficheiro JSON:**
A organização Google Cloud tem a política `iam.disableServiceAccountKeyCreation` activa por segurança. O ADC é o método recomendado pelo Google para servidores em produção — sem ficheiros de credenciais para gerir ou comprometer.

### VPS Contabo — Alemanha

O VPS estar na Alemanha (território EU) garante:
- Dados em repouso dentro da EU ✅
- Logs da aplicação dentro da EU ✅
- Base de dados CRM dentro da EU ✅
- Vault do Obsidian dentro da EU ✅

O Vertex AI com região `europe-west4` garante adicionalmente:
- Processamento LLM dentro da EU ✅
- Sem retenção de dados pelo Google ✅

### CRM legado e fontes de dados

| Sistema | Uso | Método de acesso |
|---|---|---|
| CRM AG | CRM principal (já existente) | API directa |
| ProJuris | CRM legado — migração de dados | Playwright (browser automation) |
| Google Drive | Pastas individuais de clientes | Google Drive API |

---

## ÍNDICE

1. [Visão geral da arquitectura](#1-visão-geral-da-arquitectura)
2. [Agentes — identidade e responsabilidades](#2-agentes)
3. [Schema de tickets — protocolo de comunicação](#3-schema-de-tickets)
4. [Schema do CRM AG — campos de cliente](#4-schema-crm-ag)
5. [Arquitectura do Obsidian Vault](#5-obsidian-vault)
6. [Plano de fases](#6-plano-de-fases)
7. [Fase 0 — Infraestrutura](#fase-0--infraestrutura)
8. [Fase 0.5 — Conteúdo do Obsidian](#fase-05--conteúdo-do-obsidian)
9. [Fase 1 — Agente Sónia](#fase-1--agente-sónia)
10. [Fase 2 — Agente Rex](#fase-2--agente-rex)
11. [Fase 3 — Agente Iris](#fase-3--agente-iris)
12. [Fase 4 — Agente Lex](#fase-4--agente-lex)
13. [Fase 5 — Agente Nova](#fase-5--agente-nova)
14. [Regras de governação](#14-regras-de-governação)
15. [Fluxos completos end-to-end](#15-fluxos-completos)
16. [Variáveis de ambiente](#16-variáveis-de-ambiente)

---

## 1. VISÃO GERAL DA ARQUITECTURA

```
CANAIS DE ENTRADA
─────────────────────────────────────────────────────────
  WhatsApp (ZIP histórico + mensagens directas)
  Portal Web (upload de documentos + formulários)

                         ↓
                    ┌─────────┐
                    │  SÓNIA  │  ← única interface com o cliente
                    └────┬────┘     Gemini 2.5 Flash / Vertex AI
                         │ tickets (Paperclip)
          ┌──────────────┼──────────────┐
          ↓              ↓              ↓
       ┌─────┐        ┌─────┐       ┌──────┐
       │ REX │        │IRIS │       │ LEX  │
       │ Pro │        │Flash│       │Sonnet│
       └──┬──┘        └─────┘       └──────┘
          │
          ↓
       ┌──────┐
       │ NOVA │
       │ Pro  │
       └──────┘

INFRAESTRUTURA PARTILHADA
─────────────────────────────────────────────────────────
  Paperclip       → orquestração, tickets, heartbeats, budgets
  CRM AG          → dados de clientes e processos (já existente)
  Obsidian Vault  → memória institucional (vault partilhado no VPS)
  Lex-Corpus      → RAG sobre 139K decisões DGSI + legislação
  ProJuris        → CRM legado (acesso via Playwright para migração)
  Google Drive    → pasta-mãe com pastas individuais por cliente
  Vertex AI       → plataforma LLM (europe-west4, RGPD-compliant)
```

**Princípio fundamental:** Nenhum agente comunica directamente com o cliente excepto a Sónia. Todos os retornos de outros agentes chegam ao cliente através da Sónia.

---

## 2. AGENTES

### 🟣 SÓNIA — Rececionista & Gestora de Relação

| | |
|---|---|
| **LLM** | Gemini 2.5 Flash via Vertex AI (europe-west4) |
| **Canal** | WhatsApp + Portal Web |
| **Recebe de** | Cliente (WhatsApp ZIP, mensagens, documentos, fotos) |
| **Produz** | Ficha CRM, registo RGPD, ticket de triagem |
| **Aciona** | Rex (abertura processo), Iris (via Rex) |
| **Recebe de volta** | Todos os agentes → para comunicar ao cliente |
| **Memória privada** | Histórico de conversa, tom, língua, disponibilidade do cliente |
| **Memória partilhada** | Dados pessoais, consentimentos, documentos, estado do processo |
| **Budget mensal** | A definir |
| **Heartbeat** | Cada 5 minutos (verificar mensagens não respondidas) |

**Skills da Sónia:**
- Parser de histórico WhatsApp (ZIP)
- Comunicação por texto e áudio (ElevenLabs TTS)
- Colheita e registo de consentimento RGPD
- OCR de documentos de identificação (multimodalidade Gemini nativa)
- Onboarding conversacional adaptativo
- Migração de dados do ProJuris via Playwright
- Acesso ao Google Drive (pasta de clientes)
- Agendamento de consultas (Google Calendar)
- Informação proactiva e alertas
- Triagem e classificação de casos

**O que Sónia NÃO faz:**
- Dar pareceres jurídicos
- Interpretar documentos com consequências jurídicas
- Comprometer posição processual
- Acionar cobrança sem validação do Rex

---

### 🔵 REX — Controller Jurídico

| | |
|---|---|
| **LLM** | Gemini 2.5 Pro via Vertex AI (europe-west4) |
| **Canal** | Interno (sem contacto com cliente) |
| **Recebe de** | Sónia (triagem), Lex (rascunhos), Nova (pesquisas), Iris (estado financeiro) |
| **Produz** | Processo aberto no CRM, plano de acção, alertas de prazo |
| **Aciona** | Lex (peças), Nova (pesquisa), Iris (honorários), Sónia (updates para cliente) |
| **Memória privada** | Análise interna de viabilidade, notas de estratégia |
| **Memória partilhada** | Estado do processo, prazos, advogado responsável |
| **Budget mensal** | A definir |
| **Heartbeat** | Diário às 08:00 (verificar prazos dos próximos 10 dias) |

**O que Rex NÃO faz:**
- Tomar decisões jurídicas finais (identifica, não decide)
- Comunicar directamente com o cliente
- Validar peças processuais (papel do advogado humano)

---

### 🟢 IRIS — Agente Financeiro

| | |
|---|---|
| **LLM** | Gemini 2.5 Flash via Vertex AI (europe-west4) |
| **Canal** | Interno (sem contacto directo com cliente) |
| **Recebe de** | Rex (tipo e complexidade do processo) |
| **Produz** | Proposta de honorários, factura, recibo, alertas de atraso |
| **Aciona** | Rex (confirmação de aceitação), Sónia (via Rex para entregar proposta) |
| **Memória privada** | Margens, descontos, histórico de negociação |
| **Memória partilhada** | Estado de pagamento, elegibilidade apoio judiciário |
| **Budget mensal** | A definir |
| **Heartbeat** | Semanal (segunda-feira, verificar pagamentos em atraso) |

**Regra crítica:** Nenhum processo avança para o Lex sem Rex ter confirmação de Iris (proposta aceite ou apoio judiciário deferido).

---

### 🟡 LEX — Agente de Contencioso

| | |
|---|---|
| **LLM** | **Claude Sonnet 4.6 via Anthropic API** |
| **Canal** | Interno (sem contacto com cliente) |
| **Recebe de** | Rex (instrução com contexto completo) |
| **Consulta** | Lex-Corpus (RAG DGSI), Obsidian (playbooks, templates) |
| **Produz** | Rascunho de peça processual — **sempre marcado como RASCUNHO** |
| **Devolve a** | Rex (que notifica advogado humano para validação) |
| **Memória privada** | Rascunhos em curso, versões anteriores, notas de revisão |
| **Memória partilhada** | Versão final validada (vai para CRM e Obsidian) |
| **Budget mensal** | A definir |
| **Heartbeat** | Event-driven (accionado pelo Rex) |

**Justificação do Claude Sonnet 4.6:** O Lex é o único agente que produz peças processuais com consequências jurídicas directas. O Claude Sonnet 4.6 é usado pela sua superioridade comprovada em raciocínio jurídico estruturado, fidelidade ao contexto em documentos longos, e menor taxa de alucinação em tarefas de redacção jurídica complexa.

**Regra crítica:** Lex nunca entrega peça directamente ao cliente nem a tribunal. Toda a peça passa obrigatoriamente por validação humana.

---

### 🟠 NOVA — Agente de Pesquisa Jurídica

| | |
|---|---|
| **LLM** | Gemini 2.5 Pro via Vertex AI (europe-west4) |
| **Canal** | Interno |
| **Recebe de** | Rex ou Lex (query com contexto do caso) |
| **Consulta** | Lex-Corpus, DGSI corpus, Obsidian (doutrina), web (legislação actualizada) |
| **Produz** | Memo de pesquisa estruturado com fontes e nível de confiança |
| **Devolve a** | Quem pediu (Rex ou Lex) |
| **Memória privada** | Cache de pesquisas recentes |
| **Memória partilhada** | Memos validados → Obsidian /Pesquisas/ |
| **Budget mensal** | A definir |
| **Heartbeat** | Event-driven |

---

## 3. SCHEMA DE TICKETS

Todo o ticket entre agentes segue esta estrutura. O Paperclip valida o schema antes de aceitar o ticket.

```typescript
interface Ticket {
  // Identificação
  ticket_id: string;          // UUID v4
  criado_em: string;          // ISO 8601
  atualizado_em: string;      // ISO 8601

  // Routing
  origem: AgentId;
  destino: AgentId;
  tipo: TicketTipo;
  prioridade: "urgente" | "normal" | "baixa";

  // Referências
  cliente_id: string;         // ref CRM AG
  processo_id?: string;       // ref CRM AG (null se processo ainda não existe)

  // Contexto
  contexto: {
    materia?: "imigracao" | "laboral" | "administrativo" | "familia" | "nacionalidade" | "outro";
    urgencia_processual?: "cautelar" | "prazo_curto" | "normal";
    resumo: string;
    documentos?: string[];    // refs de documentos no CRM/Drive
    dados_adicionais?: Record<string, unknown>;
  };

  payload: TicketPayload;
  retorno_esperado: RetornoTipo;
  deadline?: string;          // ISO 8601

  estado: "pendente" | "em_curso" | "aguarda_humano" | "concluido" | "cancelado";
  audit_trail: AuditEntry[];
}

type AgentId = "sonia" | "rex" | "iris" | "lex" | "nova" | "humano";

type TicketTipo =
  | "triagem_novo_cliente"
  | "triagem_cliente_existente"
  | "abertura_processo"
  | "pedido_honorarios"
  | "confirmacao_pagamento"
  | "pedido_peca"
  | "pedido_pesquisa"
  | "update_cliente"
  | "alerta_prazo"
  | "escalamento_humano"
  | "validacao_peca";

type RetornoTipo =
  | "ficha_cliente"
  | "processo_aberto"
  | "proposta_honorarios"
  | "confirmacao_financeira"
  | "rascunho_peca"
  | "peca_validada"
  | "memo_pesquisa"
  | "update_estado"
  | "decisao_humana";

interface AuditEntry {
  timestamp: string;
  agente: AgentId;
  accao: string;
  detalhe?: string;
}
```

---

## 4. SCHEMA CRM AG — CAMPOS DE CLIENTE

### Nível 1 — Obrigatório para abrir qualquer processo

```typescript
interface ClienteNivel1 {
  nome_completo: string;
  data_nascimento: string;                  // ISO 8601 (YYYY-MM-DD)
  nacionalidade: string;                    // ISO 3166-1 alpha-2
  tipo_documento_id: "passaporte" | "cc" | "bi" | "titulo_residencia" | "outro";
  numero_documento_id: string;
  validade_documento_id: string;

  telefone_whatsapp: string;                // E.164 (+351...)
  email: string;
  lingua_preferencial: string;              // ISO 639-1

  nif?: string;
  justificacao_ausencia_nif?: string;

  rgpd: {
    consentimento_dados_pessoais: boolean;
    consentimento_partilha_tribunais: boolean;
    consentimento_comunicacoes: boolean;
    consentimento_retencao_pos_processo: boolean;
    data_consentimento: string;             // ISO 8601 com timezone
    canal_consentimento: "whatsapp" | "email" | "presencial" | "portal";
    hash_sha256: string;
    versao_texto_consentimento: string;     // ex: "v1.0"
    ip_origem?: string;
  };

  como_chegou: "referencia" | "pesquisa_web" | "cliente_anterior" | "redes_sociais" | "outro";
  referencia_detalhe?: string;
  data_primeiro_contacto: string;
}
```

### Nível 2 — Obrigatório por área de prática

```typescript
interface ClienteImigracao {
  pais_nascimento: string;
  pais_residencia_actual: string;
  tipo_titulo_actual?: string;
  numero_titulo_residencia?: string;
  validade_titulo_actual?: string;
  data_entrada_portugal?: string;
  niss?: string;
  numero_passaporte?: string;
  processos_anteriores_aima: boolean;
  referencia_processo_aima?: string;
}

interface ClienteLaboral {
  entidade_empregadora?: string;
  nif_empregadora?: string;
  data_inicio_contrato?: string;
  tipo_contrato?: "prazo_certo" | "indeterminado" | "prestacao_servicos" | "outro";
  situacao_actual: "activo" | "despedido" | "baixa" | "outro";
}

interface ClienteAdministrativo {
  entidade_publica: string;
  referencia_processo_administrativo?: string;
  data_acto_administrativo?: string;
  data_notificacao_acto?: string;
}

interface ClienteNacionalidade {
  grau_ligacao: "nascimento" | "ascendencia" | "casamento" | "residencia";
  anos_residencia_legal?: number;
  cert_registo_criminal_pt: "existe" | "nao_existe" | "a_obter";
  cert_registo_criminal_origem: "existe" | "nao_existe" | "a_obter";
}
```

### Nível 3 — Importante mas não bloqueante

```typescript
interface ClienteNivel3 {
  morada_portugal?: string;
  morada_pais_origem?: string;
  contacto_emergencia?: { nome: string; telefone: string; relacao: string };
  estado_civil?: "solteiro" | "casado" | "uniao_facto" | "divorciado" | "viuvo";
  profissao?: string;
  habilitacoes?: string;
  filhos_menores?: number;
  conjuge?: { nome: string; nacionalidade: string };
  outras_linguas?: string[];
  acessibilidade?: string;
  horario_preferido?: string;
  canal_comunicacao_preferido?: "whatsapp" | "email" | "telefone";
  observacoes?: string;
}
```

### Regra de progressão de processo

```
Nível 1 incompleto  → Sónia NÃO cria ticket para Rex
Nível 2 incompleto  → Rex abre processo com flag BLOQUEADO
Nível 3 incompleto  → processo avança, Sónia recolhe progressivamente
```

---

## 5. OBSIDIAN VAULT

### Estrutura de pastas

```
Vault/
├── /Clientes/
│     └── {cliente_id}.md          ← escrito pela Sónia, actualizado a cada interacção
│
├── /Processos/
│     └── {processo_id}.md         ← timeline, estado, docs, notas do Rex
│
├── /Pecas/
│     └── {processo_id}/
│           ├── v1_rascunho.md     ← produzido pelo Lex (marcado RASCUNHO)
│           ├── v1_revisao.md      ← notas do advogado humano
│           └── v2_validado.md     ← após validação humana
│
├── /Pesquisas/
│     └── {query_hash}.md          ← memos da Nova, reutilizáveis
│
├── /Playbooks/
│     └── cautelar_imigracao.md
│     └── sis_indicacao.md
│     └── art92_formacao.md
│     └── custas_de_parte.md
│     └── renovacao_ar_standard.md
│     └── primeira_ar.md
│
├── /Legislacao/
│     └── lei_23_2007.md
│     └── lei_37_81.md
│     └── cpta.md
│     └── cpa.md
│
├── /Templates/
│     └── /comunicacao_cliente/
│           ├── boas_vindas.md
│           ├── pedido_documentos.md
│           ├── update_processo.md
│           ├── proposta_honorarios.md
│           └── consentimento_rgpd_v1.0.md
│     └── /pecas_processuais/
│           ├── requerimento_agendamento.md
│           └── providencia_cautelar.md
│
├── /Financeiro/                   ← acesso restrito: Iris + Rex + humano
│     └── tarifario.md
│     └── condicoes_apoio_judiciario.md
│
└── /Audit/                        ← NUNCA editado por agente
      └── /consentimentos_rgpd/    ← imutável — um ficheiro por consentimento
      └── /decisoes_humanas/       ← registo de cada override humano
      └── /overrides_agente/       ← quando humano corrige um agente
```

### Permissões por agente

| Pasta | Sónia | Rex | Iris | Lex | Nova |
|---|---|---|---|---|---|
| /Clientes/ | R+W | R | R | R | R |
| /Processos/ | R | R+W | R | R | R |
| /Pecas/ | — | R+W | — | R+W | — |
| /Pesquisas/ | — | R | — | R | R+W |
| /Playbooks/ | R | R | — | R | R |
| /Legislacao/ | — | R | — | R | R+W |
| /Templates/ | R | R | R | R | — |
| /Financeiro/ | — | R | R+W | — | — |
| /Audit/ | append | append | append | append | append |

---

## 6. PLANO DE FASES

| Fase | Descrição | Dependências |
|---|---|---|
| **0** | Paperclip no VPS + Obsidian vault estrutura + schema tickets + Vertex AI ADC | — |
| **0.5** | Migração de conteúdo para Obsidian (trabalho humano) | Fase 0 |
| **1** | Agente Sónia | Fase 0 + 0.5 mínimo |
| **2** | Agente Rex | Fase 1 validada |
| **3** | Agente Iris | Fase 2 validada |
| **4** | Agente Lex | Fase 2 + 3 validadas |
| **5** | Agente Nova | Fase 4 validada |

---

## FASE 0 — INFRAESTRUTURA

### 0.1 — Paperclip no VPS

O VPS Contabo já tem Sistema Silva em Docker Compose. Paperclip entra como novo serviço.

```yaml
# Adicionar ao docker-compose.yml existente

services:
  paperclip:
    image: node:20-alpine
    working_dir: /app
    command: sh -c "pnpm install && pnpm start"
    volumes:
      - ./paperclip:/app
      - paperclip_data:/app/data
    ports:
      - "3100:3100"
    environment:
      - DATABASE_URL=postgresql://paperclip:${PAPERCLIP_DB_PASSWORD}@paperclip_db:5432/paperclip
      - NODE_ENV=production
    depends_on:
      - paperclip_db
    restart: unless-stopped

  paperclip_db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=paperclip
      - POSTGRES_PASSWORD=${PAPERCLIP_DB_PASSWORD}
      - POSTGRES_DB=paperclip
    volumes:
      - paperclip_db_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  paperclip_data:
  paperclip_db_data:
```

### 0.2 — Configurar Vertex AI ADC no VPS

```bash
# Instalar Google Cloud CLI
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
gcloud init

# Autenticar Application Default Credentials
gcloud auth application-default login

# Confirmar projecto e região
gcloud config set project 514934487167
gcloud config set compute/region europe-west4
```

### 0.3 — Verificar conectividade Vertex AI

```typescript
// Teste de conectividade — executar após configurar ADC
import { VertexAI } from '@google-cloud/vertexai';

const vertexAI = new VertexAI({
  project: '514934487167',
  location: 'europe-west4'  // Países Baixos — RGPD ✅
});

const model = vertexAI.getGenerativeModel({
  model: 'gemini-2.5-flash'
});

const result = await model.generateContent('Olá, teste de conectividade SD Legal');
console.log(result.response.text());
```

### 0.4 — Criar empresa SD Legal no Paperclip

```json
{
  "empresa": {
    "nome": "SD Legal",
    "missao": "Prestar serviços jurídicos de excelência em direito administrativo, imigração, laboral e nacionalidade, com apoio de tecnologia de ponta, garantindo acesso à justiça a todos os clientes.",
    "valores": ["excelência", "transparência", "acessibilidade", "rigor deontológico"]
  }
}
```

### 0.5 — Estrutura do Obsidian Vault

Criar estrutura de pastas conforme secção 5 deste documento.

**Plugins Obsidian a instalar:**
- Dataview (queries dinâmicas)
- Templater (templates com variáveis)
- Git (sync com repositório privado)
- Tasks (gestão de tarefas)

---

## FASE 0.5 — CONTEÚDO DO OBSIDIAN

**Esta fase é executada pela equipa humana — não por Claude Code.**

### Checklist mínimo antes da Fase 1

**Playbooks obrigatórios:**
- [ ] Providência cautelar contra AIMA (migrar do existente)
- [ ] Indicação SIS — Lei 23/2007 Art. 77/123 (migrar)
- [ ] Art. 92 Lei 23/2007 — formação profissional (migrar)
- [ ] Custas de parte RCP (migrar)
- [ ] Renovação AR standard (criar)
- [ ] Primeira AR (criar)

**Templates de comunicação obrigatórios:**
- [ ] Boas-vindas ao escritório
- [ ] Texto de consentimento RGPD v1.0
- [ ] Pedido de documentos (por tipo de caso)
- [ ] Update de estado do processo
- [ ] Apresentação de proposta de honorários

**Conteúdo financeiro:**
- [ ] Tarifário por tipo de processo
- [ ] Condições de apoio judiciário

**Legislação mínima:**
- [ ] Lei 23/2007 (imigração)
- [ ] Lei 37/81 (nacionalidade)
- [ ] CPTA (processo administrativo)

---

## FASE 1 — AGENTE SÓNIA

### Stack técnica

```
Linguagem:    TypeScript / Node.js 20+
LLM:          Gemini 2.5 Flash via Vertex AI (europe-west4)
Autenticação: Application Default Credentials (ADC)
Voz:          ElevenLabs API (TTS)
OCR:          Gemini Vision nativo (multimodalidade)
CRM:          CRM AG API
Browser:      Playwright (ProJuris)
Storage:      Google Drive API
Gateway WA:   OpenClaw (já operacional)
Calendário:   Google Calendar API
```

### 1.1 — Parser de histórico WhatsApp

```typescript
interface WhatsAppMessage {
  timestamp: string;           // ISO 8601
  remetente: "cliente" | "escritorio";
  tipo: "texto" | "audio" | "imagem" | "documento" | "video" | "contacto";
  conteudo: string;
  media_path?: string;
}

interface WhatsAppHistory {
  numero_cliente: string;
  periodo: { inicio: string; fim: string };
  total_mensagens: number;
  mensagens: WhatsAppMessage[];
  media_files: string[];
}
```

**Pipeline de parsing:**
```
1. Descompactar ZIP → extrair _chat.txt + media
2. Detectar formato (Android vs iOS)
3. Parsear linha a linha
4. Identificar remetente
5. Detectar importação incremental (só processar delta)
6. Retornar WhatsAppHistory normalizado
```

**Regex de parsing:**
```typescript
const ANDROID_PATTERN = /^(\d{2}\/\d{2}\/\d{2,4}),?\s+(\d{2}:\d{2})\s+-\s+([^:]+):\s+(.+)$/;
const IOS_PATTERN = /^\[(\d{2}\/\d{2}\/\d{4}),\s+(\d{2}:\d{2}:\d{2})\]\s+([^:]+):\s+(.+)$/;
```

### 1.2 — Análise e classificação (Gemini 2.5 Flash)

```
SYSTEM PROMPT (Gemini 2.5 Flash via Vertex AI europe-west4):

És a Sónia, recepcionista jurídica do escritório SD Legal.
Analisa o histórico de conversa WhatsApp e extrai:

1. IDENTIFICAÇÃO DO CLIENTE
   - Nome, dados pessoais identificáveis, língua

2. CLASSIFICAÇÃO DO CASO
   - Área: imigração | laboral | administrativo | família | nacionalidade | outro
   - Sub-tipo específico
   - Urgência: urgente | normal | baixa
   - Indicadores de prazo iminente

3. INTENÇÃO DO CLIENTE
   - informacao_geral | consulta | contratacao | reclamacao | outro

4. DOCUMENTOS PARTILHADOS
   - Lista de media e tipo provável

5. DADOS EM FALTA
   - Campos do Nível 1 não identificados

6. NOTAS DE CONTEXTO

Responde EXCLUSIVAMENTE em JSON válido sem markdown.
```

### 1.3 — Resolução de cadastro

```
FLUXO DE DECISÃO:

Pesquisar no CRM AG por número WhatsApp
  ├── ENCONTRADO + Nível 1 completo → processar conversa
  ├── ENCONTRADO + Nível 1 incompleto → resolver campos em falta
  └── NÃO ENCONTRADO:
        a) Verificar Google Drive (pasta-mãe de clientes)
        b) Pesquisar no ProJuris via Playwright
           → Se encontrado: extrair + criar registo "pendente_validacao"
           → Abrir chamado humano para validação obrigatória
        c) Campos restantes: onboarding conversacional com cliente
        d) Campos internos: chamado para humano
```

### 1.4 — Fluxo RGPD

**CRÍTICO: Nenhum dado é armazenado antes de consentimento confirmado.**

```
1. Enviar texto de consentimento (template Obsidian /Templates/comunicacao_cliente/consentimento_rgpd_v1.0.md)

2. Aguardar resposta afirmativa

3. Ao confirmar:
   a) Calcular hash SHA-256 do par (mensagem + resposta)
   b) Gravar no CRM AG com timestamp da resposta do cliente
   c) Gravar ficheiro IMUTÁVEL em Obsidian /Audit/consentimentos_rgpd/{cliente_id}_{timestamp}.md
   d) Nunca editar este ficheiro após criação

4. Se não responder em 24h → reenviar lembrete
5. Se recusar → registar + não processar dados + escalar para humano
```

**Texto de consentimento (v1.0):**
```
O escritório SD Legal solicita o vosso consentimento para:

✅ Tratamento dos vossos dados pessoais para prestação de serviços jurídicos
✅ Partilha com tribunais e entidades administrativas quando necessário
✅ Retenção durante o período legal obrigatório após conclusão do processo

Opcional:
☐ Recepção de informações sobre serviços e novidades do escritório

Para confirmar, responda SIM.
Para recusar qualquer ponto, indique qual.
```

### 1.5 — OCR de documentos (Gemini Vision nativo)

```
PIPELINE:
1. Receber imagem → verificar legibilidade
   Se ilegível → solicitar nova foto com instruções específicas

2. Classificar documento:
   - Passaporte | Título de residência | CC | BI | Contrato | Declaração IRS | Outro

3. Extrair campos por tipo:
   Passaporte: nome, data nascimento, número, validade, país, MRZ
   Título residência: número, tipo, validade, nome
   CC: número, validade, NIF

4. Validar:
   - Dígito de controlo onde aplicável
   - Coerência com dados CRM existentes
   - Discrepância → flag para revisão humana

5. Armazenar:
   - Ficheiro original → Google Drive (pasta do cliente)
   - Campos extraídos → CRM AG
   - Registo → Obsidian /Clientes/{cliente_id}.md
```

### 1.6 — Onboarding conversacional

```
REGRA: nunca pedir mais de 2 dados por mensagem.

SEQUÊNCIA (cliente novo, imigração):
Turno 1: "Qual é o vosso nome completo e data de nascimento?"
Turno 2: "Qual é a vossa nacionalidade e número de passaporte?"
Turno 3: "Têm NIF português?"
[continua adaptativamente]

SESSÕES PERSISTENTES:
- Estado guardado no CRM AG (campo onboarding_estado)
- Retoma de onde ficou se cliente abandonar
- Indicador: "O vosso perfil está 60% completo"
```

### 1.7 — Migração ProJuris via Playwright

```typescript
// REGRAS DE MIGRAÇÃO:
// 1. Criar cliente no CRM AG com estado "migracao_pendente_validacao"
// 2. Notificar humano: "Cliente {nome} importado do ProJuris — aguarda validação"
// 3. Humano valida → estado muda para "activo"
// NUNCA marcar automaticamente como validado sem confirmação humana

interface ProJurisMapeamento {
  // Campos a mapear ProJuris → CRM AG
  // Completar após inspecção real do ProJuris
  projuris_nome: string;           // → cliente.nome_completo
  projuris_data_nascimento: string; // → cliente.data_nascimento
  projuris_nif: string;            // → cliente.nif
  projuris_telefone: string;       // → cliente.telefone_whatsapp
  projuris_email: string;          // → cliente.email
}
```

### 1.8 — Google Drive

```typescript
// Pasta-mãe: ID a fornecer por Eduardo
// Operações:
// 1. Listar subpastas (uma por cliente)
// 2. Identificar pasta do cliente por nome
// 3. Listar e descarregar ficheiros para OCR
// 4. Upload de novos documentos

const driveConfig = {
  pasta_mae_id: process.env.GOOGLE_DRIVE_PASTA_MAE_ID,
  // Autenticação via ADC — sem ficheiro JSON necessário
};
```

### 1.9 — Agendamento (Google Calendar)

```
FLUXO:
1. Cliente pede consulta
2. Sónia verifica próximos 5 slots livres
3. Apresenta opções ao cliente
4. Cliente escolhe → criar evento:
   - Título: "Consulta — {nome_cliente} — {materia}"
   - Duração: 45min (default) ou 90min (caso complexo)
   - Reminder: 24h e 1h antes
5. Confirmação ao cliente
6. Registo no CRM AG

LEMBRETES (heartbeat):
- 48h antes: confirmação de presença
- Se não responder em 24h: segundo lembrete
- Se cancelamento: novo slot + notificar advogado
```

### 1.10 — Informação proactiva (heartbeat)

```
HEARTBEAT A CADA 5 MINUTOS:
- Mensagens não respondidas há > 2h → alertar humano
- Documentos solicitados há > 3 dias → lembrete ao cliente
- Consultas nas próximas 48h sem confirmação → lembrete

HEARTBEAT DIÁRIO (07:30):
- Títulos de residência a expirar em 90 dias → notificar cliente
- Prazos processuais críticos → alertar Rex
- Onboardings incompletos há > 7 dias → reactivar ou fechar
```

### 1.11 — Chamado para humano

```typescript
interface ChamadoHumano {
  ticket_id: string;
  tipo: "dados_em_falta" | "validacao_migracao" | "escalamento_juridico" | "decisao_critica";
  urgencia: "imediata" | "hoje" | "esta_semana";
  cliente_id: string;
  descricao: string;
  campos_em_falta?: string[];
  responsavel_sugerido?: string;
  prazo?: string;
}

// Notificação: WhatsApp para equipa + ticket Paperclip + email se urgência imediata
```

### 1.12 — Geração de ticket de triagem

```typescript
const ticketTriagem: Ticket = {
  ticket_id: uuid(),
  criado_em: now(),
  atualizado_em: now(),
  origem: "sonia",
  destino: "rex",
  tipo: "triagem_novo_cliente",
  prioridade: urgenciaDetectada,
  cliente_id: clienteId,
  processo_id: null,
  contexto: {
    materia: materiaClassificada,
    urgencia_processual: urgenciaProcessual,
    resumo: resumoGeradoPorGemini,
    documentos: documentosCarregados,
  },
  payload: {
    nivel1_completo: true,
    nivel2_completo: nivel2Completo,
    intencao_cliente: intencaoDetectada,
    conflito_interesses_verificado: true,
    notas_adicionais: notasContexto,
  },
  retorno_esperado: "processo_aberto",
  estado: "pendente",
  audit_trail: [
    { timestamp: now(), agente: "sonia", accao: "ticket_criado", detalhe: "triagem concluída" }
  ]
};
```

### 1.13 — Limites deontológicos (hard-coded)

```
ESCALAMENTO FORÇADO PARA HUMANO quando Sónia detecta:
- Pergunta sobre prazo processual específico
- Pedido de interpretação de documento jurídico
- Situação de detenção ou restrição de liberdade
- Ameaça de deportação imediata
- Menor de idade envolvido
- Qualquer pergunta que comece por "tenho direito a..." ou "posso..."

DISCLAIMER AUTOMÁTICO (adicionar a respostas informativas):
"Esta informação é de carácter geral e não constitui aconselhamento jurídico.
Para uma análise do vosso caso específico, recomendamos uma consulta
com os advogados da SD Legal."
```

---

## FASE 2 — AGENTE REX

*(Detalhe a desenvolver após validação da Fase 1)*

**LLM:** Gemini 2.5 Pro via Vertex AI (europe-west4)

**Responsabilidades:**
- Receber ticket de triagem da Sónia
- Verificar conflito de interesses contra base de clientes
- Abrir processo no CRM AG
- Atribuir advogado responsável
- Gerir prazos processuais (heartbeat diário 08:00)
- Coordenar Lex + Nova
- Instruir Sónia sobre comunicações ao cliente
- Alertar humano para validações obrigatórias

---

## FASE 3 — AGENTE IRIS

*(Detalhe a desenvolver após validação da Fase 2)*

**LLM:** Gemini 2.5 Flash via Vertex AI (europe-west4)

**Responsabilidades:**
- Calcular proposta de honorários (tarifário do Obsidian)
- Gerar proposta formatada para o cliente
- Registar aceitação/rejeição
- Gerar facturas e recibos
- Monitorizar pagamentos em atraso
- Verificar elegibilidade para apoio judiciário

---

## FASE 4 — AGENTE LEX

*(Detalhe a desenvolver após validação da Fase 3)*

**LLM:** Claude Sonnet 4.6 via Anthropic API

**Responsabilidades:**
- Receber instrução detalhada do Rex
- Consultar playbooks no Obsidian
- Consultar Lex-Corpus (RAG sobre decisões DGSI)
- Produzir rascunho de peça processual
- Marcar **sempre** como RASCUNHO
- Devolver ao Rex para validação do advogado humano

---

## FASE 5 — AGENTE NOVA

*(Detalhe a desenvolver após validação da Fase 4)*

**LLM:** Gemini 2.5 Pro via Vertex AI (europe-west4)

**Responsabilidades:**
- Pesquisar jurisprudência no Lex-Corpus
- Pesquisar legislação actualizada
- Produzir memo estruturado com fontes e nível de confiança
- Guardar memos validados no Obsidian para reutilização

---

## 14. REGRAS DE GOVERNAÇÃO

### Regras hard (Paperclip impõe automaticamente)

| Regra | Mecanismo |
|---|---|
| Nenhuma peça sai sem validação humana | Paperclip bloqueia ticket do Lex até aprovação registada |
| Nenhum processo avança sem RGPD | Sónia não cria ticket para Rex sem consentimento confirmado |
| Nenhum processo avança sem proposta aceite ou AJ | Rex não aciona Lex sem confirmação do Iris |
| Qualquer agente pode ser pausado imediatamente | Dashboard Paperclip — acesso mobile |
| Override humano sempre registado | Audit log imutável em Obsidian /Audit/ |
| Orçamento mensal por agente | Paperclip para agente quando esgota |
| Nível 1 incompleto bloqueia triagem | Sónia valida antes de criar ticket para Rex |
| Migração ProJuris requer validação humana | Estado "pendente_validacao" bloqueia uso dos dados |

### Escalamento obrigatório para humano

1. Qualquer peça produzida pelo Lex → advogado valida antes de submeter
2. Estratégia processual definida pelo Rex → advogado aprova antes de executar
3. Proposta de honorários acima de X€ → sócio aprova (valor a definir)
4. Qualquer situação de risco deontológico identificada pela Sónia
5. Migração de dados do ProJuris → validação humana obrigatória

---

## 15. FLUXOS COMPLETOS

### Fluxo A — Cliente novo, caso de imigração

```
Cliente envia ZIP WhatsApp
        ↓
[SÓNIA 1.1] parser → WhatsAppHistory
        ↓
[SÓNIA 1.2] Gemini 2.5 Flash → classificação: imigração / normal / contratação
        ↓
[SÓNIA 1.3] não encontrado no CRM
        → verifica Google Drive → não encontrado
        → verifica ProJuris via Playwright → encontrado parcialmente
        → cria registo "pendente_validacao" → chamado humano
        ↓
[HUMANO] valida dados ProJuris → aprova
        ↓
[SÓNIA 1.4] envia texto RGPD → cliente responde "Sim"
        → hash SHA-256 → Audit/ (imutável)
        ↓
[SÓNIA 1.6] onboarding conversacional → campos em falta
        ↓
[SÓNIA 1.5] foto passaporte → Gemini Vision → extracção OCR → CRM AG
        ↓
Nível 1 completo ✓
        ↓
[SÓNIA 1.12] ticket triagem → [REX]
        ↓
[REX] verifica conflito → abre processo → aciona [IRIS]
        ↓
[IRIS] calcula honorários → devolve a [REX]
        ↓
[REX] instrui [SÓNIA]: "apresenta proposta ao cliente"
        ↓
[SÓNIA] envia proposta → cliente aceita → confirma a [IRIS]
        ↓
[IRIS] regista → notifica [REX]: "pode avançar"
        ↓
[REX] atribui advogado → aciona [NOVA] + [LEX]
```

### Fluxo B — Cliente existente, pergunta sobre estado

```
Cliente: "como está o meu processo?"
        ↓
[SÓNIA] identifica cliente → consulta CRM AG
        ↓
Se estado é público → [SÓNIA] responde directamente
Se requer interpretação → [SÓNIA] → [REX]: "cliente quer update"
        ↓
[REX] produz resumo → [SÓNIA] → cliente (linguagem acessível)
```

### Fluxo C — Prazo a vencer (heartbeat Rex 08:00)

```
[REX] detecta prazo a 10 dias
        ↓
[REX] verifica: peça existe? → não
        ↓
[REX] aciona [LEX] prioridade urgente
        ↓
[LEX] Claude Sonnet 4.6 → rascunho → [REX]
        ↓
[REX] notifica advogado humano com deadline
        ↓
[REX] instrui [SÓNIA]: "informa cliente que processo está em fase de submissão"
```

---

## 16. VARIÁVEIS DE AMBIENTE

```bash
# ─────────────────────────────────────────────
# LLM — Vertex AI (Sónia, Rex, Iris, Nova)
# Autenticação via ADC — sem API key necessária
# ─────────────────────────────────────────────
GOOGLE_CLOUD_PROJECT=514934487167
GOOGLE_CLOUD_LOCATION=europe-west4
GEMINI_MODEL_FLASH=gemini-2.5-flash
GEMINI_MODEL_PRO=gemini-2.5-pro

# ─────────────────────────────────────────────
# LLM — Anthropic (exclusivo do Lex)
# ─────────────────────────────────────────────
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-6

# ─────────────────────────────────────────────
# Voz
# ─────────────────────────────────────────────
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID_SONIA=

# ─────────────────────────────────────────────
# CRM
# ─────────────────────────────────────────────
CRM_AG_API_URL=
CRM_AG_API_KEY=

# ─────────────────────────────────────────────
# CRM Legado
# ─────────────────────────────────────────────
PROJURIS_URL=
PROJURIS_USERNAME=
PROJURIS_PASSWORD=

# ─────────────────────────────────────────────
# Google Drive
# ─────────────────────────────────────────────
GOOGLE_DRIVE_PASTA_MAE_ID=

# ─────────────────────────────────────────────
# Infraestrutura
# ─────────────────────────────────────────────
PAPERCLIP_API_URL=http://localhost:3100
PAPERCLIP_API_KEY=
OBSIDIAN_VAULT_PATH=/app/obsidian-vault
WHATSAPP_GATEWAY_URL=

# ─────────────────────────────────────────────
# Paperclip DB
# ─────────────────────────────────────────────
PAPERCLIP_DB_PASSWORD=
```

---

## NOTAS DE IMPLEMENTAÇÃO

### Autenticação Vertex AI no código

```typescript
// CORRECTO — ADC sem ficheiro JSON
import { VertexAI } from '@google-cloud/vertexai';

const vertexAI = new VertexAI({
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_LOCATION  // europe-west4
});

// Sónia e Iris — Flash
const modelFlash = vertexAI.getGenerativeModel({
  model: process.env.GEMINI_MODEL_FLASH
});

// Rex e Nova — Pro
const modelPro = vertexAI.getGenerativeModel({
  model: process.env.GEMINI_MODEL_PRO
});
```

```typescript
// Lex — Claude Sonnet 4.6
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});
```

### Qualidade e testes

- Cada agente tem suite de testes com casos reais anonimizados
- CI/CD via GitHub Actions antes de qualquer deploy
- Logs estruturados (JSON) para todos os agentes
- Telemetria de custos por agente (Paperclip + log próprio)
- Alertas de falha via WhatsApp para administrador SD Legal

### Idiomas suportados pela Sónia

- Português (PT-PT) — principal
- Inglês — secundário
- Francês — se detectado
- Crioulo cabo-verdiano — se detectado (melhor esforço)

### Segurança

- Nunca hardcodar credenciais — usar sempre variáveis de ambiente
- Ficheiro `.env` nunca vai para o GitHub (está no `.gitignore`)
- ADC renova automaticamente as credenciais — sem gestão de tokens
- Logs nunca incluem dados pessoais de clientes (PII)
- Audit trail imutável em Obsidian /Audit/ para todas as decisões críticas

---

*Documento produzido para uso com Claude Code — SD Legal.*  
*Cada fase deve ser implementada sequencialmente com validação humana antes de avançar.*  
*Versão 2.0 — incorpora todas as decisões de arquitectura tomadas em Março 2026.*
