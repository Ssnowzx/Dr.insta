## ADDED Requirements

### Requirement: A plataforma não se apresenta como a marca de quem atende

Telas alcançáveis sem sessão NÃO SHALL exibir a marca de nenhum cliente. Antes
da identificação não existe cliente a nomear, e assinar com a marca de um deles
faz o produto parecer pertencer a ele.

Dentro da sessão, a marca apresentada SHALL vir do registro do cliente e não do
código-fonte. Marca escrita no código é marca que mente na segunda instância.

#### Scenario: Tela de credencial

- **WHEN** alguém abre entrar, convite, recuperação ou senha nova
- **THEN** nenhuma marca de cliente aparece

#### Scenario: Tela autenticada

- **WHEN** a cliente abre qualquer tela da área autenticada
- **THEN** a marca exibida é a registrada para o cliente daquela instância

### Requirement: Uma afirmação na tela pode ser conferida pela tela

Quando a interface afirmar um fato sobre o acervo que dependa de mais de um
recorte, os controles de recorte SHALL permitir combinar esses eixos.

Contagem apresentada em um controle de recorte SHALL refletir o recorte
atualmente aplicado nos demais eixos, de modo que um cruzamento vazio apareça
como zero no próprio controle.

Contagem que sustenta uma afirmação sobre o acervo inteiro SHALL permanecer
absoluta, independentemente do recorte — afirmação que muda a cada clique é uma
afirmação diferente a cada clique.

Número apresentado como tamanho de um recorte NÃO SHALL ser o tamanho da página
exibida. Limite de exibição não é fato sobre o acervo.

#### Scenario: Dois eixos de recorte

- **WHEN** a cliente aplica um recorte e depois aplica outro de eixo diferente
- **THEN** os dois permanecem aplicados

#### Scenario: Cruzamento sem resultado

- **WHEN** um eixo está aplicado e o outro não tem nenhum item dentro dele
- **THEN** o controle desse eixo mostra zero
- **AND** ao ser escolhido, a tela explica que o cruzamento não existe no acervo

#### Scenario: Recorte maior que a página

- **WHEN** o recorte tem mais itens do que a tela apresenta
- **THEN** o total do recorte é declarado, distinto da quantidade exibida

### Requirement: A cliente é avisada do que a espera

A navegação SHALL apresentar a quantidade de pedidos em aberto para a cliente.

A contagem SHALL usar o mesmo critério da tela que ela abre ao tocar. Um
indicador que discorda da tela atrás dele ensina a não confiar no indicador.

O produto não envia mensagem por fora; sem esse indicador, um pedido aberto para
a cliente permanece invisível até ela decidir olhar.

#### Scenario: Pedidos em aberto

- **WHEN** existem pedidos em aberto ou em andamento para o cliente
- **THEN** a quantidade aparece no destino correspondente da navegação
- **AND** é anunciada por leitor de tela com o significado, não só o número

#### Scenario: Nada pendente

- **WHEN** não há pedidos em aberto
- **THEN** nenhuma contagem é apresentada

## MODIFIED Requirements

### Requirement: Contraste medido, não estimado

Todo par de cores que a interface renderiza SHALL atender WCAG 2.2 AA: 4,5:1
para texto, 3:1 para texto grande, para contorno de controle e para objeto
gráfico necessário à compreensão.

O conjunto de pares verificado automaticamente SHALL conter todo par que a
interface efetivamente renderiza. Um token validado para um uso NÃO SHALL ser
aplicado a uso de limiar mais alto sem que o novo par entre na verificação —
cor validada como preenchimento a 3:1 não é cor de texto.

A verificação SHALL cobrir os dois temas. Interface construída em um tema tem os
defeitos concentrados no outro.

Superfícies adjacentes em tema escuro NÃO SHALL depender apenas de diferença de
tom para se distinguir: no fundo da curva de luminância essa diferença não
existe, e a separação passa a ser feita por aresta, brilho ou sombra.

#### Scenario: Token usado como texto

- **WHEN** uma cor validada como preenchimento passa a ser usada como cor de texto
- **THEN** existe token próprio para esse uso, verificado a 4,5:1

#### Scenario: Contorno de campo

- **WHEN** a interface apresenta um campo de formulário
- **THEN** o contorno que o identifica atinge 3:1 contra o fundo adjacente

#### Scenario: Duas superfícies escuras vizinhas

- **WHEN** duas superfícies adjacentes precisam se distinguir no tema escuro
- **THEN** a distinção é feita por luz — aresta, brilho ou sombra — e não por tom
