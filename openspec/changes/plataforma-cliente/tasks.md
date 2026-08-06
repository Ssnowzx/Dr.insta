## 1. Fundação (05/08/2026)

- [x] 1.1 Registrar a decisão: multi-cliente no banco, Docker + Nginx, e-mail e senha
- [x] 1.2 Escrever `banco/migracoes/001-esquema-inicial.sql` com as 18 tabelas de domínio
- [x] 1.3 Criar `package.json`, `tsconfig.json` strict e `next.config.ts` com saída `standalone`
- [x] 1.4 Escrever `banco/conexao.ts` com fuso UTC e `DECIMAL` como string
- [x] 1.5 Escrever `banco/migrar.ts` — aplicação idempotente, controle em `migracao`, `--estado`
- [x] 1.6 Escrever `docker-compose.yml` sem porta de banco publicada e `compose.dev.yml` separado
- [x] 1.7 Escrever o `Dockerfile` multi-estágio, usuário não-root e `HEALTHCHECK`
- [x] 1.8 Escrever `infra/nginx-myfavorite.conf` com `client_max_body_size` e `proxy_request_buffering off`
- [x] 1.9 Subir o MySQL e conferir: 19 tabelas, 30 chaves estrangeiras, UTC, `utf8mb4_unicode_ci`
- [x] 1.10 Conferir idempotência da migração e o comando `banco:estado`
- [x] 1.11 Buildar e rodar: `/api/saude` em 200 com os cabeçalhos e a home lendo o banco
- [x] 1.12 Subir para versões sem vulnerabilidade conhecida (Drizzle ≥ 0.45.2 por `GHSA-gpj5-g38j-94v9`)

## 2. Identidade

- [x] 2.1 Declarar o esquema Drizzle a partir do SQL de 001
- [x] 2.2 `lib/password.ts` — Argon2id, com teste de verificação e de rejeição
- [x] 2.3 `lib/session.ts` — token de 32 bytes, guarda só o SHA-256, 90 dias deslizantes
- [x] 2.4 Teste: sessão expirada é recusada e sessão válida renova a data
- [x] 2.5 `proxy.ts` — checagem otimista, sem tocar no banco (roda em todo prefetch). No Next 16 `middleware.ts` foi renomeado para `proxy.ts`
- [x] 2.6 `lib/dal.ts` — a fronteira real: `requireSession()` memoizada com `cache()`, chamada por toda página, action e rota
- [x] 2.7 `lib/scope.ts` — a regra pura de alcance, separada do Next para ser testável sozinha; o teste de conjuntos com dado real vem na fase 4
- [x] 2.8 Tela de entrar, com mensagem de erro que não revela se o e-mail existe
- [x] 2.9 Fluxo de convite: token de uso único, 7 dias, tela de definir senha
- [x] 2.10 Fluxo de recuperação: token de 1 hora e telas. **Revisto em 05/08** — sem e-mail, quem emite é o consultor; ver 9.x
- [x] 2.11 `scripts/invite.ts` — gera o link de convite pelo terminal; nada é enviado
- [x] 2.12 Registrar `signed_in` em `audit_log` e atualizar `user.last_seen_at`

## 3. Design system e carga inicial

- [x] 3.1 Portar os tokens dos dois temas de `relatorios/bianca-olivo-2026-08-plano/index.html`
- [x] 3.2 **Medir contraste par a par nos dois temas** — virou `test/contrast.test.ts`, que lê `base.css` e falha o build; 40 pares travados
- [x] 3.3 Converter as sete fontes para `.woff2`, subsetadas para pt-BR — 460 KB viraram 128 KB
- [x] 3.4 Casca de aplicação: rail no desktop, barra inferior no celular, cartão, selo de estado, número tabular
- [x] 3.5 Semente: cliente Bianca Olivo, usuário consultor e ciclo "Caminho até a compra"
- [x] 3.6 Semente de `metrica_def` e `metrica_alvo` a partir de `perfil/metas.md`, com `contaminado` nas duas linhas que exigem
- [x] 3.7 Semente de `benchmark` a partir de `src/dominio/benchmarks.ts`, com `fonte` e `atualizado_em`
- [x] 3.8 Semente dos 4 experimentos com a ordem obrigatória (UTM primeiro, isolada)
- [x] 3.9 Teste: a semente roda duas vezes sem duplicar linha

## 3b. Painel (adiantado da fase 6, a pedido)

- [x] 3b.1 Funil em escala real como elemento assinatura, com as barras finas marcadas
- [x] 3b.2 Gráfico de bala: valor contra alvo e referência do nicho, marcas em tinta e não em cor
- [x] 3b.3 Baseline contaminado e amostra abaixo de 7 aparecem no cartão
- [x] 3b.4 Telas de plano, pedidos e conta, em leitura
- [x] 3b.5 Série histórica mensal — 8 meses reais da exportação pública, com o mês em curso marcado

## 4. Acompanhamento de etapas

- [x] 4.1 Semente de `delivery` + `step` com os cinco ajustes, com o dado que sustenta cada um
- [x] 4.2 Tela da entrega, mobile-first, em coluna única centrada
- [x] 4.3 Marcação com três estados, otimista no toque; o campo de nota abre sozinho ao marcar `travou`
- [x] 4.4 Placar de progresso e pedido parcial tão fácil quanto o completo
- [x] 4.5 Visão do consultor: o que ela marcou, a nota dela e quando — alcançável por `?cliente=<slug>`, porque consultor não tem `client_id`
- [x] 4.6 Teste: dois usuários na mesma etapa não se sobrescrevem, `completed_at` limpa ao desmarcar, ENUM recusa estado inválido (7 testes)
- [x] 4.7 Conferido no navegador em 390 e 1440 px; rail medido sem sobreposição

