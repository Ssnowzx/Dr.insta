## 1. Guard-rails medidos

- [x] 1.1 Ranquear o que a API mede sobre julho fechado, conta inteira
- [x] 1.2 Trocar os quatro pisos; `baselineOn` por alvo, na data que o número descreve
- [x] 1.3 Tirar `contaminated` de salvamentos e comentários
- [x] 1.4 A nota de divergência passa a dizer a amostra — prosa fora do JSX, com teste
- [x] 1.5 `perfil/metas.md`: tabela nova e a decisão de 14/08 registrada como revista

## 2. O total de seguidores

- [x] 2.1 Sondar `GET /me` um campo por chamada, com controles — read-only
- [x] 2.2 `collectProfile`, e a gravação diária com falha engolida
- [x] 2.3 O log do sync diz se leu o total, ou diz que NÃO leu
- [x] 2.4 `metric_def` + alvo de 1M no seed, com a base datada em 20/08
- [x] 2.5 `goalLine` e `daysLeft` com teste — singular, prazo vencido, meta batida,
      ritmo omitido abaixo de 30 dias e sem mês fechado
- [x] 2.6 A linha no topo do painel, conferida renderizada nos dois temas

## 3. A armadilha que o item 2 criou

- [x] 3.1 `latestPeriod`, `metrics` e `funnel` declaram `granularity = 'month'`
- [x] 3.2 Teste de regressão com uma linha de dia mais recente que os meses
- [x] 3.3 Teste da colisão do dia 1º

## 4. O digest parava de dizer a verdade

- [x] 4.1 `ideasMovedSince` lê `audit_log`, não `idea.updatedAt`
- [x] 4.2 O autor da transição passa a ser provado, não presumido
- [x] 4.3 Teste que faz o que um re-seed faz e exige silêncio

## 5. Documentação

- [x] 5.1 `platform/README.md`: a regra da granularidade e o que `contaminated` significa
- [x] 5.2 `perfil/metas.md`: guard-rails, total de seguidores e a decisão revista

## 6. Fica em aberto

- [ ] 6.1 Ler os guard-rails com agosto fechado (01/09) — a primeira leitura em que
      "não caiu" quer dizer alguma coisa
- [ ] 6.2 Fixar a banda de tolerância, com agosto e setembro fechados
- [ ] 6.3 Verificar a bio sozinho, agora que `biography` responde
- [ ] 6.4 Avisar a cliente de que existe coisa nova — o teto de tudo aqui

## 7. O que isto ensina

O mesmo defeito três vezes na mesma noite: **a parte com teste aguentou e a
vizinha sem teste não.** `escolherPeriodo` estava certo e a consulta que o alimenta
não; `porExtenso` estava testado e a nota de divergência ao lado não; o digest tinha
teste para o formato e nenhum para a origem do evento.

E um erro de leitura meu que nenhum teste pegaria: usei a tela de Novidades para
concluir que a cliente estava mexendo na fila de pautas. Era o nosso próprio seed. A
tela é evidência de segunda mão; a tabela que registra ato de pessoa é a de primeira.
