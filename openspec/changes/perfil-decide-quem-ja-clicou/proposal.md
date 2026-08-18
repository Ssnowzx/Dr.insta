## Why

Em 18/08/2026, sondando `GET /{media-id}/insights` uma métrica por vez
(`platform/scripts/probe-media-metrics.ts`), ficou estabelecido que a restrição da
API não é a métrica nem a superfície isoladamente, mas **o par**:

| Superfície | `follows` · `profile_visits` · `profile_activity` | `ig_reels_avg_watch_time` · `..._total_time` |
|---|---|---|
| **FEED** | respondem | 400 |
| **REELS** | 400 | respondem |

`reach` e `views` responderam nas duas e serviram de controle — é isso que torna o 400
um veredito sobre a métrica, e não sobre a chamada.

### O que isso destravou

O ciclo "Quem te vê, te segue" tem **dois** degraus, e até hoje só o primeiro e o
último estavam medidos. O do meio nunca foi olhado.

Sete posts de feed dos últimos 30 dias, coletados por API:

| | valor | taxa |
|---|---:|---:|
| Alcance somado | 881.171 | — |
| Visitas ao perfil | 4.386 | **0,50%** do alcance |
| Seguidores | 257 | **5,86%** das visitas |

E a conta inteira em julho, por dois números que já estavam no banco:
20.824 seguidores líquidos ÷ 347.482 visitas ao perfil = **5,99%**.

**Duas medições independentes, no mesmo mês, no mesmo número.** De cada 100 pessoas
que abrem o perfil dela, 6 seguem. As outras 94 viram bio, foto, destaques e os três
posts fixados, e foram embora.

### A aritmética que isso impõe

A 6%, os 62.200 seguidores/mês da meta exigem **1,04 milhão de visitas ao perfil por
mês** — 3× as 347 mil de hoje. Ou a taxa sobe, ou as visitas sobem, ou os dois.
O `CLAUDE.md` já dizia que 1M só fecha com "conversão 3–4× somada a um evento de
escala por mês"; o que faltava era **onde** os 3–4× têm de acontecer. É na tela do
perfil, não no post.

### O defeito que a medição expôs

O experimento 2 do ciclo — "Perfil como página de decisão" — declarava sucesso como
*"de cada 100 que abrem o perfil, 9 seguem"* e media `profile_visits_reach`, que é
visitas ÷ **alcance**: o degrau anterior. Em julho os dois estavam perto de 6%, então
a discrepância lia como correta na tela e leria como correta no fechamento.

### O que a auditoria de perfil achou (47/100)

- Os três posts **fixados** são a coleção da marca (6.134 curtidas), uma viagem
  (18.023) e uma **publi** (5.820). Os dois de marca são os menos curtidos dos doze
  posts recentes. O "kinda chic" — 28.324 curtidas, 212 seguidores, 3.074
  compartilhamentos — **não está fixado**.
- A **bio** tem duas linhas: o cargo dela na empresa e um e-mail de assessoria.
  Nenhuma das três perguntas do teste dos 3 segundos é respondida.
- São **49 destaques**, e os quatro primeiros são cidades.
- **O conteúdo é o bloco mais forte (24/30) e não se mexe.** Ela já publica Reels
  longos — 62s, 103s, 114s, 115s, 180s, 210s nos mais recentes — desde antes de
  qualquer roteiro nosso chegar.

### O quadro que ela inventou e converte

O carrossel "kinda chic" (10/08) alcançou 459.039 e trouxe **212 seguidores** —
0,046%, contra uma mediana de **8 seguidores** (0,013%) nos outros seis posts de feed
do mês. São frases de posição dela sobre fotos dela: "acho chic dizer não sem escrever
textão", "acho chique priorizar sua paz". Sem produto, sem marca.

É a **única pauta do ciclo com conversão medida por dentro do Instagram** e não
deduzida. O quadro fixo de domingo era "Trabalhar com a sua própria família", inferido
de uma fala dela em 13/08.

## What Changes

- **Coleta:** `post.follows` e `post.profile_visits` (migração 013), lidos por API nos
  posts de feed. Métricas do funil viajam em requisição própria e engolem a própria
  falha.
- **Métrica nova:** `follows_per_visit`, derivada na leitura, com alvo de 9% herdado do
  experimento 2 — não inventado aqui.
- **Correção:** o experimento 2 passa a medir `follows_per_visit`, que é o que a frase
  dele sempre descreveu.
- **Painel:** o funil volta com três degraus — alcance → visitas → seguidores — dentro
  da placa, e não mais terminando na loja.
- **Plano:** três etapas novas sobre o perfil (fixados, bio, destaques). As três antigas
  não mudam, e o título da entrega diz isso.
- **Pilar Personagens:** o quadro de domingo passa a ser "kinda chic". Os roteiros da
  família ficam no banco, sem data.

## Fora de escopo

- **Reels.** A API recusa `follows` ali, e é a superfície onde o ciclo roda. Conversão
  em Reel continua vindo de número digitado, via `post.non_follower_pct`.
- **Reels de teste (trial).** Se aparecem ou não na API é pergunta em aberto: só fecha
  rodando a sonda num dia com teste ativo. Mesmo que apareçam, o número do teste some
  na promoção, quando o post passa a somar teste + perfil.
- **A relação perfil→loja.** Continua com a equipe da My Favorite desde 12/08/2026.
- **Reescrever a bio no Instagram.** A plataforma entrega o texto pronto para colar; a
  decisão de manter ou não a menção à marca é dela.

## Impact

Métrica observável: **`follows_per_visit`** — baseline 5,99% (jul/2026), alvo 9%,
leitura mensal. Guard-rail: `profile_visits_reach` não pode cair de 6,42% enquanto a
outra sobe, senão a conta trocou um degrau pelo outro.

Prazo de leitura: 14 dias após as três etapas de perfil serem marcadas como feitas.
Antes disso não há leitura — a mudança é no perfil e o efeito aparece no mês.