## 5. Recepção de demandas

- [x] 5.1 Lista de demandas com filtro por estado e prazo
- [x] 5.2 Detalhe com `demanda_evento` como linha do tempo
- [x] 5.3 Mudança de estado gravando evento com autor e hora
- [x] 5.4 Upload por streaming com SHA-256 durante a escrita, em Route Handler — Server Action tem teto de 1 MB por padrão
- [x] 5.5 Rota de download que confere sessão e `cliente_id` antes de servir um byte
- [x] 5.6 Verificado no navegador: arquivo e pedido de outro cliente devolvem 404, não 403
- [x] 5.7 Semente dos cinco pedidos da análise dos 203 Reels
- [x] 5.8 Teste com 7 MB no `storeStream`; ida e volta pelo navegador com sha256 idêntico e `text/html` recusado com 415

## 6. Painel de dados e estratégia

- [x] 6.1 `lib/format.ts` — razão, moeda, contagem e segundos a partir de `metric_def.unit`; 15 testes
- [x] 6.2 Gráfico de linha em SVG, uma medida por gráfico e base em zero — nunca eixo duplo
- [x] 6.3 Gráfico de barra comparando valor, baseline, alvo e benchmark
- [x] 6.4 **Baseline contaminado e amostra abaixo do mínimo aparecem na tela**, não escondidos
- [x] 6.5 Benchmark com 12 meses ou mais sinalizado no cartão, com a idade em meses
- [x] 6.6 Importador dos 203 Reels reais para `post`, com `provenance='public'` e série mensal derivada
- [x] 6.7 Teste do invariante: nenhum post público tem `reach`, `saves` ou `retention` — e nenhum tem `reach` igual a `views`
- [x] 6.8 Acervo filtrável por duração e menção à marca, com a casa vazia declarada na tela

## 9. Notificação e acesso, dentro da plataforma (05/08/2026)

> Rumo trocado no meio do caminho. O resumo diário nasceu como e-mail e foi
> desfeito no mesmo dia, depois que o usuário perguntou para qual endereço estava
> indo: um endereço de teste, em domínio reservado, entregue num coletor local —
> e o log dizia "enviado". A decisão foi **o produto não manda e-mail nenhum**.

- [x] 9.1 Migração 002: `user.news_seen_at`, separada de `last_seen_at`
- [x] 9.2 `lib/digest.ts` — o que a cliente fez numa janela semiaberta, travado por teste nas duas bordas
- [x] 9.3 `/novidades` — travou e "não conseguiu entrar" primeiro; só ação da cliente
- [x] 9.4 Sino no topo com contador; no rail do desktop. Fora da barra inferior por medida: 6 itens em 360px dão 60px e o rótulo maior precisa de 53
- [x] 9.5 "Marcar como lido" move o corte
- [x] 9.6 Tela de entrar registra `asked_for_access` e **não emite token** — emitir permitiria queimar o link pendente de quem está no meio da recuperação
- [x] 9.7 Conta → Acesso das clientes: gera e copia o link, mostrando-o também (clipboard exige contexto seguro)
- [x] 9.8 Remover `nodemailer`, `lib/mail.ts` e o cron de resumo
- [x] 9.9 Tela de recuperação diz a verdade em vez de prometer e-mail

## 10. Frescor do dado e coleta (05/08/2026)

- [x] 10.1 `lib/freshness.ts` — idade medida do **fim** do período, com destaque escalonado
- [x] 10.2 Aviso de idade no painel e no acervo, com datas separadas
- [x] 10.3 `scripts/coletor-instagram.js` — roda no navegador com a sessão dela e baixa CSV
- [x] 10.4 Documentar por que não é cron na VPS: endpoint interno exige sessão, e a CSP do Instagram bloqueia POST para outra origem
- [x] 10.5 Declarar no README o que dado público **não** dá: alcance, salvamentos, envios em DM, retenção

## 7. Produção

- [ ] 7.1 Provisionar a VPS: Docker, firewall, usuário, pasta de arquivos
- [ ] 7.2 Deploy, TLS pelo certbot e conferência dos cabeçalhos em produção
- [ ] 7.3 Cron de backup diário do banco e dos arquivos
- [ ] 7.4 **Restaurar o backup num banco vazio e conferir contagem por tabela**
- [ ] 7.5 Percurso completo com a conta da cliente antes de convidar, e trocar os e-mails de teste (`*@exemplo.invalido`) pelos reais
- [ ] 7.6 Gerar o link de convite dela em Conta → Acesso das clientes, mandar pelo canal de sempre e registrar a data (marca o início da janela de 14 dias)
- [ ] 7.7 Confirmar que ela entrou; se passar 7 dias sem acesso, tratar como sinal de alarme
- [ ] 7.8 Só depois disso: desmontar `relatorios/` e o Blob store da Vercel

## 8. Leitura

- [ ] 8.1 Medir o tempo entre pedido e recebimento dos cinco pedidos da análise dos Reels
- [ ] 8.2 Confirmar o recebimento da exportação do Insights em até 14 dias da primeira entrada
- [ ] 8.3 Rodar `npm run ig -- analisar <csv> --nicho lifestyle` com o dado recebido
- [ ] 8.4 Arquivar esta mudança com o que aconteceu de fato, inclusive se falhou
