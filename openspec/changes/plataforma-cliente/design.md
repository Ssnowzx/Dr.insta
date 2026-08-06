# Design — plataforma de cliente

## Decisões tomadas com o usuário em 05/08/2026

| Pergunta | Decisão | Consequência |
|---|---|---|
| Escopo | **Multi-cliente no banco, uma cliente na tela** | Toda tabela de domínio carrega `cliente_id`; nenhuma consulta roda sem ele |
| Infra | **Docker + Nginx na VPS** | App e banco em contêiner; o Nginx do host faz proxy e TLS |
| Acesso | **E-mail e senha** | Precisa de fluxo de primeira senha, senão a cliente não entra |
| Canal | **Nenhum e-mail sai do produto** (05/08) | Recuperação deixa de ser self-service; o consultor gera o link dentro da plataforma |
| Upload | **Route Handler, nunca Server Action** | Action tem teto de 1 MB por padrão e os Insights dela chegam a 7 MB |

## Contexto que restringe o desenho

Três fatos do projeto mandam mais que qualquer preferência técnica:

1. **A cliente lê no celular.** Ela é creative director de moda, não analista. A tela precisa carregar rápido em 4G e ser legível de pé. Isso elimina SPA pesada com dashboard de biblioteca de gráficos.
2. **O documento é a conversa.** A memória do projeto registra: a página não acompanha uma explicação, ela *é* a explicação. A plataforma herda essa exigência — cada tela se explica sozinha, em linguagem de moda e negócio, não de métrica.
3. **Ela testa na hora e reprova design medíocre.** O padrão visual das entregas de julho/agosto já foi aprovado por ela. Trocar de linguagem visual agora seria jogar fora capital de reconhecimento.

## Stack

### Aplicação — Next.js 16 (App Router) + React 19 + TypeScript strict

**Por quê:** o dashboard é majoritariamente leitura de dado que muda uma vez por mês. Server Components renderizam isso no servidor e mandam HTML — o celular dela recebe conteúdo, não um pacote de JavaScript que depois busca JSON. Interatividade fica em ilhas pequenas: marcar etapa, abrir demanda, enviar arquivo.

**Alternativas descartadas:**
- **SPA (Vite + React) + API separada** — dois artefatos para versionar, dois contêineres, e a primeira pintura depende de baixar o bundle e então buscar dado. Perde exatamente onde importa: 4G, primeira visita.
- **Astro** — ótimo para conteúdo, mas isto é aplicação com sessão, formulário e estado. Estaríamos remando contra o modelo dele.
- **HTML estático como hoje** — é o que estamos substituindo, e por motivo declarado.

**Custo assumido:** Next.js é a única dependência pesada do projeto. Ela se justifica por render no servidor, roteamento, e por eliminar o serviço de API separado. A regra "zero dependências de runtime" do `openspec/config.yaml` vale para `src/` — o motor de métricas continua puro e sem dependência. `platform/` é outro artefato, e a exceção está registrada aqui.

### Estilo — CSS com os tokens já aprovados, sem framework

**Por quê:** os tokens de cor e tipografia das entregas de julho/agosto já passaram por medição de contraste WCAG par a par e já foram aprovados pela cliente. Eles migram como variáveis CSS, iguais. Tailwind seria reescrever esse sistema em outra sintaxe sem ganhar nada — a superfície é pequena e os componentes se repetem.

**Fontes servidas do próprio domínio.** Os `.ttf` de `relatorios/bianca-olivo-2026-07/fonts/` (Italiana, Instrument Sans, Instrument Serif, Geist Mono) foram subsetados para pt-BR e convertidos: **460 KB viraram 128 KB**. Cortam a ida ao Google Fonts, que no 4G custa uma resolução de DNS e um aperto de mão TLS antes do primeiro texto aparecer.

**Duas variantes do caramelo, medidas.** O validador de paleta reprovou o caramelo aprovado como *preenchimento*: croma OKLCH 0,094 contra piso 0,1, o que lê como cinza em área sólida. Texto e preenchimento têm trabalhos diferentes, então há `--caramelo` (texto, contraste WCAG) e `--dado` (marca de gráfico, validado nos dois temas). `test/contrast.test.ts` lê o `base.css` e afirma 40 pares.

### Gráficos — SVG próprio, sem biblioteca

**Por quê:** são poucas formas e todas conhecidas: linha de evolução mensal, barra comparando com baseline/alvo/benchmark, e medidor de progresso. Recharts custa em torno de 100 KB comprimidos e traz um sistema de layout inteiro para desenhar uma linha de doze pontos. SVG gerado no servidor sai em HTML, aparece com o resto da página e funciona sem JavaScript.

**Onde isso deixaria de valer:** se aparecer necessidade de zoom, seleção de intervalo por arraste ou tooltip com muitos pontos, a conta vira. Reavaliar quando surgir, não antes.

### Banco — MySQL 8 com Drizzle ORM

**MySQL** foi escolha do usuário. Compatível com MariaDB 11 no que este esquema usa (nada de `CHECK` com função, nada de tipo próprio do MySQL 8, `utf8mb4_unicode_ci` existe nos dois).

**Drizzle e não Prisma:** Prisma sobe um binário de engine ao lado do processo Node, o que engorda a imagem e complica build multi-arquitetura na VPS. Drizzle gera SQL, roda no mesmo processo e as migrações são arquivos `.sql` legíveis — dá para ler e conferir o que vai rodar em produção. Para um esquema deste tamanho, o ganho ergonômico do Prisma não paga a operação.

