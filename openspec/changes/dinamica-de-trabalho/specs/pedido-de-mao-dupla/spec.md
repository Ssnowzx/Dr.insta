## Purpose

Define o ciclo de vida de um pedido entre consultor e cliente: quais estados existem, quem é o dono da vez em cada um, quem pode movê-los, por que concluir exige desfecho escrito, e quando um pedido parado deixa de ser silêncio e vira dívida visível de quem o recebeu.

## ADDED Requirements

### Requirement: Cinco estados, cada um com dono declarado

Um pedido SHALL ter exatamente cinco estados, e cada um SHALL declarar de quem é a vez:

| Estado | Vez de | Significa |
|---|---|---|
| `open` | quem responde | foi pedido, ninguém entregou ainda |
| `answered` | quem pediu | o material chegou |
| `analyzing` | quem pediu | está sendo lido e usado |
| `concluded` | ninguém — é leitura | tem desfecho escrito |
| `dropped` | ninguém | não vai acontecer |

"Quem responde" e "quem pediu" SHALL ser derivados de `raisedBySide`, nunca fixados no papel: um pedido levantado pela cliente tem o consultor como quem responde, e o inverso também vale.

A tela SHALL mostrar de quem é a vez em linguagem direta ("esperando você" / "comigo"), e SHALL NOT exigir que a leitora deduza isso pelo nome do estado.

#### Scenario: Pedido levantado pela cliente

- **WHEN** a cliente abrir um pedido
- **THEN** o estado nasce `open` com a vez do consultor, e a tela dela mostra "comigo" no sentido de que está com ele

#### Scenario: Estado sem dono na tela

- **WHEN** um pedido for exibido em qualquer tela
- **THEN** a indicação de quem é a vez aparece junto do estado, para os dois papéis

### Requirement: "Em análise" é ato deliberado de quem recebeu

A transição para `analyzing` SHALL ser executada explicitamente por quem pediu, e SHALL NOT ser derivada de upload, comentário, abertura de tela ou qualquer evento automático.

A razão é o custo de mentir: `analyzing` é o único estado que promete atenção humana. Aceso por gatilho automático, ele é indistinguível de "ninguém olhou" — que é exatamente o que aconteceu em 13/08/2026, quando dezesseis arquivos entraram e o pedido passou a exibir "em andamento" pelo disparo automático de `in_progress`.

#### Scenario: Upload não move para análise

- **WHEN** a cliente subir arquivo ou escrever comentário em um pedido `open`
- **THEN** o estado passa a `answered` e a vez passa a ser de quem pediu — nunca a `analyzing`

#### Scenario: Consultor abre o pedido sem agir

- **WHEN** o consultor apenas visualizar um pedido `answered`
- **THEN** o estado não muda; visualizar não é analisar

### Requirement: Concluir exige desfecho escrito

Um pedido SHALL NOT entrar em `concluded` sem que `outcome` esteja preenchido com texto não vazio. O desfecho SHALL ser exibido a quem respondeu, na tela dele, como retorno do que entregou.

Um pedido fechado sem explicação é pior que um pedido aberto: quem entregou o material fica sem saber se serviu, e a próxima entrega vem com menos cuidado. A cliente declarou em 13/08/2026 que o que lhe interessa é "resultado e explicações" — esta regra é essa frase transformada em restrição.

`dropped` SHALL aceitar desfecho vazio, mas quando preenchido SHALL ser exibido igual: dizer por que algo foi dispensado também é resposta.

#### Scenario: Tentativa de concluir sem desfecho

- **WHEN** for solicitada a transição para `concluded` com `outcome` vazio
- **THEN** a transição é recusada com mensagem dizendo que falta escrever o que saiu do pedido

#### Scenario: Pedido concluído aparece para quem respondeu

- **WHEN** um pedido for concluído
- **THEN** ele aparece na tela de quem respondeu como retorno, com o desfecho legível, e não apenas como item arquivado

### Requirement: Os dois lados abrem pedido

Consultor e cliente SHALL poder abrir pedido pelo aplicativo, e `raisedBySide` SHALL registrar qual dos dois o fez. A criação SHALL exigir título e SHALL aceitar descrição opcional.

Hoje `insert(request)` existe apenas na semente (`db/seed.ts:1124`), o que torna cada rodada nova dependente de edição de código e deploy. Um intake que só o repositório alimenta não é ciclo de trabalho.

Pedido levantado pela cliente SHALL aparecer no resumo do consultor. O resumo dela SHALL continuar ignorando o que ela mesma levantou — o que ela fez não é novidade para ela.

#### Scenario: Cliente abre pedido

- **WHEN** a cliente abrir um pedido pelo aplicativo
- **THEN** ele nasce `open` com `raisedBySide: 'client'` e aparece no resumo do consultor como algo que ela pediu

#### Scenario: Resumo dela não repete o que ela levantou

- **WHEN** a cliente abrir o resumo depois de ter levantado um pedido
- **THEN** esse pedido não aparece como novidade para ela

### Requirement: Pedido respondido e parado vira dívida de quem recebeu

Um pedido em `answered` há mais de **3 dias** sem transição para `analyzing`, `concluded` ou `dropped` SHALL aparecer no resumo de quem pediu como pendência, com a contagem de dias.

O produto já cobra a cliente por tudo que falta dela. Nada cobrava o consultor, e o silêncio dele era invisível dentro do aplicativo — visível apenas para ela, do lado de fora, como ausência de resposta.

#### Scenario: Material entregue e não olhado

- **WHEN** um pedido completar mais de 3 dias em `answered`
- **THEN** ele aparece no resumo de quem pediu como pendência dele, com há quantos dias está parado

#### Scenario: Análise começou

- **WHEN** um pedido parado passar para `analyzing`
- **THEN** ele deixa o grupo de pendência, mesmo que ainda não tenha desfecho

### Requirement: Toda transição continua sendo evento com autor e hora

Cada mudança de estado SHALL gravar um evento com autor e momento, e o `state` da linha SHALL permanecer sendo projeção do último evento. Nenhuma transição SHALL alterar apenas a coluna.

Isso já é verdade e SHALL continuar sendo depois da migração: guardar só o estado atual responde "onde isto está" e nunca "quando eu pedi, e quando ela viu" — que é a pergunta que justifica o intake existir.

#### Scenario: Histórico de um pedido concluído

- **WHEN** um pedido percorrer aberto, respondido, em análise e concluído
- **THEN** os quatro momentos ficam legíveis no histórico, cada um com quem o produziu
