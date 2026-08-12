## Purpose

Define como o perfil converte atenção já conquistada em sessão rastreável no e-commerce: rastreamento de origem, infraestrutura permanente do perfil e regra de uso de link em conteúdo efêmero. Existe porque a conta alcança milhões e converte 0,29%, com a audiência correta já presente.

## ADDED Requirements

### Requirement: Rastreamento de origem em todo link publicado

Todo link para o e-commerce publicado em qualquer superfície do perfil SHALL carregar parâmetros de origem que identifiquem o canal da criadora, usando a convenção já vigente no painel de receita (`utm_source=influencer`, `utm_medium=<handle>`), acrescida de `utm_campaign` que distinga a superfície de publicação.

Um link sem parâmetros de origem é tratado como defeito de infraestrutura, não como escolha editorial.

#### Scenario: Link publicado na bio

- **WHEN** um link para o e-commerce é colocado na bio do perfil
- **THEN** ele carrega `utm_campaign=bio`
- **AND** as sessões dele aparecem no painel de receita atribuídas ao canal da criadora

#### Scenario: Link publicado em Stories

- **WHEN** um link para o e-commerce é publicado via sticker em Stories
- **THEN** ele carrega `utm_campaign` distinto do da bio
- **AND** é possível comparar a contribuição das duas superfícies separadamente

#### Scenario: Origem fragmentada no painel

- **WHEN** o painel de receita apresenta o mesmo canal em mais de uma linha por variação de grafia
- **THEN** a leitura de desempenho SHALL somar todas as variações antes de qualquer conclusão
- **AND** a unificação da grafia é solicitada a quem administra o e-commerce

### Requirement: Caminho permanente até a compra no perfil

O perfil SHALL oferecer, em superfície permanente, resposta à pergunta mais frequente recebida em mensagens diretas — onde e como comprar. Conteúdo efêmero não satisfaz este requisito, porque expira antes da próxima visita.

#### Scenario: Visitante chega ao perfil sem contexto prévio

- **WHEN** uma pessoa visita o perfil pela primeira vez
- **THEN** encontra em destaque fixo o caminho de compra, como as peças vestem e o que é novidade
- **AND** não depende de enviar mensagem direta para descobrir onde comprar

#### Scenario: Bio sem chamada para ação

- **WHEN** a bio descreve apenas cargo e contato profissional
- **THEN** isso SHALL ser tratado como lacuna de conversão
- **AND** a bio recebe uma chamada explícita para o caminho de compra

### Requirement: Separação entre conteúdo de vínculo e conteúdo de compra

Conteúdo pessoal e conteúdo de produto SHALL ser tratados como funções distintas. Conteúdo de produto carrega identificação da peça e link; conteúdo pessoal não carrega link.

Esta separação existe porque as duas funções são medidas por métricas diferentes — cliques de um lado, respostas do outro — e misturá-las degrada ambas.

#### Scenario: Publicação de peça em Stories

- **WHEN** uma peça do e-commerce aparece em Stories
- **THEN** o conteúdo nomeia a peça, diz um atributo concreto dela e leva link rastreado

#### Scenario: Publicação pessoal em Stories

- **WHEN** o conteúdo é pessoal, familiar ou de bastidor
- **THEN** não leva link
- **AND** permanece medido por taxa de resposta, não por cliques

#### Scenario: Menção institucional isolada

- **WHEN** o conteúdo apenas marca o perfil da marca sem descrever a peça
- **THEN** isso SHALL ser tratado como conteúdo de menor eficácia de clique
- **AND** não substitui identificação concreta da peça

### Requirement: Formato de conteúdo de produto ancorado em evidência

Conteúdo de produto SHALL usar formato de demonstração no ambiente real da criadora, com a mesma voz do conteúdo pessoal. Formato de apresentação institucional em vídeo longo SHALL ser evitado enquanto a evidência disponível o desaconselhar.

#### Scenario: Lançamento de coleção

- **WHEN** uma coleção ou peça nova precisa ser apresentada
- **THEN** é mostrada em demonstração natural, no ambiente da criadora
- **AND** a retenção do conteúdo é comparada à referência do nicho antes de repetir o formato

#### Scenario: Retenção de conteúdo de produto abaixo do crítico

- **WHEN** um conteúdo de produto fica abaixo do limite crítico de retenção do nicho
- **THEN** o formato SHALL ser revisto antes de novo conteúdo do mesmo tipo
- **AND** a causa é registrada distinguindo formato, duração e voz
