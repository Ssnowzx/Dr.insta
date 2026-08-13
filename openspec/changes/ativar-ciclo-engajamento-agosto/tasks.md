# Tarefas

## 1. Estratégia (fonte de verdade)

- [x] 1.1 Reescrever `perfil/metas.md` — objetivo, métrica-norte, painel, experimentos, critério de abandono
- [x] 1.2 Reescrever `perfil/pilares.md` — mix Espelho/Conversa/Vale guardar/Personagens, sem obrigação de marca
- [x] 1.3 Atualizar `CLAUDE.md` §2 e `openspec/config.yaml` — os quatro lugares dizem a mesma coisa
- [x] 1.4 Arquivar `ativar-ciclo-conversao-agosto` e `formato-curto-para-produto` com desfecho honesto

## 2. Seed (platform/db/seed.ts)

- [x] 2.1 Resolver ciclos por `(clientId, title)`; autorar o antigo como `closed` (endsOn 2026-08-12) e o novo como `active`
- [x] 2.2 Autorar experimentos do ciclo antigo como `abandoned` com desfecho; arquivar a entrega `cinco-ajustes`
- [x] 2.3 Semear o ciclo novo: 4 pilares, 5 metas (comments/saves/sends/reach/story_replies), 4 experimentos, entrega nova com 5 passos
- [x] 2.4 Estender upserts de `metric_def` e `metric_target` para autorar tudo que o arquivo autora; `comments_reach` → north_star, `tracked_sessions` → monitor com descrição de handoff
- [x] 2.5 Pedidos: existência por `(clientId, title)`; aposentar o pedido da loja (se intocado) com `request_event`; semear as 5 perguntas ligadas ao ciclo novo

## 3. Telas

- [x] 3.1 Painel: substituir a seção do funil pela placa privado × público; excluir métricas de handoff por lista explícita; reescrever as notas de rodapé que citam a loja
- [x] 3.2 Conferir `/plano` e `/pedidos` renderizados com o ciclo novo, nos dois temas

## 4. Testes e validação

- [x] 4.1 Rodar e ajustar os testes da plataforma que tocam seed/painel (nomeados `should ...`)
- [x] 4.2 `cd platform && npm run lint && npm test`; `npm run validar:tudo` na raiz

## 5. Produção

- [x] 5.1 Commit + push; pull na VPS
- [x] 5.2 Backup manual; re-seed em produção; conferir no ar (painel, plano, pedidos, ciclo fechado)

## 6. Memória

- [x] 6.1 Atualizar a memória persistente: novo ciclo, ciclo antigo como histórico, handoff pendente
