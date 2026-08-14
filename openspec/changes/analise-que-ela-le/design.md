## Context

Ver `proposal.md — Why`. O que importa aqui é o que já existe.

- `delivery.kind` é `plan | analysis | report | audit` desde `001-initial-schema.sql`. Nada lê `analysis`.
- `deliveries(clientId, userId)` faz `innerJoin(step, ...)` e é o único caminho para uma entrega chegar a uma tela.
- `monthlySeries(clientId, keys)` já monta série mensal por `metric_def.metric_key`, e o componente `Series` já a desenha. Hoje só recebem `views` e `posts_published`.
- `metric_target` guarda `baseline`, `baselineOn` e `target` por ciclo — o ponto de partida já está registrado e não é lido por nenhuma tela dela.
- `RequestText` já renderiza texto com quebras e links; a prosa da análise pode reusá-lo.

## Goals / Non-Goals

**Goals:**

- Que o achado dos 376 posts tenha uma tela dela, escrita para ela
- Que a métrica que decide o ciclo apareça com passado e alvo
- Que uma entrega sem etapas deixe de ser invisível — sem quebrar as que têm

**Non-Goals:**

- Editor de texto no app. O conteúdo nasce fora, como os pedidos
- Gráfico interativo. `/conteudo` já é o lugar de explorar
- Mexer no painel. A progressão vive na análise

## Decisions

### `delivery_section` como tabela, e não Markdown numa coluna

A alternativa barata é uma coluna `body TEXT` em `delivery` com Markdown. Recusada por três motivos concretos:

Renderizar Markdown exige uma dependência ou um parser escrito à mão, e este produto tem sete dependências de runtime contadas. Blocos com destaque numérico próprio não existem em Markdown sem inventar sintaxe. E a ordem, o título e o destaque viram dados consultáveis — a semente e o script escrevem linhas, não um blob que ninguém valida.

Colunas: `deliveryId`, `position`, `title` (nulo), `body` (texto), `highlight` (varchar curto, nulo), `highlightLabel` (nulo).

`highlight` é **texto e não número**: o destaque é `41×`, `0,025%`, `3.131` — já formatado, na unidade que a frase usa. Guardar decimal obrigaria a tela a decidir formatação que quem escreveu já decidiu.

### `deliveries()` perde o `innerJoin`, e o plano passa a filtrar

`innerJoin(step)` vira `leftJoin(step)`, e a montagem passa a aceitar entrega com zero etapas. `/plano` filtra por `steps.length > 0`.

Alternativa recusada: uma segunda função `readingDeliveries()` com sua própria consulta. Deixaria duas definições de "entrega publicada e não arquivada" para divergir na primeira mudança de regra — e é exatamente essa duplicação que produziu, em `pedido`, dois mapas de rótulo em que a migração atualizou um só.

### A progressão lê `metric_target`, não recalcula baseline

O ponto de partida vem de `metric_target.baseline` do ciclo, com `baselineOn`. A série vem de `metricValue`. Nada é derivado da própria série.

Baseline recalculado do primeiro ponto disponível se moveria toda vez que um mês antigo fosse importado, e qualquer resultado viraria progresso.

### A rota é `/analise` e não uma aba dentro de `/plano`

Plano responde "o que eu faço". Análise responde "o que vocês descobriram". São duas perguntas, e a segunda é a que ela disse que quer — juntá-las devolveria a página de 1.500 palavras que acabou de ser desmontada.

## Risks / Trade-offs

**Mais uma tela para manter desatualizada** → É o risco real: uma análise de agosto ainda no ar em novembro é pior que nenhuma. Mitigação: a entrega carrega `periodStart`/`periodEnd`, que já existem, e a tela declara a data do dado em cima — o mesmo padrão de `DataAge` que `/conteudo` já usa.

**A progressão pode ficar vazia** → A métrica-norte do ciclo vigente tem baseline mas quase nenhum valor mensal, porque a conexão do Instagram está quebrada. A spec já obriga a dizer o que falta medir em vez de desenhar nada.

**Prosa em blocos convida a escrever demais** → O mesmo defeito que o plano tinha. A regra "o achado antes da evidência" está na spec, e a primeira análise semeada serve de gabarito.

## Migration Plan

1. Migração `008`: `delivery_section`
2. `schema.ts`, e `deliveries()` com `leftJoin`
3. `/plano` filtra entregas sem etapa — **antes** de semear qualquer entrega de leitura, senão a tela dela renderiza um plano vazio
4. Consulta e tela de `/analise`, com a progressão
5. Item no menu
6. Semente: a análise de 13/08
7. `npm run lint && npm test`; abrir nos dois temas e nos dois papéis; medir de 320px a 520px
8. Deploy, migração, re-seed

**Rollback:** a tabela nova fica; `deliveries()` volta ao `innerJoin` e a rota sai do menu. Nenhuma linha existente muda de forma.

## Open Questions

Nenhuma.
