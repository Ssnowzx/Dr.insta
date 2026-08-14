## 1. Preservar os dados que ela mandou

- [ ] 1.1 ~~Versionar no git~~ — **impossível como escrito**: `dados/metricas/*.csv` está no `.gitignore` por decisão anterior, e dado da cliente não deve ir para o repositório. Os arquivos ficam no disco da VPS; o que entrou no repositório foi a leitura deles, em `perfil/metas.md` e na análise publicada
- [ ] 1.2 Registrar em `dados/metricas/` a nota de leitura: `Seguimentos` acumula desde a publicação, então comparação entre meses sofre viés de idade; comparação por duração e por tema dentro da janela não sofre
- [ ] 1.3 Arquivar os 8 prints de retenção e os 6 de Stories junto, com a tabela de fontes de visualização extraída deles

## 2. Fontes de verdade em texto

- [x] 2.1 `CLAUDE.md` — trocar objetivo dos 90 dias e métrica-norte na tabela de contexto fixo
- [x] 2.2 `CLAUDE.md` — refinar a regra 1: alcance continua sendo o denominador geral, mas conversão em seguidor usa **alcance de não-seguidor**, e toda taxa declara qual usou
- [x] 2.3 `CLAUDE.md` — reescrever "o que não é o gargalo": hoje diz que alcance está resolvido e o problema é comentário; o dado diz que o problema é alcance **de não-seguidor**
- [x] 2.4 `CLAUDE.md` — registrar a troca de 13/08 com a razão e a contagem de ciclos fechados sem leitura
- [x] 2.5 `perfil/metas.md` — substituir objetivo, métrica-norte e painel pelo funil por estágios, com os dois de não-seguidor sem alvo
- [x] 2.6 `perfil/metas.md` — trocar os quatro experimentos pelos novos, em ordem, com janela, variável isolada e critério de sucesso
- [x] 2.7 `perfil/metas.md` — escrever o critério da semana 6 com a tabela de projeções e a frase de que conversão sozinha não fecha 1M
- [x] 2.8 `perfil/pilares.md` — mix revisto: mais 90s+ de opinião (perfume, make, moda, ocasião de uso), institucional fora do feed pessoal, curto mantido como motor de distribuição
- [x] 2.9 `perfil/pilares.md` — registrar a evidência por pilar: 1,026% do vídeo de perfumes contra 0,025% da série institucional
- [x] 2.10 `perfil/perfil.md` — posicionamento premium e objetivo de publicidade, nas palavras dela
- [x] 2.11 `perfil/icp.md` — o que chega no direct e nas respostas de Stories como evidência de demanda ("Amooooo seus videos longosss", "Essa base é perfeitaaaa", pedidos de produto)

## 3. Skills

- [x] 3.1 `instagram-growth` — inverter a descrição: hoje afirma que crescimento é secundário neste ciclo, o que faz a skill se auto-desqualificar no roteador
- [x] 3.2 `instagram-community` — remover a marca de skill prioritária
- [x] 3.3 `instagram-audit` — registrar que auditoria de perfil é o experimento 2 deste ciclo
- [x] 3.4 `instagram-reels` — incorporar o achado de distribuição: retenção alta em vídeo curto não implica descoberta, e descoberta é o que move a métrica-norte
- [x] 3.5 `npm run validar:skills` passando

## 4. Verificação antes de tocar no banco

- [x] 4.1 Conferir em `platform/lib/dashboard.ts` se alguma consulta resolve "a métrica-norte" varrendo `metric_def.tier`; se sim, mudar para ler `cycle.northStarMetric`
- [x] 4.2 Conferir como as telas que leem "o ciclo" (`/`, `/plano`, `/pedidos`) se comportam com **três** ciclos, sendo dois fechados

## 5. Catálogo de métricas

- [x] 5.1 Cadastrar `followers_net_month` (count, up, tier `north_star`), com `description` dizendo que o número é líquido
- [x] 5.2 Cadastrar `follows_reach` e `profile_visits_reach` (ratio, up, tier `decision`)
- [x] 5.3 Cadastrar `nonfollower_reach_share` e `follows_per_nonfollower_reach` com `target: NULL` e `note` explicando que o baseline é a primeira coleta do ciclo
- [x] 5.4 Confirmar que nenhum benchmark novo é cadastrado, e registrar na `note` que os alvos vêm da aritmética da meta, não de referência de nicho

## 6. Ciclo no banco

- [x] 6.1 Fechar o ciclo de engajamento (`state: 'closed'`) com desfecho escrito: encerrado em 13/08/2026 sem leitura, por decisão da cliente, segundo consecutivo
- [x] 6.2 Semear o ciclo novo (`state: 'active'`) com `northStarMetric`, `goal` e `tradeOff` — o trade-off é comentários/alcance descendo a guard-rail e o institucional saindo do feed pessoal
- [x] 6.3 Semear `metric_target`: funil com `contaminated: 0`, guard-rails de conversa com piso no baseline e `contaminated: 1`, e as duas de não-seguidor sem alvo
- [x] 6.4 Semear os quatro `experiment` com posição, janela, variável isolada, `successValue`, `minSample` (7) e `minDays` (14)
- [x] 6.5 Semear os `pillar` do mix novo, marcando o controle com `isControl`
- [x] 6.6 Semear a `delivery` do ciclo com os `step` do experimento 1

## 7. Destravar a medição

- [x] 7.1 Semear o Pedido da aba **Público**: por post, a divisão seguidores × não-seguidores — é o que transforma o achado central de indício em medição
- [x] 7.2 Semear o Pedido de coleta mensal de conta: alcance, visitas ao perfil e seguidores líquidos, da aba Visão geral
- [ ] 7.3 Registrar nos dois Pedidos por que existem e que bloqueiam a leitura dos experimentos
- [x] 7.4 Lançar em `metric_value` os baselines conhecidos: alcance 5.413.754, visitas 347.482, seguidores líquidos 20.824 (jul/2026, `source: 'insights'`) e `follows_reach` 0,060%

## 8. Validação

- [x] 8.1 `npm run validar:tudo` na raiz
- [x] 8.2 `cd platform && npm run lint && npm test` — atualizar os testes que afirmam algo sobre o ciclo ativo ou a métrica-norte
- [x] 8.3 `npm run db:seed` local e conferir que existe exatamente **um** ciclo ativo
- [ ] 8.4 Abrir `/`, `/plano`, `/pedidos` e `/novidades` nos **dois temas** e conferir renderizado, não lido

## 9. Produção

- [ ] 9.1 Deploy e re-seed em `drinsta.xiax.com.br`
- [ ] 9.2 Conferir em produção que o ciclo ativo é o novo e que os dois anteriores aparecem fechados com desfecho
- [ ] 9.3 Confirmar com a Bianca se "até dezembro" é 01/12 ou 31/12, e ajustar os alvos se for 01/12

## 10. Registro

- [ ] 10.1 Arquivar `ativar-ciclo-engajamento-agosto` com o desfecho real: fechado sem leitura, nenhum experimento chegou a rodar
- [ ] 10.2 Atualizar a memória do projeto — ciclo vigente, métrica-norte, o achado de distribuição e a contagem de ciclos encerrados sem leitura
