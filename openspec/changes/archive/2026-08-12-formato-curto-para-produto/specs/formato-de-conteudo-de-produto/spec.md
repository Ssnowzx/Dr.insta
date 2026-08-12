## Purpose

Define como conteúdo de produto do perfil é formatado para sobreviver à distribuição do Instagram e apontar para a compra: duração máxima, voz, nomeação da peça, destino e o que caracteriza o formato proibido.

## ADDED Requirements

### Requirement: Duração máxima do conteúdo de produto

Todo Reel dos pilares Provador e Padrão SHALL ter **20 segundos ou menos**. Reel de produto acima de 20 segundos MUST ser recusado no planejamento, e não corrigido depois de publicado.

A restrição vale para o conteúdo de produto. Reel pessoal longo (bastidor, receita, conversa) permanece permitido — o pilar Bastidor não está sujeito a este limite.

#### Scenario: Pauta de produto acima do limite

- **WHEN** uma pauta de Provador ou Padrão for planejada com duração estimada acima de 20 segundos
- **THEN** a pauta é reescrita para caber em 20 segundos ou reclassificada como Bastidor, e o motivo é registrado

#### Scenario: Pauta de produto dentro do limite

- **WHEN** uma pauta de Provador ou Padrão for planejada com 20 segundos ou menos
- **THEN** ela segue para produção sem ressalva de duração

### Requirement: Voz única para conteúdo de marca

A legenda de conteúdo de produto SHALL usar a mesma voz do conteúdo pessoal, conforme `perfil/voz-e-tom.md`: minúscula, 2 a 5 palavras, ironia seca, sem explicar o vídeo.

Legenda de produto MUST NOT conter construção de comunicado ("oficialmente lançada", "a My Favorite apresenta"), terceira pessoa para a própria marca, adjetivo de release ("incrível", "imperdível", "exclusivo") nem CTA imperativo empilhado.

#### Scenario: Legenda em voz de assessoria

- **WHEN** uma legenda de produto contiver construção de comunicado, terceira pessoa sobre a própria marca ou adjetivo de release
- **THEN** a legenda é reescrita antes da publicação

#### Scenario: Teste de intercambialidade

- **WHEN** for preciso decidir se uma legenda de produto está na voz certa
- **THEN** aplica-se o teste: se aquela legenda não poderia aparecer num Reel de cotidiano, ela não vai num Reel de produto

### Requirement: Peça nomeada com contexto e destino

Todo Reel com peça de roupa dela em cena SHALL nomear a peça e dar um contexto de uso, e SHALL ter um destino de compra — link na bio, link em Stories no mesmo dia ou destaque de compra.

Menção institucional à marca sozinha (`@myfavorite.oficial` sem nome de peça) MUST NOT contar como cumprimento deste requisito.

#### Scenario: Reel com roupa em cena e sem nome de peça

- **WHEN** um Reel mostrar peça dela em cena e a legenda não nomear a peça nem der contexto
- **THEN** a legenda é completada antes da publicação com nome e contexto, no padrão dos Stories de maior clique

#### Scenario: Reel de produto sem destino ativo

- **WHEN** um Reel de produto for publicado e não houver link na bio, link em Stories no mesmo dia nem destaque de compra correspondente
- **THEN** o Reel é registrado como publicado sem caminho, e a ausência entra no relatório do período

### Requirement: Formato de apresentação de produto proibido

O formato "apresentação de produto em vídeo longo" MUST NOT ser produzido enquanto este ciclo estiver ativo. Caracteriza o formato: duração acima de 45 segundos somada a produto como assunto declarado, narração explicativa e ausência de cena de cotidiano.

Conteúdo de processo produtivo e de bastidor de coleção continua existindo, mas em Stories, destaque ou carrossel — não em Reel.

#### Scenario: Retomada do formato proibido

- **WHEN** uma pauta reproduzir apresentação de produto em vídeo longo
- **THEN** a pauta é recusada com a evidência registrada: a série de 4 episódios de ~88s fez 44.539 a 85.663 views contra mediana de 231.200 do perfil, e o Reel de lançamento de 1:37 fez 8% de retenção contra 48% de referência do nicho

#### Scenario: Conteúdo de processo produtivo

- **WHEN** houver conteúdo de processo produtivo ou bastidor de coleção a publicar
- **THEN** ele é distribuído em Stories, destaque ou carrossel, e não como Reel de apresentação

### Requirement: Rótulo de procedência das métricas

Toda leitura de desempenho de Reel SHALL declarar a origem do dado. Métrica vinda da API pública MUST ser rotulada como tal, e `views` MUST NOT ser apresentada como alcance.

`media_repost_count` da API pública SHALL ser reportado como **repost**, nunca como compartilhamento em DM.

#### Scenario: Relatório com dado público

- **WHEN** um relatório ou página de cliente citar views, curtidas, comentários ou reposts vindos da API pública
- **THEN** o documento declara que o dado é público, que `views` não é alcance e que repost não é compartilhamento

#### Scenario: Taxa que exige alcance

- **WHEN** for necessário calcular `saves/reach`, `sends/reach` ou retenção por Reel
- **THEN** o cálculo aguarda a exportação do Insights, e a lacuna é declarada em vez de estimada
