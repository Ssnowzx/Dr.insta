## 1. Dataset e procedência

- [x] 1.1 Extrair os 203 Reels de 01/01 a 05/08/2026 pela API pública e salvar em `dados/metricas/bianca-olivo-reels-2026-01-08.csv`
- [x] 1.2 Conferir integridade do CSV por checksum (views 121.828.977 · curtidas 6.380.123 · comentários 72.306 · reposts 225.874 em 203 linhas)
- [x] 1.3 Confirmar que `media_repost_count` é repost e não compartilhamento, cruzando com os prints de julho
- [ ] 1.4 Registrar em `dados/metricas/README.md` o esquema do CSV, a data da extração e os dois limites de procedência

## 2. Análise entregue à cliente

- [x] 2.1 Montar a página em `relatorios/bianca-olivo-2026-08-reels/` com as duas metades separadas (203 posts de dado público · 6 posts de Insights)
- [x] 2.2 Abrir a página pelos números altos dela e tratar o formato longo como problema de canal, não de talento
- [x] 2.3 Desenhar o corte por faixa de duração e a célula vazia da matriz marca × duração — feito em barras CSS com largura por custom property, não em SVG: gráfico de barra horizontal responsivo sai mais robusto em CSS e não precisou de `viewBox`
- [x] 2.4 Embutir o pedido dos dados que faltam — exportação do Business Suite e os 9 prints de curva nomeados por código
- [x] 2.5 Incluir o ciclo de retorno: placar do que ela marcou, campo aberto e botão que abre `wa.me` com o texto pronto
- [x] 2.6 Medir contraste de todos os pares de cor nos dois temas antes de entregar — 54 pares, 0 reprovados nos dois temas; achou e corrigiu `.linkbox-rot` a 1,92:1
- [x] 2.7 Medir as três faixas de media query (360px, 768px e 1710px) nos dois temas: nenhum estouro horizontal, nenhuma rolagem lateral
- [x] 2.8 Enquadrar a página como continuidade dos cinco ajustes já entregues, para não empilhar tarefa nova sobre a cliente
- [x] 2.9 Preparar `vercel.json` com `noindex`, `nosniff` e `no-referrer`, e telefone montado em partes no JS
- [x] 2.10 Campo de envio de arquivo na própria página via Web Share, sem backend e sem terceiro: os arquivos ficam na memória do navegador até a cliente escolher o app de destino
- [x] 2.11 Detectar ausência de suporte a compartilhar arquivo (o caso do desktop, onde nasce o CSV) e trocar o texto por instrução de anexar na conversa, em vez de deixar botão que falha
- [x] 2.12 Linkar as duas entregas em cartão recíproco, sem misturar conteúdo, com a URL numa constante única que esconde o cartão quando vazia
- [x] 2.12b Porta no começo da leitura (pílula com seta, alvo de toque de 45px de altura) e linha de ação explícita no cartão do fim ("abrir o plano →"): cartão sem verbo e sem seta não se anuncia como clicável, e no celular não há hover para revelar afordância
- [x] 2.13 Mover a raiz de deploy para `relatorios/` com `vercel.json` e `.vercelignore` que mantêm a auditoria de julho fora do ar
- [x] 2.14 Publicar por CLI a partir de `relatorios/` no projeto `bianca-olivo-entregas` e conferir no ar: `X-Robots-Tag` presente nas duas páginas, `/bianca-olivo-2026-07/` em 404, raiz em 404, sem proteção de acesso na frente, 60 pares de cor sem reprovação nos dois temas e ida e volta entre as páginas funcionando
- [ ] 2.15 Mandar para a cliente os dois links novos, avisando que o link antigo do plano foi substituído
- [ ] 2.16 Decidir o que fazer com os dois deploys antigos que seguem no ar: `bianca-olivo-2026-08-plano-primeira` (versão com o defeito de contraste) e `auditoria-bianca-vercel` (auditoria de julho, com receita e demografia)

## 3. Documentos de perfil

- [ ] 3.1 Substituir em `perfil/pilares.md` a evidência do corte (hoje n=1) pela dos 203 Reels e da série de 4 episódios
- [ ] 3.2 Acrescentar em `perfil/pilares.md` o limite de 20 segundos para Provador e Padrão
- [ ] 3.3 Estender em `perfil/pilares.md` a regra "nome + contexto + destino" dos Stories para os Reels
- [ ] 3.4 Acrescentar em `perfil/metas.md` o baseline público de 203 Reels, mantendo a ressalva de amostra 6 para alcance e retenção

## 4. Ativação — depois da UTM, na semana 2

- [ ] 4.1 Confirmar com a cliente o limite de 20 segundos para conteúdo de produto antes de valer
- [ ] 4.2 Combinar o destino do conteúdo de processo produtivo (Stories, destaque ou carrossel) em vez de Reel
- [ ] 4.3 Registrar a data em que a restrição passa a valer, para marcar o início da janela de 14 dias

## 5. Leitura

- [ ] 5.1 Após 14 dias e no mínimo 7 posts de produto no novo formato, medir `saves/reach` contra o critério de 0,8%
- [ ] 5.2 Medir retenção do conteúdo de produto contra o critério de 40%
- [ ] 5.3 Conferir que `sends/reach` do pilar Espelho não caiu — é o controle
- [ ] 5.4 Contar quantos Reels de produto saíram com peça nomeada e destino ativo, contra os 9 em 203 do baseline
- [ ] 5.5 Quando a exportação do Insights chegar, juntá-la ao CSV público pelo código do Reel e rodar `npm run ig -- analisar <csv> --nicho lifestyle`
- [ ] 5.6 Arquivar esta mudança com o que aconteceu com `saves/reach`, inclusive se falhou
