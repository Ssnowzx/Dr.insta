## 1. Preparar o contexto (bloqueia tudo)

- [ ] 1.1 Preencher `perfil/perfil.md`: posicionamento, bio atual, oferta e — crítico — as horas/semana reais disponíveis
- [ ] 1.2 Preencher `perfil/icp.md`: as 5 dores com as palavras do público, minerando DMs e comentários existentes
- [ ] 1.3 Preencher `perfil/voz-e-tom.md`: eixos de tom, lista negra e 3 legendas de referência
- [ ] 1.4 Confirmar que os pilares em `perfil/pilares.md` batem com o que já é publicado hoje

## 2. Definir os parâmetros dos rituais

- [ ] 2.1 Escolher os dois dias fixos, cruzando a rotina real com o horário de maior atividade da audiência (Insights > Público)
- [ ] 2.2 Registrar os dias escolhidos em `perfil/pilares.md`, seção "Pilar 4 — Comunidade > Rituais fixos"
- [ ] 2.3 Listar 10 teses de discordância — cada uma com a evidência ou experiência própria que a sustenta. Ordenar da menos para a mais polêmica
- [ ] 2.4 Listar 6 temas para as primeiras 6 caixas de perguntas, derivados das dores em `perfil/icp.md`

## 3. Levantar o baseline (bloqueia a definição de metas)

- [ ] 3.1 Exportar os últimos 30 dias do Insights para `dados/metricas/`
- [ ] 3.2 Rodar `npm run ig -- analisar dados/metricas/<arquivo>.csv` e registrar as taxas por alcance
- [ ] 3.3 Contar manualmente na última semana: comentários com mais de 4 palavras, DMs iniciadas por seguidores, respostas de Stories
- [ ] 3.4 Anotar os @ que interagiram em ao menos 2 semanas seguidas — este é o baseline de rostos recorrentes
- [ ] 3.5 Gravar todos os baselines em `perfil/metas.md` e só então definir os alvos de 90 dias

## 4. Semana 1 — ativação

- [ ] 4.1 Publicar o primeiro conteúdo de "Discordância da semana", começando pela tese menos polêmica da lista
- [ ] 4.2 Aquecer com enquete ou controle deslizante nos dois dias anteriores à caixa de perguntas
- [ ] 4.3 Abrir a primeira caixa de perguntas com tema delimitado; manter 24h
- [ ] 4.4 Responder em série no dia seguinte, agrupando perguntas parecidas
- [ ] 4.5 Cumprir a janela de 2h em todas as respostas e comentários dos dois rituais
- [ ] 4.6 Arquivar todas as perguntas recebidas — cada uma é uma pauta futura

## 5. Rotina semanal (semanas 2 a 12)

- [ ] 5.1 Executar os dois rituais nos dias fixos
- [ ] 5.2 Alimentar `perfil/icp.md` com as dores novas que aparecerem na caixa de perguntas
- [ ] 5.3 Fechamento semanal: contar as quatro métricas e registrar em `perfil/metas.md` com a data
- [ ] 5.4 Check de 10 minutos no painel: algo desviou o bastante para agir agora?

## 6. Semana 6 — ponto de decisão

- [ ] 6.1 Comparar a taxa de resposta em Stories contra o baseline
- [ ] 6.2 Aplicar o critério: subiu ao menos 20%? Se sim, seguir até a semana 12. Se não, hipótese refutada
- [ ] 6.3 Se refutada: registrar o aprendizado e propor a mudança de rumo (estreitar o ICP), não adicionar mais rituais
- [ ] 6.4 Registrar o veredito no relatório do período, com o número que o sustenta

## 7. Fechamento do ciclo

- [ ] 7.1 Rodar `/ig-relatorio` com os dois períodos e consolidar o resultado
- [ ] 7.2 Atualizar `perfil/metas.md`: os números deste ciclo viram o baseline do próximo
- [ ] 7.3 Arquivar esta mudança com `/opsx:archive`, descrevendo o que realmente aconteceu com a métrica — inclusive se a hipótese foi refutada
- [ ] 7.4 Só então avaliar a ativação de um terceiro ritual
