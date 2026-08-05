## Purpose

Define como o trabalho de consultoria é operado e apresentado quando deixa de ser uma página estática por entrega: quem enxerga o quê, como um pedido feito à cliente vira registro com estado, como o estado de uma etapa é capturado sem perder a informação que interessa, e o que a tela é obrigada a mostrar sobre a procedência de cada número.

Existe porque o formato anterior — uma página HTML por entrega, com estado em `localStorage` e retorno por campo aberto — não conseguia responder às duas perguntas mais básicas da consultoria: *o que já foi feito?* e *o dado que eu pedi chegou?*

## ADDED Requirements

### Requirement: Escopo de acesso derivado da identidade

Toda consulta de domínio SHALL ser filtrada pelo cliente ao qual a sessão pertence. Um usuário vinculado a um cliente SHALL enxergar apenas os dados daquele cliente; um usuário sem vínculo atua como consultor e enxerga todos.

Recurso pertencente a outro cliente SHALL responder como inexistente, não como proibido — uma resposta de acesso negado confirma que o recurso existe.

#### Scenario: Usuária de um cliente pede recurso de outro

- **WHEN** uma usuária vinculada ao cliente A requisita um arquivo, demanda ou entrega do cliente B
- **THEN** a resposta é de recurso não encontrado
- **AND** nenhum dado do cliente B aparece na resposta

#### Scenario: Consultor acessa qualquer cliente

- **WHEN** um usuário sem vínculo de cliente requisita dados de qualquer cliente
- **THEN** o acesso é concedido
- **AND** o acesso é registrado com autor, recurso e hora

#### Scenario: Requisição sem sessão válida

- **WHEN** uma requisição chega sem sessão, ou com sessão expirada
- **THEN** ela é recusada antes de qualquer consulta ao domínio

### Requirement: Estado de etapa preserva o que travou

O estado de uma etapa SHALL admitir três valores: pendente, concluída e travada. Registrar apenas concluída ou não concluída SHALL ser insuficiente, porque descarta o motivo da não execução — que é a informação que orienta a próxima entrega.

O estado SHALL ser gravado por usuário, de modo que dois acompanhantes do mesmo cliente não sobrescrevam um ao outro.

#### Scenario: Cliente não consegue executar uma etapa

- **WHEN** a cliente marca uma etapa como travada
- **THEN** o sistema aceita e persiste um comentário explicando o impedimento
- **AND** a etapa não é contada como concluída no progresso

#### Scenario: Retorno parcial

- **WHEN** a cliente respondeu parte das etapas e nenhuma outra
- **THEN** o retorno parcial é registrado sem exigir que as demais sejam preenchidas

#### Scenario: Duas pessoas acompanham a mesma entrega

- **WHEN** dois usuários do mesmo cliente marcam a mesma etapa
- **THEN** cada estado é preservado sob seu autor
- **AND** nenhum sobrescreve o outro

### Requirement: Pedido à cliente tem dono, prazo e histórico

Todo dado ou ação solicitado à cliente SHALL existir como registro com estado explícito e prazo. Mudança de estado, comentário e envio de arquivo SHALL ser gravados como eventos com autor e hora, formando histórico consultável.

Pedido SHALL carregar a razão pela qual ele importa. Pedido sem razão declarada vira tarefa sem sentido para quem recebe.

#### Scenario: Consultor solicita um dado

- **WHEN** um pedido é criado
- **THEN** ele nasce com estado aberto, tipo, prazo e a razão pela qual importa
- **AND** aparece para a cliente sem depender de mensagem em outro canal

#### Scenario: Cliente envia o que foi pedido

- **WHEN** um arquivo é enviado em resposta a um pedido
- **THEN** o arquivo fica vinculado àquele pedido
- **AND** um evento registra o envio com autor e hora

#### Scenario: Pergunta sobre quando algo foi pedido

- **WHEN** se consulta o histórico de um pedido
- **THEN** a data da criação, cada mudança de estado e cada comentário estão disponíveis com seus autores

### Requirement: Procedência do número é exibida junto com o número

Um valor de métrica SHALL registrar de qual origem veio. Valores da mesma métrica vindos de origens diferentes SHALL coexistir; um NÃO SHALL sobrescrever o outro, porque a divergência entre eles é informação.

Baseline reconhecidamente contaminado SHALL ser exibido como tal, e alvo derivado dele SHALL ser omitido enquanto a contaminação persistir.

#### Scenario: Mesma métrica com dois valores de origens diferentes

- **WHEN** a mesma métrica, no mesmo período, chega de duas origens com valores diferentes
- **THEN** as duas linhas são preservadas e identificadas por origem
- **AND** a tela apresenta a divergência em vez de escolher uma

#### Scenario: Baseline gerado em condição que mudou

- **WHEN** um baseline é marcado como contaminado
- **THEN** a tela exibe a marcação e a razão junto do valor
- **AND** nenhum alvo é apresentado como derivado dele

#### Scenario: Amostra abaixo do mínimo de leitura

- **WHEN** um valor se apoia em menos posts ou menos dias que o mínimo de leitura do projeto
- **THEN** a tela declara o tamanho da amostra junto do valor
- **AND** o valor é apresentado como indício, não como tendência

#### Scenario: Referência de nicho desatualizada

- **WHEN** um benchmark tem mais de doze meses desde a última atualização
- **THEN** a tela sinaliza a idade da referência ao exibi-la

### Requirement: Dado de origem pública não preenche campo de origem restrita

Quando uma métrica só existe em fonte restrita, o campo correspondente SHALL permanecer vazio na ausência dessa fonte. Substituí-lo por um valor de origem pública semelhante SHALL ser proibido, porque toda taxa do domínio é normalizada por alcance e um denominador fabricado contamina todas elas.

#### Scenario: Importação de dado público sem alcance

- **WHEN** posts são importados de fonte pública que não fornece alcance
- **THEN** o campo de alcance permanece vazio
- **AND** o registro é marcado com a procedência pública
- **AND** nenhuma taxa normalizada por alcance é calculada para esses registros

### Requirement: Arquivo de cliente não é servido por URL adivinhável

Arquivo enviado por cliente SHALL ser servido apenas por rota que verifique a sessão e o escopo de cliente antes de transmitir qualquer conteúdo. O caminho de armazenamento SHALL ser gerado pelo servidor; o nome informado pelo remetente SHALL ser preservado apenas como metadado.

#### Scenario: Acesso direto ao caminho de armazenamento

- **WHEN** alguém tenta acessar o caminho físico do arquivo sem passar pela rota autenticada
- **THEN** nenhum conteúdo é servido

#### Scenario: Nome de arquivo com caminho embutido

- **WHEN** o nome informado contém separadores de diretório ou sequências de navegação
- **THEN** ele não influencia o caminho de gravação
- **AND** é preservado apenas como metadado exibível
