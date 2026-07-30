---
name: instagram-metrics
description: "Calcula, interpreta e diagnostica metricas de Instagram a partir de CSV do Insights, prints ou numeros colados. Use quando o usuario mencionar metricas, Insights, engajamento, taxa de engajamento, alcance, impressoes, salvamentos, compartilhamentos, sends, retencao, watch time, 'meus numeros', 'como esta performando', 'analisa esses dados', 'meu alcance caiu', 'o engajamento despencou', 'esse post foi bem?', 'compara com o mes passado', ou colar qualquer tabela/print de desempenho. Tambem use quando precisar estabelecer baseline antes de definir meta. Para recomendacao de pauta a partir do diagnostico, siga para instagram-content-engine."
metadata:
  versao: "1.0.0"
  projeto: myfavorite
---

# Instagram — Metricas e Diagnostico

## Regra numero um: nao calcule na mao

Existe um motor determinístico no projeto. Use-o.

```bash
npm run ig -- analisar dados/metricas/<arquivo>.csv
npm run ig -- comparar dados/metricas/<anterior>.csv dados/metricas/<atual>.csv
npm run ig -- exemplo    # smoke test com dados fictícios
```

Ele devolve taxas normalizadas, agrupamento por formato/pilar, score por post e achados acionaveis — em Markdown, pronto para colar.

Se o usuario colou numeros soltos em vez de CSV, **monte o CSV** em `dados/metricas/` e rode. Aritmetica manual em cima de 14 posts erra, e o erro nao aparece: vira uma recomendacao confiante e errada.

### Formato do CSV

Obrigatorias: `data`, `formato`, `alcance`.
Opcionais: `id`, `pilar`, `legenda`, `curtidas`, `comentarios`, `salvamentos`, `compartilhamentos`, `retencao_media`, `alcance_nao_seguidores`, `visitas_perfil`, `cliques_link`.

O parser aceita cabecalhos em portugues e ingles, separador `,` `;` ou tab, numeros em formato BR (`1.234,5`) ou EN, e datas ISO ou `DD/MM/AAAA`. Formato aceita `reels`/`reel`/`video`, `carrossel`/`carousel`/`album`, `imagem`/`foto`/`photo`, `story`/`stories`.

Modelo em `dados/exemplos/posts-exemplo.csv`.

## O denominador correto

**Toda taxa usa alcance.** Nao seguidores.

Isso nao e preciosismo. Engajamento sobre seguidores mede duas coisas ao mesmo tempo (qualidade do conteudo e proporcao da base que foi alcancada) e por isso nao mede nenhuma. Uma conta de 2 mil seguidores com 10 mil de alcance tem "500% de engajamento sobre seguidores" — numero sem significado.

Se o usuario so tem seguidores e nao tem alcance, calcule assim mas rotule: `ER por seguidores — nao comparavel entre contas`. E peca o alcance.

## Hierarquia dos sinais

O Instagram roda sistemas de ranqueamento separados para Feed, Reels, Stories e Explore, mas a ordem de peso dos sinais e consistente:

| # | Sinal | Onde pesa mais | Por que pesa |
|---|---|---|---|
| 1 | **Watch time / retencao** | Reels | Tempo e o recurso escasso; retencao prova que o conteudo o merece |
| 2 | **Sends por alcance** | Todos, sobretudo Explore | Compartilhar em DM custa reputacao social — e o sinal mais caro de falsificar |
| 3 | **Likes por alcance** | Feed | Barato de dar, logo vale menos |

Salvamento nao aparece na lista publica mas se comporta como sinal de intencao de retorno e sustenta distribuicao de cauda longa. Trate-o logo abaixo de sends.

**Consequencia pratica:** um post com 800 curtidas e 12 compartilhamentos performou pior que um com 300 curtidas e 90 compartilhamentos. Diga isso ao usuario quando ele comemorar o numero errado.

## Como ler o resultado

O motor entrega taxas, agregados e achados. Seu trabalho e a camada que ele nao faz:

1. **Nomear o gargalo em uma frase.** "O problema e retencao, nao alcance" vale mais que seis paragrafos de tabela.
2. **Amarrar a causa.** Cruze com o que mudou no periodo — formato, tema, frequencia, horario.
3. **Escolher uma acao.** A que move a metrica-norte do ciclo (`perfil/metas.md`), nao a mais facil.
4. **Definir o proximo ponto de leitura.** "Reavalie em 14 dias ou 7 posts, o que vier depois."

## Amostra: quando calar a boca

| Amostra | O que voce pode afirmar |
|---|---|
| < 7 posts ou < 14 dias | Nada sobre tendencia. Descreva os posts individualmente e diga que e cedo. |
| 7-14 posts, 14-30 dias | Hipotese. Use "sugere", nao "prova". |
| > 14 posts, > 30 dias | Tendencia. Pode recomendar mudanca estrutural. |

O motor ja emite esse aviso automaticamente. Nao o suprima do relatorio para deixar a analise mais impressionante — a ressalva e o que torna a analise confiavel.

## Diagnosticos frequentes

### "Meu alcance caiu"

Cheque nesta ordem:

1. **Frequencia mudou?** Queda de volume derruba alcance total sem que nada esteja errado.
2. **Retencao caiu?** Se sim, o problema e o conteudo — va para `instagram-reels`.
3. **Taxas por alcance estao estaveis?** Se sim, e distribuicao: menos gente viu, mas quem viu reagiu igual. Investigue repost de conteudo de terceiros (reduz distribuicao de forma agressiva), mudanca de formato ou sazonalidade.
4. **Alcance de nao-seguidores caiu especificamente?** O conteudo parou de ser recomendado. Faltou gatilho de compartilhamento.

Nunca atribua a "shadowban" sem evidencia. E a explicacao mais popular e a menos frequente.

### "Muita curtida, pouco resultado"

Conteudo de reforco — concorda com o que a audiencia ja pensa. Agrada, nao move. Troque parte do volume por conteudo de aplicacao ("faca assim") e de posicionamento ("discordo disso").

### "Um post explodiu e os outros nao"

Antes de replicar: o post explodiu por **formato**, por **tema** ou por **gancho**? Sem isolar, a replicacao copia a coisa errada. Olhe os tres posts seguintes de mesmo formato e mesmo tema para separar.

## Saida esperada

```markdown
## Leitura em uma frase
[O gargalo, com o numero.]

## O que os dados mostram
[3-5 bullets. Numero, base e comparacao com referencia.]

## Causa provavel
[Hipotese com evidencia. Se ha duas variaveis confundidas, diga.]

## Acao
[UMA acao. Com frequencia e duracao.]

## Proximo ponto de leitura
[Quando reavaliar e qual numero precisa ter mudado.]
```

Cole a tabela do motor abaixo disso, nao acima. O usuario le a conclusao; a tabela e evidencia de apoio.

## Referencias

- `references/glossario.md` — definicao exata de cada metrica e armadilhas de interpretacao
- `src/dominio/benchmarks.ts` — faixas de referencia por nicho, com fonte e data
