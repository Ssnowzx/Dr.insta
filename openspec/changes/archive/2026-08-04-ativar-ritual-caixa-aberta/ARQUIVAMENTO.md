# Arquivamento — 04/08/2026

## O que aconteceu com a métrica

**Nada.** A mudança nunca saiu do papel: 0 de 31 tarefas executadas, nenhum ritual ativado,
nenhum dado colhido. Não há resultado a reportar — nem sucesso nem fracasso de execução.

O que falhou foi a **premissa**, antes da execução.

## Por que a premissa caiu

A proposta partia de que o gargalo do perfil era falta de comunidade e de convite recorrente
à interação. Duas coisas derrubaram isso:

**1. A evidência usada não era da cliente.** A seção "Why" cita `npm run ig -- exemplo` —
14 posts do CSV de exemplo versionado do projeto, não do perfil da @bianca.olivo. O número que
sustentava a proposta (comentários/alcance de 0,60% contra referência de 0,40%) descreve dados
fictícios.

**2. Os dados reais dizem o contrário.** Os Insights de 04/07 a 03/08/2026, recebidos em
03/08/2026, mostram interação em nível alto:

| Métrica | Real (jul/2026) | Referência lifestyle |
|---|---:|---:|
| Contas alcançadas (30d) | 5.413.754 | — |
| Compartilhamentos em Reels | 284 mil | — |
| Respostas em Stories | 22 mil | — |
| Seguidores líquidos | +20.824 | — |
| Curtidas/alcance | 7,73% | 8,00% |
| Compartilhamentos/alcance | 1,32% | 1,60% |
| Comentários/alcance | 0,21% | 0,50% |

A audiência responde, compartilha e volta. O gargalo real está **depois** da interação:

| Métrica | Real | Referência | Leitura |
|---|---:|---:|---|
| **Salvamentos/alcance** | **0,23%** | **1,40%** | crítico |
| Conversão do canal no e-commerce | 0,29% | — | 7.976 sessões, 23 transações |
| Toques no link da bio (30d) | 0 | — | não havia link na bio |

Fonte: `dados/bianca-olivo-2026-07/INDICE.md`.

## Consequências

- Objetivo do ciclo trocado de **"engajamento e comunidade"** para **"caminho até a compra"**,
  com métrica-norte em sessões rastreadas/mês no GA4. Registrado em `CLAUDE.md`,
  `perfil/metas.md` e `openspec/config.yaml`.
- O pilar "Comunidade" que esta mudança alimentaria não existe mais em `perfil/pilares.md`.
  O mix passou a ser Espelho / Provador / Padrão / Bastidor.
- "Discordância da semana", um dos dois rituais propostos, é formato de conta de negócios e
  não conversa com o que funciona neste perfil — os Reels de maior desempenho são cenas de
  cotidiano de 9 a 13 segundos.
- As tarefas 1.1 a 1.4 (preencher `perfil/`) foram concluídas em 04/08/2026 por outro caminho,
  fora desta mudança.

## Delta spec

**Não sincronizada, por decisão.** Os 7 requisitos em `specs/rituais-comunidade/spec.md`
descrevem rituais que nunca foram ativados. Promovê-los a spec principal registraria como
comportamento vigente do projeto algo que nunca existiu. `openspec/specs/` segue vazio.

## O que aproveitar daqui

Duas ideias da proposta original continuam boas e podem voltar noutro contexto:

1. **Limite de dois rituais simultâneos.** A taxa de abandono de ritual novo é alta nas três
   primeiras semanas; o valor está em atravessar essa fase, não em ter variedade.
2. **Proibição de engagement bait.** Continua valendo — comentário "🔥" não é comunidade.

O playbook em `.claude/skills/instagram-community/references/rituais.md` segue disponível se o
objetivo do ciclo voltar a ser comunidade.
