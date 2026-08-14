## 1. Banco

- [x] 1.1 Migração `008`: tabela `delivery_section` com `delivery_id`, `position`, `title`, `body`, `highlight`, `highlight_label`
- [x] 1.2 Índice por `(delivery_id, position)` e chave estrangeira com o mesmo `ON DELETE` das irmãs
- [x] 1.3 `db/schema.ts` — a tabela nova, com o comentário de por que `highlight` é texto e não decimal

## 2. Consulta

- [x] 2.1 `deliveries()` — `innerJoin(step)` vira `leftJoin`, e a montagem aceita entrega com zero etapas
- [x] 2.2 Teste: entrega publicada sem etapa aparece na listagem
- [x] 2.3 Teste: entrega com etapas continua montando as etapas na ordem
- [x] 2.4 `readingDeliveries()` — as entregas de leitura publicadas com suas seções, na ordem
- [x] 2.5 `northStarProgress()` — série mensal da métrica-norte do ciclo, com baseline e alvo vindos de `metric_target`

## 3. Não quebrar o plano

- [x] 3.1 `/plano` filtra entregas sem etapa, explicitamente e com a razão escrita
- [x] 3.2 Conferir renderizado que o plano segue igual antes de qualquer entrega de leitura existir

## 4. A tela

- [x] 4.1 Rota `/analise` — entregas de leitura publicadas, mais recente primeiro
- [x] 4.2 Blocos: título opcional, corpo, e o destaque com ênfase própria
- [x] 4.3 A data do dado no topo, no padrão de `DataAge` que `/conteudo` já usa
- [x] 4.4 A progressão: série mensal, baseline marcado, alvo declarado
- [x] 4.5 A distância até o alvo **em texto**, não só em cor ou barra
- [x] 4.6 Estado vazio: sem histórico, dizer o que falta medir em vez de desenhar nada
- [x] 4.7 Item no menu lateral e na barra inferior

## 5. O conteúdo

- [x] 5.1 Semear a análise de 13/08: o achado primeiro — 41× entre o vídeo de perfume e a série institucional
- [x] 5.2 O bloco da distribuição: 1% das visualizações vêm de Explorar e Aba Reels no longo, contra 80% no curto
- [x] 5.3 O bloco da amostra e da ressalva: 376 posts, e que `Seguimentos` acumula desde a publicação
- [x] 5.4 O bloco final — **o que muda no que ela faz**, sem o qual a entrega não se publica

## 6. Validação

- [x] 6.1 `npm run lint && npm test`
- [x] 6.2 Abrir `/analise` nos **dois temas** e nos **dois papéis**
- [x] 6.3 Medir de 320px a 520px, como nas outras telas
- [x] 6.4 Conferir que `/plano` não mudou

## 7. Produção

- [ ] 7.1 Deploy, migração `008` e re-seed
- [ ] 7.2 Conferir a análise no ar, na conta dela
