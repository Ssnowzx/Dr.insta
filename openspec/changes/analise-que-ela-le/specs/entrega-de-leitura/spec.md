## Purpose

Define a entrega que se lê em vez de se executar: onde mora o texto de uma análise, por que ela não pode depender de ter etapas para existir, e o que toda análise é obrigada a dizer antes de terminar.

## ADDED Requirements

### Requirement: Uma entrega existe mesmo sem etapas

A consulta que lista entregas publicadas SHALL devolver entregas que não têm nenhuma etapa. A decisão sobre o que renderizar SHALL ser da tela, nunca do `JOIN`.

Hoje `deliveries()` usa `innerJoin(step)`, e o efeito é que uma entrega sem etapa não existe para o produto — nem em tela, nem em contagem, nem em resumo. A tabela `delivery` declara `kind: 'analysis'` desde a primeira migração; o modelo previu análise e a consulta a tornou invisível.

#### Scenario: Análise publicada sem etapas

- **WHEN** uma entrega de leitura for publicada sem nenhuma etapa
- **THEN** ela aparece para a cliente na tela de leitura, com seu texto

#### Scenario: Tela de plano recebe uma entrega de leitura

- **WHEN** a tela do plano receber uma entrega sem etapas
- **THEN** ela a ignora explicitamente, em vez de renderizar um plano vazio

### Requirement: O texto de uma análise vive em blocos ordenados

Uma entrega SHALL poder carregar blocos de prosa ordenados, cada um com corpo obrigatório, título opcional e um destaque numérico opcional com seu rótulo.

O destaque é separado do corpo de propósito: o número que sustenta um parágrafo tem peso visual próprio e SHALL NOT depender de alguém lembrar de repeti-lo dentro do texto.

#### Scenario: Bloco com número de apoio

- **WHEN** um bloco declarar destaque e rótulo
- **THEN** o número é apresentado com ênfase própria, junto do parágrafo que ele sustenta

#### Scenario: Bloco sem título

- **WHEN** um bloco não tiver título
- **THEN** ele segue o bloco anterior como continuação, sem cabeçalho vazio

### Requirement: Toda análise termina no que muda

Uma entrega de leitura SHALL terminar com o que muda na prática para a cliente. Uma análise que só descreve o que foi encontrado SHALL ser considerada incompleta.

A razão é observada: em 04/08/2026 um diagnóstico correto foi entregue e não foi executado, e o ciclo fechou sem leitura. Descobrir não é entregar — a cliente declarou em 13/08/2026 que o que lhe interessa é "resultado e explicações", e explicação sem consequência é relatório.

#### Scenario: Análise sem consequência declarada

- **WHEN** uma entrega de leitura não disser o que muda no que ela faz
- **THEN** a entrega é tratada como incompleta e não é publicada

#### Scenario: Achado que não pede mudança

- **WHEN** um achado confirmar o que já está sendo feito
- **THEN** a consequência declarada é "não muda nada, e por isso seguimos" — dita, não omitida

### Requirement: O achado vem antes da evidência

A entrega SHALL apresentar a conclusão antes do caminho que levou a ela. Amostra, método e ressalva SHALL aparecer, e SHALL aparecer depois.

Ela abre a tela com uma pergunta — o que vocês descobriram sobre o meu perfil — e responder isso no quinto parágrafo significa que a resposta é alcançada por quem rolar até lá.

#### Scenario: Análise com ressalva metodológica

- **WHEN** um achado depender de amostra pequena, proxy ou dado com viés conhecido
- **THEN** a ressalva é escrita na entrega, depois do achado, em linguagem de conversa e não de nota de rodapé
