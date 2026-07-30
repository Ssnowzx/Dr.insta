---
description: Monta o plano de conteudo da proxima semana ancorado nos pilares e na capacidade real
argument-hint: "[contexto opcional — ex.: 'semana curta, viajo quinta']"
---

Monte o plano de conteudo da proxima semana.

Contexto adicional: `$ARGUMENTS`

Passos:

1. Leia `perfil/pilares.md`, `perfil/icp.md` e as restricoes operacionais em `perfil/perfil.md`.
2. Se houver CSV recente em `dados/metricas/`, rode `npm run ig -- analisar <csv>` para saber qual formato e qual pilar estao performando melhor. Priorize-os no mix.
3. Use a skill `instagram-content-engine`.
4. Entregue a tabela semanal com as colunas: Dia | Formato | Pilar | Pauta | Gatilho de envio | Metrica alvo.
   - A pauta precisa ser especifica, nao tema generico. "5 dicas de produtividade" nao serve; "as 3 tarefas que parei de fazer ao passar de 5 clientes" serve.
   - A coluna "gatilho de envio" e obrigatoria. Se voce nao conseguir preencher, a pauta nao esta pronta — troque.
5. Inclua a secao **"o que cortar se a semana apertar"**, com ordem explicita de sacrificio.
6. Respeite a capacidade em horas. Plano acima da capacidade e abandonado na semana 2.

Se `$ARGUMENTS` indicar restricao (viagem, semana curta, pouca energia), reduza o volume em vez de comprimir tudo nos dias restantes.
