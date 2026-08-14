## Purpose

Define como o ciclo converte alcance em seguidor: por que o denominador que decide é o alcance de não-seguidor e não o alcance total, quais estágios do funil recebem trabalho e em que ordem, o que impede o crescimento de destruir a conversa existente, e em que data a aritmética declara a meta de 1M morta.

## ADDED Requirements

### Requirement: Métrica-norte única do ciclo

O ciclo SHALL usar **seguidores líquidos por mês** como única métrica de decisão (baseline 20.824/mês sobre 713.838 seguidores em 04/08/2026; alvo 62.200/mês até 31/12/2026). Quando duas recomendações conflitarem, a que move seguidores líquidos SHALL vencer, e o custo da recomendação preterida SHALL ser declarado.

A métrica SHALL ser sempre **líquida** (ganhos menos perdas). Ganhos brutos SHALL ser rotulados como brutos quando citados, porque perdas não são visíveis nos Insights e um número bruto apresentado como líquido esconde exatamente o efeito colateral que os guard-rails existem para pegar.

#### Scenario: Conflito entre recomendações

- **WHEN** uma pauta promete mais comentários por alcance e outra promete mais seguidores líquidos
- **THEN** a recomendação entregue é a de seguidores, com a perda estimada de comentários/alcance declarada no mesmo parágrafo

#### Scenario: Número de seguidores sem base declarada

- **WHEN** um relatório ou tela citar crescimento de seguidores sem distinguir bruto de líquido
- **THEN** o número é rotulado como bruto e a leitura registra que a perda não é observável nos Insights

### Requirement: O denominador do crescimento é o alcance de não-seguidor

A regra geral do projeto normaliza tudo por alcance. Para crescimento de seguidor essa regra SHALL ser refinada: **quem já segue não pode seguir de novo**, então o denominador honesto é o alcance entre não-seguidores. Toda taxa de conversão em seguidor SHALL declarar qual denominador usou.

Medido em 13/08/2026 sobre 8 Reels, pela aba *Principais fontes das visualizações*:

| Grupo | Aba Reels + Explorar | Feed + Stories + Perfil |
|---|---:|---:|
| 6 Reels longos (1:26–1:51) | **1,0% – 4,2%** | 95,8% – 99,0% |
| 2 Reels curtos (0:06 e 0:08) | **77,8% – 83,5%** | 16,5% – 22,2% |

A consequência SHALL ser tratada como o achado central do ciclo: o formato que converte melhor por alcance (90s+, 0,146% contra 0,061% do 1–10s, em 376 posts) é justamente o que quase nunca é entregue a estranho, enquanto 33,3 milhões de alcance — 39% do total do período — vão para o formato de 1–10s, que alcança estranho e não o converte.

#### Scenario: Taxa de conversão citada sem denominador

- **WHEN** uma leitura apresentar conversão em seguidor sem dizer se o denominador é alcance total ou alcance de não-seguidor
- **THEN** a leitura é considerada incompleta e o denominador é declarado antes de qualquer recomendação derivar dela

#### Scenario: Formato com boa conversão e nenhuma descoberta

- **WHEN** um formato converter acima da média por alcance total mas tiver menos de 10% das visualizações vindas de Aba Reels e Explorar
- **THEN** o diagnóstico registra que o gargalo dele é distribuição e não conteúdo, e a recomendação ataca a descoberta, não o roteiro

### Requirement: O painel é o funil, não o número final

O ciclo SHALL medir estágios encadeados, cada um com alvo próprio, e não apenas o total de seguidores:

| Estágio | Baseline | Alvo |
|---|---|---|
| Alcance mensal | 5.413.754 (jul/2026) | guard-rail — não cair |
| Alcance de não-seguidor ÷ alcance | **a medir** | a definir após baseline |
| Seguidores ÷ alcance de não-seguidor | **a medir** | a definir após baseline |
| Seguidores ÷ alcance total (operacional) | 0,060% (jul/2026) | ≥ 0,20% |
| Visitas ao perfil ÷ alcance | 6,42% (347.482) | ≥ 9% |
| Seguidores líquidos ÷ visitas ao perfil | 5,99% | ≥ 9,0% |
| **Seguidores líquidos/mês** | **20.824** | **62.200** |

