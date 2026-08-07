## Purpose

Permite que a cliente autorize a própria conta do Instagram uma vez e, a partir
daí, as métricas que hoje dependem de ela exportar um arquivo cheguem sozinhas —
com a credencial guardada de forma que um vazamento do banco não a entregue, e
com falha que aparece em vez de silenciar.

## ADDED Requirements

### Requirement: A cliente autoriza a própria conta, sem intermediário

A conexão SHALL ser estabelecida pela própria cliente, autenticando-se no
Instagram, e NÃO SHALL exigir que ela informe senha, código ou qualquer
credencial à plataforma.

A plataforma NÃO SHALL solicitar permissão que não exerça. Escopo pedido é poder
concedido, e a tela de autorização é lida no exato momento em que ela decide
confiar.

Antes de iniciar a autorização, a interface SHALL declarar o que será acessado e
o que não será, em linguagem que descreva consequência e não nome de escopo.

#### Scenario: Conexão a partir da área da cliente

- **WHEN** a cliente aciona o botão de conectar
- **THEN** ela é levada à tela de autorização do próprio Instagram
- **AND** nenhuma credencial dela é digitada na plataforma

#### Scenario: Declaração antes de autorizar

- **WHEN** a tela de conexão é apresentada
- **THEN** ela declara que os dados serão lidos
- **AND** declara que a plataforma não publica, não comenta e não lê mensagens

#### Scenario: Autorização recusada

- **WHEN** a cliente desiste na tela do Instagram
- **THEN** ela volta a uma tela que diz que nada foi conectado
- **AND** nenhuma conexão é registrada

### Requirement: A volta da autorização é verificada antes de virar conexão

O retorno da autorização SHALL ser aceito apenas quando corresponder a um pedido
iniciado por esta plataforma, para a sessão que o iniciou. Um retorno que
qualquer pessoa possa fabricar é uma conexão que qualquer pessoa pode plantar.

A prova de correspondência SHALL ter validade limitada e SHALL ser de uso único.

Credencial de autorização recebida NÃO SHALL aparecer em endereço registrado em
log, histórico ou referência.

#### Scenario: Retorno sem pedido correspondente

- **WHEN** chega um retorno de autorização que não corresponde a pedido desta sessão
- **THEN** ele é recusado
- **AND** nenhuma conexão é criada ou alterada

#### Scenario: Retorno repetido

- **WHEN** o mesmo retorno de autorização é apresentado uma segunda vez
- **THEN** ele é recusado

### Requirement: A credencial é guardada cifrada e nunca é exibida

A credencial de acesso SHALL ser persistida cifrada, com chave que não resida no
banco. Um dump do banco NÃO SHALL bastar para agir na conta da cliente.

A credencial NÃO SHALL ser exibida em nenhuma tela, retornada por nenhuma
resposta, nem registrada em log — inclusive em mensagem de erro.

#### Scenario: Leitura do banco

- **WHEN** o valor persistido da credencial é lido diretamente do banco
- **THEN** ele não serve para chamar a API sem a chave de cifra

#### Scenario: Erro durante a coleta

- **WHEN** uma chamada à API falha e o erro é registrado
- **THEN** a credencial não aparece no registro

### Requirement: A conexão se mantém sozinha enquanto for válida

A credencial SHALL ser renovada antes de expirar, sem ação da cliente.

A renovação SHALL ocorrer com folga suficiente para que uma falha isolada não
leve à expiração — uma credencial que só é renovada na véspera morre no primeiro
dia em que a rotina falhar.

#### Scenario: Renovação de rotina

- **WHEN** a rotina de manutenção encontra uma conexão ativa dentro do prazo
- **THEN** a credencial é renovada e a nova validade é registrada

#### Scenario: Renovação falha uma vez

- **WHEN** uma tentativa de renovação falha mas a credencial ainda é válida
- **THEN** a conexão permanece ativa
- **AND** a tentativa é registrada para nova tentativa posterior

### Requirement: Conexão que para de funcionar é anunciada, não silenciada

Perda de validade, revogação pela cliente ou falha repetida de coleta SHALL
mudar o estado da conexão para um estado visível, e SHALL gerar aviso ao
consultor.

A interface da cliente SHALL apresentar o estado da conexão e, quando ela puder
resolver, o caminho para reconectar.

Enquanto a conexão estiver quebrada, os números já coletados SHALL permanecer
visíveis, marcados com a data em que foram colhidos. Apagar o que já foi medido
por causa de uma falha de coleta destrói histórico que a API não devolve.

#### Scenario: Credencial expirada

- **WHEN** a credencial expira ou é revogada
- **THEN** a conexão passa a estado que a interface apresenta como desconectada
- **AND** o consultor recebe aviso na tela de novidades

#### Scenario: Coleta falha de forma repetida

- **WHEN** a coleta falha em execuções consecutivas
- **THEN** a conexão é marcada com falha
- **AND** o aviso registra desde quando não há dado novo

#### Scenario: Dados anteriores durante a falha

- **WHEN** a conexão está quebrada e existem métricas já coletadas
- **THEN** elas continuam sendo apresentadas
- **AND** a data da última coleta bem-sucedida acompanha os números

### Requirement: O que a coleta grava é identificável como colhido por máquina

Valor obtido da API oficial SHALL ser gravado com origem própria, distinta da
origem usada para valor transcrito por pessoa a partir do aplicativo.

A coleta SHALL ser idempotente para o mesmo período: executá-la duas vezes NÃO
SHALL produzir valor duplicado nem série com degrau falso.

A coleta NÃO SHALL gravar métrica que a API não tenha entregue para o período.
Ausência de dado é ausência, e preencher com zero produz queda que nunca
aconteceu.

#### Scenario: Coleta executada duas vezes

- **WHEN** a coleta roda duas vezes para o mesmo período
- **THEN** existe um único valor por métrica, período e origem

#### Scenario: Métrica ausente na resposta

- **WHEN** a API não retorna uma métrica para o período
- **THEN** nenhum valor é gravado para ela
- **AND** a ausência não é registrada como zero

#### Scenario: Origem do valor colhido

- **WHEN** um valor coletado da API é apresentado
- **THEN** ele é identificado como colhido automaticamente da fonte oficial
