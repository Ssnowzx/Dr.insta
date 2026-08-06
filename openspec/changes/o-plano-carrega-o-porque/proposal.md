## Why

O plano chegava para a cliente como cinco tarefas. O raciocínio que produziu as
cinco — qual pilar cada uma serve, quanto da semana ele deve ocupar, qual
métrica ele move e que resultado o resolveria — vivia em `perfil/pilares.md`,
um arquivo que ela nunca abriu.

**Uma lista de tarefas sem o argumento é uma lista que só dá para obedecer ou
ignorar.** Ela não tem como discordar, e discordar é a parte que torna o plano
dela. Em 06/08/2026, dez dias depois de entregue, `step_status` tinha zero
linhas: nenhuma das cinco foi marcada.

**E a etapa mais barata deu errado do jeito mais silencioso.** A etapa `a1`
mandava trocar o link da bio por um com etiqueta, explicava por que importava
— e não entregava o link. Ela colou alguma coisa. Medido no perfil dela no
mesmo dia: a bio passou a carregar `utm_source` e `utm_medium` **sem nenhum
traço do nome dela em nenhum dos dois**, o que credita a visita a "Instagram,
bio" — o mesmo balde onde cai o tráfego do @myfavorite.oficial, que também tem
link na bio. O link funciona, a loja abre, nada parece quebrado, e o GA4
continua sem saber que a visita veio dela.

**E o preço do plano não estava escrito em lugar nenhum.** A realocação troca
alcance por chegada: Provador e Padrão não fazem os 2 milhões de views que o
humor faz. Nas primeiras semanas a queda é a única metade visível dessa troca.
Não combinada antes, a leitura óbvia é "estraguei" — e a volta atrás acontece
uma semana antes da janela de leitura fechar.

## What Changes

- **Os quatro pilares entram no produto.** Nova tabela `pillar`, escopada ao
  **ciclo** e não à cliente: um pilar é uma aposta com prazo, e quando o ciclo
  fecha dá para perguntar se pagou em vez de editar a história.
- O mix aparece em `/plano` **antes** dos cinco ajustes, com barra empilhada,
  ritmo semanal, evidência, métrica que move e critério de leitura.
- `is_control` marca o Espelho. É o pilar que **não** pode mexer: sem a marca,
  a tela apresentaria como alvo justamente o que sustenta a conta hoje.
- **O trade-off vira dado** — `cycle.trade_off` — e aparece junto do mix que o
  causa. O painel aponta para ele ao lado da série de views; repetir o texto nas
  duas telas garantiria divergência.
- **A etapa entrega o valor**, não a descrição dele: `step.copy_value` +
  `copy_label`, com o link montado e um botão de copiar. O valor fica **sempre
  na tela**, não só no clipboard — `navigator.clipboard` exige contexto seguro e
  falha calado.
- `step.copy_note` responde a objeção que a cliente levantou ("fica comprido e
  feio no perfil") com o que foi medido, e impede a correção errada: encurtar
  antes do redirect existir põe um 404 na bio dela.
- **O seed volta a aplicar o que edita.** `onDuplicateKeyUpdate` atualizava um
  campo só; corrigir texto no arquivo imprimia sucesso e não mudava o banco.
  Regra escrita no código: **o que o seed autora, o seed sobrescreve.**

## Impact

- Migrações `003-pillars-and-copy-value.sql` e `004-copy-note.sql`
- Tabela nova: `pillar`. Colunas novas: `cycle.trade_off`, `step.copy_value`,
  `step.copy_label`, `step.copy_note`
- `lib/dashboard.ts`: `pillars()`; `CycleSummary` e `StepRow` crescem
- `components/copy-value.tsx` (novo), `app/(app)/plano/page.tsx`,
  `app/(app)/page.tsx`
- `db/seed.ts`: quatro pilares, o trade-off, o link, e os upserts corrigidos

## Métricas que isto move

| O que muda | Métrica observável | Como ler |
|---|---|---|
| Pilar Provador entra no mix (25%) | **`saves/reach`** | 0,23% → alvo 0,8%, em 14 dias e ≥ 7 posts |
| Pilar Padrão entra (15%) | **`sends/reach`** | ≥ 1,6% sem retenção cair abaixo de 40% |
| Espelho preservado como controle (50%) | **`sends/reach`** | **não piorar** — se cair, a realocação foi longe demais |
| Link com etiqueta correta na bio | **sessões rastreadas/mês** | origens `influencer/bianca-olivo` no GA4, hoje creditadas como tráfego direto |
| Plano com o porquê e o valor pronto | `step_status` | hoje **zero** de cinco marcados |

## Fora de escopo

- **Classificar os 205 posts por pilar.** `post.pillar` continua NULL, e por
  isso o acervo não ganha filtro por pilar: filtrar por uma coluna vazia não
  mostra nada. Fica para quando houver critério de classificação.
- **O redirect curto na loja.** `myfavorite.com.br/bia` resolveria a objeção da
  cliente de vez, mas depende de um ajuste na VTEX que não é feito daqui. Os
  três caminhos foram verificados livres (404); o texto no app avisa para não
  encurtar antes disso.
- **UI de escrita para o consultor.** Criar pilar, ciclo ou pedido continua
  passando por `db/seed.ts`. É o gargalo maior do produto e merece mudança
  própria.
- Corrigir o padrão de upsert nas demais tabelas do seed. Foi corrigido em
  `cycle`, `step` e `pillar` — as que esta mudança toca.
