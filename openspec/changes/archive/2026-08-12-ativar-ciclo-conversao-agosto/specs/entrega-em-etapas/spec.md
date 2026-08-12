## Purpose

Define como uma recomendação chega até a cliente: o que entra em documento escrito, em que ordem as mudanças são ativadas e como o retorno volta. Existe porque o canal com a cliente é uma página publicada, sem conversa acompanhando — a página é a conversa.

## ADDED Requirements

### Requirement: Uma variável isolada por vez

Mudanças SHALL ser ativadas em sequência, não em bloco. Correção de infraestrutura de medição SHALL preceder qualquer mudança editorial e rodar isolada, porque sem medição confiável nenhum resultado posterior é interpretável.

#### Scenario: Infraestrutura e conteúdo mudariam juntos

- **WHEN** uma correção de rastreamento e uma mudança de conteúdo estão prontas ao mesmo tempo
- **THEN** o rastreamento é ativado primeiro e sozinho
- **AND** a mudança de conteúdo começa apenas no período seguinte

#### Scenario: Leitura de resultado com duas variáveis alteradas

- **WHEN** duas mudanças foram ativadas no mesmo período
- **THEN** o resultado SHALL ser declarado inconclusivo quanto a qual delas atuou
- **AND** nenhuma das duas é promovida a prática recomendada com base nele

### Requirement: Recorte do que entra em documento escrito

Uma etapa entregue por escrito SHALL conter apenas o que a cliente executa sozinha, sem depender de conversa. Recomendação que corrige o trabalho autoral da cliente — sua escrita, sua voz, decisões que ela já justificou — SHALL ser reservada para conversa.

#### Scenario: Recomendação que corrige trabalho autoral

- **WHEN** a recomendação incide sobre texto, voz ou uma decisão que a cliente justificou
- **THEN** ela não entra no documento escrito da etapa
- **AND** é registrada para a conversa seguinte

#### Scenario: Recomendação de execução direta

- **WHEN** a recomendação é uma ação concreta e verificável, sem juízo sobre o trabalho autoral
- **THEN** entra no documento escrito com o dado que a sustenta

### Requirement: Toda recomendação carrega o dado que a sustenta

Cada item entregue à cliente SHALL vir acompanhado do número observado que o justifica e da métrica que deve se mover. Recomendação sem número observável SHALL ser identificada como hipótese.

#### Scenario: Item apoiado em medição

- **WHEN** um item é incluído na entrega
- **THEN** exibe o valor medido que o motivou
- **AND** deixa explícito o que se espera que mude

#### Scenario: Recomendação sem evidência disponível

- **WHEN** não há número observável que sustente a recomendação
- **THEN** ela é apresentada como hipótese a testar
- **AND** não é apresentada como conclusão

### Requirement: Efeito colateral esperado é declarado antes

Quando uma mudança tende a piorar uma métrica visível que a cliente acompanha, esse efeito SHALL ser declarado antes da ativação, com a razão pela qual é aceitável.

#### Scenario: Mudança que reduz uma métrica visível

- **WHEN** a mudança tende a reduzir alcance ou visualizações
- **THEN** a queda é avisada antes de começar
- **AND** fica explícito qual métrica passou a valer no lugar

### Requirement: Ciclo de retorno na própria entrega

A entrega SHALL oferecer meio de a cliente responder sem sair do documento, informando o que executou e o que a impediu. Retorno parcial SHALL ser tão fácil de enviar quanto o completo.

#### Scenario: Execução parcial

- **WHEN** a cliente executou apenas parte dos itens
- **THEN** consegue enviar o retorno mesmo assim
- **AND** o retorno distingue o que foi feito do que não foi

#### Scenario: Item que não fez sentido para a cliente

- **WHEN** a cliente não compreendeu ou discordou de um item
- **THEN** existe campo aberto para registrar isso
- **AND** esse registro é tratado como falha da entrega, não da cliente

### Requirement: Confidencialidade da entrega publicada

Documento publicado que contenha dados de negócio da cliente — receita, conversão, composição de audiência — SHALL ser servido de forma não indexável por buscadores e não SHALL expor dados de contato em texto recuperável por varredura automatizada.

#### Scenario: Publicação em endereço de acesso público

- **WHEN** a entrega é publicada em endereço acessível por link
- **THEN** é servida com diretiva de não indexação tanto no documento quanto no cabeçalho de resposta
- **AND** dados de contato não aparecem em texto literal no código-fonte
