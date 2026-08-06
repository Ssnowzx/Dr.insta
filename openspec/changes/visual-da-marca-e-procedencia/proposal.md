## Why

A plataforma tinha identidade visual própria e nenhuma relação com a marca da
cliente — e mostrava números sem dizer de onde vinham.

**A paleta era invenção.** Quatro direções foram construídas e reprovadas em
sequência (caramelo herdado, rosa-choque, ouro fundido, bordô). O motivo era
sempre o mesmo e não era o matiz: **ninguém tinha olhado a marca**. A Bianca é
diretora criativa e fundadora da My Favorite, o site está no ar, e a resposta
estava a um `cat perfil/perfil.md` de distância.

**E os números não tinham endereço.** O consultor precisou perguntar de onde
saía "23 compras" e se era média. A resposta já estava no banco: `metric_def.
how_to_measure` nunca era selecionado na consulta, e `metric_value.note` era
buscado e nunca renderizado. Num produto cujo argumento inteiro é procedência,
a tela mostrava a medida e escondia a régua.

**E o método estava invisível.** `experiment` não era referenciada em nenhum
arquivo fora do schema: quatro experimentos com hipótese, variável isolada e
critério de sucesso, que ninguém nunca viu.

## What Changes

- **BREAKING** paleta inteira substituída, derivada por **amostragem de pixel**
  do hero de `myfavorite.com.br` (matiz 12–23°, saturação 17–43%, luminosidade
  59–80%). A interface **estende** a família em vez de copiá-la: o nude da loja
  mede 1,6:1 sobre branco e não carrega texto.
- Os 21 tokens de cor passam a `light-dark(claro, escuro)` — os dois valores
  numa linha só, e o **segundo bloco de paleta deixa de existir**.
- **Interruptor de tema** com três estados (sistema · claro · escuro), que muda
  apenas `color-scheme`. Antes não havia como ver um dos temas.
- Textura de tecido em **CSS puro**: urdume, trama e ruído fractal em data-URI.
- Display passa de Italiana para **Instrument Serif Itálico** — a face anterior
  tinha hastes de cabelo e sumia em claro-sobre-escuro.
- `.numero` **deixa o mono**: `tabular-nums` já vive no `body`, então a família
  monoespaçada nunca foi funcional.
- **Procedência em cada métrica**: selo da fonte, o que ela significa, onde o
  número é lido, e a ressalva daquele valor.
- **Os experimentos aparecem** em `/plano`, com a amostra mínima declarada.
- Cada post do acervo passa a trazer **posição contra a mediana dela** e
  comentários por mil views; `reposts` deixa de ser descartado.
- **Gráficos reagem ao dedo** — leitura por ponto, num slot fixo acima do
  gráfico.
- Removida a promessa de "~8 minutos de leitura" que não tinha o que ler.

## Capabilities

### New Capabilities

Nenhuma. Muda como capacidades existentes se apresentam e o que declaram.

### Modified Capabilities

- `plataforma-de-cliente`: passa a exigir que todo número apresentado declare a
  fonte e a forma de medição; que o método (hipótese, variável isolada, critério
  e amostra mínima) seja visível para a cliente; que exista escolha de tema; e
  que a interface não prometa conteúdo que não possui.

## Impact

- **Código:** `app/base.css` (paleta e escala), `app/(app)/app.css`,
  `components/{metric-bar,series,funnel,nav,tema}.tsx`, `lib/{origem,acervo,serie,tema}.ts`,
  `app/(app)/{plano,conteudo}/page.tsx`, `db/seed.ts`.
- **Banco:** nenhuma migração. As notas de atribuição entram por semente.
- **Testes:** 243 passando. Contraste com **48 pares** medidos nos dois temas,
  mais uma trava que prova que o parser lê duas paletas e não a mesma duas vezes.

## Fora de escopo

- **Ligar as entregas ao documento real.** `delivery` não tem conteúdo nem URL;
  os textos vivem em páginas no Vercel. Precisa de migração e é decisão dele.
- **Traduzir `src/` para inglês.** Fronteira intocada.
- **Medir perguntas de compra nos comentários.** O endpoint privado estrangula
  depois de ~20 requisições; exige a API oficial.

## Métrica observável

A paleta não move métrica sozinha e dizer o contrário seria invenção. O que
muda de forma verificável é a leitura: cada post do acervo passa a mostrar sua
posição contra a mediana da própria conta, e cada métrica passa a declarar
origem. O primeiro efeito medível já apareceu — os dois Reels de 05/08 estão a
**18% e 35% da mediana** em views, com o de menor alcance tendo **3× mais
comentários por mil views**, leitura que os números crus escondiam.