### Autenticação — sessão em tabela, senha com Argon2id

**Por quê própria:** dois papéis, um cliente, sem SSO e sem OAuth. Auth.js traria adaptador, callbacks e um modelo de conta que não usamos. Uma tabela `session`, um cookie `HttpOnly; Secure; SameSite=Lax` e `argon2` de hash cobrem o caso inteiro em pouco código auditável.

**Onde a autorização mora, no Next 16.** Duas coisas mudaram em relação ao que se
escrevia até o Next 15, e as duas foram lidas em `node_modules/next/dist/docs/`
antes de escrever qualquer linha:

- `middleware.ts` **foi renomeado para `proxy.ts`**. O nome antigo é ignorado.
- O proxy roda em **toda rota, inclusive nos prefetch**. Consultar banco ali
  transforma cada link pré-carregado numa consulta. Por isso ele faz só a
  checagem otimista — existe cookie de sessão? — e nada mais.

A fronteira de verdade é um **Data Access Layer**: `requireSession()` memoizada
com `cache()` do React, chamada por toda página, Server Action e Route Handler.
Quem esquecer de chamar não recebe dado, porque a consulta escopada passa por ela.
Isso é o que cumpre o requisito de recusar a requisição antes de qualquer consulta
ao domínio — o proxy sozinho não cumpriria.

**Token opaco em vez de JWT no cookie.** O guia oficial cifra o identificador da
sessão para que o proxy saiba quem é o usuário sem ir ao banco. Aqui o cookie leva
32 bytes aleatórios e o banco guarda só o SHA-256 deles.

O que se perde: o proxy não sabe *quem* é, só que *há* um cookie. O que se ganha:
não existe chave de assinatura para vazar, e **revogação é imediata** — apagar a
linha encerra a sessão no mesmo instante, enquanto um JWT válido continua valendo
até expirar. Para uma cliente e um consultor, revogação instantânea vale mais que
economizar uma consulta.

**O risco do e-mail e senha, e o que fazemos com ele.** A escolha do usuário foi senha; o atrito é real — cliente que esquece senha é cliente que não entra. Mitigação embutida no fluxo:

1. Ela nunca escolhe senha num cadastro. Recebe um **convite de uso único** (token de 32 bytes, validade 7 dias) e define a senha ali.
2. Sessão de **90 dias com renovação deslizante**. Na prática, entra uma vez no celular e continua entrando.
3. Um caminho de recuperação que **não depende de e-mail** — ver abaixo.

### Sem e-mail, decidido em 05/08/2026

O produto **não envia e-mail nenhum**. O usuário decidiu isso depois de perguntar
para qual endereço a notificação estava indo e descobrir que era um endereço de
teste, num domínio reservado, entregue num coletor local. O log dizia "enviado".

O argumento que sustenta a decisão: um servidor de e-mail que ninguém mantém é
uma dependência que falha em silêncio no pior momento, e um resumo caindo numa
caixa que ninguém olha equivale a resumo nenhum. `nodemailer` foi removido.

**O que isso custa, explicitamente:** a recuperação de senha deixa de ser
self-service. Não é detalhe de implementação — é redução do que o produto faz, e
está registrada aqui para não ser redescoberta como bug.

**O que fecha o buraco:**

1. A tela de entrar **registra a tentativa** (`asked_for_access` na auditoria) e
   ela aparece em `/novidades` como "não conseguiu entrar". O consultor fica
   sabendo sem depender de ela lembrar de avisar.
2. **Conta → Acesso das clientes** gera um link novo e copia. Convite para quem
   nunca entrou (7 dias), redefinição para quem já tem senha (1 hora). Gerar um
   novo invalida o anterior.

A tela de recuperação **não emite token**. Se emitisse, qualquer um digitando o
endereço dela queimaria o link pendente de quem está no meio da recuperação. Só
o consultor emite, autenticado.

O link aparece na tela **além** de ser copiado: `navigator.clipboard` exige
contexto seguro e não faz nada em HTTP puro, então a cópia pode falhar calada
enquanto o recurso ainda precisa funcionar.

### Notificação dentro da plataforma

`/novidades` é a tela do consultor com o que cada cliente fez desde a última
leitura. O marcador é `user.news_seen_at` (migração 002), e **não**
`last_seen_at` — este avança a cada login e marcaria tudo como lido só por
alguém abrir o app.

Três regras: **travou e "não conseguiu entrar" vêm primeiro**, porque são as
duas que mudam o que ele faz hoje; **só a ação da cliente aparece**, já que a
plataforma contando ao consultor o que ele mesmo fez é ruído; e a janela é
**semiaberta** — inclusiva no início, exclusiva no fim — para que duas leituras
seguidas não repitam nem percam um evento.

No celular a entrada é um sino no topo, não um sexto item na barra inferior:
seis itens em 360px dão 60px cada, e o rótulo mais longo já precisa de 53.

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

### A regra que o código protege

O importador **nunca escreve `reach`**. A exportação pública tem `views`, que
conta cada vez que o vídeo roda — vídeo curto roda de novo sozinho. Alcance é
outra medição, que só o Insights tem. Um `reach` copiado de `views` não seria um
pouco errado: seria denominador errado em **toda** taxa calculada depois, e nada
downstream pareceria quebrado. `test/import.test.ts` afirma o invariante, e
afirma também que nenhum post tem `reach` igual a `views`.

Pela mesma razão, o funil e os cartões de métrica leem apenas origens medidas
(`insights`, `ga4`, `store`). O que vem do coletor entra como `public` e nunca
pode ser confundido com medição.

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