Os dois estágios de não-seguidor SHALL permanecer sem alvo numérico até existir baseline medido — meta sem baseline é ficção, e a inferência por fonte de tráfego em 8 posts é indício, não medição. Até lá, o ciclo opera pela linha de conversão sobre alcance total, rotulada como proxy.

Toda leitura SHALL apontar **em qual estágio** o funil travou. Uma leitura que só reporta o total de seguidores SHALL ser considerada incompleta.

#### Scenario: Meta mensal não batida

- **WHEN** o mês fechar abaixo de 62.200 seguidores líquidos
- **THEN** a leitura identifica qual estágio ficou abaixo do alvo e a recomendação seguinte ataca esse estágio, não o total

#### Scenario: Alvo proposto sem baseline

- **WHEN** for proposto alvo numérico para conversão sobre alcance de não-seguidor antes da primeira coleta da aba *Público*
- **THEN** o alvo é recusado e a coleta do baseline é agendada no lugar

### Requirement: Conteúdo sobre a marca não ocupa espaço de feed neste ciclo

Medido em 13/08/2026: a série "por dentro da sua peça favorita" (4 episódios, 86–89s) somou **179.461 de alcance e 45 seguidores — 0,025%**, um terço da média geral de 0,079% e 41× abaixo do melhor conversor do período (vídeo de perfumes, 99s, 305.249 de alcance, 3.131 seguidores, 1,026%).

Enquanto o ciclo tiver seguidores como norte, pauta cujo sujeito é a marca My Favorite SHALL NOT ocupar espaço de feed do perfil pessoal, e SHALL ser encaminhada à equipe da marca. Isso não é julgamento de qualidade: é aritmética de alocação de alcance.

#### Scenario: Pauta institucional proposta

- **WHEN** uma pauta tiver a marca como sujeito (bastidor de produção, coleção, lançamento institucional)
- **THEN** a pauta é recusada para o perfil pessoal com o número de 0,025% declarado, e encaminhada à equipe da My Favorite

#### Scenario: Marca aparece como escolha dela

- **WHEN** a marca aparecer como item de um conteúdo cujo sujeito é a opinião ou a rotina dela
- **THEN** a pauta é aceita — a restrição é sobre o sujeito do conteúdo, não sobre a presença da marca

### Requirement: Experimentos em ordem obrigatória, do maior desperdício para o menor

O ciclo SHALL rodar quatro experimentos, **um de cada vez**, nesta ordem:

1. **Longo de opinião com engenharia de descoberta** (dias 1–21) — variável isolada: pauta de opinião/utilidade dela (perfume, make, moda, ocasião de uso) em formato de 90s+. Mede a fatia de visualizações vinda de Aba Reels + Explorar e a conversão. Sucesso: ≥ 15% de fontes de descoberta **e** ≥ 0,30% de seguidores por alcance. Evidência prévia: 1,026% quando um longo de opinião escapou da bolha, contra 0,025% da série institucional
2. **Perfil como página de decisão** (dias 22–35) — variável isolada: bio, foto, nome de busca, destaques e os primeiros nove do grid. Mede seguidores líquidos ÷ visitas ao perfil. Sucesso: ≥ 7,5%. Roda sobre as 347.482 visitas/mês que já existem, e vale para os ~66% de crescimento que não vêm de post
3. **Motivo de seguir no curto** (dias 36–63) — variável isolada: o que o vídeo de 1–10s diz sobre quem ela é. Mede conversão na faixa de 1–10s, que hoje recebe 39% de todo o alcance a 0,061%. Sucesso: ≥ 0,12%
4. **Colab de escala mensal** (dias 64–140) — variável isolada: distribuição. Evidência: março/2026 fez 26.847 seguidores por post num mês, contra 7.000–11.000 dos meses normais. Sucesso: ≥ 15.000 seguidores no mês do colab

