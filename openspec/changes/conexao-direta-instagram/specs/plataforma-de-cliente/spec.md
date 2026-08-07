## ADDED Requirements

### Requirement: Origens concorrentes para o mesmo número têm ordem declarada

Quando o mesmo indicador existir para o mesmo período vindo de mais de uma
origem, a interface SHALL apresentar exatamente um valor, escolhido por ordem de
precedência declarada, e NÃO SHALL somar, mediar ou repetir o indicador.

A precedência SHALL preferir origem contada por instrumento a origem transcrita
por pessoa, e origem transcrita por pessoa a valor informado.

Quando existir valor descartado por precedência que **divirja** do apresentado, a
divergência SHALL permanecer registrada e SHALL ser apresentável junto ao
número. Duas medições que discordam são informação sobre a confiança do dado;
esconder a perdedora transforma desacordo em certeza falsa.

#### Scenario: Mesma métrica por duas origens

- **WHEN** um indicador existe para o mesmo período com origem automática e origem transcrita
- **THEN** a tela apresenta um único valor, o de origem automática
- **AND** o indicador aparece uma única vez

#### Scenario: Divergência entre origens

- **WHEN** o valor descartado por precedência difere do apresentado
- **THEN** a divergência fica registrada e disponível junto ao número

#### Scenario: Origem de menor precedência sozinha

- **WHEN** o indicador existe apenas na origem de menor precedência
- **THEN** ele é apresentado normalmente, marcado com a própria origem

### Requirement: A cliente enxerga e resolve o estado da própria conexão

A área da cliente SHALL apresentar se a conta está conectada, desde quando, e
quando os números foram colhidos pela última vez.

Quando a conexão exigir ação dela, a interface SHALL dizer o que aconteceu em
linguagem de consequência — não de erro técnico — e oferecer o caminho para
resolver.

A cliente SHALL poder desconectar a conta a qualquer momento, pela própria
interface. Autorização que só o outro lado pode desfazer não é autorização.

#### Scenario: Conta conectada

- **WHEN** a cliente abre a tela de conexão com a conta conectada
- **THEN** ela vê que está conectada e quando foi a última coleta

#### Scenario: Conta nunca conectada

- **WHEN** a cliente abre a tela sem nenhuma conexão
- **THEN** ela vê o que será acessado e o caminho para conectar

#### Scenario: Conexão exigindo ação

- **WHEN** a conexão caiu e depende dela para voltar
- **THEN** a tela diz o que deixou de acontecer e oferece reconectar

#### Scenario: Desconexão pela cliente

- **WHEN** a cliente desconecta a conta
- **THEN** a credencial guardada deixa de ser utilizável
- **AND** as métricas já coletadas permanecem
