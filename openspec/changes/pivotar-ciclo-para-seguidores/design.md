## Context

Ver `proposal.md — Why` para a motivação, a evidência e a aritmética. O que importa aqui é o estado do sistema no momento da troca.

O banco já carrega **dois** ciclos: `conversao` (`state: 'closed'`, norte "Visitas à loja vindas das suas origens", `seed.ts:748`) e `engajamento` (`state: 'active'`, norte "Comentários por alcance", `seed.ts:784`). Este change acrescenta o **terceiro**, e é o segundo fechamento consecutivo sem leitura.

Quatro restrições moldam a solução:

1. **O norte por ciclo mora em `cycle.northStarMetric`** (varchar), mas `metric_def.tier` (`north_star | decision | monitor`) é **global e único por métrica** — não é por ciclo. Rebaixar `comments_reach` no `metric_def` reescreveria o passado: as telas do ciclo fechado passariam a exibir como "monitor" a métrica que na época era o norte.
2. **`uq_cycle_client_title`** impede reaproveitar a linha de um ciclo trocando o título.
3. **A conexão do Instagram está quebrada desde 13/08/2026** (três tentativas, todas falhando dentro do Instagram). Sem ela não há coleta automática.
4. **O achado central não é medível com o que temos.** A fatia de não-seguidor foi inferida pela aba *Principais fontes das visualizações* em 8 posts. O número direto vive na aba *Público* dos Insights, que ninguém coletou ainda.

## Goals / Non-Goals

**Goals:**

- Que as quatro fontes de verdade — `CLAUDE.md`, `perfil/`, `platform/db/seed.ts` e as descrições das skills — digam a mesma coisa depois da troca
- Que o histórico dos dois ciclos anteriores continue legível **como era na época**, incluindo qual métrica era o norte de cada um
- Que a medição do estágio de não-seguidor esteja resolvida antes do primeiro experimento, e não depois
- Que os 376 posts com `Seguimentos` fiquem no repositório, versionados — é a primeira série histórica da métrica-norte que este projeto teve

**Non-Goals:**

- **Ensinar o motor (`src/`) a calcular o funil.** Nenhuma linha de `src/` muda, nenhuma dependência entra. Ver decisão abaixo
- **Trocar o mecanismo de transição de ciclo.** A capacidade `transicao-de-ciclo-na-plataforma` serve como está
- **Definir alvo para as taxas de não-seguidor.** Sem baseline, alvo é ficção
- Rever o modelo de dados. Tudo cabe nas tabelas existentes

## Decisions

### Fechar o ciclo de engajamento e criar um terceiro, em vez de reescrever a linha ativa

Reaproveitar a linha do ciclo de engajamento está barrado por `uq_cycle_client_title` de qualquer forma. Mas o motivo de não fazer é outro: apagaria o registro de que **dois ciclos seguidos fecharam sem leitura**. Esse é o sinal mais importante que este change produz, e ele só existe se as três linhas coexistirem com desfecho escrito.

Alternativa recusada: manter os dois ativos em paralelo, com dois nortes. Dois nortes é zero norte — a regra de desempate deixa de existir.

### O norte novo entra em `cycle.northStarMetric`; `metric_def.tier` não é rebaixado

`comments_reach` permanece com `tier: 'north_star'` no `metric_def`. O rebaixamento acontece onde é específico do ciclo: `metric_target` do novo ciclo o inclui com alvo igual ao baseline (piso 0,21%), e `cycle.northStarMetric` passa a nomear seguidores líquidos.

Alternativa recusada: mover `comments_reach` para `tier: 'monitor'`. Custo real — as telas do ciclo fechado passariam a apresentá-lo como métrica de monitoramento, quando ele foi o norte declarado de 12/08 a 13/08. O `tier` é classificação do catálogo, não do ciclo.

**Consequência a verificar na aplicação:** com a métrica nova entrando como `north_star`, o catálogo passa a ter duas linhas nesse tier. Qualquer tela que resolva "a métrica-norte" varrendo `metric_def.tier` em vez de ler `cycle.northStarMetric` vai escolher errado — conferir em `lib/dashboard.ts` **antes** do seed.

### Cinco métricas novas no catálogo, duas delas deliberadamente sem alvo

| `metric_key` | unidade | papel |
|---|---|---|
| `followers_net_month` | count | **norte** — seguidores líquidos no mês |
| `follows_reach` | ratio | conversão operacional — seguidores ÷ alcance total |
| `nonfollower_reach_share` | ratio | **sem alvo** — alcance de não-seguidor ÷ alcance |
| `follows_per_nonfollower_reach` | ratio | **sem alvo** — a taxa que realmente decide |
| `profile_visits_reach` | ratio | visitas ao perfil ÷ alcance |

`followers_net_month` é **líquido por definição** e isso vai na coluna `description`: o Insights entrega o número já líquido e ninguém depois consegue saber, olhando a linha, se as perdas foram consideradas.

