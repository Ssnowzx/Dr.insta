## Context

Ver `proposal.md — Why`. O que importa aqui é o que já existe e o que impede mudar.

- `request.state` é `mysqlEnum(['open','in_progress','delivered','dropped'])`. Alterar valores de enum no MySQL exige migração.
- `request` já tem `raisedBySide: mysqlEnum(['consultant','client'])` com default `'consultant'` — a coluna existe e nunca foi usada, porque nada insere `request` fora da semente.
- `requestEvent` já registra `kind: 'state_change'` com `fromState`/`toState`, e o `state` da linha é projeção do último evento. Esse desenho está certo e não muda.
- `lib/digest.ts` já lê `toState === 'delivered'` em dois lugares (`digestFor` e `clientDigestFor`).
- `lib/dashboard.ts:509` — `requests(clientId)` não recebe papel; devolve a mesma lista para os dois.
- `/novidades` já bifurca por papel e é o precedente a seguir.

## Goals / Non-Goals

**Goals:**

- Que a cliente saiba, sem perguntar, de quem é a vez e o que saiu do que ela entregou
- Que o consultor tenha fila de trabalho dentro do produto, e seja cobrado por ela
- Que uma rodada nova de pedidos não exija editar código e fazer deploy
- Que a migração não perca o histórico dos eventos já gravados

**Non-Goals:**

- Notificação fora do aplicativo. Segue sem e-mail, por decisão anterior
- Etapas internas de análise. Um estado só, decidido em 13/08
- Reescrever o conteúdo do painel dela — isso é da mudança `pivotar-ciclo-para-seguidores`. Aqui se define a bifurcação e quem manda na ordem

## Decisions

### Renomear dois valores de enum em vez de só acrescentar um

O mínimo tecnicamente necessário é acrescentar `analyzing`. Mesmo assim `in_progress` vira `answered` e `delivered` vira `concluded`, na mesma migração.

Motivo: `delivered` passa a ter regra nova (exige desfecho) e significado único (antes significava tanto "ela entregou" quanto "ele fechou"). Manter o nome antigo sob regra nova é a forma mais barata de produzir um bug de leitura seis meses depois — e este repositório já paga caro por nomes honestos em outros lugares. Como a migração de enum vai acontecer de qualquer jeito, o custo marginal do rename é uma linha de `UPDATE` por valor.

Alternativa recusada: manter os valores e traduzir só na interface. Empurra a ambiguidade para dentro do código, onde ela é invisível.

### `analyzing` só por ação explícita, e isso é regra de domínio e não de interface

A checagem SHALL viver em `request-actions.ts`, não no componente. Um botão escondido na tela continua deixando a transição alcançável por qualquer outro caminho que chame a ação — e o valor inteiro deste estado é ele nunca mentir.

Consequência direta: o bloco de `addRequestComment` que hoje promove `open → in_progress` (`request-actions.ts:127`) passa a promover `open → answered`. O evento é o mesmo, o nome fica correto.

### `outcome` como coluna de texto, validada na ação

`request.outcome` (`text`, nulo por padrão). A obrigatoriedade vive na transição, não no schema: `NOT NULL` no banco quebraria toda linha existente e impediria `dropped` sem texto, que é permitido.

A validação SHALL rejeitar string vazia após `trim()`, como `addRequestComment` já faz — não basta a coluna estar preenchida com espaços.

### O papel entra como parâmetro em `requests()`, não como filtro na tela

`requests(clientId)` passa a `requests(clientId, role)`, e o que muda é a consulta: o consultor recebe agrupamento por vez-dele e idade em `answered`; a cliente recebe pendências dela e concluídos com desfecho.

Alternativa recusada: buscar tudo e filtrar no componente. Coloca regra de negócio em JSX e faz o consultor carregar dados que a tela dele não usa.

### O corte de 3 dias é constante nomeada, não coluna

`DIAS_ATE_COBRAR = 3` em um módulo do domínio. Vira coluna quando houver um segundo cliente ou uma segunda opinião sobre o número — hoje há um cliente e nenhuma evidência sobre qual prazo é o certo. Uma constante nomeada é honesta sobre isso; uma coluna configurável fingiria que a escolha já foi estudada.

### Abertura de pedido reusa o formulário, não um construtor

A tela de abertura SHALL exigir apenas título, com descrição opcional. `kind`, `priority` e `whyItMatters` ficam com default e são editáveis depois pelo consultor.

