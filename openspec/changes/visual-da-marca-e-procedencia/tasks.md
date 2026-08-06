> **Estado: implementado e verificado em 06/08/2026.** Nasce marcado porque a
> mudança foi construída antes de ser registrada. É relato, não lista a fazer.

## 1. A paleta, por medição

- [x] 1.1 Amostrar o hero de `myfavorite.com.br` por pixel e extrair a família dominante
- [x] 1.2 Derivar `--caramelo`/`--dado` estendendo o matiz da marca até peso de texto e de marca
- [x] 1.3 Reescrever o cabeçalho do `base.css` com a origem dos valores e a instrução de amostrar antes de mexer
- [x] 1.4 Corrigir `--linha`, que reprovou por 0,01 no par contra o cartão

## 2. Um tema que dá para ver

- [x] 2.1 Converter 21 tokens para `light-dark(claro, escuro)` e apagar o segundo bloco
- [x] 2.2 `--sombra` fica condicional — `light-dark()` só aceita `<color>`
- [x] 2.3 `components/tema.tsx` com três estados; troca apenas `color-scheme`
- [x] 2.4 Script inline no `<head>` aplicando antes da primeira pintura
- [x] 2.5 Mover a constante para `lib/tema.ts` — atravessava a fronteira cliente/servidor
- [x] 2.6 Botão na coluna e na barra superior
- [x] 2.7 Parser do teste lê `light-dark()`; trava nova prova que ele lê duas paletas

## 3. Tipografia

- [x] 3.1 Display passa a Instrument Serif Itálico; `font-smoothing: auto` no display
- [x] 3.2 `.numero` sai do mono — `tabular-nums` já vive no `body`
- [x] 3.3 Medir a escala por `getComputedStyle` e abrir os nove elementos espremidos entre 11 e 15px
- [x] 3.4 Entrelinha do corpo 1,55 → 1,60; degraus do funil 1,5rem → 2,25rem

## 4. Tecido

- [x] 4.1 Urdume, trama e ruído fractal em data-URI, sem arquivo de imagem
- [x] 4.2 `--fio` redefinido na placa re-resolve `--tecido`: página linho, placa lã
- [x] 4.3 Fio inverte no tema escuro, com alfa menor

## 5. Procedência

- [x] 5.1 `lib/origem.ts` descrevendo cada fonte e separando medido de informado
- [x] 5.2 `how_to_measure` entra na consulta; `note` passa a ser renderizada
- [x] 5.3 Nota de atribuição em `transactions` e `revenue` — julho não teve link etiquetado
- [x] 5.4 Teste lê o enum do `schema.ts` para não deixar fonte nova sem descrição

## 6. O método visível

- [x] 6.1 `experiments()` — a tabela não era referenciada em nenhum arquivo fora do schema
- [x] 6.2 Seção em `/plano` com hipótese, variável isolada, critério e amostra mínima
- [x] 6.3 Reescrever três hipóteses que falavam dela em terceira pessoa
- [x] 6.4 Remover a promessa de "~8 minutos de leitura" sem nada para ler

## 7. Acervo

- [x] 7.1 `lib/acervo.ts` — mediana, comparação e taxa por mil views, com 12 testes
- [x] 7.2 `reposts` deixa de ser descartado, rotulado como repost e nunca compartilhamento
- [x] 7.3 Mediana fora do filtro, para a régua não seguir o recorte

## 8. Gráfico no dedo

- [x] 8.1 `lib/serie.ts` com o mapeamento de ponteiro para ponto, 11 testes
- [x] 8.2 Leitura em slot fixo acima do gráfico; `touch-action: pan-y`
- [x] 8.3 Estado de arrasto próprio, não lido de `hasPointerCapture`
- [x] 8.4 Suprimir a variação em mês parcial — contradizia a legenda do próprio gráfico
- [x] 8.5 Teclado e `aria-live`

## 9. Semente

- [x] 9.1 `onDuplicateKeyUpdate` das métricas passa a propagar `note`
- [x] 9.2 O dos experimentos passa a propagar `name`, `hypothesis` e `successLabel`

## 10. Verificação

- [x] 10.1 `npm run lint`, 243 testes, `validar:tudo`
- [x] 10.2 48 pares de contraste nos dois temas
- [x] 10.3 Percurso das seis telas nos dois papéis, com o banco no estado zerado
- [x] 10.4 Interação do gráfico com eventos de toque, ponto a ponto
- [x] 10.5 390px sem estouro horizontal

## 11. Aberto — não é desta mudança

- [ ] 11.1 Varrer os demais `onDuplicateKeyUpdate` da semente pelo mesmo defeito
- [ ] 11.2 Decidir se as entregas apontam para o documento (precisa de migração)
- [ ] 11.3 `cycle.north_star_metric` duplica `metric_def.tier` sem nada sincronizar
- [ ] 11.4 `RequestRow.dueOn` é buscado e nunca renderizado