Nenhuma leitura SHALL ser feita com menos de 7 posts ou 14 dias.

#### Scenario: Proposta de aumentar volume

- **WHEN** for proposto publicar mais para crescer mais rápido
- **THEN** a proposta é recusada com o dado declarado — ela já publica 58 a 81 posts/mês, e a conversão média de 0,060% significa que mais volume entrega mais alcance na mesma taxa

#### Scenario: Dois experimentos na mesma janela

- **WHEN** dois experimentos do ciclo forem propostos para a mesma janela
- **THEN** o segundo é adiado e a razão registrada — duas variáveis em movimento não produzem conclusão válida

### Requirement: Guard-rails que impedem crescer destruindo o que funciona

O ciclo SHALL monitorar, com piso no próprio baseline medido, quatro sinais que **não são alvo**: comentários/alcance ≥ 0,21%, saves/alcance ≥ 0,23%, sends/alcance ≥ 1,32% e alcance mensal ≥ 5.413.754. Queda superior a 25% sustentada por 3 semanas em qualquer um SHALL abrir revisão do mix antes de qualquer nova decisão de pauta.

Comentários/alcance SHALL permanecer no painel como acompanhamento. O diagnóstico que o elegeu norte em 12/08 (0,21% contra 0,50% do nicho) continua verdadeiro e SHALL ser reportado como dívida conhecida, nunca apagado.

#### Scenario: Seguidores crescem e a conversa cai

- **WHEN** os seguidores líquidos subirem e comentários/alcance cair mais de 25% por três semanas
- **THEN** a leitura declara que o ciclo está comprando audiência que não conversa, abre revisão do mix e registra o custo — a meta não é reafirmada sem essa nota

#### Scenario: Queda de alcance por realocação de formato

- **WHEN** o alcance mensal cair mais de 25% por três semanas durante a realocação do curto para o longo
- **THEN** a realocação é declarada excessiva e o mix é revisto — o formato curto sustenta a distribuição e não pode ser zerado

### Requirement: Critério aritmético de morte da meta

Na **semana 6** (24/09/2026) o ciclo SHALL projetar linearmente, do ritmo então observado até 31/12/2026, o total de seguidores na data. Se a projeção não alcançar 1.000.000, a meta na data SHALL ser declarada encerrada e a data SHALL ser renegociada com a cliente **em números** — projeção, ritmo observado e ritmo necessário — nunca adiada por otimismo ou substituída em silêncio.

Referências para essa conversa, calculadas sobre o alcance-post de julho (11.730.218) somado aos ~13.800/mês que não vêm de post:

| Conversão média | Seguidores/mês | Projeção em 31/12 |
|---|---:|---:|
| 0,060% (hoje) | 20.800 | ~810.000 |
| 0,20% | 37.300 | ~885.000 |
| 0,30% | 49.000 | ~939.000 |
| 0,40% | 60.700 | ~993.000 |

A leitura honesta que acompanha esses números SHALL ser declarada desde o início do ciclo: **conversão sozinha não fecha 1M**. A meta só fecha com conversão de 3–4× **somada** a um evento de escala por mês, do porte do que março/2026 produziu.

#### Scenario: Ritmo não sai do baseline

- **WHEN** a semana 6 fechar com ritmo observado próximo de 20.824/mês
- **THEN** a meta 1M até dezembro é declarada morta, a projeção de ~810k é apresentada à cliente e uma data sustentada pelo ritmo é proposta no lugar

#### Scenario: Conversão melhora e nenhum evento de escala acontece

- **WHEN** a conversão atingir a faixa de 0,20% a 0,30% sem nenhum colab de escala no período
- **THEN** a leitura declara que a meta na data depende do experimento 4 e que sem ele a projeção fecha entre 885k e 939k

#### Scenario: Prazo ambíguo não confirmado

- **WHEN** a primeira leitura chegar sem que a cliente tenha confirmado se "até dezembro" significa 01/12 ou 31/12
- **THEN** a leitura declara a suposição usada (31/12) e registra que o alvo sobe para ~80.000/mês na leitura alternativa
