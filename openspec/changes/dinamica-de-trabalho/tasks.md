## 1. Testes antes da migração

- [x] 1.1 Teste: `open → answered` dispara no primeiro comentário ou upload da outra parte
- [x] 1.2 Teste: upload e comentário **não** movem para `analyzing`
- [x] 1.3 Teste: `concluded` é recusado com `outcome` vazio ou só espaços
- [x] 1.4 Teste: `dropped` aceita `outcome` vazio
- [x] 1.5 Teste: toda transição grava `request_event` com autor e hora, e o `state` da linha bate com o último evento
- [x] 1.6 Teste do caminho que `digest.ts` usa hoje (`toState === 'delivered'`), para a migração não apagá-lo em silêncio

## 2. Migração de dados

- [x] 2.1 Migração SQL: acrescentar `analyzing` ao enum de `request.state`
- [x] 2.2 Migração SQL: renomear `in_progress` → `answered` e `delivered` → `concluded` em `request.state`
- [x] 2.3 Migração SQL: atualizar `request_event.from_state` e `to_state` com os nomes novos — são `varchar` livres e não acompanham o enum
- [x] 2.4 Migração SQL: acrescentar `request.outcome` (`text`, nulo)
- [x] 2.5 Atualizar `db/schema.ts` para refletir enum e coluna
- [x] 2.6 Ensaiar local: contagem por estado antes e depois, e `request_event` sem valor órfão

## 3. Domínio

- [x] 3.1 `request-actions.ts` — trocar a promoção automática de `open → in_progress` por `open → answered`
- [x] 3.2 `request-actions.ts` — `analyzing` só por chamada explícita, checado na ação e não na tela
- [x] 3.3 `request-actions.ts` — `concluded` exige `outcome` não vazio após `trim()`
- [x] 3.4 `request-actions.ts` — derivar "de quem é a vez" a partir de `raisedBySide` e do estado, exposto como função pura
- [x] 3.5 `request-actions.ts` — ação de criar pedido, gravando `raisedBySide` conforme o papel de quem chama
- [x] 3.6 Constante nomeada `DIAS_ATE_COBRAR = 3` no domínio

## 4. Consultas

- [x] 4.1 `dashboard.ts` — `requests()` passa a receber o papel e devolver o recorte de cada lado
- [x] 4.2 `dashboard.ts` — consulta da fila do consultor: chegou, não analisado, parado, com idade em dias
- [x] 4.3 `dashboard.ts` — consulta dos concluídos com desfecho, para a tela dela
- [x] 4.4 `digest.ts` — trocar as duas comparações `toState === 'delivered'` por `'concluded'`
- [x] 4.5 `digest.ts` — pedido levantado pela cliente entra no digest do consultor (hoje `digestFor` não consulta a tabela `request`)
- [x] 4.6 `digest.ts` — pedido em `answered` há mais de 3 dias entra como pendência de quem pediu

## 5. Telas

- [x] 5.1 `/pedidos` — bifurcar por papel, seguindo o padrão de `/novidades`
- [x] 5.2 `/pedidos` dela — grupo "o que falta de você" e grupo "o que voltou pra você", com o desfecho legível
- [x] 5.3 `/pedidos` dele — fila de trabalho com idade e o que está parado em destaque
- [x] 5.4 Selo de estado passa a exibir de quem é a vez ("esperando você" / "comigo"), nos dois papéis
- [x] 5.5 Detalhe do pedido — botão de "em análise" e campo de desfecho na conclusão
- [x] 5.6 Formulário de abertura de pedido: título obrigatório, descrição opcional, disponível para os dois
- [ ] 5.7 Painel (`/`) — bifurcar por papel; o dela na ordem declarada (seguidores → comentários e curtidas → views), cada número com linha de significado
- [ ] 5.8 Campos editáveis do pedido na tela do consultor, inclusive nos que ela abriu — revisar e publicar, não redigir

## 5b. Escrita pelo CLI

- [x] 5b.1 `scripts/pedido.ts` — abrir, analisar e concluir pelo terminal, no padrão de `scripts/link.ts`
- [x] 5b.2 Declarar `npm run pedido` no `package.json`
- [x] 5b.3 O script chama as mesmas ações de `request-actions.ts` — evento com autor gravado igual, desfecho obrigatório valendo igual
- [x] 5b.4 Teste: desfecho vazio é recusado também pelo caminho do script

## 6. Semente

- [x] 6.1 `seed.ts` — migrar os nove pedidos para os estados novos (nada a mudar: a semente só escrevia `open` e `dropped`, e a migração 007 cuidou das linhas existentes)
- [ ] 6.2 ~~Desfecho pela semente~~ — **substituído por 8.3**. O desfecho é texto autorado por rodada, não conteúdo de semente: escrever ali significaria reescrever a semente a cada pedido concluído. Vai pelo `npm run pedido -- --concluir`

## 7. Validação

- [x] 7.1 `cd platform && npm run lint && npm test`
- [x] 7.2 `npm run db:seed` local e conferir os dois papéis
- [x] 7.3 Abrir `/`, `/pedidos` e `/novidades` nos **dois temas** e nos **dois papéis** — 3 das 4 combinações vistas renderizadas; contraste dos elementos novos **medido** nos dois temas (menor 5,18:1, passa AA). Falta consultor+claro visualmente — mesmos componentes e tokens já medidos
- [x] 7.4 Percorrido pela tela dela (recado → `respondido`) e pelo CLI (`analisar` → `concluir` com desfecho), conferindo a vez em cada passo

## 7c. Defeito encontrado renderizando

- [x] 7c.1 Selo do detalhe dizia "em aberto" num pedido concluído — cada tela tinha seu mapa de rótulos e a migração atualizou só um; o `?? ESTADO.open` transformava chave ausente em rótulo errado, sem erro. Centralizado em `LABEL` no domínio, tipado por `RequestState`

## 8. Produção

- [ ] 8.1 Deploy, migração e re-seed em `drinsta.xiax.com.br`
- [ ] 8.2 Conferir os nove pedidos migrados e o histórico de eventos íntegro
- [ ] 8.3 Concluir, com desfecho escrito, os pedidos que ela respondeu em 13/08
