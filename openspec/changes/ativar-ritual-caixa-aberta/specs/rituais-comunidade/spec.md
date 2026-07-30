## Purpose

Define o comportamento observável dos rituais recorrentes de comunidade do perfil: cadência
fixa, delimitação de tema, janela de resposta e apuração semanal das métricas que o
Instagram Insights não exporta. Existe para que engajamento deixe de ser evento isolado e
passe a ter previsibilidade suficiente para criar hábito de retorno na audiência.

## ADDED Requirements

### Requirement: Cadência fixa e previsível

Cada ritual ativo SHALL ter um dia da semana fixo, publicamente reconhecível, e esse dia
NÃO DEVE mudar entre semanas. A previsibilidade é o mecanismo que converte interação
avulsa em hábito de retorno; mudar o dia destrói o efeito que o ritual existe para produzir.

#### Scenario: Ritual publicado no dia previsto
- **WHEN** chega o dia fixo de um ritual ativo
- **THEN** o conteúdo do ritual é publicado nesse dia
- **AND** o formato segue a mesma estrutura das semanas anteriores

#### Scenario: Semana em que o ritual não pode ser cumprido
- **WHEN** o ritual não pode ser publicado no dia previsto
- **THEN** a ausência é comunicada à audiência em Stories no próprio dia
- **AND** o ritual retoma no dia fixo da semana seguinte, sem tentar compensar com publicação dobrada

### Requirement: Delimitação de tema na caixa de perguntas

A caixa de perguntas SHALL ser aberta sempre com um tema delimitado, nunca como convite
aberto do tipo "pergunte qualquer coisa". Convite irrestrito produz perguntas genéricas,
que geram respostas genéricas e não alimentam o banco de pautas.

#### Scenario: Abertura da caixa de perguntas
- **WHEN** a caixa de perguntas é aberta
- **THEN** o card de abertura nomeia explicitamente o tema da semana
- **AND** a caixa permanece aberta por 24 horas

#### Scenario: Volume baixo de perguntas recebidas
- **WHEN** a caixa recebe menos de 5 perguntas no período
- **THEN** as perguntas recebidas são respondidas com profundidade
- **AND** o volume baixo é reconhecido publicamente em vez de disfarçado com perguntas fabricadas

### Requirement: Janela de resposta de duas horas

Toda resposta de Story e todo comentário recebido em conteúdo de ritual SHALL ser
respondido em até 2 horas. Interação sem retorno ensina a audiência que responder não vale
a pena, e a janela inicial de interação é também a que mais concentra distribuição.

#### Scenario: Resposta recebida em Story de ritual
- **WHEN** um seguidor responde a um Story de ritual
- **THEN** a resposta é respondida em até 2 horas
- **AND** a resposta contém uma pergunta ou continuação, não apenas agradecimento

#### Scenario: Comentário recebido em conteúdo de ritual
- **WHEN** um seguidor comenta em um conteúdo de ritual
- **THEN** o comentário é respondido em até 2 horas
- **AND** comentários de discordância são respondidos com argumento, nunca com ironia

### Requirement: Aquecimento antes de pedido de alto custo

Antes de qualquer pedido de interação de alto custo — caixa de perguntas ou resposta direta
em Story — a audiência SHALL ter recebido ao menos um pedido de baixo custo (enquete ou
controle deslizante) nos dois dias anteriores. Pedir alto custo a uma audiência fria produz
silêncio, e o silêncio ensina que responder é opcional.

#### Scenario: Caixa de perguntas precedida de aquecimento
- **WHEN** a caixa de perguntas está prevista para um dia
- **THEN** nos dois dias anteriores houve ao menos uma enquete ou controle deslizante em Stories

### Requirement: Apuração semanal das métricas de comunidade

As métricas que o Instagram Insights não exporta SHALL ser contadas manualmente uma vez por
semana e registradas em `perfil/metas.md`. Sem contagem, não há baseline; sem baseline,
qualquer meta é ficção e o ciclo termina sem aprendizado.

#### Scenario: Fechamento semanal
- **WHEN** a semana termina
- **THEN** são registrados: comentários com mais de 4 palavras, DMs iniciadas por seguidores, respostas de Stories e quantidade de pessoas distintas que interagiram
- **AND** os valores são gravados em `perfil/metas.md` com a data da apuração

#### Scenario: Primeira semana do ciclo
- **WHEN** é a primeira semana após a ativação dos rituais
- **THEN** os valores apurados são registrados como baseline
- **AND** nenhuma meta numérica é definida antes desse registro existir

### Requirement: Limite de dois rituais simultâneos

No máximo 2 rituais SHALL estar ativos ao mesmo tempo, e um terceiro NÃO DEVE ser
adicionado antes de os dois primeiros completarem 90 dias ininterruptos. A taxa de abandono
de ritual novo é alta nas três primeiras semanas; sobreviver a essa fase vale mais que
variedade.

#### Scenario: Pedido de adicionar um terceiro ritual
- **WHEN** há proposta de ativar um ritual adicional
- **AND** os rituais ativos ainda não completaram 90 dias
- **THEN** a adição é recusada e o pedido é registrado para o ciclo seguinte

### Requirement: Proibição de engagement bait

Os rituais SHALL NOT usar pedidos genéricos de interação — "comenta EU", "marca alguém que
precisa ver", "salva para não perder". Esses padrões são descontados pelo algoritmo, geram
número sem relação e corroem autoridade.

#### Scenario: Redação da chamada para ação de um ritual
- **WHEN** a chamada para ação de um conteúdo de ritual é escrita
- **THEN** ela é específica ao conteúdo, respondível em menos de 10 palavras e posiciona quem responde
- **AND** não usa nenhuma das fórmulas genéricas de engagement bait
