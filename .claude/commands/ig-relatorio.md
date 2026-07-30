---
description: Relatorio periodico — consolida metricas, avalia hipoteses do ciclo e define o proximo
argument-hint: "[periodo] [csv-anterior] [csv-atual] — ex.: 'junho dados/metricas/mai.csv dados/metricas/jun.csv'"
---

Monte o relatorio periodico do perfil.

Argumentos: `$ARGUMENTS`

Passos:

1. Identifique os dois periodos. Se nao vierem nos argumentos, liste `dados/metricas/*.csv` e use os dois mais recentes.
2. Rode:
   - `npm run ig -- analisar <csv-atual>`
   - `npm run ig -- comparar <csv-anterior> <csv-atual>`
3. Leia `perfil/metas.md` (metas vigentes e baseline) e `openspec/changes/` (o que foi decidido no ciclo anterior).
4. Pergunte ao usuario os numeros que o Insights nao exporta: comentarios com substancia, DMs iniciadas por seguidores, rostos recorrentes. Peca os tres de uma vez.
5. Use a skill `instagram-report` e siga exatamente a estrutura dela.
6. A secao **"o que nao funcionou"** e obrigatoria e nao pode ficar vazia. Se estiver, diga qual das duas coisas e verdade: o ciclo nao testou nada arriscado, ou a analise nao foi funda o bastante.
7. Termine com o proximo ciclo: manter / mudar (uma coisa) / parar (uma coisa) / testar (um experimento com hipotese e criterio de sucesso).

Depois de entregar:
- Atualize `perfil/metas.md` com os numeros reais deste periodo, que viram o baseline do proximo.
- Ofereca arquivar mudancas concluidas com `/opsx:archive`, descrevendo o que aconteceu com a metrica — inclusive quando a hipotese foi refutada.
