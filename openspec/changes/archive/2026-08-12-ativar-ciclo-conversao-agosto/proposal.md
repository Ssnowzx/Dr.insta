## Why

Os Insights de 04/07 a 03/08/2026 mostram que engajamento não é o gargalo desta conta: 5,4M de contas alcançadas, 284 mil compartilhamentos em Reels, 22 mil respostas em Stories e +20.824 seguidores em 30 dias, com curtidas e `sends/reach` na média do nicho lifestyle. O que trava está depois da atenção — **`saves/reach` de 0,23% contra 1,40% de referência** e conversão de 0,29% no e-commerce (7.976 sessões, 23 transações).

A hipótese de audiência errada foi testada e descartada: 88,7% mulheres, 68,2% entre 25 e 44 anos, 91,5% no Brasil. É a compradora da marca. O problema é ausência de caminho até a compra, e ele já tem uma prova: no dia em que a Bianca fez um unboxing natural no closet, a conversão foi 0,66% contra 0,29% da média do mês.

## What Changes

- **BREAKING** — objetivo do ciclo de 90 dias passa de "engajamento e comunidade" para **caminho até a compra**; métrica-norte passa de taxa de resposta para **sessões rastreadas/mês no GA4**. Invalida a mudança `ativar-ritual-caixa-aberta`, já arquivada em 04/08/2026
- Nicho de referência do motor corrigido de `negocios-marketing` para `lifestyle`
- Ativação de três experimentos com **ordem obrigatória**: UTM na bio isolada, depois mix de pilares e voz única para conteúdo de marca
- Novo mix editorial: Espelho 50% / Provador 25% / Padrão 15% / Bastidor 10%, sem aumento de volume de produção
- Corte do formato "apresentação de produto em vídeo longo" (o Reel de 1:37 fez 8% de retenção)
- Entrega ao cliente passa a ser feita **em etapas, por página HTML publicada**, com retorno estruturado da cliente na própria página

## Capabilities

### New Capabilities

- `caminho-ate-compra`: como o perfil converte atenção em sessão rastreável — rastreamento de origem, infraestrutura de perfil (link, CTA, destaques) e regra de link em Stories
- `entrega-em-etapas`: como uma recomendação chega à cliente — recorte do que entra em documento escrito, sequenciamento das etapas e ciclo de retorno

### Modified Capabilities

Nenhuma. `openspec/specs/` está vazio — não há spec principal publicada até aqui.

## Impact

- `CLAUDE.md`, `perfil/metas.md`, `perfil/pilares.md`, `openspec/config.yaml` — os quatro carregam o objetivo do ciclo e precisam dizer a mesma coisa
- `perfil/perfil.md`, `perfil/icp.md`, `perfil/voz-e-tom.md` — preenchidos em 04/08/2026 com o formulário e os Insights
- `relatorios/bianca-olivo-2026-08-plano/` — página da etapa 1, publicada na Vercel (fora do git)
- `dados/bianca-olivo-2026-07/` — material bruto e transcrição, fora do git
- Sem impacto em `src/`. O motor de métricas não muda; muda o `--nicho` usado ao rodá-lo

## Fora de escopo

- **Crescimento e captação de seguidores.** Deliberadamente adiado para o ciclo seguinte: não adianta trazer público novo para um caminho que ainda não converte. Alcance segue como métrica de acompanhamento, não de otimização
- **Mudança de voz nos posts de marca e pilares Padrão/Bastidor na etapa 1.** Entram na etapa 2, porque soam como correção ao trabalho da cliente e pedem conversa, não documento
- **Alvo numérico de sessões e receita.** Os baselines de julho estão contaminados (foram gerados sem link na bio); alvo só depois de 30 dias com UTM ativa
- **Alteração do motor em `src/`.** Nenhuma mudança de código é necessária neste ciclo

## Desfecho — 12/08/2026

**Superada por decisão da cliente antes da leitura dos experimentos.** Em 12/08/2026 a
Bianca redirecionou o foco: o perfil pessoal é dela; a relação com a loja e o e-commerce
ficam com a equipe da My Favorite. O ciclo fechou sem nenhum experimento lido:

- **UTM na bio:** ela colou um link com etiqueta genérica (`ig`/`bio`) que não identifica
  o canal dela — o passo, como especificado, nunca foi executado.
- **Mix de pilares, voz única, unboxing:** não iniciados.
- Dos 5 ajustes da etapa 1, **nenhum dos 2 verificáveis de fora foi feito** (medido
  direto no perfil em 06/08/2026).

A não-execução tem leitura estratégica: o plano pedia que o perfil pessoal virasse canal
de venda da marca, e a cliente não quer o perfil nesse papel. O diagnóstico que sustentava
a proposta continua válido (saves/reach 0,23%, conversão 0,29%, caminho até a compra
inexistente) — **mudou de dono, não de veracidade**; vira material de handoff para o time
da marca. Substituída por `ativar-ciclo-engajamento-agosto`.
