# Plataforma de cliente na VPS

## Why

O canal com a Bianca hoje é uma página estática por entrega, publicada uma a uma na Vercel, com o link mudando a cada versão. Esse formato chegou ao limite em 05/08/2026, e o limite não é estético — é operacional:

1. **O dado que a análise precisa não chega.** A análise dos 203 Reels fecha com **cinco pedidos, quatro deles apenas "me manda o dado"**. As tarefas de leitura 5.1 a 5.6 de `formato-curto-para-produto` estão todas bloqueadas nesses pedidos. Não existe hoje nenhum lugar onde um pedido tenha dono, prazo e estado — existe uma página com um `textarea` e um botão.
2. **O que ela marca não volta para cá.** Os cinco ajustes vivem em `localStorage` no aparelho dela. Se ela marcar três e trocar de celular, o registro some. Não há como responder à pergunta mais básica da consultoria — *o que já foi feito?* — sem perguntar a ela.
3. **Cada entrega é uma ilha.** Duas páginas se linkam por um cartão no rodapé. A terceira será um terceiro link. A cliente acumula links de WhatsApp e não tem um lugar único para voltar.
4. **Não há série histórica.** Todo número deste projeto vive em Markdown (`perfil/metas.md`), print (`dados/bianca-olivo-2026-07/`) ou CSV solto. O ciclo pede leitura mensal comparada, e comparar mês a mês hoje é trabalho manual de leitura de arquivo.

A decisão de 05/08/2026 foi encerrar o remendo incremental e construir o produto: *"vamos parar de gastar tokens com isso e vamos construir um produto logo"*, rodando na VPS própria.

## What Changes

- Nasce `plataforma/` — aplicação web mobile-first, autenticada, servida da VPS, com MySQL como fonte de verdade
- **Recepção de demandas** — cada pedido feito à cliente vira registro com tipo, prazo, estado e histórico. Os cinco pedidos da análise dos Reels entram como carga inicial
- **Acompanhamento de etapas** — os cinco ajustes de 04/08/2026 saem do `localStorage` e passam a viver no banco, com estado por usuária, marcação de travado (não só feito/não feito) e comentário por etapa
- **Painel de dados e estratégia** — série histórica de métrica por competência, comparada com baseline, alvo do ciclo e benchmark do nicho, com a marcação explícita de baseline contaminado que `perfil/metas.md` já carrega
- **Acervo de posts** — os 203 Reels deixam o CSV solto e passam a ser consultáveis por pilar, duração e formato
- Autenticação por e-mail e senha, com dois papéis: consultor e cliente. **O produto não envia e-mail** — o e-mail é identificador de login, não canal
- Arquivo enviado pela cliente passa a ter dono, checksum e vínculo com a demanda que o pediu — em vez de cair numa pasta por carimbo de hora
- O banco nasce **multi-cliente**; a interface entra no ar com uma cliente só

## Capabilities

### New Capabilities

- `plataforma-de-cliente`: como o trabalho de consultoria é operado e apresentado — identidade e escopo de acesso, ciclo de vida de uma demanda, estado de etapa, série de métrica e procedência de dado

### Modified Capabilities

Nenhuma. `openspec/specs/` continua vazio.

## Fora de escopo

- **Integração com a Graph API do Instagram.** A conta é de Criador e o dado continua entrando por exportação manual e print. Automatizar coleta é uma mudança própria, depois que a plataforma existir
- **Integração com o GA4 por API.** Sessões e receita entram por lançamento manual mensal na primeira versão
- **Multi-cliente na interface.** Seletor de cliente, convite de novos clientes e permissão granular ficam para depois — o banco suporta, a tela não expõe
- **Substituir as duas páginas já publicadas na Vercel.** Elas continuam no ar até a plataforma receber a cliente. Desmontar é tarefa da fase final, não do começo
- **Editor de conteúdo.** A plataforma apresenta e acompanha; ela não escreve legenda nem gera calendário. Isso continua nas skills
- **Notificação por e-mail ou push.** Decidido em 05/08/2026 que o produto não envia e-mail nenhum; a notificação vive dentro da plataforma, em `/novidades`
- **Coleta automática de dados do Instagram.** O coletor em `platform/scripts/coletor-instagram.js` roda no navegador com a sessão dela e baixa um CSV — ele automatiza o dado público. Alcance, salvamentos, envios em DM e retenção **não existem em dado público** e continuam chegando por exportação do Insights

## Métrica observável

A plataforma não move `saves/reach` por si — dizer que moveria seria inventar causa. O que ela move é a **chegada do dado que destrava a leitura**, e é isso que se mede:

**Primária — tempo entre pedido e recebimento do dado.** Baseline: os cinco pedidos da análise dos Reels foram feitos em 05/08/2026 e, na data desta proposta, nenhum foi entregue. Critério: **os cinco pedidos com estado registrado e ao menos a planilha dos 203 Reels recebida em até 14 dias** da primeira entrada da cliente na plataforma.

**A métrica de Instagram que isso destrava:** `saves/reach` do conteúdo de produto, hoje em **0,23%** contra **1,40%** de referência do nicho lifestyle, com critério de **≥ 0,8%**. As tarefas 5.1 a 5.5 de `formato-curto-para-produto` dependem da exportação do Insights, que é o pedido 1 dos cinco. Sem o dado, o experimento não fecha — fica em "acho que melhorou".

**Métrica de guarda:** a plataforma não pode adicionar atrito. Se a cliente parar de responder depois da migração, o formato antigo era melhor e isto se reverte. Sinal de alarme: **nenhum acesso dela em 7 dias** após o envio do convite.

## Impact

- `plataforma/` — novo, versionado no git (diferente de `relatorios/`, que está ignorado)
- `src/dominio/benchmarks.ts` — passa a ser **semeado** na tabela `benchmark` por script, mantendo `fonte` e `atualizadoEm`. O motor continua sendo a única origem do número; o banco é cópia consultável, não segunda verdade
- `perfil/metas.md` — o painel do ciclo passa a ter representação no banco (`metrica_alvo`), inclusive a marcação de baseline contaminado. O Markdown continua sendo a narrativa; o banco, a série
- `dados/metricas/*.csv` — o CSV dos 203 Reels ganha um importador para a tabela `post`
- `relatorios/` — sem mudança agora; desmontagem é a última fase
- Interage com `formato-curto-para-produto`: as tarefas 2.15 (mandar os links) e 5.5 (juntar a exportação ao CSV) passam a ser executadas dentro da plataforma
