---
titulo: Renovação de Autorização de Residência — Standard
area: imigração
tipo: administrativo
base_legal: Art. 78.º e 79.º Lei 23/2007, Portaria 1563/2007
ultima_revisao: 2026-03
autor: Eduardo Dias
---

# Renovação de AR — Standard

## 1. Quando usar

- Cliente com AR temporária a expirar nos próximos 90 dias
- Renovação sem complicações (sem indicação SIS, sem processos pendentes, sem alteração de situação)
- Heartbeat da Sónia detecta título a expirar → alerta automático

## 2. Prazo de submissão

O pedido de renovação deve ser apresentado **até 30 dias antes** da data de expiração do título de residência (Art. 78.º, n.º 1 Lei 23/2007).

**Se apresentado fora de prazo:**
- Até 30 dias após expiração: possível, com coima (€75-300)
- Após 30 dias: risco de considerar permanência ilegal — avaliar caso a caso

## 3. Requisitos gerais de renovação

- [ ] AR anterior válida ou expirada há menos de 30 dias
- [ ] Ausência de condenação penal superior a 1 ano (não suspensa)
- [ ] Ausência de indicação SIS activa
- [ ] Meios de subsistência comprovados
- [ ] Alojamento comprovado
- [ ] Situação regularizada perante a Segurança Social e Autoridade Tributária

## 4. Documentação por tipo de AR

### 4.1 AR por trabalho subordinado (Art. 88.º)

| Documento | Obrigatório | Observação |
|---|---|---|
| Passaporte válido | Sim | Ou comprovativo de renovação em curso |
| Título de residência anterior | Sim | Original |
| Contrato de trabalho em vigor | Sim | Ou declaração da entidade patronal |
| Último recibo de vencimento | Sim | Dos últimos 3 meses |
| Declaração da Segurança Social | Sim | Extracto de remunerações (últimos 12 meses) |
| Comprovativo de morada | Sim | Contrato arrendamento ou atestado junta de freguesia |
| Registo criminal português | Sim | Emitido há menos de 3 meses |
| NIF | Sim | |
| NISS | Sim | |
| Comprovativo de situação fiscal regularizada | Sim | Portal das Finanças |
| 2 fotografias tipo passe | Sim | Fundo branco |

### 4.2 AR por trabalho independente (Art. 89.º)

Além dos documentos gerais:
| Documento | Obrigatório | Observação |
|---|---|---|
| Abertura de actividade nas Finanças | Sim | Ou último recibo verde |
| Declaração de IRS (último ano) | Sim | |
| Comprovativo de rendimentos | Sim | Extractos bancários ou declaração contabilista |

### 4.3 AR para estudantes

Além dos documentos gerais:
| Documento | Obrigatório | Observação |
|---|---|---|
| Comprovativo de matrícula | Sim | Ano lectivo em curso |
| Declaração de aproveitamento escolar | Sim | |
| Comprovativo de meios de subsistência | Sim | Bolsa, transferências, declaração de responsabilidade |
| Seguro de saúde | Sim | Se não inscrito no SNS |

## 5. Fluxo processual

```
Sónia detecta AR a expirar em 90 dias (heartbeat)
                ↓
Alerta ao cliente + pedido de documentos
                ↓
Cliente envia documentos → Sónia faz OCR e valida
                ↓
Documentação completa?
    ├── Não → Sónia pede documentos em falta (máx. 2 por mensagem)
    └── Sim ↓
        Sónia cria ticket para Rex
                ↓
Rex verifica → cria processo no CRM AG
                ↓
Iris gera proposta de honorários (€300,00)
                ↓
Sónia apresenta proposta ao cliente
                ↓
Cliente aceita → submissão do pedido à AIMA
                ↓
Aguardar decisão (acompanhamento mensal)
                ↓
    ┌───────────┼───────────┐
    ↓                       ↓
Deferida                Indeferida
    ↓                       ↓
Novo título             Avaliar recurso
emitido                 (ver playbook cautelar)
```

## 6. Submissão à AIMA

### Via portal AIMA (método preferencial)
1. Aceder ao portal AIMA com credenciais do cliente
2. Seleccionar "Renovação de Autorização de Residência"
3. Preencher formulário online
4. Carregar documentos digitalizados
5. Gerar referência de pagamento de taxas
6. Guardar comprovativo de submissão

### Presencialmente (quando necessário)
- Agendar atendimento no portal AIMA
- Levar toda a documentação original + cópias
- Levar comprovativo de pagamento de taxas

## 7. Taxas AIMA

| Taxa | Valor |
|---|---|
| Renovação de AR temporária | €50,00 |
| Emissão de título (cartão) | €50,00 |
| **Total** | **€100,00** |

**Nota:** Valores sujeitos a actualização — verificar no portal AIMA.

## 8. Situações que complicam a renovação

Se qualquer destas situações existir, usar o valor de **€800,00** (renovação com complicações):

- Interrupção de descontos para a Segurança Social
- Mudança de empregador sem comunicação à AIMA
- Ausência do território nacional superior a 6 meses
- Processo criminal pendente
- Dívidas fiscais ou à Segurança Social
- Título expirado há mais de 30 dias
- Indicação SIS de outro Estado-Membro

## 9. Prazos

| Item | Prazo |
|---|---|
| Submissão do pedido | Até 30 dias antes da expiração |
| Decisão AIMA | 60 dias (prazo legal) |
| Emissão do novo título | 20 dias após deferimento |
| Recurso de indeferimento | 30 dias (hierárquico) ou 3 meses (judicial) |

## 10. Checklist

- [ ] Verificar data de expiração do título actual
- [ ] Alertar cliente com 90 dias de antecedência
- [ ] Verificar se é renovação standard ou com complicações
- [ ] Recolher toda a documentação necessária
- [ ] Validar que SS e AT estão regularizadas
- [ ] Submeter pedido à AIMA
- [ ] Guardar comprovativo de submissão no Google Drive (pasta do cliente)
- [ ] Registar no CRM AG
- [ ] Agendar follow-up mensal até decisão
