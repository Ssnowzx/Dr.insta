> **Estado: implementado e verificado em 06/08/2026.** Nasce marcado porque a
> mudança foi construída antes de ser registrada. É relato, não lista a fazer.

## 1. A marca sai do código

- [x] 1.1 `generateMetadata` no layout do grupo `(app)`, lendo `client.brand`
- [x] 1.2 `title.template` `%s — <marca>`; cada página declara só o próprio nome
- [x] 1.3 Título neutro no layout raiz, que cobre as telas sem sessão
- [x] 1.4 `clientProfile` vira `cache()` — passou a ser lido duas vezes por render
- [x] 1.5 Assinatura "My Favorite" removida das quatro telas de credencial
- [x] 1.6 Verificado: a string não existe mais no código, e a aba lê `Plano — My Favorite`

## 2. A tela de entrada

- [x] 2.1 `components/auth-shell.tsx` — casca compartilhada pelas quatro telas
- [x] 2.2 Campo animado: 3 arcos, 3 anéis com `conic-gradient` mascarado, 2 ondas, 2 blobs
- [x] 2.3 Anéis em `cqmin` — um breakpoint inteiro deixou de existir
- [x] 2.4 Assinatura em `cqi`, medida em 320/360/390/430/500px: uma linha em todas
- [x] 2.5 Crédito "Desenvolvido por Xiax" **fora** do cartão
- [x] 2.6 `prefers-reduced-motion` respeitado pela regra global; a composição funciona parada

## 3. O contraste do tema escuro

- [x] 3.1 Medir: placa × papel dá 14,78 no claro e 1,18 no escuro
- [x] 3.2 Medir a alternativa: near-black × papel escuro dá 1,07 — tom não resolve
- [x] 3.3 `--poco`, que sobe a luz nude de 9,8:1 para 12,3:1
- [x] 3.4 Costura como hairline acesa, horizontal no celular e vertical no desktop
- [x] 3.5 Cartão elevado para o formulário, com aresta e sombra

## 4. Os defeitos que a auditoria mediu

- [x] 4.1 `.campo`, `.btn`, `.aviso` migram de `auth.css` para `base.css`
- [x] 4.2 `suppressHydrationWarning` no `<html>`, com o motivo escrito
- [x] 4.3 `--dado-texto` nos seis usos como texto; `--dado` segue preenchimento
- [x] 4.4 `--suave` escurecido: media 4,35 sobre `--papel2`
- [x] 4.5 `--linha-campo` a 3:1 — borda de campo media 1,53 e 1,47
- [x] 4.6 `--campo-fundo`: campo e cartão não podem dividir o mesmo fundo
- [x] 4.7 Sete pares novos em `test/contrast.test.ts` (50 → 72 testes)
- [x] 4.8 Auditoria renderizada: **zero** reprovações nas quatro telas, tema claro

## 5. O acervo pode ser conferido

- [x] 5.1 Chips alternam o próprio eixo e preservam o outro
- [x] 5.2 `postCounts()` recebe o filtro e conta cada eixo dentro do recorte do outro
- [x] 5.3 `marcaTotal`/`marcaCurto` seguem absolutos — o achado é sobre o acervo inteiro
- [x] 5.4 `noRecorte` para a linha de estado; `lista.length` para em 60
- [x] 5.5 Dois grupos rotulados: cinco chips em fila liam como cinco respostas de uma pergunta
- [x] 5.6 Vazio de cruzamento explica que é casa vazia, não falha de busca

## 6. O sinal para a cliente

- [x] 6.1 `openRequestCount()` contando `open` e `in_progress`
- [x] 6.2 Contador no item Pedidos, no rail e na barra inferior
- [x] 6.3 `aria-label` dizendo "Pedidos: N em aberto"
- [x] 6.4 Fundo do contador para `--dado-texto` — media 3,62 como número a ler
- [x] 6.5 Mostrar/esconder senha, com `tabIndex={-1}` para não desviar o teclado

## 7. Verificação

- [x] 7.1 `npm run lint` limpo
- [x] 7.2 `npm test` — 266 testes na plataforma
- [x] 7.3 Console sem erro de hidratação
- [x] 7.4 Alvos de toque medidos: segmentos 135×44, barra 100×57
- [x] 7.5 `npm run validar:tudo` limpo
