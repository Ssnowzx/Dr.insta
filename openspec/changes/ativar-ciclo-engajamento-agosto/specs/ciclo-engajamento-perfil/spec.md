## Purpose

Define como o ciclo de 90 dias converte a atenção que o perfil já tem em conversa pública e recorrente: qual métrica decide, o que é controle, em que ordem os experimentos rodam e quando a aposta é declarada errada.

## ADDED Requirements

### Requirement: Métrica-norte única do ciclo

O ciclo SHALL usar **comentários por alcance** como única métrica de decisão (baseline 0,21%, alvo ≥ 0,50%). Quando duas recomendações conflitarem, a que move comentários/alcance SHALL vencer. Alcance, views e seguidores SHALL ser tratados como guard-rail e contexto — nunca como alvo de otimização.

#### Scenario: Conflito entre recomendações

- **WHEN** uma pauta promete mais alcance e outra promete mais comentários por alcance
- **THEN** a recomendação entregue é a de comentários, com o custo de alcance declarado

#### Scenario: Pedido de otimização de alcance

- **WHEN** o usuário ou a cliente pede para "crescer" ou "alcançar mais gente" durante o ciclo
- **THEN** a resposta registra que alcance está em nível alto (5,4M/mês), aponta o guard-rail e redireciona para a métrica-norte — colab só entra nos dias 61–90

### Requirement: Mix editorial com controle intocável

O mix SHALL ser Espelho 50% / Conversa 20% / Vale guardar 20% / Personagens 10%, sem aumento de volume total (~8 Reels/semana). O pilar Espelho SHALL ser tratado como controle: não recebe experimento e não é alterado. Nenhum pilar SHALL exigir menção à marca My Favorite; a marca só aparece como escolha da cliente, na voz dela.

#### Scenario: Queda no controle

- **WHEN** sends/reach do pilar Espelho cair de forma sustentada durante a realocação
- **THEN** a leitura declara que a realocação foi longe demais e o mix é revisto — o problema não é tratado como falha do pilar

#### Scenario: Pauta de marca proposta

- **WHEN** uma pauta trata o perfil como canal de venda da marca (link, oferta, lançamento)
- **THEN** a pauta é recusada e encaminhada como assunto da equipe da My Favorite

### Requirement: Experimentos em ordem obrigatória

O ciclo SHALL rodar quatro experimentos, um de cada vez, nesta ordem: pauta de conversa → resposta na primeira hora → utilidade na voz dela → colab mensal (somente dias 61–90). Nenhuma leitura SHALL ser feita com menos de 7 posts ou 14 dias; leituras sem Insights SHALL usar proxy público explicitamente rotulado como proxy.

#### Scenario: Tentativa de rodar experimentos em paralelo

- **WHEN** dois experimentos do ciclo forem propostos para a mesma janela
- **THEN** o segundo é adiado, com a razão registrada: duas variáveis na mesma janela não produzem conclusão válida

#### Scenario: Leitura com amostra insuficiente

- **WHEN** houver menos de 7 posts ou menos de 14 dias de dados para um experimento
- **THEN** o resultado é declarado como ruído/indício, nunca como tendência

### Requirement: Guard-rail de distribuição

O ciclo SHALL monitorar alcance mensal (baseline 5,4M) e respostas em Stories (baseline 22 mil/mês). Queda superior a 25% sustentada por 3 semanas em qualquer um dos dois SHALL abrir revisão do mix.

#### Scenario: Queda acentuada de alcance

- **WHEN** o alcance mensal cair mais de 25% por três semanas consecutivas
- **THEN** o ciclo abre revisão do mix antes de qualquer outra decisão de pauta

### Requirement: Critério de abandono declarado

Se, com ≥ 14 posts do pilar Conversa e 6 semanas de ciclo, comentários/alcance não passar de 0,35%, a hipótese "pauta certa gera conversa pública" SHALL ser declarada errada e o ciclo SHALL trocar para Stories-first (caixinha diária + repost de resposta) antes de insistir em formato de feed.

#### Scenario: Hipótese não confirma

- **WHEN** a semana 6 fechar com ≥ 14 posts de Conversa e comentários/alcance ≤ 0,35%
- **THEN** o experimento é marcado como lido-negativo com desfecho registrado, e o plano B (Stories-first) é ativado
