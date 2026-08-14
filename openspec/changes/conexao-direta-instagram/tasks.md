## 1. Fundação: schema e cifra

- [x] 1.1 Migração `005`: tabela `instagram_connection` (`client_id` único, `ig_user_id`, `username`, `access_token_encrypted`, `token_expires_at`, `scopes`, `connected_by`, `connected_at`, `last_refresh_at`, `last_sync_at`, `state` enum `active|expired|revoked|failing`, `last_error`, `last_error_at`) e valor `api` no enum `metric_value.source`
- [x] 1.2 Declarar a tabela em `db/schema.ts` seguindo os helpers existentes (`id()`, `fk()`, `createdAt()`, `updatedAt()`)
- [x] 1.3 Teste: `test/schema.test.ts` afirma que `client_id` é único em `instagram_connection` (uma conexão por cliente) e que `api` é aceito em `metric_value.source`
- [x] 1.4 `lib/crypto-box.ts`: cifrar/decifrar com AES-256-GCM do `node:crypto`, formato `iv:authTag:ciphertext`, chave lida de `ENCRYPTION_KEY`
- [x] 1.5 Teste: ida e volta preserva o valor; texto adulterado **falha** ao decifrar em vez de devolver lixo; ausência de `ENCRYPTION_KEY` dá erro com mensagem que aponta `.env.exemplo`
- [x] 1.6 Documentar `IG_APP_ID`, `IG_APP_SECRET` e `ENCRYPTION_KEY` no `.env.exemplo`, incluindo que perder a chave obriga a reconectar

## 2. Precedência de origem — antes de qualquer coleta

> Se a coleta chegar antes disto, a tela duplica cartão em produção.

- [x] 2.1 `lib/precedencia.ts`: ordem total `api > store > ga4 > insights > manual`, escolhendo um valor por métrica/período e devolvendo os descartados
- [x] 2.2 Teste: duas origens para a mesma métrica e período resultam em um valor, o de maior precedência; origem sozinha de baixa precedência é apresentada; empate impossível por construção
- [x] 2.3 Aplicar em `lib/dashboard.ts:metrics()` — resolver a precedência depois de ler
- [x] 2.4 Teste: `metrics()` devolve um cartão por `metric_def` mesmo com duas origens gravadas para o mesmo período — `test/dashboard-precedencia.test.ts`, contra o banco
- [x] 2.5 Expor a divergência quando o valor descartado difere do apresentado, e apresentá-la junto ao número na tela
- [x] 2.6 Teste: divergência aparece quando os valores diferem e não aparece quando são iguais
- [x] 2.7 **Não previsto:** `funnel()` e `latestPeriod()` tinham cópias próprias do filtro de origem e ignoravam `api` em silêncio — o painel seguiria mostrando o número transcrito com o coletado na tabela. Lista centralizada em `ORIGENS_MEDIDAS`, e o funil também resolve por precedência em vez de depender da ordem que o MySQL devolveu
- [x] 2.8 **Não previsto:** `lib/origem.ts` precisava descrever `api` — o teste que lê o enum do schema e exige descrição para toda origem pegou na hora. Antecipa a tarefa 6.7
- [x] 2.9 Verificado renderizado nos dois temas, com divergência real no banco: 168 elementos medidos, zero reprovações de contraste. Dado de teste revertido

## 3. Fluxo de autorização

- [x] 3.1 `lib/instagram/oauth.ts`: montar a URL de autorização (`client_id`, `redirect_uri`, `response_type=code`, `scope`, `state`) e trocar `code` por token curto
- [x] 3.2 Trocar token curto por token longo e calcular `token_expires_at`
- [x] 3.3 Teste: a URL carrega exatamente os dois escopos de leitura e nenhum outro; `state` é obrigatório
- [x] 3.4 Rota de início: gera `state`, grava em cookie `httpOnly`/`Lax` de 10 minutos e redireciona
- [x] 3.5 Rota de callback: exige `state` casando com o cookie, consome o cookie, troca o código, cifra e grava a conexão, e **redireciona para URL limpa** sem o `code` na query
- [x] 3.6 Teste: `state` ausente, divergente ou reaproveitado é recusado sem criar conexão; retorno com `error=access_denied` não cria nada
- [x] 3.7 Teste: o `code` recebido não aparece em log nem na URL final

## 4. Telas