Motivo: um formulário de sete campos faz a cliente desistir de abrir o pedido e voltar ao WhatsApp — que é o comportamento que esta mudança existe para substituir. O campo que importa é o texto dela.

### O consultor não escreve na tela: ele revisa o que foi escrito fora dela

Decidido em 13/08/2026. Quem redige pedido, descrição, "por que importa" e desfecho é o assistente, não o consultor. A tela dele precisa ser um lugar de **revisão e publicação**, não um editor de texto longo — um formulário grande ali seria mobília que ninguém usa.

O caminho de escrita já existe no repositório e não foi inventado para isto: `scripts/invite.ts` e `scripts/link.ts` rodam pelo CLI com acesso ao banco, e `package.json` já declara o padrão. Entra `scripts/pedido.ts` na mesma forma:

```
npm run pedido -- --abrir --titulo "..." --descricao "..." --porque "..."
npm run pedido -- --concluir <codigo> --desfecho "..."
npm run pedido -- --analisar <codigo>
```

Três consequências de desenho:

1. **A tela do consultor mantém os campos editáveis** — inclusive nos pedidos que ela abriu. Não para ele redigir do zero, mas para corrigir e publicar o que chegou pelo script.
2. **O script grava evento com autor**, igual à ação da tela. Um desfecho escrito pelo CLI e um escrito pela tela são indistinguíveis no histórico, e devem ser: a autoria que importa é a do consultor, não a do teclado.
3. **A regra do desfecho obrigatório vale para os dois caminhos**, porque vive em `request-actions.ts` e não no componente — que é a mesma razão pela qual `analyzing` também é checado lá.

Alternativa recusada: escrever direto no banco por SQL. Pula a gravação do evento, e o histórico passa a ter desfecho que nunca foi anunciado.

## Risks / Trade-offs

**A migração de enum roda sobre dados de produção** → São 9 pedidos e um punhado de eventos. A migração SHALL atualizar `request.state` e também `request_event.from_state`/`to_state`, que são `varchar` livres — esquecê-los deixa o histórico dizendo `delivered` enquanto a linha diz `concluded`. Ensaiar local com `db:seed` e conferir a contagem por estado antes e depois.

**`digest.ts` compara `toState === 'delivered'` em dois lugares** → Se a migração passar e o código não, o resumo silenciosamente para de mostrar pedidos concluídos. Não quebra teste nenhum, porque não há teste cobrindo isso. Escrever o teste antes da migração.

**A assimetria pode virar opacidade** → Ela deixa de ver a conta inteira. O que impede isso de ser sonegação é o desfecho obrigatório: a explicação chega em texto, no pedido. Se na prática os desfechos vierem curtos e vazios, o problema volta — e aí é assunto de processo, não de produto.

**"Em análise" manual depende de disciplina dele** → Um estado que exige ato humano pode simplesmente nunca ser usado, e o produto volta ao silêncio. Por isso a dívida de 3 dias existe: se ele não marca, o próprio Novidades dele cobra.

**Ela abrir pedido pode gerar demanda desordenada** → Aceito. O canal alternativo hoje é WhatsApp, onde a demanda chega igual e sem registro, sem histórico e sem estado.

## Migration Plan

1. Escrever os testes de transição e do desfecho obrigatório **antes** da migração, incluindo o caminho que `digest.ts` usa
2. Migração SQL: acrescentar `analyzing` ao enum, renomear os dois valores, atualizar `request_event.from_state`/`to_state`, acrescentar `outcome`
3. `request-actions.ts`: transições novas, `analyzing` manual, validação do desfecho, ação de criar pedido
4. `dashboard.ts` e `digest.ts`: papel como parâmetro, fila do consultor, pedido levantado por ela, dívida de 3 dias
5. Telas: bifurcação de `/pedidos`, formulário de abertura, painéis separados
6. `seed.ts`: os nove pedidos migram para os estados novos
7. `cd platform && npm run lint && npm test`; abrir as telas nos **dois temas** e nos **dois papéis**
8. Deploy, migração em produção, re-seed

**Rollback:** a migração reversa renomeia de volta e descarta `analyzing` (nenhuma linha deve estar nesse estado se o rollback for imediato). `outcome` pode ficar — coluna nula a mais não quebra o código antigo.

## Open Questions

Nenhuma. A pergunta sobre edição do pedido levantado por ela foi respondida em 13/08/2026 e virou a decisão acima: o consultor edita qualquer pedido, e o texto nasce fora da tela.
