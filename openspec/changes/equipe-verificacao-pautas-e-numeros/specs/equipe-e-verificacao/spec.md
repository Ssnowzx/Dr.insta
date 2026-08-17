## Purpose

Define como duas pessoas do lado da cliente trabalham no mesmo perfil sem se atropelar, e como a plataforma para de pedir o que ela já fez.

## ADDED Requirements

### Requirement: Uma conta de cliente pode ter mais de uma pessoa

O produto SHALL permitir mais de um usuário `client` no mesmo `client_id`, e SHALL apresentar o estado do trabalho compartilhado — tarefas, pedidos, pautas — como **do time**, com o nome de quem respondeu ao lado.

`user.job_title` SHALL ser descritivo e nunca SHALL gatilhar permissão: a regra de acesso continua sendo `user.client_id` e nada mais.

#### Scenario: Uma marca, a outra lê

- **WHEN** a Bianca marca uma etapa como feita
- **THEN** a Cris abre o Plano e lê "feito", com "Bianca Olivo marcou em <data>" embaixo

#### Scenario: A nota de uma não vira a nota da outra

- **WHEN** a Cris abre uma etapa em que a Bianca escreveu uma anotação
- **THEN** o texto da Bianca aparece atribuído e fora do campo editável, e o campo que a Cris edita está vazio
- **AND** marcar qualquer estado não grava a frase da Bianca na linha da Cris

#### Scenario: A credencial é de quem a concedeu

- **WHEN** a assessora abre Conta e a conexão do Instagram foi autorizada pela Bianca
- **THEN** o botão de desconectar não é oferecido, e a tela diz quem autorizou

### Requirement: Nada é inalcançável no celular

Toda tela do produto SHALL ser alcançável a partir de um telefone. Um destino SHALL NOT ser removido da navegação móvel para caber outro; se a barra ficar cheia, o que sai é o que **não é destino**, e vai para a barra do topo.

Todo alvo de toque SHALL ter no mínimo 44px.

#### Scenario: Uma aba nova não expulsa outra

- **WHEN** um destino novo é adicionado à navegação
- **THEN** ele continua alcançável no celular sem tornar nenhum outro exclusivo de desktop

### Requirement: O que já foi feito para de ser pedido

Uma etapa SHALL poder declarar como se prova: `step.request_id` para "esta tarefa É aquele pedido", `step.verify_key` para um fato que a plataforma observa sozinha.

A prova SHALL apenas levar uma etapa a `done`, e SHALL NOT tirá-la desse estado. Um verificador é evidência de conclusão, não de não-conclusão.

A prova SHALL prevalecer sobre `blocked`, mantendo visível a anotação de quem travou.

#### Scenario: Respondeu em Pedidos, some do Plano

- **WHEN** ela responde ou anexa algo no pedido amarrado a uma etapa
- **THEN** a etapa aparece como feita, sem o valor para copiar, com "você já respondeu isso em Pedidos" e um link

#### Scenario: A credencial cai depois de a etapa estar pronta

- **WHEN** a conexão do Instagram passa a `revoked` e a etapa já constava como feita
- **THEN** a etapa continua feita
