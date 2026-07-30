# Glossario de metricas do Instagram

Definicao exata de cada metrica, a formula, e a armadilha de interpretacao mais comum.

## Indice

- [Metricas de distribuicao](#metricas-de-distribuicao)
- [Metricas de interacao](#metricas-de-interacao)
- [Metricas de video](#metricas-de-video)
- [Metricas de Stories](#metricas-de-stories)
- [Metricas de conversao](#metricas-de-conversao)
- [Metricas compostas](#metricas-compostas)
- [Armadilhas gerais](#armadilhas-gerais)

---

## Metricas de distribuicao

### Alcance (contas alcancadas)

Numero de **contas unicas** que viram o conteudo pelo menos uma vez.

- **Armadilha:** alcance nao soma entre posts. Se dois posts alcancaram 5 mil cada, o alcance do periodo nao e 10 mil — provavelmente e bem menos, porque as mesmas pessoas viram os dois.
- **Uso correto:** denominador de todas as taxas de interacao.

### Impressoes

Numero total de exibicoes, incluindo repetidas.

- **Armadilha:** impressoes altas com alcance baixo significa que as mesmas pessoas viram varias vezes. Isso pode ser bom (conteudo revisitado) ou ruim (a mesma bolha, sem distribuicao nova). Cruze com alcance de nao-seguidores para saber qual.
- **Uso correto:** razao impressoes/alcance como sinal de repeticao. Acima de 1,5 investigue.

### Alcance de nao-seguidores

Percentual do alcance vindo de quem ainda nao segue.

- **Por que importa:** e o unico indicador direto de que o algoritmo esta recomendando o conteudo. Sem isso nao ha crescimento, so circulacao interna.
- **Referencia:** abaixo de 20% o perfil esta falando so para a propria base. Acima de 60% em Reels e sinal de conteudo com boa distribuicao.
- **Armadilha:** alcance de nao-seguidores alto com conversao em seguidores baixa significa que o conteudo atrai a audiencia errada. Cheque o posicionamento antes de comemorar.

---

## Metricas de interacao

### Curtidas

**Formula:** `curtidas / alcance × 100`

- **Peso no ranqueamento:** terceiro sinal (likes per reach).
- **Armadilha:** e a metrica mais barata de obter e a mais facil de inflar com conteudo generico. Curtida alta com salvamento e compartilhamento baixos indica conteudo agradavel e descartavel.

### Comentarios

**Formula:** `comentarios / alcance × 100`

- **Por que importa:** custa esforco, e o sinal mais direto de que existe comunidade.
- **Armadilha critica:** nem todo comentario e igual. "🔥🔥" e ruido; uma resposta de duas frases e sinal. Para o objetivo de comunidade, conte separadamente os **comentarios com mais de 4 palavras**. O Insights nao faz essa distincao — a contagem e manual e vale o esforco.
- **Armadilha 2:** pedir comentario explicitamente ("comenta EU") infla o numero sem criar comunidade, e o algoritmo tende a descontar padroes obvios de engagement bait.

### Salvamentos

**Formula:** `salvamentos / alcance × 100`

- **Significado:** intencao de voltar. Sinal de utilidade percebida.
- **Uso correto:** melhor indicador de que o conteudo educacional funcionou. Um carrossel de framework com saves/reach baixo falhou na promessa, mesmo com muitas curtidas.
- **Armadilha:** salvamento nao gera distribuicao imediata como sends. Ele sustenta cauda longa. Nao espere pico de alcance no mesmo dia.

### Compartilhamentos (sends)

**Formula:** `compartilhamentos / alcance × 100`

- **Peso no ranqueamento:** segundo sinal, atras apenas de watch time. Pesa varias vezes mais que uma curtida para distribuicao.
- **Por que pesa tanto:** compartilhar em DM custa capital social — a pessoa se expoe ao mandar. E o sinal mais dificil de falsificar.
- **Como aumentar:** conteudo que serve de **recado** ("manda pra quem precisa ver"), que **da identidade** ("isso sou eu"), ou que **da municao de argumento** ("eu falei"). Qualidade sozinha nao gera envio; utilidade social gera.
- **Armadilha:** o Insights agrupa compartilhamento em DM com compartilhamento para Stories. O primeiro pesa mais. Nao ha como separar no export — trate o numero como agregado.

---

## Metricas de video

### Watch time / tempo de visualizacao

Tempo total assistido, somado entre todos os espectadores.

- **Peso no ranqueamento:** sinal numero um para Reels.
- **Armadilha:** watch time total cresce com alcance. Para comparar posts, use retencao media (percentual), nao o total absoluto.

### Retencao media

**Formula:** `tempo medio assistido / duracao total × 100`

- **Onde o jogo se decide:** nos 3 primeiros segundos. A maior parte da queda acontece ali.
- **Referencia (nicho negocios/marketing):** abaixo de 30% e ruim; 45% e mediano; acima de 60% e forte.
- **Armadilha importante:** video curto tem retencao percentual naturalmente maior. Um Reels de 8s com 70% de retencao entregou 5,6s assistidos; um de 45s com 40% entregou 18s. O segundo performa melhor apesar do percentual menor. **Sempre compare videos de duracao parecida.**

### Replays

Quantas vezes o video foi reassistido.

- **Significado:** conteudo denso ou loop bem construido. Ambos sao positivos para distribuicao.
- **Uso:** replay alto com retencao baixa costuma indicar que a informacao apareceu rapido demais na tela.

---

## Metricas de Stories

### Taxa de resposta

**Formula:** `respostas / alcance de Stories × 100`

- **Por que importa:** e a metrica-norte do ciclo atual. Resposta em Story e conversa iniciada — o insumo direto de comunidade.
- **Referencia:** acima de 1% ja e forte. Stories e canal de baixa interacao por natureza.

### Taxa de conclusao

**Formula:** `visualizacoes do ultimo card / visualizacoes do primeiro × 100`

- **Uso:** mede se a sequencia sustenta atencao. Queda brusca entre dois cards especificos aponta exatamente onde o conteudo perdeu a pessoa.
- **Armadilha:** sequencias longas tem conclusao naturalmente menor. Compare sequencias de tamanho parecido.

### Toques para avancar vs. sair

- **Avancar:** a pessoa quis pular aquele card. Sinal fraco de desinteresse pontual.
- **Sair:** a pessoa abandonou a sequencia inteira. Sinal forte. Investigue o card onde acontece.

---

## Metricas de conversao

### Visitas ao perfil

**Formula:** `visitas / alcance × 100`

- **Significado:** o conteudo despertou curiosidade sobre quem produziu.
- **Uso:** e o elo entre conteudo e conversao. Alcance alto com visitas baixas significa que o conteudo funciona mas nao gera interesse na fonte — falta assinatura de autoria.

### Cliques no link

**Formula:** `cliques / visitas ao perfil × 100`

- **Atencao ao denominador:** o correto e visitas ao perfil, nao alcance. A pessoa precisa chegar ao perfil antes de clicar; usar alcance mistura dois funis diferentes.

---

## Metricas compostas

### Engajamento total

**Formula:** `(curtidas + comentarios + salvamentos + compartilhamentos) / alcance × 100`

- **Uso:** visao geral, boa para acompanhar tendencia ao longo do tempo.
- **Armadilha:** trata sinais de peso muito diferente como equivalentes. Serve para tendencia, nao para decidir o que fazer.

### Engajamento de valor

**Formula:** `(salvamentos + compartilhamentos) / alcance × 100`

- **Uso:** metrica propria deste projeto. Isola os dois sinais que exigem intencao real, filtrando o ruido da curtida.
- **Por que existe:** e o melhor previsor isolado de distribuicao continuada.

### Score (0-100)

Nota ponderada calculada por `src/dominio/metricas.ts`, com pesos: compartilhamentos 35%, salvamentos 30%, comentarios 20%, curtidas 15%.

- **Uso:** ranquear posts entre si dentro do mesmo perfil.
- **Nao use para:** comparar perfis diferentes, ou como nota absoluta de qualidade.

---

## Armadilhas gerais

### Media esconde bimodalidade

Se um perfil tem posts que explodem e posts que morrem, a media descreve um post que nunca existiu. Sempre olhe a distribuicao, nao so a media. O motor devolve melhores e piores exatamente por isso.

### Comparar periodos de tamanhos diferentes

14 dias contra 30 dias nao e comparacao. Normalize o periodo antes de comparar.

### Sazonalidade

Dezembro e janeiro tem comportamento proprio em quase todo nicho de negocios. Queda em periodo de festa raramente e problema de conteudo.

### Confundir correlacao com causa

Se voce mudou horario **e** formato na mesma semana, o resultado nao atribui a nenhum dos dois. Isole uma variavel por vez — ou aceite que aquele ciclo nao produz aprendizado.

### O numero que subiu nao e necessariamente o que importa

Alcance subiu 40% e comentario caiu 30%: no ciclo atual, isso e uma piora. A metrica-norte manda.
