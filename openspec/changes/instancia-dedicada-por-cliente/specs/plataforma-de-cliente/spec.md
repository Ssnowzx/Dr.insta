## MODIFIED Requirements

### Requirement: Escopo de acesso derivado da identidade

Toda consulta de domínio SHALL ser filtrada por um cliente resolvido no
servidor. Um usuário vinculado a um cliente SHALL enxergar apenas os dados
daquele cliente; um usuário sem vínculo atua como consultor e SHALL enxergar o
cliente que a instância serve.

A instância SHALL servir exatamente um cliente, nomeado por configuração e nunca
derivado dos dados. A resolução do escopo NÃO SHALL aceitar influência da
requisição — nenhum parâmetro de URL, cabeçalho ou corpo pode ampliar o alcance
de quem já está vinculado a um cliente.

A resolução do escopo NÃO SHALL admitir resultado vazio: sem cliente resolvido a
requisição falha, em vez de prosseguir sem filtro.

Recurso pertencente a outro cliente SHALL responder como inexistente, não como
proibido — uma resposta de acesso negado confirma que o recurso existe.

#### Scenario: Usuária de um cliente pede recurso de outro

- **WHEN** uma usuária vinculada ao cliente A requisita um arquivo, demanda ou entrega do cliente B
- **THEN** a resposta é de recurso não encontrado
- **AND** nenhum dado do cliente B aparece na resposta

#### Scenario: Consultor abre a plataforma

- **WHEN** um usuário sem vínculo de cliente requisita qualquer tela protegida
- **THEN** os dados apresentados são os do cliente que a instância serve
- **AND** nenhuma escolha de cliente é apresentada a ele
- **AND** o acesso é registrado com autor, recurso e hora

#### Scenario: Requisição tenta escolher outro cliente

- **WHEN** uma requisição carrega um identificador de cliente diferente do resolvido
- **THEN** o identificador é ignorado
- **AND** a tela responde com os dados do escopo resolvido, sem erro

#### Scenario: Configuração ausente ou apontando para cliente inexistente

- **WHEN** a instância sobe sem o cliente configurado, ou com um nome que não corresponde a nenhum cliente
- **THEN** a primeira requisição que precise de escopo falha de forma explícita
- **AND** a mensagem nomeia a configuração e o valor recusado
- **AND** nenhum cliente é servido por omissão

#### Scenario: Requisição sem sessão válida

- **WHEN** uma requisição chega sem sessão, ou com sessão expirada
- **THEN** ela é recusada antes de qualquer consulta ao domínio

### Requirement: Papel define o que se pode fazer, não qual cliente se vê

Consultor e cliente SHALL operar sobre o mesmo cliente. A diferença entre os
papéis SHALL ser o conjunto de ações permitidas, não o conjunto de dados
visíveis.

Tela restrita ao consultor SHALL recusar acesso de usuário vinculado a cliente
levando-o a uma tela permitida, e não a uma página de erro — o produto tem uma
cliente só, e um erro aqui é ruído sobre algo que ela não pediu.

#### Scenario: Cliente tenta abrir tela de consultor

- **WHEN** uma usuária vinculada a um cliente requisita a tela de atividade
- **THEN** ela é levada para a tela inicial
- **AND** nenhum conteúdo da tela restrita é transmitido

#### Scenario: Marcação de etapa continua sendo dela

- **WHEN** o consultor abre o plano
- **THEN** ele lê o que a cliente marcou, sem poder marcar no lugar dela
