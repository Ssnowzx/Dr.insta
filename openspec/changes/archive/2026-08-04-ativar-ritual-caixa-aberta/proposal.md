## Why

O objetivo do ciclo de 90 dias é engajamento e comunidade, com métrica-norte em taxa de
resposta e retorno de audiência (`perfil/metas.md`). Hoje não existe nenhum ritual
recorrente no perfil: cada publicação é um evento isolado, e não há motivo estrutural para
a mesma pessoa voltar na semana seguinte.

Sem ritual, a interação fica pulverizada — muitas pessoas interagindo uma vez, nenhuma
voltando. Isso é alcance, não comunidade, e é exatamente o que a métrica-norte não mede.

A análise do período de junho (`npm run ig -- exemplo`, 14 posts) mostra comentários por
alcance em 0,60% contra referência de 0,40% do nicho — a base responde quando é chamada.
O gargalo não é disposição da audiência, é ausência de convite recorrente.

## What Changes

Ativação de **dois** rituais semanais fixos, conforme o playbook em
`.claude/skills/instagram-community/references/rituais.md`:

1. **Caixa aberta** — caixa de perguntas em Stories em dia fixo, com tema delimitado, e
   respostas em série no dia seguinte.
2. **Discordância da semana** — um conteúdo semanal com posição contrária ao consenso do
   nicho, convidando discordância de forma explícita.

Dois, e não cinco. A taxa de abandono de ritual novo é alta nas três primeiras semanas; o
valor está em atravessar essa fase, não em ter variedade.

A escolha do par atende aos dois gargalos simultaneamente: "caixa aberta" move taxa de
resposta em Stories (métrica-norte direta) e "discordância" move comentários com
substância, que é o insumo qualitativo de comunidade.

## Capabilities

### New Capabilities
- `rituais-comunidade`: rituais recorrentes de engajamento com cadência fixa, tema
  delimitado e janela de resposta definida, além do registro semanal das métricas que o
  Instagram Insights não exporta.

### Modified Capabilities

Nenhuma. Não há specs anteriores neste projeto.

## Impact

- `perfil/pilares.md` — Pilar 4 (Comunidade) passa a nomear os dois rituais e seus dias fixos.
- `perfil/metas.md` — o painel do ciclo ganha as linhas de contagem manual semanal.
- `.claude/skills/instagram-community/` — nenhuma mudança de código; o playbook já cobre a execução.
- Nenhuma mudança em `src/`. O motor de métricas não lê dados de Stories, que continuam com apuração manual.

## Métrica observável

| Métrica | Baseline | Alvo em 90 dias | Cadência |
|---|---|---|---|
| Taxa de resposta em Stories (respostas ÷ alcance de Stories) | a levantar na semana 1 | +50% sobre o baseline | semanal |
| Comentários com substância (>4 palavras, não emoji puro) | a levantar na semana 1 | +40% sobre o baseline | semanal |
| Rostos recorrentes (pessoas distintas que interagem em 2+ semanas seguidas) | a levantar na semana 1 | crescimento sustentado | semanal |

Critério de abandono explícito: se a taxa de resposta em Stories não subir ao menos 20%
sobre o baseline até a semana 6, a hipótese está errada. Nesse caso, o problema é a
audiência, não o ritual — e a próxima mudança passa a ser estreitar o ICP em vez de
adicionar mais convites.

## Fora de escopo

- **Automação de DM.** Resposta automática produz volume e destrói a relação que o ciclo quer construir.
- **Crescimento de seguidores.** Métrica de acompanhamento neste ciclo, não alvo (`perfil/metas.md`).
- **Integração com a Graph API.** A apuração é manual por decisão de projeto.
- **Os outros três rituais do playbook** (DM da semana, Spotlight, Bastidor fixo). Ficam disponíveis para um ciclo posterior, depois destes dois sobreviverem 90 dias.
- **Mudança no motor de métricas.** Dados de Stories não entram no CSV nesta etapa.
