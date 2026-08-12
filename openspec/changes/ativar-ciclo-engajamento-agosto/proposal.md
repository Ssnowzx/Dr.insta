## Why

Em 12/08/2026 a cliente redirecionou o trabalho: o perfil pessoal (@bianca.olivo) é dela — a relação com a loja e o e-commerce ficam com a equipe própria da My Favorite. O ciclo "caminho até a compra" (04/08) foi superado antes da leitura, e a não-execução do plano tem leitura estratégica: dos 5 ajustes, nenhum dos 2 verificáveis foi feito, e os 3 posts publicados desde a análise não mencionam a marca. A cliente estava votando com os pés — estratégia que a cliente não executa não é estratégia.

O objetivo declarado por ela — "engajamento" — tem alvo honesto nos dados: os únicos dois sinais de engajamento abaixo da referência do nicho são **comentários/alcance (0,21% contra 0,50%)** e **saves/alcance (0,23% contra 1,40%)**. Todo o resto (alcance 5,4M/mês, sends/reach 1,32%, 22 mil respostas de Stories) está na média ou acima. E há evidência prévia da aposta: o Reel do DOJI (05/08) alcançou 35% da mediana e fez 3,0 comentários por mil views — quase o triplo dos vizinhos.

## What Changes

- **BREAKING** — objetivo do ciclo de 90 dias passa de "caminho até a compra" para **engajamento do perfil dela**; métrica-norte passa de sessões rastreadas no GA4 para **comentários por alcance**. O ciclo anterior fecha sem leitura (registrado no desfecho de `2026-08-12-ativar-ciclo-conversao-agosto`)
- Novo mix editorial: **Espelho 50% (controle) / Conversa 20% / Vale guardar 20% / Personagens 10%** — nenhum pilar existe para servir a My Favorite; a marca só aparece como escolha dela, na voz dela
- Quatro experimentos com **ordem obrigatória**: pauta de conversa → resposta na 1ª hora → utilidade na voz dela → colab mensal (só no 3º mês)
- Alcance e views viram **guard-rail** (≥ 5,4M/mês; queda >25% por 3 semanas vira assunto), não alvo
- A relação perfil→loja (UTM, link, receita, conversão, voz de marca, formato curto de produto) vira **material de handoff** para a equipe da My Favorite
- A plataforma reflete a transição: ciclo antigo fecha **congelado** no banco, ciclo novo é semeado com pilares/metas/experimentos/passos próprios, e as **perguntas que calibram o ciclo viram Pedidos** que a Bianca responde no app

## Capabilities

### New Capabilities

- `ciclo-engajamento-perfil`: como o perfil converte atenção em conversa pública e recorrente — métrica-norte, mix, experimentos em ordem, guard-rails e critérios de abandono
- `transicao-de-ciclo-na-plataforma`: como uma troca de ciclo chega à cliente — fechamento congelado do ciclo anterior, semeadura do novo e perguntas de calibração respondíveis no app

### Modified Capabilities

Nenhuma. `openspec/specs/` está vazio — não há spec principal publicada.

## Impact

- `CLAUDE.md`, `perfil/metas.md`, `perfil/pilares.md`, `openspec/config.yaml` — já atualizados em 12/08/2026; os quatro dizem a mesma coisa
- `platform/db/seed.ts` — fecha o ciclo antigo, semeia o novo (cycle, pillar, metric_target, experiment, delivery, step, request); o upsert de `request` precisa deixar de ser só-se-vazio
- Telas da plataforma que leem o ciclo ativo (`/`, `/plano`, `/pedidos`) — verificar como resolvem "o ciclo" com dois ciclos no banco
- Produção (drinsta.xiax.com.br) — re-seed após deploy
- Sem impacto em `src/` — o motor de métricas não muda

## Fora de escopo

- **A entrega do handoff ao time da My Favorite.** O material está identificado (diagnóstico de conversão, UTM correta, redirect `/bia` na VTEX, restrição de formato curto para produto); o canal e o momento são decisão do usuário
- **Crescimento e captação de seguidores.** Segue métrica de vaidade; colab mensal só entra nos dias 61–90 e com a conversa já segurando
- **Medição de retorno da mesma pessoa por API.** O escopo de comentários foi deliberadamente recusado no app da Meta; enquanto for manual, a leitura é qualitativa e quinzenal
- **Recalibração após as respostas dela.** As perguntas no app podem mudar alvo e pesos; isso será uma revisão do ciclo, não este change
