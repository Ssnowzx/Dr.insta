## ADDED Requirements

### Requirement: Todo número declara de onde veio

Todo valor medido apresentado na interface SHALL declarar a fonte de onde foi
lido e, quando existir, o caminho exato onde ele é conferido na ferramenta de
origem.

Valor informado por pessoa SHALL ser distinguido visualmente de valor contado
por ferramenta. As duas coisas não têm o mesmo peso para decidir, e a diferença
não pode depender de quem lê saber de cor.

Ressalva registrada junto ao valor — a razão de ele ser o que é — SHALL ser
apresentada com ele. Um zero sem a razão lê como fracasso.

#### Scenario: Métrica medida por ferramenta

- **WHEN** a tela apresenta um valor lido de uma ferramenta de medição
- **THEN** a fonte aparece junto ao número
- **AND** o caminho onde conferi-lo aparece quando estiver registrado

#### Scenario: Métrica informada por pessoa

- **WHEN** o valor foi informado e não medido
- **THEN** ele é marcado como informado, de forma distinta da marca de medido

#### Scenario: Valor com ressalva registrada

- **WHEN** existe ressalva gravada para aquele valor
- **THEN** ela é apresentada junto ao número, separada da descrição da fonte

#### Scenario: Atribuição sem rastreio

- **WHEN** um valor de conversão vem de período sem parâmetro de rastreio
- **THEN** a tela declara que é a melhor atribuição disponível e não uma medição rastreada

### Requirement: O método é visível para a cliente

Os experimentos do ciclo SHALL ser apresentados à cliente, cada um com a
hipótese, a única variável que muda e o critério numérico que o resolveria.

Quando houver amostra mínima definida, ela SHALL ser declarada junto ao
experimento. Abaixo dela um resultado é indício e não tendência, e esconder o
piso é como uma semana de sorte vira conclusão.

#### Scenario: Ciclo com experimentos

- **WHEN** a cliente abre o plano de um ciclo que tem experimentos
- **THEN** cada experimento aparece com hipótese, variável isolada e critério de sucesso
- **AND** a amostra mínima aparece quando estiver definida

#### Scenario: Experimento concluído

- **WHEN** um experimento tem desfecho registrado
- **THEN** o desfecho é apresentado, inclusive quando contraria a hipótese

### Requirement: A interface não promete o que não tem

A interface NÃO SHALL anunciar conteúdo, prazo de leitura ou recurso que o
produto não seja capaz de entregar naquele momento.

#### Scenario: Entrega sem documento

- **WHEN** uma entrega não possui texto nem endereço de leitura no produto
- **THEN** nenhuma estimativa de tempo de leitura é apresentada

## MODIFIED Requirements

### Requirement: A idade do dado é exibida junto com o dado

Nenhum dado deste produto se atualiza sozinho. Toda tela que apresenta número medido SHALL declarar o período a que ele se refere e há quanto tempo.

Número apresentado sem base de comparação NÃO SHALL ser deixado sozinho quando
existir base própria disponível: um valor isolado não responde à única pergunta
de quem lê, que é se aquilo foi bom. A comparação SHALL ser contra o histórico
da própria conta, nunca contra outra, e SHALL declarar a base usada.

#### Scenario: Número de um post do acervo

- **WHEN** a tela apresenta o desempenho de um post
- **THEN** aparece a posição dele contra a mediana da própria conta
- **AND** a base da comparação é declarada

#### Scenario: Base inflada por repetição

- **WHEN** a taxa usa uma base que conta repetição em vez de pessoas
- **THEN** a tela declara isso junto da taxa

### Requirement: A cliente escolhe o tema

A interface SHALL oferecer escolha entre tema claro, escuro e o do sistema, e a
escolha SHALL sobreviver à navegação e ao recarregamento.

A escolha SHALL ser aplicada antes da primeira pintura. Aplicá-la depois produz
um clarão a cada navegação para quem escolheu o escuro.

Enquanto nenhuma escolha existir, o sistema operacional decide.

#### Scenario: Pessoa escolhe um tema

- **WHEN** ela escolhe claro ou escuro
- **THEN** a interface passa a usar aquele tema em todas as telas
- **AND** continua nele depois de recarregar

#### Scenario: Escolha devolvida ao sistema

- **WHEN** ela devolve a decisão ao sistema
- **THEN** a interface volta a seguir a preferência do sistema operacional

#### Scenario: Contraste em ambos os temas

- **WHEN** um par de cor é usado na interface
- **THEN** ele atende ao mínimo de contraste **nos dois temas**, verificado automaticamente
