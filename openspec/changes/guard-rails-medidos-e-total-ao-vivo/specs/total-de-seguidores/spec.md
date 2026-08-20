## Purpose

Define como o total de seguidores é coletado, com que granularidade vive no banco, e
o que a tela pode afirmar sobre a distância até a meta sem virar palpite.

## ADDED Requirements

### Requirement: O total é um fato de um instante, e é gravado como tal

O total de seguidores SHALL ser gravado com granularidade `day`, sob a data em que
foi lido. Toda outra métrica aqui descreve um mês fechado, o que é correto para elas:
alcance de um mês é um fato sobre aquele mês. Um total de seguidores é um fato sobre
um momento, e o momento é o único que a API entrega — não existe endpoint para
"quantos ela tinha no dia 14".

Uma coleta que falhe em ler o total SHALL ser reportada no log em vez de falhar
calada. Um dia perdido nessa série não volta.

A leitura do total SHALL engolir a própria falha e SHALL NOT derrubar a coleta do
mês, que a essa altura já está em mãos.

#### Scenario: Cinco coletas no mesmo dia

- **WHEN** o sync roda cinco vezes num dia
- **THEN** existe uma linha para aquele dia, com a última leitura
- **AND** a chave única (cliente, métrica, período, granularidade, fonte) é o que
  garante isso

### Requirement: Toda consulta que significa "o mês" declara a granularidade

Qualquer consulta cujo resultado representa um mês SHALL filtrar por
`granularity = 'month'` explicitamente, e SHALL NOT confiar apenas no formato do
período.

Duas razões, ambas medidas em produção: uma linha de dia mais recente que qualquer
mês vira "o período mais recente" e leva o painel para uma data sob a qual não existe
métrica mensal nenhuma; e **no primeiro dia de qualquer mês uma linha de dia e uma de
mês compartilham a mesma string de período**, de modo que o total diário seria lido
como o número daquele mês.

#### Scenario: O painel escolhe o mês a exibir

- **WHEN** existe uma linha diária mais recente que o último mês fechado
- **THEN** a linha diária é invisível para essa escolha
- **AND** o painel exibe o último mês fechado

#### Scenario: Dia 1º de um mês

- **WHEN** um valor diário é gravado no primeiro dia do mês
- **THEN** nenhum cartão mensal o lê como o número daquele mês

### Requirement: A distância até a meta é aritmética, nunca veredito

A tela SHALL declarar o total de hoje, a diferença até a meta e o prazo restante, e
SHALL declarar o ritmo que isso exige **ao lado do ritmo do último mês fechado** —
um ritmo exigido sem escala ao lado lê como cobrança e não como medida.

A frase SHALL NOT emitir julgamento sobre o desempenho. "Muito atrás" é opinião e
pertence a uma conversa com a cliente, não a uma tela que ela abre sozinha.

O ritmo mensal SHALL ser omitido quando restar menos de um mês, porque projetar
trinta dias a partir de onze ultrapassa o prazo e imprime um número inútil; e SHALL
ser omitido quando nenhum mês fechado existir.

A linha inteira SHALL ser omitida quando o total nunca foi lido. Um marcador de
"sem dados" no topo do painel é uma linha que a leitora aprende a pular.

#### Scenario: Prazo vencido sem a meta atingida

- **WHEN** a data final passou e a meta não foi alcançada
- **THEN** a frase mantém a diferença e abandona o prazo

#### Scenario: Um único dia restante

- **WHEN** resta exatamente um dia
- **THEN** a frase diz "resta 1 dia", no singular

### Requirement: A meta mora no seed, não no código da tela

O valor da meta e sua data SHALL vir do alvo do ciclo. São decisões da cliente, e uma
decisão digitada dentro de um componente envelhece sem que ninguém consiga ver que
envelheceu — que foi exatamente como quatro guard-rails ficaram três vezes abaixo da
verdade.

#### Scenario: Ciclo sem meta de seguidores

- **WHEN** o ciclo em vigor não tem alvo para o total
- **THEN** a frase declara só o total de hoje
- **AND** nenhum número de meta é inventado pela tela
