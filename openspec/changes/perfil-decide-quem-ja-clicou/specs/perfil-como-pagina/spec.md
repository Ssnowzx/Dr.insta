## Purpose

Define que o perfil — bio, foto, destaques e posts fixados — é uma etapa do funil com
métrica própria, e não cenário; e como o plano fala dela sem pedir que ela refaça o
que já está certo.

## ADDED Requirements

### Requirement: O funil do painel tem os degraus do ciclo em vigor

O painel SHALL apresentar alcance → visitas ao perfil → seguidores, e SHALL NOT
apresentar etapas de um ciclo encerrado.

Cada etapa SHALL mostrar sua fatia do topo **e** sua fatia do passo acima. A fatia do
passo acima é onde o vazamento aparece; só a fatia do topo esconde qual degrau falhou.

#### Scenario: O degrau do meio é visível

- **WHEN** a cliente abre o painel
- **THEN** lê quantas pessoas abriram o perfil e que fração delas passou a seguir

### Requirement: Componente de dado declara o fundo em que funciona

Um componente cujas cores pressupõem um fundo específico SHALL ser usado apenas sobre
esse fundo, e o contraste SHALL ser medido no navegador antes de a entrega ser dada
como pronta — nos dois temas.

Mínimo de 4,5:1 para texto.

#### Scenario: O que lint e teste não pegam

- **WHEN** um componente de fundo escuro é colocado em seção de fundo claro
- **THEN** a verificação renderizada acusa antes de ir ao ar

### Requirement: O plano abre pelo que não muda

Quando etapas são adicionadas a uma entrega já publicada, o título e o subtítulo SHALL
dizer que as anteriores continuam valendo, antes de descrever as novas.

Do lado de quem lê, entrega nova é substituição até que se diga o contrário.

#### Scenario: Três viram seis

- **WHEN** a entrega passa a ter seis etapas
- **THEN** o título não continua dizendo "três movimentos"
- **AND** a primeira frase diz que as três primeiras seguem iguais

### Requirement: Etapa sobre o perfil entrega o texto pronto

Etapa que pede mudança de texto no perfil SHALL trazer o valor exato para colar em
`step.copy_value`, escrito por extenso e nunca descrito.

Quando a mudança envolve remover algo que serve a outro interesse — a marca, a
imprensa —, a nota SHALL dizer que manter é uma opção e onde aquilo cabe.

#### Scenario: A bio chega colável

- **WHEN** a cliente abre a etapa da bio
- **THEN** copia o texto inteiro com um toque
- **AND** lê o que acontece se quiser manter a menção à marca

### Requirement: Pauta com conversão medida tem precedência sobre pauta inferida

Quando uma pauta que a cliente já publicou apresenta conversão medida melhor que a de
uma pauta inferida ocupando o mesmo espaço no calendário, o espaço SHALL passar para a
medida, e a inferida SHALL ir para o banco com o roteiro preservado.

O número de roteiros por semana SHALL NOT aumentar por causa dessa troca.

#### Scenario: O domingo troca de dono

- **WHEN** um quadro dela mede 212 seguidores contra a mediana de 8 dos posts do mesmo
  formato
- **THEN** ele assume o dia fixo, e o quadro inferido fica sem data com o roteiro
  intacto
