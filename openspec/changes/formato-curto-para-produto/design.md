## Context

Ver `proposal.md — Why` para a motivação. O que importa aqui são três restrições de método que moldam a abordagem.

**A amostra tem duas metades desiguais.** Os 203 Reels de 01/01 a 05/08/2026 têm views, curtidas, comentários, reposts, duração e legenda — todos de API pública. Alcance, salvamentos, compartilhamentos em DM e retenção existem para **6 Reels**, os de julho, vindos de print de Insights. A mesma página vai conter as duas metades e não pode misturá-las.

**Já existe um ciclo em execução.** `ativar-ciclo-conversao-agosto` fixou a ordem obrigatória de experimentos e o mix de pilares em 04/08/2026. Esta mudança entra dentro daquela, não ao lado. Se ela criar uma quarta variável, invalida a leitura dos 14 dias que ainda nem começou.

**O canal com a cliente é uma página HTML publicada.** Não há backend. A página é a conversa inteira: precisa se explicar sozinha, carregar dado sensível sem indexação e devolver o retorno dela por `wa.me` com o texto montado no cliente.

## Goals / Non-Goals

**Goals:**

- Transformar o corte do vídeo longo de produto de decisão n=1 em decisão medida, sem inflar o que o dado público sustenta
- Especificar o formato de produto de modo verificável antes da produção, não depois da publicação
- Manter uma única variável em movimento por vez, respeitando a ordem já acordada
- Entregar a análise à cliente com a fronteira entre "medido" e "pendente" visível na própria página

**Non-Goals:**

- Estimar alcance a partir de views. Nenhum fator de conversão entre as duas métricas entra no projeto
- Tocar em `src/`. O motor calcula sobre alcance e este dataset não tem alcance
- Reescrever `perfil/pilares.md` de cima a baixo. Só a evidência do corte e as duas restrições novas mudam

## Decisions

**1. A célula vazia é o achado, e não um confundidor a controlar.**

Duração e assunto-marca são colineares nesta amostra: os 23 Reels de marca são todos longos, e não existe um único de ≤20s. A leitura estatística convencional seria declarar o confundidor e desistir da conclusão. A leitura correta aqui é outra: a colinearidade **é** o fato. Ela não impede a conclusão, ela define o experimento — a célula que falta é a hipótese que nunca rodou.

Alternativa considerada: controlar por duração dentro do grupo de marca. Descartada porque a variância de duração dentro dos 23 é pequena (21s a 192s, mediana bem acima de 45s) e não há nenhum caso curto para servir de contraste. Não se controla por uma variável que não varia no lugar onde importa.

**2. Restrição de formato dentro dos pilares existentes, não um quarto experimento.**

O limite de 20 segundos e a regra de nomeação entram como **especificação de execução** de Provador e Padrão, que já estão aprovados. Isso preserva a regra "um experimento por vez": quando o mix for ativado na semana 2, a variável em teste continua sendo o mix, agora com o formato definido.

Alternativa considerada: abrir um experimento próprio "produto curto" rodando em paralelo à UTM. Descartada — `perfil/metas.md` já registra que três variáveis simultâneas não produzem conclusão válida, e a UTM é infraestrutura que precisa correr sozinha.

**3. O limite é 20 segundos, e ele vem do corte da amostra, não de opinião.**

A faixa ≤20s reúne 117 Reels com mediana de 383.580 views e reposts/views de 0,187%; a faixa 21-45s cai para 166.020 e 0,062%; acima de 45s, para ~143.000 e 0,030%. O degrau mais forte está exatamente em 20s, que é também a fronteira onde a marca desaparece da amostra. Escolher 15s seria mais agressivo sem apoio no dado; escolher 30s atravessaria o degrau.

**4. Duas metades declaradas na página, com hierarquia invertida em relação ao volume de dado.**

A metade pública tem 203 posts e responde formato. A metade de Insights tem 6 posts e responde conversão. A página abre pela conclusão de formato — que é a que aguenta peso — e trata retenção e salvamento como pendência nomeada, com o pedido de dado embutido. O contrário (abrir por retenção, que é o assunto mais interessante) daria destaque ao que tem amostra de 6.

**5. Sem dependência nova.** A página é HTML, CSS e JavaScript escritos à mão, como as duas entregas anteriores. O CSV foi produzido no navegador e transcrito com conferência de checksum — sem parser de terceiros, sem biblioteca de gráfico. Os gráficos da página são SVG inline.

## Risks / Trade-offs

**A cliente lê "seus vídeos longos são ruins" e desliga.** → A página abre pelo que funciona e pelos números altos dela (121,8 milhões de views, 14,8M no maior Reel), e trata o formato longo como problema de canal, não de talento: o conteúdo de processo produtivo não morre, muda de lugar. O nome da série dela não aparece como fracasso isolado, e sim como quatro tentativas de um formato que o Reels não distribui.

**Views inflada por loop derruba a conclusão de duração.** → A conclusão principal não depende de views: depende da célula vazia, que é composição de amostra. Onde views é citada, o texto declara o viés — e as taxas de curtida e repost, que usam o mesmo denominador inflado, penalizam o vídeo curto em vez de favorecê-lo. Ou seja, o dado é conservador na direção da conclusão.

**A exportação do Insights contradiz o corte.** Se a série longa tiver `saves/reach` alto, o formato não está morto — está no canal errado. → O requisito de rótulo de procedência mantém a conclusão de formato separada da de salvamento, então essa contradição corrige o destino do conteúdo (carrossel em vez de Reel) sem derrubar a restrição de duração dos pilares de produto.

**A restrição de 20 segundos engessa a produção.** Ela produz e escreve tudo sozinha. → 117 dos 203 Reels dela já são ≤20s: é o formato que ela mais domina, não uma imposição nova. O que muda é o assunto que entra nele, não o ritmo de produção.

**Uma restrição especificada e não medida vira burocracia.** → Cada requisito da spec tem cenário verificável antes da publicação, e a leitura fica amarrada a `saves/reach ≥ 0,8%` em 14 dias e 7 posts. Se não medir, a mudança é arquivada como falha de método, não como formato errado.

## Migration Plan

1. `perfil/pilares.md` e `perfil/metas.md` recebem a evidência de 203 posts e as duas restrições novas — texto, sem mudança de estrutura
2. A página da análise vai para `relatorios/bianca-olivo-2026-08-reels/`, publicada por CLI (a pasta está no `.gitignore`, então deploy por Git não a enxerga)
3. A restrição de formato só entra em vigor junto com a ativação do mix, na semana 2, depois da UTM
4. **Rollback:** se `sends/reach` do pilar Espelho cair mais de 25% por 3 semanas, a realocação foi longe demais — volta-se ao volume anterior de Espelho e a restrição de produto continua valendo apenas para os posts de Provador e Padrão

## Open Questions

- A exportação do Business Suite existe para conta de Criador com Página ligada? Se não existir, o recorte de alcance por Reel cai para amostra dirigida (ranking por mês) e a leitura de `saves/reach` por post fica limitada aos posts novos. Não muda spec, design nem tarefas — muda o tamanho da amostra da leitura de 14 dias
- Qual a data exata de ativação da UTM. Define o início da janela e é tarefa 2.5 da mudança ativa
