---
titulo: Template de Apresentação de Proposta de Honorários
tipo: template
canal: whatsapp, email
versao: "1.0"
---

# Apresentação de Proposta de Honorários

## Versão WhatsApp

### Proposta standard
```
{nome}, após análise do vosso caso, apresentamos a seguinte proposta de honorários:

📋 **Serviço:** {tipo_servico}
💰 **Valor:** {valor}

{se_inclui_recursos: "Este valor já inclui eventuais recursos para tribunais superiores."}
{se_fases: "O valor é repartido da seguinte forma:
• 30% na contratação ({valor_30pct})
• 70% no início da fase judicial ({valor_70pct})"}

Os valores já incluem IVA, quando incidente.

⚠️ **Não incluído:** taxas judiciais, certidões, traduções e outros encargos oficiais (estes são por conta do cliente e serão indicados à medida que surjam).

{se_consulta_descontada: "O valor da consulta já realizada (€{valor_consulta}) será deduzido dos honorários."}

Esta proposta é válida por 30 dias.

Para aceitar, respondam ACEITO. Se tiverem dúvidas, estamos aqui para esclarecer.
```

### Proposta com parcelas
```
{nome}, apresentamos a proposta de honorários para o vosso caso:

📋 **Serviço:** {tipo_servico}
💰 **Valor total:** {valor}

Propomos o seguinte plano de pagamento:
• {n_parcelas} parcelas mensais de {valor_parcela}
• Primeira parcela na contratação

Os valores já incluem IVA, quando incidente.

Esta proposta é válida por 30 dias. Para aceitar, respondam ACEITO.
```

### Proposta com êxito (laboral)
```
{nome}, apresentamos a proposta de honorários para o vosso caso laboral:

📋 **Serviço:** {tipo_servico}
💰 **Provisionamento:** {valor_provisionamento}
📈 **Êxito:** 20% sobre o valor recuperado

O provisionamento que paguem será deduzido do valor de êxito. Ou seja, se recuperarmos {exemplo_valor}, o êxito seria {exemplo_calculo}, menos os {valor_provisionamento} já pagos.

Os valores já incluem IVA, quando incidente.

Esta proposta é válida por 30 dias. Para aceitar, respondam ACEITO.
```

### Proposta com fase judicial adicional (imigração)
```
{nome}, apresentamos a proposta de honorários:

📋 **Serviço:** Primeira Autorização de Residência

**Fase 1 — Administrativa:** €500,00
Inclui a instrução e submissão do pedido à AIMA.

**Fase 2 — Judicial (se necessária):** +€1.200,00
Caso a AIMA não responda ou indefira, avançamos com acção judicial. Este valor só é cobrado se for necessário recorrer ao tribunal.

Os valores já incluem IVA, quando incidente.

Esta proposta é válida por 30 dias. Para aceitar a Fase 1, respondam ACEITO.
```

## Versão Email (formal)

```
Assunto: Proposta de Honorários — {tipo_servico} — SD Legal

Exmo(a). Sr(a). {nome},

Na sequência da análise do vosso caso, temos o prazer de apresentar a seguinte proposta de honorários:

SERVIÇO: {tipo_servico}
VALOR: {valor}

CONDIÇÕES DE PAGAMENTO:
{condicoes}

INCLUI:
- {lista_incluido}

NÃO INCLUI:
- Taxas judiciais e emolumentos oficiais
- Certidões e registos
- Traduções certificadas
- Deslocações fora da comarca (€0,36/km + portagens)

NOTA: Os valores apresentados já incluem IVA, quando incidente.
{se_consulta_descontada: "O valor da consulta já realizada será deduzido dos honorários."}

Esta proposta é válida por 30 dias a contar da presente data.

Para formalizar a contratação, basta responder a este email com a indicação "ACEITO" ou contactar-nos pelo WhatsApp.

Com os melhores cumprimentos,
Dr. Eduardo Dias
SD Legal
```

## Processamento da resposta

### Ao receber "ACEITO":
1. Registar aceitação no CRM AG com timestamp
2. Notificar Iris → gerar factura da primeira parcela/provisionamento
3. Notificar Rex → processo pode avançar
4. Confirmar ao cliente:

```
{nome}, obrigado pela confiança no escritório SD Legal!

A contratação ficou registada. {instrucoes_pagamento}

Vamos dar início ao vosso processo. Mantemos contacto com actualizações regulares.
```

### Ao receber recusa ou pedido de desconto:
1. Registar no CRM AG
2. Escalar para Rex/humano para avaliação
3. Se elegível para desconto (10%): apresentar nova proposta
4. Se não elegível: manter proposta ou escalar para Eduardo

### Sem resposta (7 dias):
```
{nome}, enviámos-lhe uma proposta de honorários há uma semana. Gostaríamos de saber se têm alguma dúvida ou se pretendem avançar.

Estamos disponíveis para esclarecer qualquer questão.
```
