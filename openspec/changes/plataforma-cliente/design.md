# Design — plataforma de cliente

## Decisões tomadas com o usuário em 05/08/2026

| Pergunta | Decisão | Consequência |
|---|---|---|
| Escopo | **Multi-cliente no banco, uma cliente na tela** | Toda tabela de domínio carrega `cliente_id`; nenhuma consulta roda sem ele |
| Infra | **Docker + Nginx na VPS** | App e banco em contêiner; o Nginx do host faz proxy e TLS |
| Acesso | **E-mail e senha** | Precisa de fluxo de primeira senha, senão a cliente não entra |

## Contexto que restringe o desenho

Três fatos do projeto mandam mais que qualquer preferência técnica:

1. **A cliente lê no celular.** Ela é creative director de moda, não analista. A tela precisa carregar rápido em 4G e ser legível de pé. Isso elimina SPA pesada com dashboard de biblioteca de gráficos.
2. **O documento é a conversa.** A memória do projeto registra: a página não acompanha uma explicação, ela *é* a explicação. A plataforma herda essa exigência — cada tela se explica sozinha, em linguagem de moda e negócio, não de métrica.
3. **Ela testa na hora e reprova design medíocre.** O padrão visual das entregas de julho/agosto já foi aprovado por ela. Trocar de linguagem visual agora seria jogar fora capital de reconhecimento.

## Stack

### Aplicação — Next.js 15 (App Router) + React 19 + TypeScript strict

**Por quê:** o dashboard é majoritariamente leitura de dado que muda uma vez por mês. Server Components renderizam isso no servidor e mandam HTML — o celular dela recebe conteúdo, não um pacote de JavaScript que depois busca JSON. Interatividade fica em ilhas pequenas: marcar etapa, abrir demanda, enviar arquivo.

**Alternativas descartadas:**
- **SPA (Vite + React) + API separada** — dois artefatos para versionar, dois contêineres, e a primeira pintura depende de baixar o bundle e então buscar dado. Perde exatamente onde importa: 4G, primeira visita.
- **Astro** — ótimo para conteúdo, mas isto é aplicação com sessão, formulário e estado. Estaríamos remando contra o modelo dele.
- **HTML estático como hoje** — é o que estamos substituindo, e por motivo declarado.

**Custo assumido:** Next.js é a única dependência pesada do projeto. Ela se justifica por render no servidor, roteamento, e por eliminar o serviço de API separado. A regra "zero dependências de runtime" do `openspec/config.yaml` vale para `src/` — o motor de métricas continua puro e sem dependência. `plataforma/` é outro artefato, e a exceção está registrada aqui.

### Estilo — CSS com os tokens já aprovados, sem framework

**Por quê:** os tokens de cor e tipografia das entregas de julho/agosto já passaram por medição de contraste WCAG par a par e já foram aprovados pela cliente. Eles migram como variáveis CSS, iguais. Tailwind seria reescrever esse sistema em outra sintaxe sem ganhar nada — a superfície é pequena e os componentes se repetem.

**Fontes servidas do próprio domínio.** Os `.ttf` já estão em `relatorios/bianca-olivo-2026-07/fonts/` (Italiana, Instrument Sans, Instrument Serif, Geist Mono). Convertidos para `.woff2` e servidos pelo Nginx, cortam a ida ao Google Fonts — que no 4G custa duas resoluções de DNS e uma conexão TLS antes do primeiro texto aparecer.

### Gráficos — SVG próprio, sem biblioteca

**Por quê:** são poucas formas e todas conhecidas: linha de evolução mensal, barra comparando com baseline/alvo/benchmark, e medidor de progresso. Recharts custa em torno de 100 KB comprimidos e traz um sistema de layout inteiro para desenhar uma linha de doze pontos. SVG gerado no servidor sai em HTML, aparece com o resto da página e funciona sem JavaScript.

**Onde isso deixaria de valer:** se aparecer necessidade de zoom, seleção de intervalo por arraste ou tooltip com muitos pontos, a conta vira. Reavaliar quando surgir, não antes.

### Banco — MySQL 8 com Drizzle ORM

