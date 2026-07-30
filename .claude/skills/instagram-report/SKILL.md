---
name: instagram-report
description: "Monta o relatorio periodico de Instagram: consolida metricas, compara com o periodo anterior, avalia o que foi decidido antes e define o proximo ciclo. Use quando o usuario pedir 'relatorio', 'fechamento do mes', 'como foi o mes', 'resumo do periodo', 'balanco', 'consolidar resultados', 'apresentar os numeros', 'review mensal', 'retrospectiva', ou quando terminar um ciclo de experimento. Tambem use ao arquivar uma mudanca no OpenSpec, para registrar o que realmente aconteceu com a metrica. Para diagnostico pontual de um periodo use instagram-metrics."
metadata:
  versao: "1.0.0"
  projeto: myfavorite
---

# Instagram — Relatorio Periodico

Um relatorio existe para **decidir o proximo ciclo**, nao para descrever o anterior. Se ele nao termina em decisao, foi um exercicio de contabilidade.

## Antes de escrever

1. Rode o motor nos dois periodos:
   ```bash
   npm run ig -- analisar dados/metricas/<atual>.csv
   npm run ig -- comparar dados/metricas/<anterior>.csv dados/metricas/<atual>.csv
   ```
2. Leia `perfil/metas.md` — quais metas estavam valendo
3. Leia os experimentos ativos e as mudancas em `openspec/changes/` — o que foi decidido no ciclo anterior
4. Colete o que o Insights nao exporta: comentarios com substancia, DMs iniciadas, rostos recorrentes

O passo 3 e o que transforma relatorio em aprendizado. Sem ele, cada mes recomeça do zero.

## Estrutura

```markdown
# Relatorio — [periodo]

## Veredito
[Uma frase. O ciclo avancou, ficou parado ou regrediu em relacao a metrica-norte.]

## Metrica-norte
| | Anterior | Atual | Meta | Situacao |
|---|---:|---:|---:|---|
| [nome] | | | | |

[Duas linhas sobre o que explica esse numero.]

## Painel do ciclo
[Tabela do motor. As metricas de `perfil/metas.md`, com baseline, atual e alvo.]

## O que decidimos no ciclo passado e o que aconteceu
| Decisao | Hipotese | Resultado | Veredito |
|---|---|---|---|
| | | | confirmada / refutada / inconclusiva |

## O que funcionou
[2-3 itens. Com evidencia numerica. Se nao ha numero, nao entra.]

## O que nao funcionou
[2-3 itens. Igualmente com numero. Esta secao e obrigatoria — relatorio sem ela nao e confiavel.]

## O que aprendemos sobre a audiencia
[Insights qualitativos: DMs, comentarios, caixa de perguntas. Frequentemente vale mais que os numeros.]

## Metricas de acompanhamento
[Seguidores, alcance total, impressoes. Contexto, nao alvo — deixe isso explicito.]

## Proximo ciclo
- **Manter:** [o que continua sem mudanca]
- **Mudar:** [uma coisa]
- **Parar:** [uma coisa — isso libera o tempo para a mudanca]
- **Testar:** [um experimento, com hipotese e criterio de sucesso]

## Riscos
[O que pode dar errado no proximo ciclo e como saberemos cedo.]
```

## Regras de honestidade

**A secao "o que nao funcionou" nao pode ficar vazia.** Se estiver, uma de duas coisas e verdade: o ciclo nao testou nada arriscado, ou a analise nao foi funda o bastante. Diga qual das duas.

**Veredito de hipotese e obrigatorio.** "Inconclusiva" e uma resposta legitima e frequente — amostra pequena, variavel confundida, prazo curto. Registrar isso vale mais que forcar uma conclusao.

**Nao maquie com metrica de vaidade.** Se a metrica-norte caiu e os seguidores subiram, o veredito e negativo. Reportar seguidores como se compensasse e o erro mais comum de relatorio de social — e o que faz perfis passarem anos otimizando a coisa errada.

**Numero sem base nao entra.** "Engajamento de 8%" nao significa nada. "Engajamento de 8% sobre alcance, contra referencia de 9% do nicho" significa.

## Cadencia

| Periodo | Profundidade | Foco |
|---|---|---|
| Semanal | 10 min, so o painel | Detectar desvio cedo |
| Mensal | Relatorio completo | Decidir o proximo ciclo |
| Trimestral | Completo + revisao de pilares e metas | Reposicionar se necessario |

O check semanal nao produz documento. E olhar o painel e perguntar: algo desviou o bastante para agir agora?

## Fechar o ciclo na memoria

Depois do relatorio mensal:

1. Atualize `perfil/metas.md` com os numeros reais (o baseline do proximo ciclo e o atual deste)
2. Arquive as mudancas concluidas com `/opsx:archive` — **descrevendo o que aconteceu com a metrica**, inclusive quando falhou
3. Registre o proximo experimento com `/opsx:propose`

O passo 2 e o que da valor a memoria. Um `openspec/archive/` que so guarda sucessos e inutil para decidir — o aprendizado esta concentrado nas hipoteses refutadas.

## Erros comuns

- **Relatorio descritivo.** Lista de numeros sem interpretacao nem decisao. Se termina em tabela, esta incompleto.
- **Comparar periodos de tamanhos diferentes.** 14 dias contra 30 nao e comparacao.
- **Ignorar sazonalidade.** Queda em dezembro/janeiro raramente e problema de conteudo.
- **Tirar conclusao de amostra pequena.** O motor emite o aviso; nao o suprima do relatorio.
- **Mudar tres coisas no proximo ciclo.** Uma mudanca por ciclo. Tres mudancas produzem um ciclo do qual nao se aprende nada.
