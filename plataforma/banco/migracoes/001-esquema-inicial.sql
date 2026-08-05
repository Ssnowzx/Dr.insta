-- =============================================================================
-- 001 — Esquema inicial da plataforma de cliente
--
-- Compatível com MySQL 8.0+ e MariaDB 11+.
-- Nada aqui usa recurso exclusivo de um dos dois.
--
-- Convenções, decididas em openspec/changes/plataforma-cliente/design.md:
--   · Todo DATETIME é UTC. O servidor roda com time_zone='+00:00'.
--     A renderização em America/Sao_Paulo é responsabilidade da aplicação.
--   · Identificador interno é BIGINT UNSIGNED. O que aparece em URL leva
--     `codigo_publico` CHAR(26) (ULID), para não expor contagem de registros.
--   · Toda tabela de domínio carrega `cliente_id`. Nenhuma consulta roda sem ele.
--   · Não há exclusão física em tabela de trabalho — `arquivado_em` marca a saída.
--   · Razão é gravada como razão (0.002300), nunca como percentual já formatado.
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';


-- =============================================================================
-- 1. IDENTIDADE E ESCOPO
-- =============================================================================

-- Uma conta atendida. A plataforma nasce com uma linha aqui (Bianca Olivo),
-- mas nenhuma consulta assume isso.
CREATE TABLE cliente (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo_publico    CHAR(26)        NOT NULL,
  slug              VARCHAR(60)     NOT NULL COMMENT 'usado na URL: bianca-olivo',
  nome              VARCHAR(120)    NOT NULL,
  marca             VARCHAR(120)        NULL COMMENT 'My Favorite',
  handle_instagram  VARCHAR(60)         NULL COMMENT 'sem @',
  site              VARCHAR(255)        NULL,
  nicho             VARCHAR(40)     NOT NULL DEFAULT 'lifestyle'
                    COMMENT 'casa com a chave de src/dominio/benchmarks.ts',
  fuso              VARCHAR(40)     NOT NULL DEFAULT 'America/Sao_Paulo',
  arquivado_em      DATETIME            NULL,
  criado_em         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cliente_slug   (slug),
  UNIQUE KEY uq_cliente_codigo (codigo_publico)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Quem entra na plataforma.
--
-- `cliente_id` NULL = consultor: enxerga todos os clientes.
-- `cliente_id` preenchido = usuária daquele cliente: enxerga só o dela.
-- É a regra de acesso inteira, em uma coluna. Sem matriz de permissão.
CREATE TABLE usuario (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo_publico    CHAR(26)        NOT NULL,
  cliente_id        BIGINT UNSIGNED     NULL,
  email             VARCHAR(190)    NOT NULL,
  senha_hash        VARCHAR(255)        NULL COMMENT 'argon2id; NULL até aceitar o convite',
  nome              VARCHAR(120)    NOT NULL,
  papel             ENUM('consultor','cliente') NOT NULL,
  ativo             TINYINT(1)      NOT NULL DEFAULT 1,
  ultimo_acesso_em  DATETIME            NULL,
  criado_em         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuario_email  (email),
  UNIQUE KEY uq_usuario_codigo (codigo_publico),
  KEY ix_usuario_cliente (cliente_id),
  CONSTRAINT fk_usuario_cliente FOREIGN KEY (cliente_id)
    REFERENCES cliente (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Sessão de 90 dias com renovação deslizante: ela entra uma vez no celular
-- e continua entrando. `id` é o SHA-256 do token do cookie — vazamento de
-- banco não entrega sessão utilizável.
CREATE TABLE sessao (
  id             CHAR(64)        NOT NULL COMMENT 'sha256 hex do token do cookie',
  usuario_id     BIGINT UNSIGNED NOT NULL,
  expira_em      DATETIME        NOT NULL,
  ip             VARBINARY(16)       NULL COMMENT 'INET6_ATON; serve para revogar sessão suspeita',
  agente         VARCHAR(255)        NULL,
  criado_em      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  usado_em       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_sessao_usuario (usuario_id),
  KEY ix_sessao_expira  (expira_em),
  CONSTRAINT fk_sessao_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuario (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Convite de uso único (7 dias) e recuperação de senha (1 hora).
--
-- As duas coisas na mesma tabela porque o mecanismo é idêntico: token de uso
-- único com validade. `finalidade` separa. Só o hash é guardado.
CREATE TABLE credencial_token (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id    BIGINT UNSIGNED NOT NULL,
  token_hash    CHAR(64)        NOT NULL COMMENT 'sha256 hex; o token cru só existe no link enviado',
  finalidade    ENUM('convite','redefinicao') NOT NULL,
  expira_em     DATETIME        NOT NULL,
  usado_em      DATETIME            NULL,
  criado_em     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_credencial_hash (token_hash),
  KEY ix_credencial_usuario (usuario_id, finalidade),
  CONSTRAINT fk_credencial_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuario (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- 2. TRABALHO — o que foi entregue e o que foi pedido
-- =============================================================================

-- Um ciclo de trabalho com objetivo e métrica-norte. Espelha perfil/metas.md.
CREATE TABLE ciclo (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo_publico  CHAR(26)        NOT NULL,
  cliente_id      BIGINT UNSIGNED NOT NULL,
  titulo          VARCHAR(160)    NOT NULL COMMENT 'Caminho até a compra',
  objetivo        TEXT                NULL COMMENT 'em linguagem de cliente, não de métrica',
  metrica_norte   VARCHAR(160)        NULL COMMENT 'Sessões rastreadas/mês vindas das origens dela no GA4',
  inicio_em       DATE            NOT NULL,
  fim_em          DATE                NULL,
  status          ENUM('rascunho','ativo','encerrado') NOT NULL DEFAULT 'rascunho',
  criado_em       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                  ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ciclo_codigo (codigo_publico),
  KEY ix_ciclo_cliente (cliente_id, status),
  CONSTRAINT fk_ciclo_cliente FOREIGN KEY (cliente_id)
    REFERENCES cliente (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Um documento entregue à cliente. Substitui uma página publicada na Vercel.
CREATE TABLE entrega (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo_publico  CHAR(26)        NOT NULL,
  cliente_id      BIGINT UNSIGNED NOT NULL,
  ciclo_id        BIGINT UNSIGNED     NULL,
  slug            VARCHAR(80)     NOT NULL COMMENT 'cinco-ajustes',
  titulo          VARCHAR(200)    NOT NULL,
  subtitulo       TEXT                NULL,
  tipo            ENUM('plano','analise','relatorio','auditoria') NOT NULL,
  periodo_inicio  DATE                NULL COMMENT 'janela de dados que a entrega analisa',
  periodo_fim     DATE                NULL,
  minutos_leitura SMALLINT UNSIGNED   NULL,
  ordem           SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  publicado_em    DATETIME            NULL COMMENT 'NULL = rascunho, invisível para a cliente',
  arquivado_em    DATETIME            NULL,
  criado_em       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                  ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_entrega_codigo      (codigo_publico),
  UNIQUE KEY uq_entrega_cliente_slug (cliente_id, slug),
  KEY ix_entrega_ciclo (ciclo_id),
  CONSTRAINT fk_entrega_cliente FOREIGN KEY (cliente_id)
    REFERENCES cliente (id) ON DELETE RESTRICT,
  CONSTRAINT fk_entrega_ciclo FOREIGN KEY (ciclo_id)
    REFERENCES ciclo (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Uma ação que a cliente executa. Os cinco ajustes de 04/08/2026 são cinco linhas.
--
-- `dado_valor` + `dado_rotulo` carregam o número que sustenta a recomendação.
-- A regra do projeto é que nenhuma recomendação chega sem o dado observado que
-- a motivou; a coluna existe para que a tela não consiga esquecer disso.
CREATE TABLE etapa (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  entrega_id     BIGINT UNSIGNED NOT NULL,
  cliente_id     BIGINT UNSIGNED NOT NULL COMMENT 'desnormalizado: evita join só para checar escopo',
  codigo         VARCHAR(12)     NOT NULL COMMENT 'a1..a5, estável entre versões da entrega',
  titulo         VARCHAR(200)    NOT NULL,
  resumo         TEXT                NULL,
  rotulo_prazo   VARCHAR(40)         NULL COMMENT 'hoje, se der · esta semana · a partir de já',
  urgencia       ENUM('hoje','semana','continuo') NOT NULL DEFAULT 'semana',
  dado_valor     VARCHAR(60)         NULL COMMENT '0,66% · 347.482',
  dado_rotulo    VARCHAR(160)        NULL COMMENT 'de conversão no dia',
  ordem          SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  criado_em      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                 ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_etapa_entrega_codigo (entrega_id, codigo),
  KEY ix_etapa_cliente (cliente_id),
  CONSTRAINT fk_etapa_entrega FOREIGN KEY (entrega_id)
    REFERENCES entrega (id) ON DELETE CASCADE,
  CONSTRAINT fk_etapa_cliente FOREIGN KEY (cliente_id)
    REFERENCES cliente (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- O que a cliente respondeu sobre cada etapa. Separado de `etapa` porque a
-- etapa é o que o consultor escreveu e o estado é o que ela respondeu.
--
-- Três estados, não dois. `travado` é a informação que a caixa de marcar do
-- HTML estático jogava fora — e "o que travou é tão útil quanto o que deu certo".
CREATE TABLE etapa_status (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  etapa_id       BIGINT UNSIGNED NOT NULL,
  usuario_id     BIGINT UNSIGNED NOT NULL,
  estado         ENUM('pendente','feito','travado') NOT NULL DEFAULT 'pendente',
  comentario     TEXT                NULL COMMENT 'o que travou, ou o que ela notou ao fazer',
  concluido_em   DATETIME            NULL,
  atualizado_em  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                 ON UPDATE CURRENT_TIMESTAMP,
  criado_em      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_etapa_status (etapa_id, usuario_id),
  KEY ix_etapa_status_usuario (usuario_id),
  CONSTRAINT fk_etapa_status_etapa FOREIGN KEY (etapa_id)
    REFERENCES etapa (id) ON DELETE CASCADE,
  CONSTRAINT fk_etapa_status_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuario (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Recepção de demandas: um pedido com dono, prazo e estado.
--
-- Os cinco pedidos do fim da análise dos 203 Reels entram como cinco linhas.
-- `tipo='dado'` é o caso dominante: quatro dos cinco são só "me manda o dado".
CREATE TABLE demanda (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo_publico  CHAR(26)        NOT NULL,
  cliente_id      BIGINT UNSIGNED NOT NULL,
  entrega_id      BIGINT UNSIGNED     NULL COMMENT 'a entrega que originou o pedido',
  ciclo_id        BIGINT UNSIGNED     NULL,
  titulo          VARCHAR(200)    NOT NULL,
  descricao       TEXT                NULL COMMENT 'o passo a passo de onde tirar o dado',
  porque_importa  TEXT                NULL COMMENT 'sem isto o pedido vira tarefa sem sentido',
  tipo            ENUM('dado','acao','duvida','material') NOT NULL DEFAULT 'dado',
  origem          ENUM('consultor','cliente') NOT NULL DEFAULT 'consultor'
                  COMMENT 'consultor pede à cliente, ou cliente pede ao consultor',
  prioridade      ENUM('baixa','media','alta') NOT NULL DEFAULT 'media',
  status          ENUM('aberta','em_andamento','entregue','dispensada') NOT NULL DEFAULT 'aberta'
                  COMMENT 'projeção do último demanda_evento; mantida aqui para listar sem agregar',
  prazo_em        DATE                NULL,
  aberta_por      BIGINT UNSIGNED     NULL,
  fechada_em      DATETIME            NULL,
  ordem           SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  criado_em       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                  ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_demanda_codigo (codigo_publico),
  KEY ix_demanda_cliente_status (cliente_id, status, prazo_em),
  KEY ix_demanda_entrega (entrega_id),
  CONSTRAINT fk_demanda_cliente FOREIGN KEY (cliente_id)
    REFERENCES cliente (id) ON DELETE RESTRICT,
  CONSTRAINT fk_demanda_entrega FOREIGN KEY (entrega_id)
    REFERENCES entrega (id) ON DELETE SET NULL,
  CONSTRAINT fk_demanda_ciclo FOREIGN KEY (ciclo_id)
    REFERENCES ciclo (id) ON DELETE SET NULL,
  CONSTRAINT fk_demanda_autor FOREIGN KEY (aberta_por)
    REFERENCES usuario (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Log da demanda: comentário, mudança de estado e anexo, com autor e hora.
-- Responde "quando eu pedi e quando ela viu" sem depender de memória de conversa.
CREATE TABLE demanda_evento (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  demanda_id   BIGINT UNSIGNED NOT NULL,
  usuario_id   BIGINT UNSIGNED     NULL,
  tipo         ENUM('comentario','mudanca_status','arquivo','visualizacao') NOT NULL,
  texto        TEXT                NULL,
  de_status    VARCHAR(20)         NULL,
  para_status  VARCHAR(20)         NULL,
  arquivo_id   BIGINT UNSIGNED     NULL,
  criado_em    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_evento_demanda (demanda_id, criado_em),
  CONSTRAINT fk_evento_demanda FOREIGN KEY (demanda_id)
    REFERENCES demanda (id) ON DELETE CASCADE,
  CONSTRAINT fk_evento_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuario (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Arquivo enviado. Os bytes ficam no disco da VPS; aqui fica a identidade.
--
-- O nome que o navegador mandou nunca toca o sistema de arquivos: `caminho` é
-- gerado pelo servidor. `sha256` detecta reenvio do mesmo arquivo e prova
-- integridade. Nada é servido estaticamente — download passa por rota que
-- confere sessão e cliente_id.
CREATE TABLE arquivo (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo_publico  CHAR(26)        NOT NULL,
  cliente_id      BIGINT UNSIGNED NOT NULL,
  demanda_id      BIGINT UNSIGNED     NULL,
  nome_original   VARCHAR(255)    NOT NULL,
  caminho         VARCHAR(400)    NOT NULL COMMENT 'relativo à raiz de armazenamento',
  mime            VARCHAR(100)    NOT NULL,
  bytes           BIGINT UNSIGNED NOT NULL,
  sha256          CHAR(64)        NOT NULL,
  enviado_por     BIGINT UNSIGNED     NULL,
  criado_em       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_arquivo_codigo (codigo_publico),
  KEY ix_arquivo_cliente (cliente_id, criado_em),
  KEY ix_arquivo_demanda (demanda_id),
  KEY ix_arquivo_sha     (cliente_id, sha256),
  CONSTRAINT fk_arquivo_cliente FOREIGN KEY (cliente_id)
    REFERENCES cliente (id) ON DELETE RESTRICT,
  CONSTRAINT fk_arquivo_demanda FOREIGN KEY (demanda_id)
    REFERENCES demanda (id) ON DELETE SET NULL,
  CONSTRAINT fk_arquivo_usuario FOREIGN KEY (enviado_por)
    REFERENCES usuario (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE demanda_evento
  ADD CONSTRAINT fk_evento_arquivo FOREIGN KEY (arquivo_id)
    REFERENCES arquivo (id) ON DELETE SET NULL;


-- =============================================================================
-- 3. NÚMEROS — série, alvo e referência
-- =============================================================================

-- Catálogo de métricas. Diz o que a coluna `valor` significa e como renderizar.
CREATE TABLE metrica_def (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  chave        VARCHAR(60)     NOT NULL COMMENT 'saves_reach, sessoes_rastreadas',
  rotulo       VARCHAR(120)    NOT NULL COMMENT 'como aparece para a cliente',
  rotulo_curto VARCHAR(40)         NULL,
  unidade      ENUM('razao','inteiro','moeda','segundos') NOT NULL,
  direcao      ENUM('subir','descer') NOT NULL DEFAULT 'subir'
               COMMENT 'para que a tela saiba se uma queda é boa ou ruim',
  casas        TINYINT UNSIGNED NOT NULL DEFAULT 2,
  descricao    TEXT                NULL COMMENT 'em linguagem de negócio: por que isto importa',
  como_medir   VARCHAR(255)        NULL COMMENT 'Insights > Atividade do perfil',
  grupo        ENUM('norte','decisao','acompanhar') NOT NULL DEFAULT 'acompanhar'
               COMMENT 'acompanhar = reportar, não otimizar',
  PRIMARY KEY (id),
  UNIQUE KEY uq_metrica_chave (chave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- A série. Um valor por competência POR ORIGEM.
--
-- A mesma métrica pode chegar do Insights e do GA4 com números diferentes, e
-- apagar uma com a outra destruiria a divergência que precisa aparecer — foi o
-- caso da receita de julho: painel dizia R$ 10.583,28 e formulário dizia 12,7 mil.
-- As duas linhas existem; `origem` diz qual é qual.
--
-- DECIMAL(16,6) guarda R$ 10583.280000 e a razão 0.002300 na mesma coluna.
-- Ponto flutuante em coluna de dinheiro é bug esperando data.
CREATE TABLE metrica_valor (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cliente_id     BIGINT UNSIGNED NOT NULL,
  metrica_def_id BIGINT UNSIGNED NOT NULL,
  competencia    DATE            NOT NULL COMMENT 'primeiro dia do período medido',
  granularidade  ENUM('dia','semana','mes') NOT NULL DEFAULT 'mes',
  valor          DECIMAL(16,6)   NOT NULL,
  amostra_n      INT UNSIGNED        NULL COMMENT 'quantos posts sustentam este número',
  origem         ENUM('insights','ga4','loja','publico','manual') NOT NULL,
  observacao     VARCHAR(255)        NULL COMMENT 'amostra abaixo do mínimo, valor contestado, etc.',
  criado_em      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                 ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_metrica_valor (cliente_id, metrica_def_id, competencia, granularidade, origem),
  KEY ix_metrica_valor_serie (cliente_id, metrica_def_id, competencia),
  CONSTRAINT fk_valor_cliente FOREIGN KEY (cliente_id)
    REFERENCES cliente (id) ON DELETE RESTRICT,
  CONSTRAINT fk_valor_def FOREIGN KEY (metrica_def_id)
    REFERENCES metrica_def (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Baseline e alvo por ciclo.
--
-- `contaminado` existe porque perfil/metas.md já carrega duas linhas assim: as
-- 7.976 sessões e a receita de julho foram geradas sem link na bio. Uma tela
-- que mostra baseline contaminado como se fosse limpo produz meta ficcional.
-- A regra do projeto é "baseline antes de meta"; esta coluna é a regra em SQL.
CREATE TABLE metrica_alvo (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cliente_id     BIGINT UNSIGNED NOT NULL,
  ciclo_id       BIGINT UNSIGNED NOT NULL,
  metrica_def_id BIGINT UNSIGNED NOT NULL,
  baseline       DECIMAL(16,6)       NULL,
  baseline_em    DATE                NULL,
  alvo           DECIMAL(16,6)       NULL COMMENT 'NULL enquanto o baseline não for confiável',
  contaminado    TINYINT(1)      NOT NULL DEFAULT 0,
  nota           TEXT                NULL COMMENT 'por que está contaminado, ou como o alvo foi definido',
  criado_em      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                 ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_alvo (ciclo_id, metrica_def_id),
  KEY ix_alvo_cliente (cliente_id),
  CONSTRAINT fk_alvo_cliente FOREIGN KEY (cliente_id)
    REFERENCES cliente (id) ON DELETE RESTRICT,
  CONSTRAINT fk_alvo_ciclo FOREIGN KEY (ciclo_id)
    REFERENCES ciclo (id) ON DELETE CASCADE,
  CONSTRAINT fk_alvo_def FOREIGN KEY (metrica_def_id)
    REFERENCES metrica_def (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Referência do nicho. Semeado de src/dominio/benchmarks.ts.
-- O motor continua sendo a origem do número; isto é cópia consultável.
-- `fonte` e `atualizado_em` são obrigatórios: benchmark sem procedência é boato.
CREATE TABLE benchmark (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nicho          VARCHAR(40)     NOT NULL,
  metrica_def_id BIGINT UNSIGNED NOT NULL,
  valor          DECIMAL(16,6)   NOT NULL,
  fonte          VARCHAR(200)    NOT NULL,
  atualizado_em  DATE            NOT NULL COMMENT 'acima de 12 meses, a tela sinaliza',
  PRIMARY KEY (id),
  UNIQUE KEY uq_benchmark (nicho, metrica_def_id),
  CONSTRAINT fk_benchmark_def FOREIGN KEY (metrica_def_id)
    REFERENCES metrica_def (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Experimento com hipótese, variável isolada e critério de sucesso.
-- `ordem` existe porque o ciclo tem ordem obrigatória: UTM primeiro, sozinha.
CREATE TABLE experimento (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo_publico    CHAR(26)        NOT NULL,
  cliente_id        BIGINT UNSIGNED NOT NULL,
  ciclo_id          BIGINT UNSIGNED NOT NULL,
  nome              VARCHAR(160)    NOT NULL,
  hipotese          TEXT            NOT NULL,
  variavel_isolada  VARCHAR(160)        NULL,
  metrica_def_id    BIGINT UNSIGNED     NULL,
  criterio_valor    DECIMAL(16,6)       NULL,
  criterio_texto    VARCHAR(200)        NULL COMMENT 'saves/reach ≥ 0,8%',
  amostra_minima    SMALLINT UNSIGNED   NULL COMMENT '7 posts',
  dias_minimos      SMALLINT UNSIGNED   NULL COMMENT '14 dias',
  ordem             SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  inicio_em         DATE                NULL,
  fim_em            DATE                NULL,
  status            ENUM('a_iniciar','rodando','lido','inconclusivo','abandonado')
                    NOT NULL DEFAULT 'a_iniciar',
  resultado         TEXT                NULL COMMENT 'o que aconteceu com a métrica, inclusive se falhou',
  criado_em         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_experimento_codigo (codigo_publico),
  KEY ix_experimento_ciclo (ciclo_id, ordem),
  CONSTRAINT fk_exp_cliente FOREIGN KEY (cliente_id)
    REFERENCES cliente (id) ON DELETE RESTRICT,
  CONSTRAINT fk_exp_ciclo FOREIGN KEY (ciclo_id)
    REFERENCES ciclo (id) ON DELETE CASCADE,
  CONSTRAINT fk_exp_def FOREIGN KEY (metrica_def_id)
    REFERENCES metrica_def (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- 4. ACERVO — os posts
-- =============================================================================

-- Um post. Os 203 Reels de jan a ago/2026 entram aqui pelo importador de CSV.
--
-- Coluna de dado público e coluna de Insights ficam separadas e nulas por padrão.
-- O CSV público traz `views`, `curtidas`, `comentarios`. Não traz `alcance` nem
-- `retencao_pct` — só o Insights tem. Uma coluna `alcance` nula é a verdade;
-- preencher com `views` fabricaria denominador, e toda taxa deste projeto é
-- normalizada por alcance.
CREATE TABLE post (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cliente_id      BIGINT UNSIGNED NOT NULL,
  codigo_ig       VARCHAR(40)     NOT NULL COMMENT 'shortcode do Instagram',
  tipo            ENUM('reel','carrossel','imagem','story') NOT NULL,
  publicado_em    DATETIME        NOT NULL,
  url             VARCHAR(255)        NULL,
  legenda         TEXT                NULL,
  duracao_seg     SMALLINT UNSIGNED   NULL,
  pilar           VARCHAR(40)         NULL COMMENT 'Espelho, Provador, Padrão, Bastidor',
  fala_de_marca   TINYINT(1)          NULL,
  nomeia_peca     TINYINT(1)          NULL,
  tem_destino     TINYINT(1)          NULL COMMENT 'chamada para compra presente',
  impulsionado    TINYINT(1)          NULL COMMENT 'NULL = não perguntado ainda',

  -- dado público (API aberta)
  views           BIGINT UNSIGNED     NULL,
  curtidas        BIGINT UNSIGNED     NULL,
  comentarios     BIGINT UNSIGNED     NULL,
  reposts         BIGINT UNSIGNED     NULL COMMENT 'media_repost_count: é repost, NÃO envio em DM',

  -- dado de Insights (só existe com exportação da conta)
  alcance         BIGINT UNSIGNED     NULL,
  salvamentos     BIGINT UNSIGNED     NULL,
  compartilhados  BIGINT UNSIGNED     NULL COMMENT 'sends em DM — este sim',
  retencao_pct    DECIMAL(6,3)        NULL,
  tempo_medio_seg DECIMAL(8,2)        NULL,

  procedencia     ENUM('publico','insights','misto') NOT NULL DEFAULT 'publico',
  criado_em       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                  ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_post (cliente_id, codigo_ig),
  KEY ix_post_data  (cliente_id, publicado_em),
  KEY ix_post_pilar (cliente_id, pilar, duracao_seg),
  CONSTRAINT fk_post_cliente FOREIGN KEY (cliente_id)
    REFERENCES cliente (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- 5. AUDITORIA
-- =============================================================================

-- Quem fez o quê. Documento de cliente carrega receita, conversão e demografia;
-- saber quem leu e quem alterou não é luxo.
CREATE TABLE auditoria (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id   BIGINT UNSIGNED     NULL,
  cliente_id   BIGINT UNSIGNED     NULL,
  acao         VARCHAR(60)     NOT NULL COMMENT 'entrou, baixou_arquivo, mudou_etapa',
  entidade     VARCHAR(40)         NULL,
  entidade_id  BIGINT UNSIGNED     NULL,
  detalhe      JSON                NULL,
  ip           VARBINARY(16)       NULL,
  criado_em    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_auditoria_cliente (cliente_id, criado_em),
  KEY ix_auditoria_usuario (usuario_id, criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A tabela `migracao`, que registra o que já rodou, é criada pelo próprio
-- migrador (`banco/migrar.ts`) antes de aplicar qualquer arquivo. Se ela
-- nascesse aqui, a 001 precisaria criar a tabela que registra a 001.