**MySQL** foi escolha do usuário. Compatível com MariaDB 11 no que este esquema usa (nada de `CHECK` com função, nada de tipo próprio do MySQL 8, `utf8mb4_unicode_ci` existe nos dois).

**Drizzle e não Prisma:** Prisma sobe um binário de engine ao lado do processo Node, o que engorda a imagem e complica build multi-arquitetura na VPS. Drizzle gera SQL, roda no mesmo processo e as migrações são arquivos `.sql` legíveis — dá para ler e conferir o que vai rodar em produção. Para um esquema deste tamanho, o ganho ergonômico do Prisma não paga a operação.

### Autenticação — sessão em tabela, senha com Argon2id

**Por quê própria:** dois papéis, um cliente, sem SSO e sem OAuth. Auth.js traria adaptador, callbacks e um modelo de conta que não usamos. Uma tabela `sessao`, um cookie `HttpOnly; Secure; SameSite=Lax` e `argon2` de hash cobrem o caso inteiro em pouco código auditável.

**O risco do e-mail e senha, e o que fazemos com ele.** A escolha do usuário foi senha; o atrito é real — cliente que esquece senha é cliente que não entra. Mitigação embutida no fluxo, sem virar outra decisão:

1. Ela nunca escolhe senha num cadastro. Recebe um **convite de uso único** (token de 32 bytes, validade 7 dias) e define a senha ali.
2. Sessão de **90 dias com renovação deslizante**. Na prática, entra uma vez no celular e continua entrando.
3. **Recuperação por e-mail** desde a primeira versão. Sem isso, a primeira senha esquecida encerra o uso da plataforma.

### Arquivos — disco da VPS, servidos por rota autenticada

Na Vercel foi preciso URL pré-assinada porque o corpo de função serverless para em 4,5 MB e os prints dela chegam a 7 MB. **Na VPS esse limite não existe** — o Nginx recebe `client_max_body_size 64m` e o arquivo entra por streaming direto para o disco, sem passar inteiro pela memória.

Gravação em `/var/lib/myfavorite/arquivos/<cliente_id>/<ano>/<mes>/<ulid>.<ext>`. O nome original vive só no banco: nome de arquivo vindo do navegador nunca toca o sistema de arquivos. `SHA-256` calculado durante a escrita, para detectar reenvio do mesmo arquivo e provar integridade.

**Nada é servido estaticamente.** Um `alias` do Nginx apontando para essa pasta exporia receita e demografia da cliente numa URL adivinhável. O download passa por rota que confere sessão e `cliente_id`.

### Infra — dois contêineres, Nginx do host

```
Internet → Nginx (host, TLS) → 127.0.0.1:3080 → contêiner app (Next standalone)
                                                        ↓
                                                 contêiner db (MySQL 8)
                                                        ↓
                                          volume mysql-dados + /var/lib/myfavorite/arquivos
```

O MySQL **não publica porta no host** — fala com o app pela rede interna do Compose. Uma porta 3306 exposta é a forma mais comum de perder um banco em VPS.

Backup: `mysqldump` diário por cron no host, comprimido, retenção de 14 dias, mais cópia dos arquivos por `rsync`. Um banco sem backup testado é um banco que você ainda não perdeu.

## Esquema do banco

Quatro grupos, na ordem em que o produto os usa.

### 1. Identidade e escopo

`cliente` → `usuario` → `sessao`, com `convite` e `redefinicao_senha` para o ciclo de credencial.

**A decisão estrutural:** `usuario.cliente_id` é `NULL` para o consultor e preenchido para a cliente. Isso dá a regra de acesso em uma linha — consultor enxerga todos os clientes, usuária de cliente enxerga o seu. Sem tabela de papel-permissão, sem matriz.

### 2. Trabalho — o que foi entregue e o que foi pedido

`ciclo` → `entrega` → `etapa` → `etapa_status`, e `demanda` → `demanda_evento`.

**`etapa_status` é separada de `etapa` de propósito.** A etapa é o que eu escrevi; o estado é o que ela respondeu. Se um dia duas pessoas da equipe dela acompanharem a mesma entrega, cada uma tem seu estado sem que uma sobrescreva a outra. `UNIQUE (etapa_id, usuario_id)` garante uma linha por par.

