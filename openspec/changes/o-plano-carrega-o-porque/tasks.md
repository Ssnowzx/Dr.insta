> **Estado: implementado e verificado em 06/08/2026.** Nasce marcado porque a
> mudança foi construída antes de ser registrada. É relato, não lista a fazer.

## 1. Os pilares viram dado

- [x] 1.1 Migração `003-pillars-and-copy-value.sql` com a tabela `pillar`, escopada ao ciclo
- [x] 1.2 `UNIQUE (cycle_id, pillar_key)` — o mesmo pilar não existe duas vezes no ciclo
- [x] 1.3 `is_control` para o pilar que não pode mexer
- [x] 1.4 `metric_key` como texto e sem FK, com o motivo escrito na migração
- [x] 1.5 `share_pct` sem CHECK de soma, com o motivo escrito
- [x] 1.6 Modelo Drizzle em `db/schema.ts`
- [x] 1.7 Os quatro pilares no seed, a partir de `perfil/pilares.md`

## 2. O mix na tela

- [x] 2.1 `pillars()` em `lib/dashboard.ts`, com LEFT JOIN em `metric_def`
- [x] 2.2 Seção em `/plano` **antes** dos cinco ajustes
- [x] 2.3 `MixBarra` — barra empilhada, larguras normalizadas pela soma real
- [x] 2.4 Legenda nomeando cada faixa com o percentual em texto
- [x] 2.5 Cartão por pilar: tese, papel, evidência, métrica que move, critério
- [x] 2.6 Selo "não mexer" e borda própria no pilar de controle
- [x] 2.7 Rampa de quatro tons invertendo por tema — no escuro a faixa maior media 2,08 contra o fundo
- [x] 2.8 Contorno no trilho: a ponta clara da rampa sangrava no papel do tema claro

## 3. O preço do ciclo

- [x] 3.1 `cycle.trade_off` na migração e no schema
- [x] 3.2 Texto no seed, escrito para ser lido antes de a queda acontecer
- [x] 3.3 Bloco `.troca` em `/plano`, tom de atenção e não de crítico
- [x] 3.4 Frase curta no painel, ao lado da série de views, apontando para o plano

## 4. A etapa entrega o que pede

- [x] 4.1 `step.copy_value` e `copy_label` na migração 003
- [x] 4.2 `step.copy_note` na migração 004 — coluna própria, não parágrafo do resumo
- [x] 4.3 `components/copy-value.tsx`: valor sempre visível, botão como atalho
- [x] 4.4 `input readonly` + `select()` no foco — apertar-e-segurar não pega tudo no celular
- [x] 4.5 Mensagem de falha quando o clipboard não existe (HTTP puro)
- [x] 4.6 Link montado no seed com `utm_medium=bianca.olivo`, a parte que faltava no que ela colou
- [x] 4.7 Nota respondendo à objeção dela, com o que foi medido no perfil
- [x] 4.8 Nota impedindo o encurtamento antes do redirect existir

## 5. O seed volta a aplicar

- [x] 5.1 `cycle`: `set` com tudo que o arquivo escreve
- [x] 5.2 `step`: idem — antes só `title`, e o link novo nunca entraria
- [x] 5.3 `pillar` nasce com o padrão correto
- [x] 5.4 Regra escrita nos dois pontos, com o que fica de fora e por quê

## 6. Verificação

- [x] 6.1 `npm run lint` limpo
- [x] 6.2 `npm test` — 266 testes na plataforma
- [x] 6.3 Migrações aplicadas e seed reexecutado no banco local
- [x] 6.4 Renderização conferida nos dois temas, a 500px
- [x] 6.5 Contraste das faixas medido no navegador: escuro 3,4 a 13,8
- [x] 6.6 `npm run validar:tudo` limpo
