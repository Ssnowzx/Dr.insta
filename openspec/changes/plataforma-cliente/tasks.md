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

- [ ] 2.1 Declarar o esquema Drizzle a partir do SQL de 001
- [ ] 2.2 `lib/senha.ts` — Argon2id, com teste de verificação e de rejeição
- [ ] 2.3 `lib/sessao.ts` — token de 32 bytes, guarda só o SHA-256, 90 dias deslizantes
- [ ] 2.4 Teste: sessão expirada é recusada e sessão válida renova a data
- [ ] 2.5 `proxy.ts` — checagem otimista, sem tocar no banco (roda em todo prefetch). No Next 16 `middleware.ts` foi renomeado para `proxy.ts`
- [ ] 2.6 `lib/dal.ts` — a fronteira real: `verificarSessao()` memoizada com `cache()`, chamada por toda página, action e rota
- [ ] 2.7 `lib/escopo.ts` — resolve o `cliente_id` da sessão; teste de que consultor e cliente veem conjuntos diferentes
- [ ] 2.8 Tela de entrar, com mensagem de erro que não revela se o e-mail existe
- [ ] 2.9 Fluxo de convite: token de uso único, 7 dias, tela de definir senha
- [ ] 2.10 Fluxo de recuperação: token de 1 hora, e-mail e tela de nova senha
- [ ] 2.11 `scripts/convidar.ts` — gera o link de convite pelo terminal, sem depender de SMTP
- [ ] 2.12 Registrar `entrou` em `auditoria` e atualizar `usuario.ultimo_acesso_em`

## 3. Design system e carga inicial

- [ ] 3.1 Portar os tokens dos dois temas de `relatorios/bianca-olivo-2026-08-plano/index.html`
- [ ] 3.2 **Medir contraste par a par nos dois temas** — texto ≥ 4,5:1, componente ≥ 3:1 — antes de qualquer tela
- [ ] 3.3 Converter as sete fontes para `.woff2` e servir do próprio domínio
- [ ] 3.4 Componentes de base: cartão, etiqueta, dado em destaque, botão, campo
- [ ] 3.5 Semente: cliente Bianca Olivo, usuário consultor e ciclo "Caminho até a compra"
- [ ] 3.6 Semente de `metrica_def` e `metrica_alvo` a partir de `perfil/metas.md`, com `contaminado` nas duas linhas que exigem
- [ ] 3.7 Semente de `benchmark` a partir de `src/dominio/benchmarks.ts`, com `fonte` e `atualizado_em`
- [ ] 3.8 Semente dos 4 experimentos com a ordem obrigatória (UTM primeiro, isolada)
- [ ] 3.9 Teste: a semente roda duas vezes sem duplicar linha

## 4. Acompanhamento de etapas

- [ ] 4.1 Semente de `entrega` + `etapa` com os cinco ajustes de 04/08/2026, com o dado que sustenta cada um
- [ ] 4.2 Tela da entrega, mobile-first, em coluna única centrada
- [ ] 4.3 Marcação de etapa com os três estados e campo de comentário
- [ ] 4.4 Placar de progresso e pedido parcial tão fácil quanto o completo
- [ ] 4.5 Visão do consultor: o que ela marcou, o que travou e quando
- [ ] 4.6 Teste: dois usuários marcando a mesma etapa não sobrescrevem um ao outro
- [ ] 4.7 Renderizar e conferir em 360, 390, 768, 1024 e 1440 px

## 5. Recepção de demandas

- [ ] 5.1 Lista de demandas com filtro por estado e prazo
- [ ] 5.2 Detalhe com `demanda_evento` como linha do tempo
- [ ] 5.3 Mudança de estado gravando evento com autor e hora
- [ ] 5.4 Upload por streaming, com SHA-256 calculado durante a escrita
- [ ] 5.5 Rota de download que confere sessão e `cliente_id` antes de servir um byte
- [ ] 5.6 Teste: arquivo de outro cliente devolve 404, não 403 (403 confirma que existe)
- [ ] 5.7 Semente dos cinco pedidos da análise dos 203 Reels
- [ ] 5.8 Teste de ponta a ponta com arquivo de 7 MB

## 6. Painel de dados e estratégia

- [ ] 6.1 `lib/formatar.ts` — razão, moeda e inteiro a partir de `metrica_def.unidade`; teste de cada unidade
- [ ] 6.2 Gráfico de linha em SVG para evolução mensal
- [ ] 6.3 Gráfico de barra comparando valor, baseline, alvo e benchmark
- [ ] 6.4 **Baseline contaminado e amostra abaixo do mínimo aparecem na tela**, não escondidos
- [ ] 6.5 Benchmark com mais de 12 meses sinalizado na interface
- [ ] 6.6 Importador do CSV dos 203 Reels para `post`, com `procedencia='publico'`
- [ ] 6.7 Teste: o importador não preenche `alcance` com `views`
- [ ] 6.8 Acervo de posts filtrável por pilar e duração

## 7. Produção

- [ ] 7.1 Provisionar a VPS: Docker, firewall, usuário, pasta de arquivos
- [ ] 7.2 Deploy, TLS pelo certbot e conferência dos cabeçalhos em produção
- [ ] 7.3 Cron de backup diário do banco e dos arquivos
- [ ] 7.4 **Restaurar o backup num banco vazio e conferir contagem por tabela**
- [ ] 7.5 Percurso completo com a conta da cliente antes de mandar o convite
- [ ] 7.6 Enviar o convite e registrar a data (marca o início da janela de 14 dias)
- [ ] 7.7 Confirmar que ela entrou; se passar 7 dias sem acesso, tratar como sinal de alarme
- [ ] 7.8 Só depois disso: desmontar `relatorios/` e o Blob store da Vercel

## 8. Leitura

- [ ] 8.1 Medir o tempo entre pedido e recebimento dos cinco pedidos da análise dos Reels
- [ ] 8.2 Confirmar o recebimento da exportação do Insights em até 14 dias da primeira entrada
- [ ] 8.3 Rodar `npm run ig -- analisar <csv> --nicho lifestyle` com o dado recebido
- [ ] 8.4 Arquivar esta mudança com o que aconteceu de fato, inclusive se falhou