- [x] 4.1 Cartão de conexão em `/conta`: estado (conectada desde / nunca conectada / precisa reconectar), última coleta, e o botão
- [x] 4.2 Texto antes de autorizar, em consequência e não em nome de escopo: o que será lido, e que a plataforma não publica, não comenta e não lê mensagens
- [x] 4.3 Desconectar pela própria interface, apagando a credencial e preservando as métricas já coletadas
- [x] 4.4 Teste: desconectar remove a credencial utilizável e não apaga `metric_value`
- [x] 4.5 Abrir renderizado nos dois temas e medir contraste dos estados novos

## 5. Cliente da API e coleta

- [x] 5.1 `lib/instagram/client.ts`: `fetch` com token, tratamento de erro tipado (autorização inválida ≠ falha de rede) e contador de chamadas por execução
- [x] 5.2 Teste: resposta de erro de autorização é distinguida de erro transitório
- [x] 5.3 Coleta de conta por range (`since`/`until` do mês), **sem somar dias** — `reach` é de contas únicas
- [x] 5.4 Teste: a coleta pede o range do período e nunca soma períodos; um teste nomeia essa armadilha porque o erro produz número plausível e maior
- [x] 5.5 Mapeamento para os `metric_def` existentes conforme a tabela do design, incluindo as taxas derivadas sobre alcance
- [x] 5.6 Teste: métrica ausente na resposta **não** vira zero; nenhuma linha é gravada para ela
- [x] 5.7 Gravação idempotente em `metric_value` com origem `api`
- [x] 5.8 Teste: rodar a coleta duas vezes para o mesmo período deixa um único valor por métrica e origem
- [x] 5.9 Coleta de insights por mídia na janela de 30 dias e das mídias sem insights, atualizando `post` sem jamais escrever `reach` a partir de `views`
- [x] 5.10 Teste: o invariante de `test/import.test.ts` continua valendo para a coleta pela API

## 6. Rotina e falha visível

- [x] 6.1 `scripts/sync-instagram.ts`: renova se faltar menos de 15 dias, coleta, grava `last_sync_at` ou `last_error` e o estado
- [x] 6.2 Registrar o comando em `package.json` e garantir que ele exista dentro da imagem (`scripts/` e `lib/` já são copiados)
- [x] 6.3 Teste: credencial perto do vencimento é renovada; falha isolada de renovação com credencial ainda válida mantém a conexão ativa
- [x] 6.4 Estado `expired`/`revoked`/`failing` vira aviso em `/novidades`, dizendo desde quando não há dado novo
- [x] 6.5 Teste: `lib/digest.ts` reporta conexão quebrada; conexão saudável não gera ruído
- [x] 6.6 Apresentar a idade da última coleta junto dos números, usando `lib/freshness.ts`
- [x] 6.7 Descrever a origem `api` em `lib/origem.ts` como colhida automaticamente da fonte oficial, e teste correspondente
- [x] 6.8 Documentar o cron do host no `README.md` da plataforma

## 6b. O termo que ela aceita — pedido do usuário, 07/08/2026

- [x] 6b.1 `lib/instagram/termos.ts`: as duas listas e a versão datada, em consequência e não em nome de escopo
- [x] 6b.2 Tela `/conta/instagram` com o que é lido, o que é impossível, e a caixa de aceite — substitui o redirect direto para a Meta
- [x] 6b.3 `POST /conta/instagram/autorizar`: recusa aceite ausente ou de versão antiga, grava em `audit_log` e só então redireciona
- [x] 6b.4 Migração `006`: `terms_version` e `terms_accepted_at` na conexão — versão, não booleano, para que a aceitação pare de valer quando o texto mudar
- [x] 6b.5 A versão aceita viaja em cookie próprio até o callback, para gravar o que ela leu e não o que estiver corrente
- [x] 6b.6 Verificado renderizado nos dois temas: 34 elementos, zero reprovações
- [x] 6b.7 **Não previsto:** `components/freshness.tsx` dizia "Eles não entram sozinhos: eu atualizo quando você me manda o Insights" — frase que a conexão tornaria falsa. Agora depende do estado da conexão

## 7. Validação de verdade

