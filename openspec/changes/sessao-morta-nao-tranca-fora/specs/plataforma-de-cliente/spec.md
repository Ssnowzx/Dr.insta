## MODIFIED Requirements

### Requirement: Recuperação de acesso sem canal externo

Sem canal externo, uma pessoa que não consegue entrar NÃO SHALL depender de si mesma para recuperar acesso. O sistema SHALL registrar a tentativa e apresentá-la ao consultor, e SHALL permitir que apenas o consultor autenticado emita uma credencial de acesso nova.

A tela de recuperação NÃO SHALL emitir credencial: uma requisição não autenticada capaz de emitir invalidaria a credencial pendente de quem está no meio de uma recuperação.

Uma credencial nova SHALL invalidar a anterior de mesma finalidade.

As telas de entrada e de recuperação SHALL permanecer alcançáveis por qualquer
requisição, independentemente de credencial residual no navegador. Um desvio
para fora dessas telas SHALL ser decidido por verificação da sessão contra o
armazenamento, nunca pela mera presença de uma credencial — que não prova sessão
alguma. Sem canal externo, quem perde o caminho para essas duas telas fica sem
caminho nenhum.

#### Scenario: Pessoa não consegue entrar

- **WHEN** ela informa o endereço na tela de recuperação
- **THEN** a resposta é a mesma exista ou não aquele cadastro
- **AND** nenhuma credencial é emitida
- **AND** a tentativa aparece na tela de atividade do consultor

#### Scenario: Credencial no navegador sem sessão viva

- **WHEN** alguém com credencial residual — sessão revogada, expirada, restaurada de backup, ou conta desativada — requisita qualquer tela protegida
- **THEN** ela chega à tela de entrada
- **AND** a tela de entrada é apresentada, sem novo desvio
- **AND** a tela de recuperação também permanece alcançável

#### Scenario: Pessoa com sessão viva pede a tela de entrada

- **WHEN** alguém já autenticado requisita a tela de entrada ou a de recuperação
- **THEN** ela é levada para a tela inicial
- **AND** essa decisão vem da verificação da sessão, não da presença da credencial

#### Scenario: Consultor emite acesso

- **WHEN** o consultor autenticado emite uma credencial para alguém
- **THEN** a credencial é apresentada na tela para ser repassada
- **AND** qualquer credencial anterior de mesma finalidade deixa de valer
- **AND** o prazo de validade é declarado

#### Scenario: Emissão por quem não é consultor

- **WHEN** alguém sem papel de consultor tenta emitir uma credencial
- **THEN** a operação é recusada

## ADDED Requirements

### Requirement: Destino preservado ao pedir autenticação

Quem é desviada para a tela de entrada por não ter credencial SHALL ter o
destino original preservado, e SHALL ser levada a ele depois de autenticar.

O destino SHALL ser um caminho interno; valor que aponte para fora da origem
SHALL ser recusado. O endereço da tela de entrada NÃO SHALL repetir os
parâmetros do destino fora dele.

#### Scenario: Link para tela interna sem sessão

- **WHEN** alguém sem credencial abre um link para uma tela protegida específica
- **THEN** ela é levada para a tela de entrada
- **AND** o destino original viaja junto, uma única vez
- **AND** depois de autenticar ela chega àquela tela, não à inicial

#### Scenario: Destino apontando para fora

- **WHEN** o destino informado aponta para outra origem
- **THEN** ele é descartado e a pessoa vai para a tela inicial
