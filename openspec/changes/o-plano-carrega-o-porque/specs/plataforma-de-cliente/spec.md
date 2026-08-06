## ADDED Requirements

### Requirement: O plano apresenta o porquê antes do que fazer

O plano de um ciclo SHALL apresentar os pilares editoriais antes da lista de
ajustes a executar.

Cada pilar SHALL declarar a proporção do volume que lhe cabe, a métrica que ele
existe para mover e o critério numérico que resolveria se funcionou. Uma lista
de tarefas sem o argumento só pode ser obedecida ou ignorada — discordar exige
ver o raciocínio.

Quando um pilar for controle — aquele que não deve mudar — a interface SHALL
marcá-lo como tal. Sem a marca, a tela apresenta como alvo justamente o que já
sustenta a conta.

A soma das proporções NÃO SHALL ser assumida como 100: a representação gráfica
normaliza pelas proporções realmente registradas.

#### Scenario: Ciclo com pilares definidos

- **WHEN** a cliente abre o plano de um ciclo que tem pilares
- **THEN** o mix aparece antes dos ajustes
- **AND** cada pilar traz proporção, ritmo, métrica que move e critério de leitura

#### Scenario: Pilar de controle

- **WHEN** um pilar está marcado como controle
- **THEN** a interface o distingue dos demais e declara que ele não deve mudar

#### Scenario: Mix incompleto

- **WHEN** as proporções registradas não somam 100
- **THEN** a representação gráfica usa a soma real como base
- **AND** nenhuma lacuna aparece como falha de desenho

### Requirement: O ciclo declara o que custa antes de cobrar

Quando um ciclo implicar perda conhecida em alguma métrica, essa perda SHALL
estar registrada no ciclo e apresentada junto da decisão que a causa.

A tela onde a perda aparecerá primeiro SHALL remeter a essa declaração. A perda
é a metade visível da troca nas primeiras semanas; não declarada antes, a
leitura óbvia é de falha, e a reversão acontece antes da janela de leitura
fechar.

A declaração NÃO SHALL ser apresentada como erro ou alerta crítico. É um termo
combinado, e um aviso que parece urgente quando nada está errado deixa de ser
lido.

#### Scenario: Ciclo com trade-off registrado

- **WHEN** a cliente abre o plano de um ciclo que declara uma perda esperada
- **THEN** a declaração aparece junto do mix que a causa

#### Scenario: A métrica que vai cair

- **WHEN** o painel apresenta a série da métrica que a troca sacrifica
- **THEN** a tela declara que a queda é esperada e remete ao plano

### Requirement: Uma etapa que pede um valor entrega esse valor

Quando um passo do plano exigir que a cliente insira um valor exato em outra
ferramenta, o passo SHALL apresentar esse valor pronto para uso, e não apenas
descrevê-lo.

O valor SHALL permanecer visível na tela, independentemente de o mecanismo de
cópia funcionar. Cópia para a área de transferência exige contexto seguro e pode
falhar sem sinal; um controle cuja única saída é essa cópia pode não fazer nada
sem que ninguém perceba.

O passo SHALL declarar onde o valor deve ser colado.

Quando o valor tiver aparência que suscite dúvida ou correção indevida, o passo
SHALL trazer a explicação junto — e, quando a correção óbvia produzir defeito,
SHALL dizer para não fazê-la.

#### Scenario: Passo com valor a colar

- **WHEN** a cliente abre um passo que exige colar um valor
- **THEN** o valor aparece por extenso, selecionável
- **AND** o destino do valor é declarado
- **AND** existe atalho para copiar

#### Scenario: Cópia indisponível

- **WHEN** o mecanismo de cópia falha
- **THEN** a tela avisa e o valor continua visível e selecionável

#### Scenario: Valor de aparência estranha

- **WHEN** o valor tem forma que provavelmente gera dúvida
- **THEN** a explicação aparece junto dele, separada da explicação do passo
- **AND** quando a correção intuitiva causaria defeito, a tela pede que não seja feita

### Requirement: Dado semeado reflete o arquivo que o descreve

A carga de dados iniciais SHALL aplicar, em reexecução, todos os campos que ela
própria autora.

Identificadores, códigos públicos e qualquer valor produzido por ação de pessoa
na aplicação NÃO SHALL ser sobrescritos.

Uma carga que informa sucesso sem aplicar o que mudou é pior que uma que falha:
o arquivo e o banco divergem sem sinal, e a divergência só aparece na tela da
cliente.

#### Scenario: Reexecução após edição do arquivo

- **WHEN** um campo é corrigido no arquivo de carga e a carga é reexecutada
- **THEN** o banco passa a refletir o valor corrigido

#### Scenario: Reexecução sobre resposta da cliente

- **WHEN** a carga é reexecutada sobre registros que a cliente respondeu
- **THEN** as respostas dela permanecem intactas