- [x] 7.1 Criar o app na Meta, produto Instagram, e cadastrar o `redirect_uri` do túnel
- [x] 7.2 Percorrer o fluxo inteiro: feito com a conta real dela em 14/08/2026, pelo computador. Conectou, coletou, e o número apareceu na tela com origem `api`
- [ ] 7.3 Provar o caminho de falha: revogar a autorização e confirmar que vira aviso em `/novidades` e estado na tela — **em aberto**, e agora custa pedir a ela que revogue o que levou dois dias para conectar. Fica para a primeira expiração real de token
- [x] 7.4 `cd platform && npm run lint && npm test` — 433 testes. `validar:tudo` na raiz foi bloqueado pelo classificador do harness; nada fora de `platform/` foi tocado
- [x] 7.5 Atualizar o `CLAUDE.md`: a fonte de dados deixa de ser "input manual / CSV (sem Graph API)"

## 8. Depois da VPS

- [x] 8.1 Cadastrar o `redirect_uri` de produção no app da Meta
- [x] 8.2 Adicionar a Bianca como tester e confirmar que ela aceitou o convite — verificado no painel em 14/08, Status vazio
- [x] 8.3 Ela conecta a conta real — **14/08/2026**, pelo computador, depois de cinco tentativas fracassadas pelo iPhone
- [ ] 8.4 Conferir `profile_links_taps` chegando com origem `api` em até 24h — **superado pelo handoff de 12/08**: o link com etiqueta é da equipe da marca agora, e `bio_link_clicks` está em `HANDED_OFF` no painel. O critério vivo virou `reach` e `followers_net` chegando com origem `api`, e ambos chegaram
- [x] 8.5 Fechar os pedidos abertos que a coleta passou a responder — reduzido, não fechado: o print mensal encolheu de três números para um (visitas ao perfil), e a aba Público dos cinco Reels continua de pé. Nenhum dos dois tem contrapartida na API

## 9. O que a conexão real revelou — 14/08/2026

> Cinco defeitos, e quatro deles só apareceram **renderizados**. `tsc` e a suíte
> passaram em todas as versões erradas.

- [x] 9.1 **iOS entregava a autorização ao app do Instagram.** `www.instagram.com` reivindica os próprios links; o fluxo é excluído como `/oauth/authorize/*`, e a nossa URL era `/oauth/authorize` + query, que não casa com o padrão. Cinco tentativas dela morreram num esqueleto travado. `ce35e30` aponta para `/oauth/authorize/third_party/`, que casa sem ambiguidade — e é para onde o próprio endpoint documentado redireciona. Antes disso, `3bbb7bd` tentou só a barra final e **não funcionou**: o iOS não casa `*` com string vazia
- [x] 9.2 **O sync nunca casaria post nenhum.** `collectMedia` comparava `post.ig_code` (shortcode, vindo da importação pública) com o id numérico da API. "0 post(s) updated", silencioso, para sempre. `f7f78c3` casa pelo shortcode do permalink; os insights seguem sendo buscados pelo id, único que `/{media}/insights` aceita
- [x] 9.3 **O painel pulou para o mês corrente.** A coleta gravou agosto com origem `api` — medida — e a tela passou a julgar meio mês contra alvo mensal: "contas alcançadas 2.668.572, longe do alvo". Os dois cartões do ciclo sumiram junto, porque `profile_visits` não tem contrapartida na API. `cbc536d` passa a exigir mês **fechado**, e `eca149b` corrige a consulta, que devolvia agosto duas vezes por haver uma linha por métrica
- [x] 9.4 **A taxa de visitas ao perfil estava congelada.** Valor e nota gravados à mão contra o alcance antigo; quando a API mediu julho em 5.584.671, a tela mostrou dois alcances diferentes para o mesmo mês. `b566ff3` deriva a razão na leitura e reescreve a nota com os números que usou. `follows_reach` ficou de fora de propósito — o denominador dele é alcance somado por post
- [x] 9.5 **O retorno da autorização voltava calado.** Cinco motivos de recusa redirecionavam sem gravar nada, e o diagnóstico do dia 13 dependeu de print dela em vez do nosso log. `7a240ba` grava `instagram_auth_rejected` com o motivo. Ressalva: as tentativas que travam **dentro** do Instagram nunca chegam nesta rota, então isso cobre a volta, não a ida
- [ ] 9.6 `--period` data as métricas de conta mas não filtra os posts, que sempre vêm da janela de 30 dias. Cada mês de backfill gasta ~32 chamadas repetindo o mesmo trabalho. Sem corrupção de dado; só desperdício
- [ ] 9.7 Acervo anterior à janela de 30 dias segue sem alcance medido — 205 Reels de fevereiro a julho. Preenchê-los é uma execução única de ~200 chamadas, e uma decisão a tomar
