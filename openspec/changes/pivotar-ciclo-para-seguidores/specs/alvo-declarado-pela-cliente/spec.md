## Purpose

Define o que acontece quando o alvo que a cliente declara contradiz o diagnóstico tirado dos dados: quem prevalece, o que precisa estar dito antes de obedecer, e como o diagnóstico vencido é preservado como risco declarado em vez de ser apagado.

## ADDED Requirements

### Requirement: O alvo declarado pela cliente prevalece

Quando a cliente declarar explicitamente um objetivo que contradiz o diagnóstico vigente, o objetivo dela SHALL prevalecer e o ciclo SHALL ser reescrito para servi-lo. A discordância técnica SHALL ser registrada uma vez, com números, e não SHALL ser relitigada a cada entrega.

A razão é observada, não teórica: o perfil é dela, e o ciclo de conversão de 04/08/2026 foi encerrado sem leitura porque a cliente não executou um plano que não reconhecia como seu — dos cinco ajustes recomendados, nenhum dos dois verificáveis saiu.

#### Scenario: Objetivo da cliente contradiz o diagnóstico

- **WHEN** a cliente declarar um alvo que os dados apontam como não sendo o gargalo
- **THEN** o ciclo é reescrito para o alvo dela, a discordância é registrada uma vez com a aritmética, e as entregas seguintes não reabrem a discussão

#### Scenario: Recomendação futura contraria o alvo declarado

- **WHEN** uma skill ou leitura produzir recomendação que serve o diagnóstico antigo em vez do alvo declarado
- **THEN** a recomendação é reenquadrada para o alvo vigente, ou entregue como risco declarado — nunca como redirecionamento do ciclo

### Requirement: A aritmética vem antes da obediência

Antes de o ciclo ser reescrito, o alvo declarado SHALL ser convertido em números verificáveis e apresentados ao usuário: baseline atual com a fonte, distância até o alvo, prazo em dias, ritmo necessário, fator sobre o ritmo atual e a data em que o alvo chegaria mantido o ritmo de hoje. Um alvo cuja aritmética não foi apresentada SHALL NOT ser adotado como métrica-norte.

#### Scenario: Alvo numérico declarado pela cliente

- **WHEN** a cliente declarar um alvo com número e prazo
- **THEN** a resposta apresenta baseline, distância, ritmo necessário, fator e a data no ritmo atual, antes de qualquer plano de execução

#### Scenario: Baseline indisponível

- **WHEN** o baseline necessário para converter o alvo em ritmo não existir ou estiver desatualizado
- **THEN** o levantamento do baseline vira o primeiro passo do ciclo e o alvo fica declarado como provisório até existir número

### Requirement: O diagnóstico vencido vira risco declarado

O diagnóstico superado pelo alvo da cliente SHALL ser preservado no painel como acompanhamento, com o baseline medido como piso, e SHALL NOT ser removido dos arquivos de contexto. O registro SHALL dizer que ele mudou de prioridade, não que deixou de ser verdadeiro, e SHALL declarar a condição que o reabriria.

#### Scenario: Métrica rebaixada

- **WHEN** uma métrica-norte for substituída por decisão da cliente
- **THEN** a métrica anterior permanece no painel como guard-rail com piso no baseline, e o registro nomeia a condição de reabertura

#### Scenario: Sinal rebaixado se deteriora

- **WHEN** a métrica rebaixada cair abaixo do piso registrado
- **THEN** a queda é reportada como custo do ciclo vigente, com o número, sem que isso por si só troque o alvo

### Requirement: Contradição vira mudança registrada

Uma contradição entre o alvo declarado pela cliente e o ciclo em curso SHALL gerar uma mudança OpenSpec própria antes de qualquer execução, e o ciclo superado SHALL ser encerrado com desfecho escrito — inclusive quando o desfecho for "fechou sem leitura". Ajuste silencioso de métrica-norte em arquivo de contexto SHALL NOT ocorrer.

Ciclos encerrados sem leitura SHALL ser contados no registro. Dois ou mais seguidos SHALL ser reportados ao usuário como padrão a observar, porque a alternância rápida de objetivo impede qualquer hipótese de completar sua janela de medição.

#### Scenario: Segundo ciclo consecutivo encerrado sem leitura

- **WHEN** um ciclo for encerrado antes da primeira leitura e o anterior também tiver sido
- **THEN** o desfecho registra a contagem e reporta ao usuário que nenhuma hipótese chegou a ser testada nos dois ciclos

#### Scenario: Tentativa de ajuste direto no contexto

- **WHEN** a métrica-norte for alterada apenas editando `CLAUDE.md` ou `perfil/metas.md`
- **THEN** a alteração é tratada como incompleta até existir a mudança OpenSpec correspondente com o desfecho do ciclo anterior
