## Purpose

Define que o mesmo dado chega de formas diferentes às duas pessoas que usam o produto: a cliente lê resultado e explicação, na ordem de prioridade que ela mesma declarou, e o consultor lê diagnóstico e fila de trabalho — sem que nenhuma tela tente servir os dois com o mesmo texto.

## ADDED Requirements

### Requirement: Nenhuma tela serve os dois papéis com o mesmo texto

Toda tela que apresenta estado de trabalho ou números de desempenho SHALL resolver o papel de quem lê e apresentar conteúdo próprio para ele. `/novidades` já faz isso e SHALL ser o padrão seguido pelas demais.

Hoje `/pedidos` é escrita inteiramente na voz dela — o cabeçalho diz "O que falta de você" — e é servida igual ao consultor, que assim não tem fila de trabalho nenhuma dentro do produto.

#### Scenario: Consultor abre a tela de pedidos

- **WHEN** o consultor abrir `/pedidos`
- **THEN** ele vê fila de trabalho — o que chegou, o que não foi analisado e o que está parado — e não o texto endereçado a ela

#### Scenario: Cliente abre a tela de pedidos

- **WHEN** a cliente abrir `/pedidos`
- **THEN** ela vê o que falta dela e, em grupo próprio, o que voltou pra ela com desfecho escrito

### Requirement: A ordem do painel dela é a que ela declarou

O painel da cliente SHALL apresentar as métricas na ordem de prioridade declarada por ela em 13/08/2026 — **seguidores, depois comentários e curtidas, depois visualizações** — e SHALL NOT reordenar segundo a importância diagnóstica.

Quando a ordem declarada divergir da ordem diagnóstica, a divergência SHALL ser resolvida no texto e não na ordem: o número que ela pediu vem primeiro, e logo abaixo dele vem a única alavanca que o move, traduzida.

#### Scenario: Métrica prioritária para ela não é a alavanca

- **WHEN** a métrica no topo do painel dela for um resultado que ela não consegue mover diretamente
- **THEN** logo abaixo aparece a alavanca que o move, em linguagem de decisão dela, sem substituir o número que ela pediu

### Requirement: O painel dela explica em vez de exibir taxa

Todo número no painel da cliente SHALL vir acompanhado de uma linha que diz o que ele significa em termos concretos. Taxas percentuais de diagnóstico SHALL NOT ser o texto principal de nenhum cartão dela.

Exemplo do padrão exigido: em vez de "conversão 0,060%", a leitura dela é "de cada 1.000 pessoas novas que te viram, 0,6 seguiram" — e a comparação vem de um post dela, não de um benchmark de nicho.

#### Scenario: Cartão sem tradução

- **WHEN** um número for apresentado no painel dela sem a linha de significado
- **THEN** o cartão é considerado incompleto — número sem tradução não sustenta decisão dela

#### Scenario: Comparação necessária

- **WHEN** uma leitura dela precisar de referência para o número fazer sentido
- **THEN** a referência preferida é um conteúdo dela mesma, e não a média do nicho

### Requirement: O diagnóstico completo é do consultor

Denominadores, amostras, taxas por faixa, projeções e ressalvas metodológicas SHALL estar disponíveis ao consultor dentro do produto, e SHALL NOT ser diluídos para caber na tela dela.

A assimetria é deliberada e tem custo declarado: ela não vê a conta inteira. O que impede isso de virar opacidade é a regra do desfecho escrito em `pedido-de-mao-dupla` — a explicação chega a ela em texto, no pedido, e não como tabela.

#### Scenario: Ressalva metodológica

- **WHEN** uma leitura depender de amostra pequena, de proxy ou de dado com viés conhecido
- **THEN** a ressalva aparece na tela do consultor junto do número, e a tela dela recebe a conclusão já qualificada em texto

#### Scenario: Pedido para simplificar o painel dele

- **WHEN** for proposto unificar os dois painéis para reduzir manutenção
- **THEN** a proposta é recusada: o painel único volta a servir diagnóstico a quem quer decisão, que é o defeito que esta capacidade existe para corrigir
