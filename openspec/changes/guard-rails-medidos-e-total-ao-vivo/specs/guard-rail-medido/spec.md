## Purpose

Define de onde sai o piso de um guard-rail, o que a tela precisa dizer quando duas
medições discordam, e por que nenhum piso ganha folga sem medição que a sustente.

## ADDED Requirements

### Requirement: O piso vem da mesma medição que o cartão exibe

O piso de um guard-rail SHALL vir do mesmo instrumento e da mesma população que o
valor exibido no cartão. Um piso medido por um instrumento e um valor medido por
outro produzem um veredito sobre o instrumento, não sobre o desempenho.

O piso SHALL cobrir um período **fechado** e SHALL declarar em `baseline_on` a data
que o número descreve — não a data em que foi transcrito. Um piso auditado meses
depois precisa dizer de que janela saiu.

#### Scenario: Régua trocada no meio do ciclo quando ela aperta

- **WHEN** a medição nova é mais fiel e resulta num piso MAIS ALTO
- **THEN** o piso é trocado, e a decisão anterior é registrada como revista
- **AND** o motivo declarado é que o risco de "parecer cumprido por mudança de
  fonte" se inverte quando a régua nova exige mais

#### Scenario: Amostra abaixo do mínimo não vira piso

- **WHEN** uma medição tem menos de 7 posts
- **THEN** ela NÃO SHALL ser usada como piso enquanto existir medição de população
  completa para o mesmo período

### Requirement: Nenhum piso ganha folga que ninguém mediu

O piso SHALL ficar exatamente no valor medido enquanto não houver medição que
descreva a variação normal da conta. Uma margem de conforto arbitrada SHALL NOT ser
aplicada: ela silencia o alarme com um número que ninguém apurou.

Uma tolerância JÁ DECIDIDA e registrada SHALL ser preservada, e SHALL continuar
declarada em prosa no próprio cartão.

#### Scenario: Primeiro cruzamento depois da calibração

- **WHEN** um guard-rail acusa queda pela primeira vez com um único mês fechado de
  histórico
- **THEN** o cruzamento é lido, e não obedecido
- **AND** a banda real só é fixada com dois meses fechados

### Requirement: Divergência declara a população, não só o número

Quando duas fontes medem o mesmo par métrica × período e discordam, a tela SHALL
mostrar as duas e SHALL declarar o tamanho da amostra da leitura perdedora quando ele
existir.

Duas taxas que discordam por três ou quatro vezes são duas populações diferentes, e
não duas opiniões. Sem a amostra, o leitor não tem como pesar uma contra a outra e é
convidado a tratá-las como equivalentes — que é a falsa certeza que a nota de
divergência existe para evitar.

#### Scenario: A leitura perdedora sem amostra registrada

- **WHEN** a linha divergente não tem `sample_size`
- **THEN** a frase termina no ponto final, sem inventar um tamanho

### Requirement: `contaminated` sai quando a medição que o justificava é substituída

A marca `contaminated` SHALL ser removida quando o baseline passar a vir de uma
medição de população completa sobre período fechado. A marca descreve a força do
baseline, e mantê-la depois disso esconde que o problema foi resolvido.

#### Scenario: Medição forte substitui a fraca

- **WHEN** um baseline de amostra insuficiente é trocado por um de mês fechado
- **THEN** a marca sai junto
- **AND** o aviso "ainda não dá para fixar meta com este número" some do cartão
