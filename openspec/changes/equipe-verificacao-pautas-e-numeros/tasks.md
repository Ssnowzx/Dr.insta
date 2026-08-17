# Tarefas — 17/08/2026

Tudo abaixo está **implementado, testado e commitado**. Nada foi para a VPS
ainda além do que consta em "Já em produção".

## 1. Equipe de duas pessoas

- [x] 1.1 Migração 010: `user.job_title`, descritivo e nunca permissão
- [x] 1.2 Estado da etapa passa a ser do time (`teamStepAnswers`), com o nome de quem marcou
- [x] 1.3 Conta → **Quem tem acesso** cria pessoa e entrega o link, sem SSH
- [x] 1.4 `npm run invite -- --job "assessora de conteúdo"`
- [x] 1.5 Só quem conectou desconecta o Instagram, por `connected_by`
- [x] 1.6 Grupo **"Sua equipe"** nas Novidades dela — elas eram invisíveis uma para a outra
- [x] 1.7 A nota que o controle EDITA é a da própria pessoa; a da colega aparece atribuída e travada
- [ ] 1.8 **Criar o acesso real da Cris** — falta o e-mail dela

## 2. O que já foi feito para de aparecer

- [x] 2.1 Migração 010: `step.request_id` e `step.verify_key`
- [x] 2.2 `lib/verificacao.ts` puro, com teste — prova só leva a `done`, e vence `blocked`
- [x] 2.3 Etapa `c1` amarrada ao pedido "A aba Público de cinco Reels"
- [x] 2.4 Etapa `b1` amarrada ao verificador `instagram_connected`
- [x] 2.5 `step-actions` recusa contradizer uma prova
- [x] 2.6 O pedido do print mensal reescrito: pedia três números, dois já chegam sozinhos

## 3. Aba Ideias

- [x] 3.1 Migração 010: `idea`, `idea_beat`, `idea_note`
- [x] 3.2 `/ideias` com atrasadas · hoje · sete dias · depois · banco · publicadas · descartadas
- [x] 3.3 `/ideias/[codigo]` com gancho, blocos (`says` separado de `shows`), legenda e chamada
- [x] 3.4 Conversa por pauta, dos dois lados, chegando em `/novidades`
- [x] 3.5 11 pautas e 25 blocos na seed
- [x] 3.6 Manchete e lead vêm de `manchete()`, testados nos cinco ramos
- [x] 3.7 Rodapé reescrito na voz dela: começa pelo que **não** muda
- [ ] 3.8 **Segundo lote de pautas** — só depois do retorno delas no primeiro

## 4. O acervo cresce sozinho

- [x] 4.1 `collectMedia` cria o post que não encontra
- [x] 4.2 `kindOf` lê os DOIS campos de tipo — `media_type` diz VIDEO para Reel e para vídeo de feed
- [x] 4.3 `postCounts.semDuracao` + a nota na tela; os dois chips deliberadamente não somam o total
- [x] 4.4 A tela deixa de dizer "Reels" sobre um acervo que tem carrossel e foto
- [x] 4.5 Cron de 1× para 5× por dia, pulando 00:00–05:00 UTC
- [ ] 4.6 **Backfill de fevereiro a junho** — um comando por mês, decisão dele

## 5. O celular é o aparelho

- [x] 5.1 Seis destinos na barra; sino e conta no topo
- [x] 5.2 Contador no canto do sino, não em cima dele
- [x] 5.3 Todos os alvos em 44px — o botão de tema estava em 31
- [x] 5.4 Três faixas para o nome da pessoa (inteiro · primeiro · só ícone)
- [x] 5.5 Nome do topo passa a ser `client.name`, na serif de display

## 6. Campo de número no pedido

- [x] 6.1 Migração 011: `request_field` e `post.non_follower_pct`
- [x] 6.2 Migração 012: identidade do campo é `slug`, não o rótulo
- [x] 6.3 `lib/numero.ts` puro e testado — recusa "1.5" em vez de adivinhar
- [x] 6.4 Os dois pedidos com campo, e a seed recusa shortcode fora do acervo
- [ ] 6.5 **Conferir com ela** que o caminho no Instagram bate com o app dela hoje

## 7. Antes do deploy

- [ ] 7.1 `git push origin main`
- [ ] 7.2 Na VPS: pull · build · migrate (010, 011, 012) · up · seed
- [ ] 7.3 Trocar a linha do cron em `/etc/cron.d/myfavorite-sync`
- [ ] 7.4 Abrir `/ideias`, `/pedidos` e `/conteudo` no celular, nos dois temas
