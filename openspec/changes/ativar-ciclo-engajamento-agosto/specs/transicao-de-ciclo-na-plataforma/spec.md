## Purpose

Define como uma troca de ciclo chega à cliente pela plataforma: o ciclo anterior fecha congelado com desfecho legível, o novo entra completo, e as perguntas que calibram o novo ciclo são respondíveis dentro do app.

## ADDED Requirements

### Requirement: Ciclo anterior fecha congelado

Ao ativar um novo ciclo, o anterior SHALL passar a `closed` com data de fim, mantendo intactos os seus pilares, metas e experimentos (escopados ao ciclo). Experimentos que não rodaram SHALL ser marcados `abandoned` com desfecho explicando a decisão. O re-seed SHALL NOT alterar o conteúdo congelado de um ciclo fechado além de estado e desfecho.

#### Scenario: Re-seed após o fechamento

- **WHEN** o seed rodar de novo com o ciclo anterior já fechado
- **THEN** os pilares, metas e experimentos do ciclo fechado permanecem como estavam, e nada que a cliente respondeu é tocado

#### Scenario: Pergunta futura "a aposta pagou?"

- **WHEN** alguém abrir o ciclo fechado depois da transição
- **THEN** o mix, os alvos e o desfecho dos experimentos daquele ciclo estão legíveis como eram no fechamento

### Requirement: Um único ciclo ativo

A plataforma SHALL ter no máximo um ciclo `active` por cliente; todas as telas que falam "do ciclo" SHALL resolver pelo ciclo ativo. O plano do ciclo anterior SHALL sair de exibição (arquivado), preservando as respostas dadas.

#### Scenario: Painel após a transição

- **WHEN** a cliente abrir o painel depois da transição
- **THEN** título, objetivo, trade-off, métrica-norte, pilares e experimentos exibidos são os do ciclo novo, e o plano antigo não aparece mais em `/plano`

### Requirement: A tese do ciclo aparece com os números do ciclo

O painel SHALL abrir com a tese do ciclo ativo sustentada por números medidos. Para o ciclo de engajamento: o contraste entre a conversa privada (respostas em Stories) e a pública (comentários por alcance). Métricas cuja responsabilidade saiu do ciclo (loja, receita, sessões, conversão) SHALL NOT aparecer como métricas do ciclo, e suas definições SHALL registrar para onde foram.

#### Scenario: Painel do ciclo de engajamento

- **WHEN** o painel renderizar com o ciclo de engajamento ativo
- **THEN** o topo mostra o contraste privado × público, a métrica-norte destacada é comentários por alcance, e nenhum número de loja/receita aparece como métrica a seguir

### Requirement: Perguntas de calibração respondíveis no app

As perguntas que calibram o ciclo SHALL existir como pedidos do tipo `question`, ligados ao ciclo novo, respondíveis com texto dentro do app. A semeadura SHALL ser idempotente numa tabela não-vazia (chaveada por título): rodar de novo não duplica pedidos nem recria pedidos já respondidos ou encerrados.

#### Scenario: Re-seed com pedidos existentes

- **WHEN** o seed rodar com pedidos antigos e novos já na tabela
- **THEN** nenhum pedido é duplicado e os eventos/respostas existentes permanecem intactos

#### Scenario: Cliente responde uma pergunta

- **WHEN** a cliente abrir um pedido de pergunta e escrever a resposta
- **THEN** a resposta fica registrada no histórico do pedido e visível para o consultor em `/novidades`

### Requirement: Pedido que perdeu o objeto é encerrado com narrativa

Um pedido do ciclo anterior que perdeu o objeto SHALL ser encerrado como `dropped` com um evento explicando o motivo — somente se ainda estiver `open` e sem interação da cliente. Pedidos com qualquer interação SHALL ser deixados como estão.

#### Scenario: Pedido da loja após o handoff

- **WHEN** o seed rodar após a transição e o pedido do relatório da loja ainda estiver aberto e sem eventos da cliente
- **THEN** ele passa a `dispensado` com um evento dizendo que a loja é assunto da equipe da marca
