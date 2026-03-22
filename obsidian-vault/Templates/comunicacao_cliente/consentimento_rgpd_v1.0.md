---
titulo: Texto de Consentimento RGPD
versao: "1.0"
data_versao: 2026-03
tipo: template
canal: whatsapp, email, portal, presencial
---

# Consentimento para Tratamento de Dados Pessoais — v1.0

## Texto para envio ao cliente

### Versão WhatsApp (curta)

```
Bem-vindo(a) ao escritório SD Legal.

Antes de avançarmos, precisamos do vosso consentimento para tratamento dos vossos dados pessoais, conforme o Regulamento Geral de Protecção de Dados (RGPD).

O escritório SD Legal solicita o vosso consentimento para:

✅ Tratamento dos vossos dados pessoais para prestação de serviços jurídicos
✅ Partilha de dados com tribunais e entidades administrativas quando necessário para o vosso processo
✅ Conservação dos dados durante o período legal obrigatório após conclusão do processo (mínimo 5 anos)

Opcional:
☐ Recepção de informações sobre serviços e novidades do escritório

Responsável pelo tratamento: SD Legal — Eduardo Dias, Advogado
Contacto DPO: eduardodias@eduardodiasadvogado.com

Podem exercer os vossos direitos de acesso, rectificação, apagamento e portabilidade a qualquer momento contactando o escritório.

Para confirmar, respondam SIM.
Para recusar qualquer ponto, indiquem qual.
Para recusar tudo, respondam NÃO.
```

### Versão email/portal (completa)

```
CONSENTIMENTO INFORMADO PARA TRATAMENTO DE DADOS PESSOAIS

Nos termos do Regulamento (UE) 2016/679 (Regulamento Geral sobre a Protecção de Dados — RGPD) e da Lei n.º 58/2019 (lei de execução do RGPD em Portugal), o escritório SD Legal informa:

1. RESPONSÁVEL PELO TRATAMENTO
   SD Legal — Eduardo Dias, Advogado
   Cédula profissional n.º [número]
   Email: eduardodias@eduardodiasadvogado.com

2. FINALIDADES DO TRATAMENTO
   a) Prestação de serviços jurídicos contratados
   b) Gestão administrativa do processo
   c) Comunicação com tribunais e entidades administrativas
   d) Facturação e cumprimento de obrigações fiscais
   e) Cumprimento de obrigações legais e regulatórias

3. BASE JURÍDICA
   a) Consentimento do titular (Art. 6.º, n.º 1, al. a) RGPD) — para os pontos solicitados abaixo
   b) Execução de contrato (Art. 6.º, n.º 1, al. b) RGPD) — prestação de serviços jurídicos
   c) Obrigação legal (Art. 6.º, n.º 1, al. c) RGPD) — conservação de documentos, obrigações fiscais

4. DADOS TRATADOS
   - Dados de identificação (nome, data de nascimento, nacionalidade, documento de identificação)
   - Dados de contacto (telefone, email, morada)
   - Dados fiscais (NIF, NISS)
   - Dados processuais (documentos, peças, decisões)
   - Dados de imigração (título de residência, processos AIMA), quando aplicável
   - Dados especiais apenas quando estritamente necessários e com consentimento expresso

5. DESTINATÁRIOS DOS DADOS
   - Tribunais e entidades administrativas (AIMA, IEFP, ISS, AT) — apenas quando necessário
   - Serviços de processamento tecnológico (alojamento EU, encriptação em trânsito e repouso)
   - Nenhum dado é transferido para fora do Espaço Económico Europeu

6. PRAZO DE CONSERVAÇÃO
   - Durante a vigência da relação contratual
   - Após conclusão: 5 anos (prazo de prescrição geral) ou prazo legal superior quando aplicável
   - Dados fiscais: 10 anos (obrigação fiscal)

7. DIREITOS DO TITULAR
   Pode exercer a qualquer momento:
   - Direito de acesso (Art. 15.º RGPD)
   - Direito de rectificação (Art. 16.º RGPD)
   - Direito ao apagamento (Art. 17.º RGPD) — quando não conflitue com obrigação legal
   - Direito à portabilidade (Art. 20.º RGPD)
   - Direito de oposição (Art. 21.º RGPD)
   - Direito de retirar o consentimento a qualquer momento, sem comprometer a licitude do tratamento anterior
   - Direito de apresentar reclamação à CNPD (www.cnpd.pt)

DECLARO QUE:

[ ] Autorizo o tratamento dos meus dados pessoais para prestação de serviços jurídicos
[ ] Autorizo a partilha dos meus dados com tribunais e entidades administrativas quando necessário
[ ] Autorizo a conservação dos dados pelo período legal obrigatório após conclusão do processo
[ ] (Opcional) Autorizo a recepção de comunicações sobre serviços e novidades do escritório

Data: ___/___/______
Nome: _________________________
Assinatura: _________________________
```

## Regras de processamento

### Ao receber "SIM" por WhatsApp:
1. Registar como consentimento dos 3 pontos obrigatórios (sem o opcional)
2. Calcular hash SHA-256 do par (mensagem enviada + resposta + timestamp)
3. Gravar no CRM AG: `rgpd.consentimento_dados_pessoais = true`, `rgpd.consentimento_partilha_tribunais = true`, `rgpd.consentimento_retencao_pos_processo = true`, `rgpd.consentimento_comunicacoes = false`
4. Gravar ficheiro **IMUTÁVEL** em `/Audit/consentimentos_rgpd/{cliente_id}_{timestamp}.md`
5. Confirmar ao cliente: "Obrigado. O vosso consentimento ficou registado."

### Ao receber recusa parcial:
1. Registar apenas os consentimentos dados
2. Se recusar ponto 1 (dados pessoais): **não é possível prestar serviços** — escalar para humano
3. Se recusar ponto 2 (partilha tribunais): registar, alertar Rex que haverá limitações processuais
4. Se recusar ponto 3 (retenção): registar, configurar apagamento automático após conclusão

### Ao receber "NÃO":
1. Registar recusa total
2. Responder: "Compreendemos. Sem o vosso consentimento não nos é possível prestar serviços jurídicos. Se mudarem de ideias, estamos disponíveis."
3. Escalar para humano
4. Não processar nem armazenar quaisquer dados pessoais

### Formato do ficheiro de audit

```markdown
---
cliente_id: {id}
timestamp: {ISO 8601}
canal: whatsapp
versao_texto: "v1.0"
hash_sha256: {hash}
---

## Consentimento RGPD

**Mensagem enviada:** [texto completo]
**Resposta do cliente:** [texto completo]
**Timestamp resposta:** [ISO 8601]
**IP origem:** [se disponível]

### Consentimentos registados
- [x] Dados pessoais para serviços jurídicos
- [x] Partilha com tribunais
- [x] Retenção pós-processo
- [ ] Comunicações marketing

### Hash SHA-256
{hash do par mensagem+resposta+timestamp}
```

## Lembretes automáticos

- Se não responder em **24h:** reenviar lembrete
- Se não responder em **72h:** segundo lembrete com tom urgente
- Se não responder em **7 dias:** registar como "sem resposta" e fechar