**O estado tem três valores, não dois:** `pendente`, `feito`, `travado`. O `travado` é o que a página estática não conseguia capturar — a memória do projeto registra que *"o que travou é tão útil quanto o que deu certo"*. Uma caixa marcada/desmarcada joga fora essa informação.

**`demanda_evento` é log, não campo.** Mudança de estado, comentário e anexo entram como evento com autor e hora. Isso responde "quando eu pedi isso e quando ela viu" sem depender de memória de conversa. `demanda.status` é a projeção do último evento, mantida na própria linha para não precisar de agregação em toda listagem.

### 3. Números — série, alvo e referência

`metrica_def` (o catálogo) → `metrica_valor` (a série), com `metrica_alvo` (baseline e meta por ciclo) e `benchmark` (referência do nicho).

**Um valor por competência, por origem.** `UNIQUE (cliente_id, metrica_def_id, competencia, origem)` — a mesma métrica pode chegar do Insights e do GA4 com números diferentes, e apagar uma com a outra destruiria justamente a divergência que precisa aparecer. Foi exatamente o caso da receita de julho: painel dizia R$ 10.583,28, formulário dizia R$ 12,7 mil. As duas linhas existem; `origem` diz qual é qual.

**`valor DECIMAL(16,6)` para tudo.** Guarda R$ 10.583,280000 e 0,002300 na mesma coluna. `metrica_def.unidade` diz como renderizar. Ponto flutuante em coluna de dinheiro é bug esperando data.

**Razão é guardada como razão, não como percentual.** `saves/reach` grava `0.002300`, não `0.23`. A formatação multiplica por 100 na hora de exibir. Guardar já formatado é o caminho curto para somar percentual com razão sem perceber.

**`metrica_alvo.contaminado`** existe porque `perfil/metas.md` já carrega duas linhas com essa ressalva — as 7.976 sessões e a receita de julho foram geradas sem link na bio. Uma tela que mostra baseline contaminado como se fosse baseline limpo produz meta ficcional. A regra do projeto é "baseline antes de meta"; a coluna é essa regra escrita em SQL.

**`benchmark` é semeado de `src/dominio/benchmarks.ts`**, com `fonte` e `atualizado_em` obrigatórios. O motor continua sendo a origem; o banco é cópia consultável. Se divergirem, o motor ganha.

### 4. Acervo — os posts

`post`, com `UNIQUE (cliente_id, codigo_ig)`.

**Colunas de dado público e de Insights ficam separadas e nulas por padrão.** Os 203 Reels trazem `views`, `curtidas`, `comentarios` — dado público. Não trazem `alcance` nem `retencao_pct`, que só o Insights tem. Uma coluna `alcance` nula é a verdade; preencher com `views` seria fabricar denominador, e toda taxa do projeto é normalizada por alcance. `procedencia` marca de onde veio cada linha.

## Riscos

| Risco | Sinal | Resposta |
|---|---|---|
| A cliente não entra (senha) | Nenhum acesso em 7 dias após o convite | Fluxo de recuperação já pronto; se persistir, link mágico é uma tabela e uma rota |
| A plataforma vira mais trabalho para o consultor | Dado sendo lançado à mão e o Markdown ficando desatualizado | Importador de CSV e semente cobrem a carga; lançamento manual só para GA4 e receita, que são 2 números por mês |
| Perder banco na VPS | — | Backup diário desde o primeiro deploy, restauração testada uma vez antes de receber a cliente |
| Sobreposição com `perfil/*.md` | Dois lugares dizendo coisas diferentes | Markdown guarda a narrativa e o porquê; banco guarda a série e o estado. Número que vira série sai do Markdown e passa a ser citado do banco |

## O que fica decidido para não ser rediscutido

- Fuso: tudo gravado em **UTC**, renderizado em `America/Sao_Paulo`
- `charset utf8mb4` / `collation utf8mb4_unicode_ci` (funciona em MySQL 8 e MariaDB 11)
- Identificador interno `BIGINT UNSIGNED`; o que aparece em URL leva `codigo_publico CHAR(26)` (ULID), para não expor contagem
- Nenhuma exclusão física em tabela de trabalho — `arquivado_em` marca saída
- Toda consulta de domínio filtra por `cliente_id`, sem exceção
