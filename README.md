# Myfavorite

Sistema de estratégia e análise de Instagram operado por Claude Code.

Combina **Agent Skills** (padrão Anthropic) com um **motor de métricas em TypeScript** e
**memória de decisões** via OpenSpec. As skills trazem julgamento estratégico; o motor
traz os números; o OpenSpec guarda o que foi decidido e o que aconteceu depois.

**Configuração atual:** conta única · nicho Negócios/Marketing · objetivo de 90 dias em
engajamento e comunidade · dados por entrada manual/CSV.

---

## Instalação

Requer Node.js >= 20.19.

```bash
npm install
npm install -g @fission-ai/openspec@latest   # memória de decisões
npm run validar:tudo                          # confere que tudo está de pé
```

## Uso rápido

```bash
npm run ig -- exemplo                                    # smoke test com dados fictícios
npm run ig -- analisar dados/metricas/junho.csv          # diagnostica um período
npm run ig -- comparar dados/metricas/mai.csv dados/metricas/jun.csv
```

Dentro do Claude Code:

| Comando | O que faz |
|---|---|
| `/ig-diagnostico` | Roda o motor e entrega o gargalo com uma ação |
| `/ig-semana` | Plano de conteúdo da próxima semana |
| `/ig-relatorio` | Relatório do período e definição do próximo ciclo |
| `/ig-perfil` | Preenche/revisa o contexto do perfil |
| `/opsx:propose` | Registra uma decisão estratégica na memória |
| `/opsx:archive` | Fecha uma decisão registrando o que aconteceu |

## Estrutura

```
CLAUDE.md              Persona do estrategista + regras do projeto
perfil/                Contexto vivo: posicionamento, ICP, voz, pilares, metas
.claude/skills/        9 Agent Skills de Instagram (+ 5 do OpenSpec)
.claude/commands/      Slash commands
src/dominio/           Lógica pura: métricas, benchmarks, diagnóstico, relatório
src/infra/             I/O: parser de CSV, CLI, validador de skills
test/                  Vitest — 156 testes, padrão AAA
dados/exemplos/        CSV de exemplo versionado
dados/metricas/        Seus CSVs reais (fora do git)
openspec/              Memória: specs, mudanças em curso, arquivo
```

### As skills

| Skill | Para quê |
|---|---|
| `instagram-strategy` | Roteia o pedido e monta plano de 30/60/90 |
| `instagram-metrics` | Interpreta números e diagnostica |
| `instagram-audit` | Auditoria de perfil com scorecard 0-100 |
| `instagram-community` | ★ Engajamento, rituais, DM, Stories — foco do ciclo |
| `instagram-content-engine` | Pilares, banco de pautas, calendário |
| `instagram-copywriting` | Hooks, legendas, CTAs, carrosséis |
| `instagram-reels` | Roteiro, retenção, os 3 primeiros segundos |
| `instagram-growth` | Alcance de não-seguidores, colabs, SEO interno |
| `instagram-report` | Relatório periódico e fechamento de ciclo |

## Formato do CSV

Obrigatórias: `data`, `formato`, `alcance`.
Opcionais: `id`, `pilar`, `legenda`, `curtidas`, `comentarios`, `salvamentos`,
`compartilhamentos`, `retencao_media`, `alcance_nao_seguidores`, `visitas_perfil`,
`cliques_link`.

O parser aceita cabeçalhos em português e inglês, separador `,` `;` ou tab, números em
formato BR (`1.234,5`) ou EN, e datas ISO ou `DD/MM/AAAA`. Linhas inválidas viram avisos
sem derrubar a análise. Modelo em `dados/exemplos/posts-exemplo.csv`.

## A regra que organiza o sistema

**Toda taxa é normalizada por alcance, nunca por seguidores.** Engajamento sobre seguidores
mede duas coisas ao mesmo tempo — qualidade do conteúdo e proporção da base alcançada — e
por isso não mede nenhuma. Alcance é a base que o algoritmo usa para ranquear e a única
comparável entre contas de tamanhos diferentes.

A hierarquia de sinais que o sistema assume: **watch time → sends/reach → likes/reach**.
Compartilhamento em DM pesa muito mais que curtida para distribuição, porque custa capital
social e é difícil de falsificar.

## Desenvolvimento

```bash
npm test                # 156 testes
npm run test:cobertura  # cobertura (mínimo 80%; atual ~98%)
npm run lint            # tsc --noEmit
npm run validar:skills  # frontmatter das skills contra a Agent Skills Spec
npm run validar:tudo    # tudo acima + openspec validate
```

Padrões: TypeScript strict, ESM, zero dependências de runtime, arquivos em
`lowercase-com-hífen`, tipos em `src/tipos/index.ts`, testes no padrão AAA.
`src/dominio/` é puro (sem I/O, sem `Date.now()` implícito); `src/infra/` faz I/O.

## Variáveis de ambiente

Nenhuma. O sistema opera inteiramente sobre arquivos locais.

## Referências

- [Agent Skills Specification](https://agentskills.io/specification)
- [anthropics/skills](https://github.com/anthropics/skills) — padrão de autoria e `skill-creator`
- [Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec) — memória de decisões
- Benchmarks e fontes: `src/dominio/benchmarks.ts`
