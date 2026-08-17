## Why

Em 17/08/2026 o cliente chegou com três pedidos de produto e, ao longo do dia,
mais quatro. Nenhum era funcionalidade nova pela funcionalidade: cada um era um
lugar onde a plataforma contradizia o trabalho que ela existe para sustentar.

### 1. A Bianca não trabalha sozinha

Ela tem uma **assessora, a Cris**, que cuida do Instagram pessoal junto com ela.
A assessora já aparecia nos dados de julho ("você e a assessora já fazem isso no
direct todo dia") e **não existia no produto**.

Isso não era só uma conta faltando. `step_status` é único em `(step_id,
user_id)` e toda consulta juntava pelo id de quem estava lendo — invisível com
uma pessoa, defeito no dia um com duas: a Bianca marca, a Cris lê "a fazer", e a
tarefa é feita duas vezes ou por ninguém.

### 2. "Coisas que ela já fez continuam no app, e isso confunde"

Palavras dele, na voz dela. Três causas independentes, todas nossas:

| Causa | Sintoma |
|---|---|
| O estado era privado de cada leitor | Ver acima |
| O mesmo trabalho em duas telas sem ligação | Ela manda os prints em Pedidos e o Plano continua pedindo |
| A plataforma via o fato e perguntava assim mesmo | Ela conectou o Instagram em 14/08; a etapa continuava convidando |

### 3. Falta a ponte entre a decisão e a gravação

O plano diz o que mudar; a análise diz o que os números acharam. Os dois param
um passo antes do que ela faz numa terça, que é apontar a câmera e falar.
"Grave dois vídeos de opinião" é uma decisão, não um roteiro — e agora existe uma
segunda pessoa que precisa executar sem ter estado na conversa onde se decidiu.

### 4. O acervo estava parado havia oito dias

Descoberto olhando produção: o post mais novo em `/conteudo` era de 9 de agosto.
A coleta funcionava — aquele post tinha alcance, e alcance só existe na API — mas
`collectMedia` **só atualizava** linhas que já existiam. A tabela `post` crescia
por um caminho só, a exportação manual pelo navegador.

E o buraco se fechava sozinho: a janela de insights é de 30 dias, então post
ausente do acervo quando a janela fecha **nunca** ganha alcance, por rota nenhuma.

### 5. O celular é o aparelho

Regra dada por ele: elas trabalham quase só no celular, então **tela que só
existe no desktop não existe**. A aba Ideias fez oito destinos e eu tinha
derrubado Conteúdo da barra para manter seis. Essa troca não era minha.

### 6. O que ela manda nos Pedidos não é processado

Pergunta direta dele, respondida traçando o código: `metric_value` é escrita por
exatamente três coisas — a seed, o importador de Reels e o sync do Instagram. A
tabela `file` é lida por uma rota, o download. Não existe OCR. Um inteiro que ela
lê em quatro segundos viajava como PNG e esperava alguém abrir.

### 7. O nome no topo era da marca

`client.brand` — "My Favorite" — acima de todas as telas de um produto que é
inteiramente sobre o **perfil pessoal** dela, num ciclo cujo primeiro ato foi
passar a ponte com a loja para o time da marca.

## What Changes

- **Equipe de duas pessoas** no lado da cliente, com `user.job_title`
  descritivo. O estado das tarefas passa a ser do time, com atribuição. A única
  coisa não compartilhada é desconectar o Instagram, decidida por
  `instagram_connection.connected_by` — fato que já existia e ninguém lia.
- **Mecanismo de prova** (`lib/verificacao.ts`): `step.request_id` e
  `step.verify_key`. A prova **só leva a `done`**, nunca de volta, e vence
  `blocked`.
- **Aba Ideias** — pautas com data, roteiro em blocos, legenda, e uma conversa
  por pauta. Três roteiros por semana, não oito, e o porquê está em
  `perfil/pilares.md`.
- **O acervo cresce sozinho**: o coletor cria o post que não encontra. Duração
  fica nula — nenhum endpoint informa o tempo de um Reel — e a tela conta esses
  posts em vez de deixá-los sumir dos dois filtros.
- **Nada só no desktop**: seis destinos na barra, sino e conta no topo, todos os
  alvos em 44px.
- **Campo de número no pedido** (`request_field`): ela digita e o valor pousa em
  `metric_value` ou em `post.non_follower_pct`, com `lib/numero.ts` recusando o
  que não consegue ler.
- **O nome no topo é `client.name`**, na serif de display.

## Impact

- Migrações **010, 011, 012** — nenhuma reversível sem perda; as três são
  aditivas.
- `perfil/pilares.md` ganha a decisão de cadência (3 roteiros/semana) e a regra
  das datas fixas.
- `CLAUDE.md` ganha dois erros novos a evitar ativamente.
- **Custo declarado:** `post.duration_sec` passa a ser opcional na prática, e o
  corte ≤20s — que decide o ciclo — deixa de cobrir todo o acervo. A tela diz
  quantos posts estão fora dos dois lados; ninguém pode ler o corte como
  completo sem ver esse número.