As duas de não-seguidor entram com `target: NULL` e `note` explicando que o baseline é a primeira tarefa do ciclo. Entram agora, e não depois, porque a tela precisa mostrar o buraco — uma métrica ausente do painel é uma métrica que ninguém lembra de coletar.

Nenhum benchmark novo é cadastrado: não existe referência de nicho com fonte e data para taxa de seguir, e inventar uma quebraria a regra 4 de `CLAUDE.md`.

### O motor não muda, mas o CSV entra no repositório

Os dois CSVs têm colunas que o formato do motor não conhece (`Seguimentos`, `Duração (s)`, `Tipo de post`) e granularidade de conta, não de post-com-alcance-do-Insights. Ensinar o motor a lê-los é um change próprio, com testes, e não cabe aqui.

O que cabe: versionar os arquivos em `dados/metricas/` e deixar a análise exploratória registrada como número no `metric_value`. A série de 376 posts é a primeira medição real da métrica-norte deste ciclo, e perdê-la num diretório temporário seria perder o baseline junto.

### A medição do estágio de não-seguidor vem antes do experimento 1

O achado central — 1,0–4,2% de descoberta no longo contra 77,8–83,5% no curto — vem de 8 prints, inferido por fonte de tráfego. A aba *Público* dos Insights dá o número direto por post, e ninguém o coletou.

Decisão: **a coleta é o passo zero do ciclo**, como Pedido na plataforma, junto com a coleta mensal de conta. Sem ela o experimento 1 roda 21 dias e termina medindo um proxy contra outro proxy — que é como os dois ciclos anteriores morreram.

Trade-off aceito: isso adiça trabalho manual dela em cima de um Pedido que ela já respondeu hoje. A alternativa é rodar o ciclo inteiro sobre uma inferência de 8 pontos.

## Risks / Trade-offs

**O achado central pode não sobreviver à medição direta** → 8 prints, fatia inferida. Se a aba *Público* mostrar que os longos alcançam mais estranhos do que a fonte de tráfego sugere, o experimento 1 muda de hipótese. Por isso a medição é o passo zero e os alvos de não-seguidor entram sem número.

**`Seguimentos` acumula desde a publicação** → post velho teve mais tempo para somar. Isso infla março contra agosto, e a queda mensal de 0,105% para 0,056% pode ser em parte idade, não deterioração. As comparações **por duração e por tema dentro da mesma janela** não sofrem disso, e são as que sustentam as decisões deste change. A leitura mensal precisa dizer isso em voz alta.

**A meta pode não ser alcançável em 140 dias** → Declarado desde o primeiro dia que conversão sozinha não fecha, com a tabela de projeções. Critério aritmético na semana 6.

**Crescer seguidor destruindo a conversa** → Guard-rails com piso no baseline medido. Se comentários/alcance cair >25% por 3 semanas, o mix é revisto e o custo entra no relatório.

**Zerar o formato curto derruba a distribuição** → O 1–10s carrega 39% do alcance e é o que alcança estranho. O experimento 3 o corrige, não o elimina; o guard-rail de alcance pega o excesso de realocação.

**Terceiro ciclo encerrado sem leitura** → A spec `alvo-declarado-pela-cliente` obriga a contagem a ser reportada, para que o diagnóstico não dependa de alguém lembrar.

**Duas linhas com `tier: 'north_star'`** → Conferir `lib/dashboard.ts` antes do seed.

## Migration Plan

1. Versionar os dois CSVs em `dados/metricas/` com data e procedência
2. Atualizar `CLAUDE.md` (incluindo a regra 1, do denominador), `perfil/metas.md`, `perfil/pilares.md`, `perfil/perfil.md`, `perfil/icp.md` — todas precisam concordar antes de tocar no banco
3. Inverter a prioridade nas descrições de `instagram-community` e `instagram-growth`
4. Conferir `lib/dashboard.ts` quanto à resolução do norte por `tier`
5. `seed.ts`: fechar o ciclo de engajamento com desfecho, cadastrar as cinco métricas, semear ciclo/pilares/alvos/experimentos/entrega/passos e os dois Pedidos de coleta
6. `npm run validar:tudo` na raiz; `cd platform && npm run lint && npm test`
7. Abrir as telas afetadas nos **dois temas** antes de dar por pronta
8. Deploy e re-seed em produção

**Rollback:** reativar o ciclo de engajamento (`state: 'active'`) e voltar o novo para `draft`. Nenhuma migração de esquema é executada.

## Open Questions

- **01/12 ou 31/12?** Muda os números do painel, não a estrutura nem as tarefas. Confirmar na primeira interação; até lá vale a suposição declarada
- **Orçamento para tráfego pago.** Fora de escopo por ora. Se a semana 6 declarar a meta morta no orgânico, esta vira a primeira pergunta
