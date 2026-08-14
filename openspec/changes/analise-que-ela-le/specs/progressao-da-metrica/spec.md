## Purpose

Define como a métrica que decide o ciclo é mostrada ao longo do tempo para a cliente: de onde partiu, onde está e quanto falta — em vez de um número do mês corrente que não diz se melhorou.

## ADDED Requirements

### Requirement: A métrica-norte aparece ao longo dos meses

A entrega de leitura SHALL apresentar a métrica-norte do ciclo como série mensal, com o ponto de partida marcado e o alvo declarado. Um número isolado do mês corrente SHALL NOT ser a única forma de apresentá-la.

Um número sozinho não responde a pergunta que a cliente tem, que é se está melhorando. `0,21%` pode ser vitória ou derrota conforme o mês anterior, e a tela não diz qual.

#### Scenario: Série com poucos pontos

- **WHEN** houver menos de três meses medidos
- **THEN** os pontos existentes são mostrados e a leitura declara que ainda não há tendência, apenas começo

#### Scenario: Métrica sem histórico

- **WHEN** a métrica-norte não tiver nenhum valor mensal registrado
- **THEN** a progressão não é desenhada, e a entrega diz o que falta medir para ela existir

### Requirement: A distância até o alvo é dita em número, não em cor

A progressão SHALL declarar em texto quanto falta para o alvo, na mesma unidade da métrica. Cor, seta ou barra SHALL ser reforço, nunca a única forma de comunicar a distância.

Quem lê no telefone, com brilho baixo, em movimento, não distingue confiavelmente dois tons de uma barra — e a diferença entre "quase lá" e "falta o triplo" é a informação inteira.

#### Scenario: Alvo ainda distante

- **WHEN** a métrica estiver abaixo do alvo
- **THEN** a distância é escrita em número e unidade, junto do desenho

#### Scenario: Leitura sem cor disponível

- **WHEN** a progressão for lida sem distinção de cor
- **THEN** o texto sozinho continua dizendo onde ela está e quanto falta

### Requirement: O ponto de partida não se move

O baseline apresentado SHALL ser o registrado no início do ciclo, e SHALL NOT ser recalculado a cada leitura. Quando o ciclo trocar, a série SHALL indicar onde o ciclo anterior terminou.

Baseline que se move junto com o resultado transforma qualquer desempenho em progresso, que é a forma mais silenciosa de um painel mentir.

#### Scenario: Troca de ciclo no meio da série

- **WHEN** a série cruzar a data de troca de ciclo
- **THEN** o ponto da troca é marcado, e os meses anteriores continuam visíveis como história de outro alvo
