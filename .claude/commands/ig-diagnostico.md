---
description: Diagnostico completo do perfil — roda o motor de metricas e entrega o gargalo com acao
argument-hint: "[caminho do csv] (opcional — usa o mais recente de dados/metricas/ se omitido)"
---

Faca um diagnostico completo do perfil de Instagram.

Argumento recebido: `$ARGUMENTS`

Passos:

1. Leia `perfil/metas.md` e `perfil/perfil.md` para o objetivo do ciclo e a metrica-norte.
2. Determine o CSV a usar:
   - Se `$ARGUMENTS` traz um caminho, use-o.
   - Senao, liste `dados/metricas/*.csv` e use o mais recente.
   - Se nao houver nenhum, use a skill `instagram-audit` (diagnostico sem dados) e explique que a analise fica mais precisa com um export do Insights.
3. Rode `npm run ig -- analisar <csv>`.
4. Use a skill `instagram-metrics` para interpretar a saida.
5. Entregue no formato: leitura em uma frase → o que os dados mostram → causa provavel → UMA acao → proximo ponto de leitura. A tabela do motor vai depois da conclusao, como evidencia de apoio.
6. Se o diagnostico revelar uma decisao estrategica (mudanca de pilar, formato, frequencia ou metrica-norte), ofereca registra-la com `/opsx:propose`.

Respeite os avisos de amostra insuficiente que o motor emitir. Nao os suprima para deixar a analise mais assertiva.
