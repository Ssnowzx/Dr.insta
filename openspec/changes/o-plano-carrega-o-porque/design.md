## Context

Ver `proposal.md — Why`. Três fatos medidos moldaram o desenho, não preferência:

1. `step_status` com **zero linhas** dez dias após a entrega do plano.
2. O link da bio, lido no perfil dela em 06/08/2026, com `utm_source` e
   `utm_medium` presentes e **sem** `bianca`, `olivo` ou `influencer` em nenhum
   dos dois.
3. `pillar` não existia; `perfil/pilares.md` tinha a estratégia inteira e nunca
   foi lido por ninguém além do consultor.

## Goals / Non-Goals

**Goals:**

- A cliente consegue **discordar** do plano, porque vê o argumento.
- Uma etapa que pede para colar alguma coisa entrega essa coisa.
- O preço do ciclo está escrito antes de ser cobrado.
- Editar o seed volta a mudar o banco.

**Non-Goals:**

- Editar plano ou pilar pela interface. Continua sendo `db/seed.ts`.
- Classificar o acervo por pilar.
- Resolver a atribuição do lado da loja.

## Decisions

### 1. `pillar` é escopado ao ciclo, não ao cliente

Um pilar é uma aposta com data de validade. Amarrado ao cliente, o mix de agosto
seria editado em novembro e a pergunta "a aposta pagou?" perderia o objeto —
não haveria com o que comparar, porque a linha antiga teria virado a nova.

Amarrado ao ciclo, fechar o ciclo congela o mix. O próximo é uma linha nova, e
`/opsx:archive` tem o que ler.

**Alternativa descartada:** `pillar` global com `valid_from`/`valid_to`. Resolve
o mesmo, com uma dimensão temporal a mais para acertar em toda consulta, e o
ciclo já é essa dimensão.

### 2. `share_pct` não tem CHECK somando 100

Um mix somando 95 no meio de uma edição é rascunho, não corrupção. Um CHECK faria
o seed falhar na terceira linha com a tabela pela metade — pior estado que o
número provisório.

A barra normaliza pela soma real, então 95 desenha uma barra cheia de proporções
corretas em vez de uma barra com buraco no fim, que pareceria defeito de
renderização.

### 3. `metric_key` como texto, sem chave estrangeira

O seed escreve pilares e definições de métrica na mesma execução. Uma FK forçaria
ordem entre duas coisas que não dependem uma da outra de verdade, e o custo seria
um erro de integridade num seed que deveria ser reexecutável a qualquer momento.

O `LEFT JOIN` na consulta é deliberado pelo mesmo motivo: pilar apontando para
métrica que ainda não existe é rascunho, e rascunho renderiza.

### 4. O valor a colar fica na tela, não só no clipboard

`navigator.clipboard` exige contexto seguro e **não faz nada** em HTTP puro — em
alguns navegadores sem lançar exceção. Um controle cuja única saída é uma escrita
no clipboard é um controle que pode falhar em silêncio.

O valor é renderizado num `input readonly`, selecionável, e o botão é o atalho.
`readonly` e não texto puro porque `select()` num input pega o valor inteiro no
celular, e apertar-e-segurar texto não pega.

Monoespaçado: esta é uma string que se confere caractere a caractere. Um
`utm_medium` errado é exatamente a falha que originou a mudança, e ela se detecta
olhando.

### 5. `copy_note` é coluna, não parágrafo do `summary`

O `summary` responde *por que isso importa* e é lido **antes** do valor aparecer.
A nota responde *por que isso está assim*, pergunta que só ocorre depois de olhar
a string. Perguntas diferentes, momentos diferentes de leitura.

Visualmente separada por régua e **não** por cor de alerta: é explicação, não
aviso, e vesti-la de alerta faria uma resposta parecer problema.

### 6. O trade-off mora no ciclo e é citado no painel

Texto completo em `/plano`, junto do mix que o causa. No painel, ao lado da série
de views — que é onde ela verá a queda primeiro — uma frase curta apontando para
lá.

Repetir o texto inteiro nos dois lugares garante que um dia divirjam. A frase
curta pode envelhecer sem mentir.

### 7. O que o seed autora, o seed sobrescreve

`onDuplicateKeyUpdate` atualizava `title` e `updatedAt` em `step`, e só
`updatedAt` em `cycle`. Consequência: corrigir um resumo, um prazo — ou, nesta
mudança, adicionar um link para colar — imprimia "Seeded" e não mudava nada num
banco que já tinha a linha.

A regra escrita nos dois pontos: o `set` lista **tudo que o arquivo escreve**.
Ficam fora ids, `public_code` e qualquer coisa que uma pessoa editou pelo app —
`step_status` é dela e vive em tabela própria, então nada que ela respondeu corre
risco.

Corrigido em `cycle`, `step` e `pillar`. `request` continua inserindo só em
tabela vazia e as demais seguem com o padrão antigo: fora de escopo, registrado.

## Risks / Trade-offs

- **O mix pode não ser seguido.** Nada no produto verifica se o post publicado
  pertence ao pilar que deveria — `post.pillar` está vazio. A leitura em 14 dias
  vai depender de conferência manual.
- **`saves/reach` tem amostra de 6 posts**, abaixo do mínimo de 7 do projeto. O
  cartão já declara isso; o alvo de 0,8% é leitura de indício até a amostra
  fechar.
- **A cliente pode encurtar o link mesmo assim.** A nota pede para não fazer, e
  pedir não é impedir. Se acontecer, aparece como 404 e o consultor descobre
  pelo GA4, não pela plataforma.
