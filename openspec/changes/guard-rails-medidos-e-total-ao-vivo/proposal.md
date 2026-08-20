## Why

Duas coisas foram descobertas em 20/08/2026, e as duas estavam em produção há
semanas parecendo certas.

### Os quatro guard-rails do ciclo não podiam ser cruzados

Os pisos de `sends_reach`, `saves_reach`, `comments_reach` e `reach` vinham de um
print de julho com **amostra de 6 Reels** — abaixo do mínimo de 7 posts que é a
regra 3 deste projeto — enquanto as taxas descrevem a conta inteira. Somava-se a
isso um denominador montado post a post, que conta duas vezes quem viu dois posts.

Os dois erros empurram para o mesmo lado:

| Guard-rail | Piso (print, n=6) | Medido pela API (julho fechado) | Gap |
|---|---:|---:|---:|
| Compartilhamentos/alcance | 1,32% | **5,45%** | 4,1× |
| Salvamentos/alcance | 0,23% | **0,74%** | 3,2× |
| Comentários/alcance | 0,21% | **0,32%** | 1,5× |
| Alcance | 5.413.754 | **5.584.671** | 1,03× |

E o valor exibido no cartão já era o da API. O painel comparava leitura de API
contra piso de print: os compartilhamentos podiam cair pela metade e o cartão
continuaria dizendo "não caiu". **Um piso que não dá para cruzar é decoração** —
e este guardava o sinal de distribuição que sustenta o alcance do ciclo.

Isso derruba uma decisão registrada em `perfil/metas.md` ("o baseline da tabela
fica como está"), cujo receio era que trocar a régua no meio do ciclo fizesse o
"não cair" parecer cumprido por mudança de fonte. O receio é legítimo e se
inverte aqui: a régua nova **aperta** o guard-rail.

### O produto nunca perguntou à conta quantos seguidores ela tem

Toda cifra de seguidor que este produto já mostrou descrevia um **mês fechado**.
No dia 20 de agosto o painel respondia uma pergunta sobre julho, enquanto a meta
que a cliente declarou tem data — 1 milhão até dezembro — e nenhuma tela dizia a
que distância isso estava hoje.

`GET /me` nunca havia sido chamado. A sonda `scripts/probe-profile-fields.ts`
(um campo por chamada, `user_id` e `username` de controle) confirmou contra o
token real que **`followers_count` e `biography` respondem** sob o escopo já
ativo.

## What Changes

- **Os quatro pisos passam a vir da API**, sobre mês fechado, com `baseline_on`
  na data que o número descreve e não na data em que foi transcrito.
- **Sem margem de conforto**, declarado: um mês fechado não diz qual é o ruído
  normal da conta, e uma folga inventada silencia o alarme.
- **`contaminated` sai** de salvamentos e comentários.
- **A nota de divergência passa a dizer o tamanho da amostra** da leitura
  perdedora — duas taxas que discordam 4× são duas populações, não duas opiniões.
- **`followers_total` é coletado 5×/dia** e gravado com granularidade `day`.
- **O painel abre com a distância até a meta**, em prosa testada.
- **Toda consulta que significa "o mês" passa a declarar `granularity = 'month'`.**
- **O digest deixa de ler `idea.updatedAt`** e passa a ler `audit_log`.

## Fora de escopo

- Verificar a bio sozinho, agora que `biography` responde. É a próxima peça e
  encosta em `step.verify_key`, que tem regra própria.
- Avisar a cliente de que existe coisa nova. É o teto de tudo aqui e não é uma
  tela: o produto não envia e-mail nem notificação.
- Uma banda de tolerância para os guard-rails. Só existe com dois meses fechados.

## Impact

- `platform/db/seed.ts` — pisos, `baselineOn` por alvo, `followers_total`, o alvo
  de 1M, e o pedido do TikTok
- `platform/lib/instagram/collect.ts` e `sync.ts` — `collectProfile`, gravação
  diária, o total no log
- `platform/lib/dashboard.ts` — `followerGoal`, e `granularity` em três consultas
- `platform/lib/goal.ts` — a prosa da distância até a meta
- `platform/lib/pautas.ts` e `digest.ts` — transições lidas do audit log
- `platform/components/metric-bar.tsx` — a amostra na nota de divergência
- `perfil/metas.md` — tabela de guard-rails e a decisão revista
