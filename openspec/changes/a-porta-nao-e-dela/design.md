## Context

Ver `proposal.md — Why`. Tudo aqui saiu de medição no navegador com a aplicação
rodando, nos dois temas, e não de leitura de código.

## Goals / Non-Goals

**Goals:**

- A plataforma não se apresenta como a marca de quem ela atende.
- O tema escuro tem a mesma qualidade que o claro — não "também funciona".
- Uma afirmação na tela pode ser conferida pela própria tela.
- A cliente tem pelo menos um sinal de que algo a espera.

**Non-Goals:**

- Identidade visual para a consultoria. Ele escolheu não nomear nada na porta.
- Sistema de notificação. O contador é o mínimo viável.
- Refazer o contraste de todas as bordas do produto.

## Decisions

### 1. A marca vem do banco, e só existe depois da sessão

Fora da sessão não há cliente para nomear — literalmente: a tela de entrada é
alcançada antes de qualquer identificação. Ali, nenhuma marca.

Dentro, `generateMetadata` no layout do grupo lê `client.brand` e monta
`%s — <marca>`; cada página declara só o próprio nome. `clientProfile` virou
`cache()` porque passou a ser lido duas vezes por render — título e cabeçalho.

**Consequência que importa:** a string "My Favorite" não existe mais no código.
Uma segunda instância nomeia a própria cliente sem ninguém editar nada.

### 2. No escuro, camadas se fazem com luz

A medição fechou a questão: placa contra papel dá 14,78 no claro e **1,18** no
escuro. Escurecer o campo não resolve — near-black contra papel escuro dá 1,07.
No fundo da curva de luminância não sobra espaço para separar duas superfícies
por tom, e nenhuma escolha de marrom teria funcionado.

O que separa então:

- o campo cai para `--poco` (quase preto), e o ganho **não** é o delta com o
  papel — é a luz nude subindo de 9,8:1 para **12,3:1**. Os anéis deixam de ser
  decoração e viram fonte de luz;
- a costura entre as metades é uma hairline acesa com glow;
- o formulário ganha cartão com aresta visível e sombra funda — cartão e fundo
  ficam 1,09 apart, quem separa é a borda.

### 3. Os anéis são dimensionados pelo container, não em `rem`

A caixa muda de forma completamente: 500×208 no celular, ~717×900 ao lado do
formulário. Tamanho fixo que serve a uma é fatiado pela outra, e círculo cortado
pela moldura para de ler como círculo — a luz só aparece e some nas bordas.

`cqmin` (fração do lado menor do próprio container) resolve para qualquer
proporção e **apagou um breakpoint inteiro**: os três anéis passaram a existir
também no celular, onde antes dois eram escondidos.

A assinatura usa `cqi` — a **largura** — porque largura é o que causa quebra de
linha, e a altura da banda é fixa. Medir pelo lado menor a teria prendido no
piso fingindo adaptação.

### 4. `--dado-texto` em vez de reusar `--caramelo`

`--dado` está declarado como preenchimento de gráfico, validado a 3:1, e estava
servindo de `color` em seis lugares onde o piso é 4,5.

`--caramelo` sobre `--dado-fraco` mede 4,27 — reprova. Um token novo era
necessário de qualquer forma.

Fica perto de `--caramelo` de propósito: os dois são a matiz da marca em peso de
texto. Continuam separados porque respondem a coisas diferentes — `--caramelo` é
link e se move com decisões sobre links; este é medida e se move com `--dado`.
No escuro assume o valor do próprio `--dado`, que já passava: **nada muda
naquele tema**.

### 5. O teste de contraste testa pares, e o buraco era nomeável

`test/contrast.test.ts` é bom e não pegaria nada disso: ele mede **pares de
tokens**, e os pares que reprovavam não estavam na lista. Pior, `--dado` estava
lá — como preenchimento, com mínimo 3, não como texto.

O arquivo já dizia a regra ("adicionar um par na UI significa adicioná-lo
aqui"). O que faltava era cumprir. Sete pares novos: os do poço, os das bordas
de campo e o do contador.

### 6. As contagens dos chips são cruzadas

Cada eixo é contado **dentro** do recorte do outro. Com "até 20s" ligado, "fala
da marca" mostra `0` — a casa vazia aparece no controle, não só na frase acima
dele.

`marcaTotal` e `marcaCurto` continuam absolutos: o texto do achado é uma
afirmação sobre o acervo inteiro, e uma afirmação que muda a cada clique seria
uma afirmação diferente a cada clique.

A linha de estado usa a contagem real do recorte e não `lista.length` — a lista
para em 60, e dizer "60 Reels neste recorte" de um corte com 117 transformaria
limite de página em fato sobre o acervo dela.

### 7. O contador vale para os dois papéis

É o mesmo fato lido de qualquer lado: o que ainda é dela responder. Um `if` por
papel produziria duas verdades sobre a mesma tabela.

Conta `open` e `in_progress`, igual ao painel e à lista que ela abre. Um badge
que discorda da tela atrás dele ensina a não confiar no badge.

## Risks / Trade-offs

- **A tela de entrada segue o tema do sistema** e não tem interruptor. Quem
  nunca entrou não escolheu tema; herda o do aparelho. Aceito: as duas versões
  foram medidas e nenhuma reprova.
- **O contador não zera sozinho.** Fica aceso enquanto o pedido estiver aberto,
  mesmo depois de ela mandar o arquivo — porque quem fecha o pedido é ela. É
  coerente com a tela, e pode cansar.
- **Escurecer `--suave`** melhorou todo texto de apoio do produto e alterou
  levemente o tom de muita coisa. Mudança global, verificada nas quatro telas.
