---
titulo: Template de Update de Estado do Processo
tipo: template
canal: whatsapp, email
versao: "1.0"
---

# Update de Estado do Processo

## Por estado

### Processo submetido
```
{nome}, informamos que o vosso {tipo_processo} foi submetido à {entidade} com a referência {referencia}.

O prazo legal de decisão é de {prazo_dias} dias. Vamos acompanhar e informá-lo(a) assim que houver novidades.

Se tiverem alguma dúvida entretanto, estamos disponíveis.
```

### A aguardar decisão (update periódico)
```
{nome}, uma actualização sobre o vosso processo ({referencia}):

O pedido continua em análise pela {entidade}. Até ao momento não houve qualquer notificação.

Continuamos a acompanhar o caso. Informamos logo que haja novidades.
```

### Decisão favorável
```
{nome}, temos boas notícias! 🎉

O vosso {tipo_processo} foi **deferido** pela {entidade}.

Próximos passos:
{proximos_passos}

Parabéns! Qualquer dúvida, estamos aqui.
```

### Decisão desfavorável
```
{nome}, recebemos a decisão da {entidade} sobre o vosso {tipo_processo}.

Infelizmente, o pedido foi **indeferido**. O motivo indicado é: {motivo_resumido}.

Não se preocupem — vamos analisar a decisão e apresentar-vos as opções disponíveis. O Dr. Eduardo vai contactá-lo(a) para discutir os próximos passos.

{se_prazo_urgente: "IMPORTANTE: Temos um prazo de {prazo} dias para reagir. Vamos tratar disto com prioridade."}
```

### Agendamento marcado
```
{nome}, o vosso atendimento na {entidade} ficou agendado:

📅 Data: {data}
🕐 Hora: {hora}
📍 Local: {local}

Por favor levem:
{lista_documentos_originais}

Se precisarem de remarcar, avisem-nos com pelo menos 48 horas de antecedência.
```

### Pedido de documentos adicionais pela entidade
```
{nome}, a {entidade} solicitou documentos adicionais para o vosso processo:

{lista_documentos_pedidos}

O prazo para envio é de {prazo} dias. Conseguem obter estes documentos? Se precisarem de ajuda, digam-nos.
```

### Processo concluído
```
{nome}, o vosso processo ({referencia}) está **concluído**.

{resumo_resultado}

Foi um prazer tratar do vosso caso. Se no futuro precisarem de qualquer apoio jurídico, não hesitem em contactar-nos.

Agradecemos também se puderem recomendar o escritório a quem precisar. 🙏
```

## Por via processual

### Acção judicial interposta
```
{nome}, informamos que foi interposta uma {tipo_accao} junto do {tribunal}.

Isto significa que o tribunal vai agora analisar o vosso caso. O processo judicial tem prazos próprios e vamos mantê-lo(a) informado(a) de cada desenvolvimento.

Se tiverem dúvidas, estamos disponíveis.
```

### Providência cautelar aceite
```
{nome}, a providência cautelar que interpusemos foi **aceite** pelo tribunal.

Isto significa que a decisão da {entidade} fica **suspensa** até à decisão final do processo. Podem ficar tranquilos — a vossa situação está protegida enquanto o processo decorre.
```

### Recurso interposto
```
{nome}, o recurso contra a decisão de {instancia_anterior} foi interposto junto do {tribunal_superior}.

Vamos aguardar a decisão do tribunal. Este processo pode demorar alguns meses. Informamos assim que houver novidades.
```

## Regras de uso

- Adaptar sempre a língua ao cliente
- Nunca usar termos jurídicos sem explicar (ex: "deferido" → "aprovado")
- Se decisão desfavorável: tom calmo, transmitir que há opções
- Se prazo urgente: destacar claramente
- Updates periódicos mesmo sem novidades (1x/mês mínimo) — transmite acompanhamento
