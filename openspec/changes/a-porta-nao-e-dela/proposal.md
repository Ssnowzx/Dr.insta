## Why

**A plataforma se apresentava como a marca da cliente.** "My Favorite" estava
escrito no código-fonte como título de toda página e como assinatura das quatro
telas de credencial — que são vistas **antes** de qualquer sessão, quando não
existe cliente para nomear. A My Favorite é a empresa da Bianca; a plataforma é
da consultoria. Além de errado hoje, seria mentira no dia em que uma segunda
instância servisse outra pessoa.

**E uma auditoria da interface encontrou quatro defeitos, todos por medição:**

1. **O formulário de senha em `/conta` renderizava sem CSS.** Input em Arial,
   `padding: 0`, botão cinza do sistema. Causa: `.campo`, `.btn` e `.aviso` só
   existiam em `app/auth.css`, que apenas as rotas de credencial importam — e
   `FormTrocarSenha` é componente compartilhado. Pior: `.aviso-erro` também sem
   estilo, na única tela onde se troca uma credencial.
2. **Erro de hidratação em toda navegação.** O script de tema escreve
   `data-tema` no `<html>` antes do React, por desenho, e faltava
   `suppressHydrationWarning`. Um aviso que sempre aparece é onde um aviso real
   se esconde.
3. **Seis usos de `--dado` como cor de texto.** O token está declarado como
   preenchimento de gráfico, validado a 3:1. Como texto responde a 4,5 e media
   entre **2,95 e 3,85** no tema claro — a pior sendo a etiqueta "≤20s", que
   marca justamente o corte de formato que o ciclo testa. Tudo passava no
   escuro, que é onde o trabalho foi feito.
4. **Os filtros do acervo não combinavam.** A tela abre afirmando que nenhum
   Reel de marca tem 20 segundos ou menos, e os chips substituíam a query
   inteira — ela não conseguia conferir a própria afirmação.

**E a cliente não era avisada de nada.** `/novidades` e o sino são do consultor;
não há e-mail, por decisão. Um pedido aberto para ela ficava invisível até ela
resolver olhar.

**Depois disso, a tela de entrada não tinha contraste.** No tema escuro as duas
metades do split eram o mesmo marrom: a placa contra o papel mede **14,78 no
claro e 1,18 no escuro**.

## What Changes

- **A marca sai da porta.** Nenhuma marca nas telas fora da sessão. Dentro, o
  título vem do banco (`client.brand`) via `generateMetadata`, e a string deixa
  de existir no código.
- **Tela de entrada nova**: campo animado à esquerda — anéis concêntricos com
  luz percorrendo, ondas, blobs — e o formulário num cartão elevado à direita.
  Anéis dimensionados em `cqmin`, o que apagou um breakpoint inteiro.
- **No escuro, camada se faz com luz.** Escurecer não separava (near-black
  contra papel escuro mede 1,07): o campo virou poço quase preto, o que sobe a
  luz nude de 9,8:1 para 12,3:1, a costura virou hairline acesa e o formulário
  ganhou cartão com aresta e sombra.
- `.campo`, `.btn` e `.aviso` migram para `app/base.css` — grupo de rotas não
  pode ser dono do estilo de um componente compartilhado.
- **`--dado-texto`** nasce para os seis usos como texto; `--dado` continua sendo
  preenchimento. **`--linha-campo`** dá 3:1 à borda de campo, que media 1,53 e
  1,47 e reprovava WCAG 1.4.11 nos dois temas.
- **Filtros combináveis** no acervo, com as contagens calculadas dentro do
  recorte do outro eixo — com "até 20s" ligado, "fala da marca" lê `0`. O achado
  saiu do parágrafo e entrou no controle.
- **Contador de pedidos abertos** no item de navegação, para os dois papéis. É o
  único sinal que a cliente tem.
- Campo de senha ganha **mostrar/esconder**.

## Capabilities

### New Capabilities

Nenhuma. Muda de quem a plataforma parece ser, e conserta o que estava medido
errado.

## Impact

- `app/layout.tsx`, `app/(app)/layout.tsx`, todas as sete páginas com título
- `components/auth-shell.tsx` (novo), `app/auth.css` reescrito
- `app/base.css`: tokens `--poco`, `--campo-fundo`, `--linha-campo`,
  `--dado-texto`; `--suave` escurecido; formulário migrado
- `components/nav.tsx`, `components/auth-forms.tsx`, `app/(app)/conteudo/page.tsx`
- `lib/dashboard.ts`: `openRequestCount()`, `postCounts()` com recorte cruzado
- `test/contrast.test.ts`: 50 → 72 testes

## Métricas que isto move

| O que muda | Indicador observável | Como ler |
|---|---|---|
| Contador de pedidos na navegação dela | `request` em aberto | 5 abertos, `request_event` em **zero** — nenhum foi respondido |
| Filtros combináveis no acervo | uso do recorte marca × duração | a casa vazia deixa de depender de acreditar no texto |
| Contraste corrigido | pares reprovando | **0** em Painel, Plano, Conteúdo e Conta, tema claro |
| Formulário de senha legível | — | ela consegue trocar a senha sem pedir ajuda |

## Fora de escopo

- **Atalho do painel para o plano.** O painel remete a Pedidos e não ao Plano,
  que é a tela da ação. Fica registrado.
- **Notificação de verdade para a cliente.** O contador é o mínimo; um aviso de
  entrega nova ou pedido novo continua não existindo, e sem e-mail depende dela
  abrir o app.
- **Bordas de cartão a 3:1.** Só a borda de campo foi corrigida — é ela que
  identifica um controle. As demais seguem como estão.
- Alvo de toque do botão de tema no celular: 31×31px, abaixo dos 44.
