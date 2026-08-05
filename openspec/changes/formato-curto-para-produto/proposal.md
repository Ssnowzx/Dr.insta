## Why

O corte do formato "apresentação de produto em vídeo longo", decidido em 04/08/2026, estava sustentado por **um único post** — o Reel da coleção Primavera 27, de 1:37 e 8% de retenção. Uma decisão de mix editorial apoiada em n=1 é palpite com sorte, e as próprias regras de leitura do ciclo (`perfil/metas.md`) exigem 7 posts ou 14 dias.

A extração de **203 Reels publicados entre 01/01 e 05/08/2026** fecha essa lacuna e revela algo que nenhum documento do projeto registrava: **o conteúdo de marca só existe no formato longo.** Nenhum dos 23 Reels que falam de marca, coleção ou lojista tem 20 segundos ou menos — o mais curto tem 21s — enquanto 117 Reels de ≤20s sem marca fazem mediana de 383.580 views contra 122.370 dos de marca. Produto em formato curto na voz dela é uma célula vazia da matriz: nunca foi testada, então não existe dado que a condene nem que a aprove.

No mesmo levantamento, **4 dos 203 Reels têm chamada para compra e 9 nomeiam uma peça.** A regra "nome + contexto + link", hoje escrita em `perfil/pilares.md` apenas para Stories, nunca alcançou o formato que concentra 121,8 milhões de views do período.

## What Changes

- Registro do dataset de 203 Reels em `dados/metricas/bianca-olivo-reels-2026-01-08.csv` (fora do git) como baseline público de formato, com checksums conferidos
- O corte do vídeo longo de produto deixa de ser hipótese de n=1 e passa a decisão apoiada em 23 posts de marca e numa série de 4 episódios ("por dentro da sua peça favorita", ~88s cada, 44.539 a 85.663 views contra mediana de 231.200 do perfil)
- **Restrição de formato para os pilares Provador e Padrão:** conteúdo de produto nasce em **≤ 20 segundos** e na mesma voz do conteúdo pessoal. Não é um quarto experimento paralelo — é a especificação de como os pilares já aprovados em `perfil/pilares.md` são executados
- A regra "nome da peça + contexto + destino" passa a valer para **Reels**, não só para Stories
- Reconhecimento explícito de dois limites de medição, para que nenhuma leitura futura os confunda: `views` não é alcance, e `media_repost_count` da API pública é **repost**, não compartilhamento em DM (confirmado contra os prints de julho: 1.986 no campo público contra 2 mil de repost e 48 mil de compartilhamento no Insights)

## Capabilities

### New Capabilities

- `formato-de-conteudo-de-produto`: como conteúdo de produto é formatado para sobreviver à distribuição e apontar para a compra — duração máxima, voz, nomeação da peça, destino e o que caracteriza o formato proibido

### Modified Capabilities

Nenhuma. `openspec/specs/` continua vazio — não há spec principal publicada.

## Impact

- `perfil/pilares.md` — Provador e Padrão ganham restrição de duração; a regra de nomeação de peça se estende a Reels; a evidência do corte do vídeo longo é substituída pela de 203 posts
- `perfil/metas.md` — o baseline de conteúdo passa a citar amostra de 203 Reels para as métricas públicas, mantendo a ressalva de que alcance, salvamentos e retenção seguem com amostra de 6
- `dados/metricas/bianca-olivo-reels-2026-01-08.csv` — novo, fora do git
- `relatorios/bianca-olivo-2026-08-reels/` — página da análise para a cliente, publicada na Vercel, fora do git
- Interage com a mudança ativa `ativar-ciclo-conversao-agosto`: esta detalha a tarefa 5.2 daquela e não altera a ordem obrigatória de experimentos (UTM primeiro, isolada)
- Sem impacto em `src/`. O motor não roda sobre este CSV — ele calcula taxas sobre alcance, e alcance é justamente o que os dados públicos não trazem

## Métrica observável

**`saves/reach` do conteúdo de produto**, hoje em 0,23% contra 1,40% de referência do nicho lifestyle. Critério: **≥ 0,8%** em 14 dias com no mínimo 7 posts de produto no novo formato.

Métrica de guarda: `sends/reach` do pilar Espelho **não pode cair** — é o controle. E retenção do conteúdo de produto **≥ 40%**, contra os 8% do Reel de lançamento.

## Fora de escopo

- **Rodar o experimento antes da UTM.** A ordem obrigatória de `perfil/metas.md` continua valendo: UTM na bio isolada primeiro. Esta mudança especifica o formato, não antecipa a ativação
- **Conclusão sobre alcance e salvamento por Reel.** Depende da exportação do Business Suite, que não chegou. Todo número desta mudança é de dado público e está rotulado como tal
- **Afirmar causalidade entre duração e alcance.** A correlação é monotônica em 5 faixas de duração, mas `views` infla com loop em vídeo curto. O que se afirma é a célula vazia, que é fato de composição da amostra e não de inferência
- **Publi paga.** Os 6 Reels com `#publi` fazem mediana de 74.985 views, o pior recorte do conjunto, mas n=6 não sustenta decisão sobre contrato comercial de terceiro
- **Crescimento e captação.** Segue adiado para o ciclo seguinte, como já definido em `ativar-ciclo-conversao-agosto`
