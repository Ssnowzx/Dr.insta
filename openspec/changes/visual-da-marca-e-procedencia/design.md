## Context

Ver `proposal.md — Why`. O que moldou o desenho foram três restrições medidas,
não preferências.

## Goals / Non-Goals

**Goals:**

- A paleta sai da marca da cliente, por medição, e não de gosto.
- Um token de cor não consegue divergir entre temas.
- Todo número na tela sabe dizer o próprio endereço.

**Non-Goals:**

- Identidade própria da plataforma. Ela é da marca dela.
- Guardar o texto das entregas. Continua fora, e a promessa de leitura saiu.

## Decisions

### 1. A paleta veio de amostragem, não de escolha

Recorte do hero de `myfavorite.com.br`, agrupamento em baldes de 16 níveis por
canal, ordenado por participação. Resultado: **uma família só**, matiz 12–23°,
saturação 17–43%, luminosidade 59–80%.

**A restrição que decide tudo:** essa família **não carrega texto**. O nude
dominante mede **1,6:1 sobre branco**. Então a interface **estende**: mesmo
matiz, empurrado fundo o bastante para medir (5,6:1 em texto, 3,9:1 em marca).

**Alternativa descartada:** copiar os hexadecimais da loja. Produz uma tela
bonita e ilegível, e reprovaria metade dos pares de contraste.

**Por que a marca sobrevive ao tema escuro e o bordô não:** clarear matiz 16°
dá pêssego, que continua sendo a família. Clarear bordô dá rosa doce. Foi o que
matou a direção anterior, e é o argumento mais forte para a paleta vir da marca.

### 2. `light-dark()` mata o segundo bloco de paleta

Os dois valores de cada token passam a viver na mesma linha. **Não existe mais
um segundo bloco para divergir.** `--sombra` é a única exceção — `light-dark()`
só aceita `<color>` — e por isso a duplicação dela está num lugar só e visível.

O interruptor troca `color-scheme` e nada mais. **Token novo não exige mudança
no componente do tema.**

O teste passou a ler `light-dark(a, b)` e ganhou uma trava que prova que ele
lê **duas paletas diferentes**: um parser que pegasse sempre o mesmo lado
passaria em 48 pares medindo um tema duas vezes.

### 3. Procedência é do produto, não da nota de rodapé

`how_to_measure` e `note` já existiam no banco. O que faltava era a consulta
selecioná-los e a tela mostrá-los.

O selo separa **medido** de **informado** porque as duas coisas não têm o mesmo
peso para decidir — e a distinção não pode depender de quem lê saber de cor que
o painel da loja é medição e a resposta de formulário não é.

### 4. Comparação contra a própria mediana, nunca contra terceiro

Mediana e não média: o acervo tem post de 7,4M ao lado de post de 84 mil, e uma
semana viral puxaria a média fazendo quase todo o trabalho dela parecer fracasso.

**Fora do filtro**, de propósito: régua que segue o recorte faz todo post
parecer mediano em todo corte, que é a única coisa que uma comparação não pode
fazer.

Views inflam por looping, e a inflação é aproximadamente constante **dentro de
uma conta** e sem sentido entre duas. Por isso a comparação é sempre interna e
a tela declara a base.

### 5. Interação de gráfico desenhada para o dedo

A leitura fica **acima** do gráfico, em slot de altura fixa. Balão que segue o
ponteiro é padrão de desktop: no toque a mão cobre exatamente o que o gesto
existe para revelar. Altura fixa porque dois gráficos ficam lado a lado e um
salto em um empurraria o outro.

`touch-action: pan-y` e não `none`: com `none` o gráfico engole a rolagem
vertical e a página trava no polegar.

O estado "arrastando" é controlado pelo componente e **não** lido de
`hasPointerCapture`. Perguntar ao navegador produziu um arrasto que marcava o
primeiro mês e nunca mais mudava, porque quando a captura não pega a guarda
rejeita todo movimento.

## Risks / Trade-offs

- **`light-dark()` exige navegador recente** → Chrome 123+, Safari 17.5+,
  Firefox 120+. Em 2026 é seguro; num navegador antigo os tokens ficariam
  inválidos e a página sairia sem cor. Não há degradação graciosa.
- **A textura é decorativa e custa pintura** → alfas de 2–3%, tile de 140px,
  `background-attachment: fixed`. Se aparecer custo de rolagem em aparelho
  fraco, o primeiro corte é o `fixed`.
- **A comparação com a mediana não vale entre contas** → está dito na tela, mas
  é o tipo de número que vaza para uma conversa sem a legenda junto.

## Migration Plan

Deploy de código mais `db:seed` — as notas de atribuição e as hipóteses
reescritas entram por semente. **Sem migração de banco.**

**Atenção medida:** o `onDuplicateKeyUpdate` da semente atualizava só
`value`/`updatedAt` nas métricas e só `updatedAt` nos experimentos, então texto
corrigido no arquivo **não chegava** a um banco que já tinha a linha — a semente
reportava sucesso e não mudava nada. Corrigido nas duas. **As demais entidades
provavelmente têm o mesmo padrão e precisam de varredura.**

**Rollback:** reverter o commit. Nada de dado foi transformado.

## Open Questions

**As entregas devem apontar para o documento?** `delivery` não tem conteúdo nem
URL, e os textos vivem em páginas no Vercel que a cliente já recebeu. A promessa
de tempo de leitura foi removida porque era falsa, mas o produto segue sem o
caminho para a leitura. Ligar exige uma coluna nova — decisão dele, e melhor
tomada depois de ver a plataforma no ar.
