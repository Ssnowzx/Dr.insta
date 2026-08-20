## 1. Medir o que a API entrega

- [x] 1.1 Sonda `probe-media-metrics.ts`, uma métrica por chamada, com `reach`/`views` de controle
- [x] 1.2 Sondar Reel **e** post de feed na mesma rodada — a recusa nomeia o product type
- [x] 1.3 Varredura `--feed-sweep` sobre todos os posts de feed da janela (7 posts, mínimo da regra de amostra)

## 2. Coleta

- [x] 2.1 Migração 013: `post.follows` e `post.profile_visits`, NULL por padrão
- [x] 2.2 Transcrever no `db/schema.ts` com o motivo do NULL
- [x] 2.3 `FUNNEL_METRICS` em requisição própria; `funnelInsights` engole a própria falha
- [x] 2.4 `sync.ts` grava sob a regra de ausência já existente
- [x] 2.5 Testes: pede só em feed · lê os dois valores · null em Reel · falha não derruba o resto

## 3. Leitura

- [x] 3.1 `funnel()` passa a alcance → visitas → seguidores
- [x] 3.2 `follows_per_visit` como taxa derivada, com numerador e denominador na nota
- [x] 3.3 `metric_def` + baseline 5,99% + alvo 9% herdado do experimento 2
- [x] 3.4 Corrigir experimento 2: mede `follows_per_visit`, não `profile_visits_reach`
- [x] 3.5 Testes da taxa derivada, incluindo o caso de parte faltando
- [x] 3.6 `Funnel` com `resumo` opcional e legenda que conta as etapas
- [x] 3.7 Renderizar e **medir contraste** nos dois temas antes de dar por pronto

## 4. Plano e pautas

- [x] 4.1 Etapas c4 (fixados), c5 (bio, com `copy_value`) e c6 (destaques)
- [x] 4.2 Título e subtítulo da entrega abrem pelo que não muda
- [x] 4.3 "kinda chic" edições 2 e 3, domingos 23 e 30
- [x] 4.4 Família ep1 e ep2 para o banco, roteiros preservados
- [x] 4.5 Pilar Personagens reescrito com a evidência medida
- [x] 4.6 Copy da aba Ideias deixa de dizer "vídeos" e "opinião" — agora há carrossel

## 5. Documentação

- [x] 5.1 `perfil/pilares.md` e `perfil/metas.md`
- [x] 5.2 `platform/README.md`: colunas novas, sonda, o que a API dá por superfície
- [x] 5.3 `CLAUDE.md`: o gargalo tem dois degraus, não um
- [x] 5.4 `openspec/config.yaml`: o contexto ainda descrevia o ciclo encerrado em 13/08

## 6. Fica em aberto

- [ ] 6.1 Rodar a sonda num dia com Reel de teste no ar — a única forma de fechar a pergunta
- [ ] 6.2 Ler `follows_per_visit` 14 dias depois de as três etapas de perfil serem marcadas

## 7. O que aconteceu depois — conferido no perfil real em 20/08/2026

As três etapas de perfil saíram do papel em 18/08, e **quem executou foi a Cris**, não a
Bianca. Isso é o primeiro sinal de comportamento da divisão de trabalho: a assessora mexe
na mecânica do perfil, a cliente responde o que só ela pode responder (mandar a aba
Público, decidir que pauta de marca sai). O produto ainda escreve "você" para as duas.

- [x] 7.1 **c4 (fixados) — marcado feito, feito pela metade.** O "kinda chic"
      (`Db4JPPplRC0`) entrou, que era a parte que importa. Mas quem saiu dos três foi a
      **viagem**, não a publi: a Miu Miu (`DXzAFzfh0iS`, 01/05) segue fixada. **A etapa
      não foi reaberta** — foi feita conforme ela leu, e o que faltou virou item próprio.
- [x] 7.2 **c6 (destaques) — a etapa pedia cinco no título e um no corpo.** "Põe looks em
      primeiro" era a única instrução concreta; ela fez exatamente isso e marcou feito,
      com razão. Título corrigido para "Pôr «looks» na frente dos destaques", estado
      preservado. **Os outros quatro lugares não foram pedidos porque não existem
      candidatos: 36 dos 49 destaques são viagem.** Fazer direito é criar destaque de
      make/perfume/"o que usar em" — trabalho de conteúdo, não arrasto. Fica para a
      próxima entrega.
- [x] 7.3 **c7 "Os outros dois fixados", nova etapa** — nomeia "pensando pensamentos"
      (20/07) e "thinking out loud" (05/08) pelos dois lugares que ainda são marca, e
      responde a dúvida antes de ela existir: desafixar não despublica.
- [x] 7.4 **A escolha dos dois substitutos veio de medição, não de julgamento.** Ranking
      dos 14 posts de feed da janela — a superfície onde a API responde `follows`. Penhasco
      entre o 3º e o 4º (146 para 20) e **nenhum post de marca passou de 9**. Registrado em
      `perfil/metas.md`.
- [x] 7.5 Título da entrega deixou de declarar contagem ("Três novos"), que estava errada
      no instante em que a sétima etapa entrou.
- [x] 7.6 Seed em produção (`3091699`), conferido renderizado nos dois temas: "Faltam 3.",
      "4 de 7 marcados", `step_status` preservado.

**O que isto ensina para a próxima etapa que eu escrever:** título e corpo têm que pedir a
mesma coisa. Um título que promete cinco e um corpo que pede um produzem uma tarefa marcada
como feita que não foi feita — e o defeito só aparece medindo o perfil de fora, nunca lendo
a tela.
