## Purpose

Define o que a plataforma entrega para ela gravar, quanto disso é roteirizado e por quê, e como um número chega ao painel sem passar por uma pessoa.

## ADDED Requirements

### Requirement: Roteiro só para o vídeo que converte

O produto SHALL entregar **três roteiros completos por semana**, não um por post. Espelho — o formato curto e espontâneo — SHALL NOT receber roteiro escrito, por ser o controle declarado do ciclo e o motor de distribuição.

A tela SHALL dizer isso começando pelo que **não** muda no trabalho dela, nunca justificando a decisão de quem escreveu.

#### Scenario: Ela abre a aba e conta três

- **WHEN** ela abre Ideias e vê três roteiros para uma semana de oito posts
- **THEN** a tela diz "Continue postando como você já posta" antes de explicar o que está ali

### Requirement: A pauta que já saiu deixa a fila

Uma pauta marcada como publicada ou descartada SHALL sair dos grupos de trabalho, qualquer que seja a data dela, e SHALL permanecer legível abaixo.

O título da tela SHALL nomear a coisa mais próxima que precisa dela, e SHALL NOT somar num único número o que é para hoje e o que é para daqui a duas semanas.

#### Scenario: A data ainda não chegou, mas ela já publicou

- **WHEN** uma pauta datada para depois de amanhã é marcada como publicada
- **THEN** ela sai de "nos próximos sete dias" imediatamente

### Requirement: Um número é digitado, não fotografado

Um pedido SHALL poder pedir números identificados, e o valor SHALL pousar no seu destino sem intervenção humana: `metric_value` com origem `insights`, ou `post.non_follower_pct`.

A leitura SHALL recusar entrada ambígua em vez de adivinhar. Ponto SHALL ser sempre separador de milhar e vírgula sempre decimal; `1.5` SHALL ser recusado com uma mensagem que ensina o formato.

O valor gravado SHALL ser devolvido na tela na forma em que ela o escreveria.

Nenhum reconhecimento automático de imagem SHALL alimentar métrica: um dígito lido errado que entra sozinho no painel é pior que um que espera um dia, porque ninguém desconfia dele.

#### Scenario: Ela digita como o Instagram mostra

- **WHEN** ela escreve `347.482` no campo de visitas ao perfil
- **THEN** o painel passa a ler 347.482 no mês corrente, com origem `insights`
- **AND** a tela responde "Guardei 347.482"

#### Scenario: Entrada que não dá para ler

- **WHEN** ela escreve `1.5`
- **THEN** nada é gravado, e a mensagem diz que ponto separa milhar e vírgula separa decimal

### Requirement: O acervo não depende de exportação manual

A coleta SHALL criar o post que não encontra no acervo, a partir do que a API entrega.

Duração SHALL permanecer nula quando nenhuma fonte a informa, e SHALL NOT ser estimada. A tela SHALL contar separadamente os posts sem duração, porque eles ficam fora dos dois lados do corte que decide o ciclo.

#### Scenario: Ela publica e o app mostra no mesmo dia

- **WHEN** ela publica um Reel às 18h
- **THEN** ele aparece no acervo na coleta seguinte, no mesmo dia

#### Scenario: Post sem duração conhecida

- **WHEN** um post entra pela API, sem duração
- **THEN** ele não é contado em "até 20s" nem em "mais de 20s", e a tela diz quantos estão nessa situação
