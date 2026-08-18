## Purpose

Define o que a plataforma mede sozinha sobre conversão em seguidor, o que continua
dependendo de número digitado, e como as duas coisas convivem sem se confundir.

## ADDED Requirements

### Requirement: A coleta pede cada métrica na superfície que a responde

A coleta SHALL pedir `follows` e `profile_visits` apenas para mídia cuja superfície é
FEED, e SHALL NOT pedi-las para Reels. As métricas `ig_reels_*` seguem a regra
inversa, que já existia.

O pedido dessas duas métricas SHALL viajar em **requisição própria**, separada das
métricas que já eram coletadas. O endpoint de insights rejeita a requisição inteira
quando qualquer métrica da lista é inválida; anexá-las à lista existente faria com que
uma mudança de comportamento do Instagram custasse também `reach` e `views`, que é o
denominador de tudo neste projeto.

A falha dessa requisição SHALL ser engolida e SHALL NOT abortar a coleta do post.

#### Scenario: Reel não paga por uma métrica que não tem

- **WHEN** a coleta lê um Reel
- **THEN** faz uma requisição de insights, não duas
- **AND** `post.follows` e `post.profile_visits` permanecem como estavam

#### Scenario: A falha do novo não derruba o que já funcionava

- **WHEN** a requisição das métricas de funil devolve erro num post de feed
- **THEN** `reach`, `views`, `saved` e `shares` daquele post são gravados normalmente
- **AND** `follows` e `profile_visits` ficam nulos

### Requirement: Ausência de medida é nula, nunca zero

`post.follows` e `post.profile_visits` SHALL ser NULL quando não medidos, e a leitura
SHALL tratar NULL como ausência.

Um zero gravado no lugar de NULL descreveria um post que alcançou pessoas e não
converteu ninguém — uma afirmação que a coleta não fez.

#### Scenario: Post anterior à migração

- **WHEN** um post coletado antes da migração 013 é lido
- **THEN** ele não entra em nenhuma média de conversão, em vez de entrar como zero

### Requirement: Toda taxa declara os dois números que a formaram

Taxa derivada SHALL ser recalculada na leitura a partir dos valores vigentes e SHALL
apresentar numerador e denominador junto do resultado.

`follows_per_visit` SHALL usar seguidores líquidos do mês sobre visitas ao perfil do
mês, e SHALL NOT ser apresentada como conversão por pessoa: o numerador é líquido, e
quem deixou de seguir no mesmo mês é subtraído do topo sem nunca ter visitado.

#### Scenario: A régua muda e a taxa acompanha

- **WHEN** o alcance de um mês é remedido pela API
- **THEN** as taxas que o usam como denominador mudam junto, sem edição de nota

#### Scenario: Falta uma das partes

- **WHEN** o período não tem um dos dois números
- **THEN** o valor armazenado é mantido com a nota que o acompanha, em vez de a tela
  ficar vazia

### Requirement: A conversão em Reel continua vinda dela

O produto SHALL continuar pedindo `post.non_follower_pct` por campo de número, e
SHALL NOT apresentar a conversão medida no feed como se valesse para o perfil inteiro.

Reels são a superfície onde este ciclo roda. A medição de feed cobre cerca de um terço
do que ela publica.

#### Scenario: Uma tela não mistura as duas origens

- **WHEN** uma taxa de conversão é apresentada
- **THEN** ela diz qual denominador usou e de onde o número veio
