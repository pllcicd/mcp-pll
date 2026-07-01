-- Schema do banco de dados para o servidor MCP
-- Execute: mysql -u root -p < schema.sql

CREATE DATABASE IF NOT EXISTS ai_mcp
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ai_mcp;

-- ── Tokens OAuth emitidos ────────────────────────────────────────────────────
-- Vinculados ao colaborador autenticado via B2B.
-- access_token é um JWT (o jti fica aqui para eventual revogação).
-- refresh_token é opaco e rotacionado a cada uso (single-rotation).

CREATE TABLE IF NOT EXISTS oauth_tokens (
  id                  BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  colaborador_id      INT UNSIGNED     NOT NULL,         -- id em grupopll_master.cadastro_colaborador
  user_session_id     VARCHAR(255)     NOT NULL,         -- userSession recebido do B2B (code)
  access_jti          VARCHAR(64)          NULL,         -- jti do JWT (para revogação futura)
  refresh_token       VARCHAR(255)     NOT NULL,         -- token opaco, single-rotation
  scopes              VARCHAR(1024)    NOT NULL DEFAULT '',
  expires_at          TIMESTAMP        NOT NULL,         -- expiração do access_token
  refresh_expires_at  TIMESTAMP        NOT NULL,         -- expiração do refresh_token (padrão: +30 dias)
  revoked             TINYINT(1)       NOT NULL DEFAULT 0,
  created_at          TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_oauth_refresh (refresh_token),
  KEY idx_oauth_colab   (colaborador_id),
  KEY idx_oauth_jti     (access_jti)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Auditoria de acessos ─────────────────────────────────────────────────────
-- Registra cada troca de userSession por tokens em /oauth/token.

CREATE TABLE IF NOT EXISTS oauth_access_log (
  id               BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  colaborador_id   INT UNSIGNED     NOT NULL,
  user_session_id  VARCHAR(255)     NOT NULL,
  ip               VARCHAR(64)          NULL,
  created_at       TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_access_colab   (colaborador_id),
  KEY idx_access_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Auth codes temporários (OAuth) ───────────────────────────────────────────
-- Gerados no /oauth/callback e consumidos no /oauth/token (single-use, 5 min).
-- Persistidos para sobreviver hot-reload do servidor.

CREATE TABLE IF NOT EXISTS oauth_auth_codes (
  code            VARCHAR(64)      NOT NULL,
  colaborador_id  INT UNSIGNED     NOT NULL,
  expires_at      TIMESTAMP        NOT NULL,
  used            TINYINT(1)       NOT NULL DEFAULT 0,
  created_at      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (code),
  KEY idx_auth_code_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Auditoria de execuções de tools MCP ──────────────────────────────────────
-- Registra cada chamada de tool MCP com o colaborador e o timestamp.

CREATE TABLE IF NOT EXISTS oauth_execution_log (
  id               BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  colaborador_id   INT UNSIGNED     NOT NULL,        -- mesmo id de cadastro_colaborador
  tool_name        VARCHAR(255)     NOT NULL,
  created_at       TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_exec_colab   (colaborador_id),
  KEY idx_exec_tool    (tool_name),
  KEY idx_exec_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── RBAC de ferramentas MCP (escopos LEITURA/USO por perfil) ─────────────────
-- Todas as tabelas abaixo seguem a premissa: `adicionado` (criação), `cancelado`
-- (soft-delete) e `fk_colaborador` (quem fez a última alteração). Cada tabela
-- base tem uma gêmea `_log` alimentada por triggers AFTER INSERT / BEFORE UPDATE
-- para versionamento (ver seção de Triggers).

-- Registro de ferramentas MCP expostas pelo servidor.
-- `arquivo_fonte` é o caminho relativo a `src/tools/` lido pela ferramenta
-- `read_tool_source`.
CREATE TABLE IF NOT EXISTS mcp_ferramentas (
  id              BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  nome            VARCHAR(255)     NOT NULL,                -- casa com server.tool('<nome>')
  descricao       VARCHAR(1024)    NOT NULL DEFAULT '',
  arquivo_fonte   VARCHAR(512)         NULL,                -- ex.: 'os.tool.ts'
  adicionado      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelado       TIMESTAMP            NULL,
  fk_colaborador  INT UNSIGNED         NULL,                -- id em grupopll_master.cadastro_colaborador

  PRIMARY KEY (id),
  UNIQUE KEY uq_mcp_ferramentas_nome (nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Catálogo de escopos (LEITURA = ver código-fonte, USO = executar).
CREATE TABLE IF NOT EXISTS mcp_escopos (
  id              BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  codigo          VARCHAR(64)      NOT NULL,                -- 'LEITURA' | 'USO' | ...
  descricao       VARCHAR(1024)    NOT NULL DEFAULT '',
  adicionado      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelado       TIMESTAMP            NULL,
  fk_colaborador  INT UNSIGNED         NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_mcp_escopos_codigo (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vínculo ferramenta ↔ escopo: quais escopos cada ferramenta expõe.
CREATE TABLE IF NOT EXISTS mcp_ferramentas_escopo (
  id              BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  fk_ferramenta   BIGINT UNSIGNED  NOT NULL,                -- mcp_ferramentas.id
  fk_escopo       BIGINT UNSIGNED  NOT NULL,                -- mcp_escopos.id
  adicionado      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelado       TIMESTAMP            NULL,
  fk_colaborador  INT UNSIGNED         NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_mcp_ferramentas_escopo (fk_ferramenta, fk_escopo),
  KEY idx_mcp_ferramentas_escopo_ferramenta (fk_ferramenta),
  KEY idx_mcp_ferramentas_escopo_escopo      (fk_escopo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Concessão RBAC por perfil: liga um perfil (codigo de
-- grupopll_master.cadastro_colaborador_perfil.codigo, mesmo valor das chaves
-- do JSON acesso_perfil) a um par ferramenta+escopo específico. A presença de
-- uma linha não cancelada = permissão concedida.
CREATE TABLE IF NOT EXISTS mcp_perfis_escopo (
  id                    BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  perfil_codigo         VARCHAR(64)      NOT NULL,          -- cadastro_colaborador_perfil.codigo (cross-DB, sem FK)
  fk_ferramenta_escopo  BIGINT UNSIGNED  NOT NULL,           -- mcp_ferramentas_escopo.id
  adicionado            TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelado             TIMESTAMP            NULL,
  fk_colaborador        INT UNSIGNED         NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_mcp_perfis_escopo (perfil_codigo, fk_ferramenta_escopo),
  KEY idx_mcp_perfis_escopo_perfil     (perfil_codigo),
  KEY idx_mcp_perfis_escopo_ferrescopo (fk_ferramenta_escopo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Histórico / versionamento (tabelas _log) ─────────────────────────────────
-- Cada tabela `_log` espelha as colunas de negócio da base e adiciona
-- `id_registro` (id da linha base versionada), `operacao` (INSERT/UPDATE) e
-- `registrado_em`. Sem unique keys — guarda N versões da mesma linha base.

CREATE TABLE IF NOT EXISTS mcp_ferramentas_log (
  id              BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  id_registro     BIGINT UNSIGNED  NOT NULL,
  operacao        VARCHAR(16)      NOT NULL,
  nome            VARCHAR(255)     NOT NULL,
  descricao       VARCHAR(1024)    NOT NULL DEFAULT '',
  arquivo_fonte   VARCHAR(512)         NULL,
  adicionado      TIMESTAMP            NULL,
  cancelado       TIMESTAMP            NULL,
  fk_colaborador  INT UNSIGNED         NULL,
  registrado_em   TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_mcp_ferramentas_log_registro (id_registro)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mcp_escopos_log (
  id              BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  id_registro     BIGINT UNSIGNED  NOT NULL,
  operacao        VARCHAR(16)      NOT NULL,
  codigo          VARCHAR(64)      NOT NULL,
  descricao       VARCHAR(1024)    NOT NULL DEFAULT '',
  adicionado      TIMESTAMP            NULL,
  cancelado       TIMESTAMP            NULL,
  fk_colaborador  INT UNSIGNED         NULL,
  registrado_em   TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_mcp_escopos_log_registro (id_registro)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mcp_ferramentas_escopo_log (
  id              BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  id_registro     BIGINT UNSIGNED  NOT NULL,
  operacao        VARCHAR(16)      NOT NULL,
  fk_ferramenta   BIGINT UNSIGNED  NOT NULL,
  fk_escopo       BIGINT UNSIGNED  NOT NULL,
  adicionado      TIMESTAMP            NULL,
  cancelado       TIMESTAMP            NULL,
  fk_colaborador  INT UNSIGNED         NULL,
  registrado_em   TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_mcp_ferramentas_escopo_log_registro (id_registro)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mcp_perfis_escopo_log (
  id                    BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  id_registro           BIGINT UNSIGNED  NOT NULL,
  operacao              VARCHAR(16)      NOT NULL,
  perfil_codigo         VARCHAR(64)      NOT NULL,
  fk_ferramenta_escopo  BIGINT UNSIGNED  NOT NULL,
  adicionado            TIMESTAMP            NULL,
  cancelado             TIMESTAMP            NULL,
  fk_colaborador        INT UNSIGNED         NULL,
  registrado_em         TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_mcp_perfis_escopo_log_registro (id_registro)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Triggers de versionamento ─────────────────────────────────────────────────
-- AFTER INSERT grava a versão de nascimento (NEW). BEFORE UPDATE grava a
-- pré-imagem (OLD) antes da alteração — assim a linha base atual somada a
-- todas as pré-imagens em `_log` reconstroem a linha do tempo completa,
-- inclusive soft-deletes via `cancelado`. `DROP TRIGGER IF EXISTS` antes de
-- cada `CREATE TRIGGER` garante que este arquivo possa ser reaplicado.

DELIMITER $$

DROP TRIGGER IF EXISTS trg_mcp_ferramentas_ai$$
CREATE TRIGGER trg_mcp_ferramentas_ai AFTER INSERT ON mcp_ferramentas
FOR EACH ROW
BEGIN
  INSERT INTO mcp_ferramentas_log
    (id_registro, operacao, nome, descricao, arquivo_fonte, adicionado, cancelado, fk_colaborador)
  VALUES
    (NEW.id, 'INSERT', NEW.nome, NEW.descricao, NEW.arquivo_fonte, NEW.adicionado, NEW.cancelado, NEW.fk_colaborador);
END$$

DROP TRIGGER IF EXISTS trg_mcp_ferramentas_bu$$
CREATE TRIGGER trg_mcp_ferramentas_bu BEFORE UPDATE ON mcp_ferramentas
FOR EACH ROW
BEGIN
  INSERT INTO mcp_ferramentas_log
    (id_registro, operacao, nome, descricao, arquivo_fonte, adicionado, cancelado, fk_colaborador)
  VALUES
    (OLD.id, 'UPDATE', OLD.nome, OLD.descricao, OLD.arquivo_fonte, OLD.adicionado, OLD.cancelado, OLD.fk_colaborador);
END$$

DROP TRIGGER IF EXISTS trg_mcp_escopos_ai$$
CREATE TRIGGER trg_mcp_escopos_ai AFTER INSERT ON mcp_escopos
FOR EACH ROW
BEGIN
  INSERT INTO mcp_escopos_log
    (id_registro, operacao, codigo, descricao, adicionado, cancelado, fk_colaborador)
  VALUES
    (NEW.id, 'INSERT', NEW.codigo, NEW.descricao, NEW.adicionado, NEW.cancelado, NEW.fk_colaborador);
END$$

DROP TRIGGER IF EXISTS trg_mcp_escopos_bu$$
CREATE TRIGGER trg_mcp_escopos_bu BEFORE UPDATE ON mcp_escopos
FOR EACH ROW
BEGIN
  INSERT INTO mcp_escopos_log
    (id_registro, operacao, codigo, descricao, adicionado, cancelado, fk_colaborador)
  VALUES
    (OLD.id, 'UPDATE', OLD.codigo, OLD.descricao, OLD.adicionado, OLD.cancelado, OLD.fk_colaborador);
END$$

DROP TRIGGER IF EXISTS trg_mcp_ferramentas_escopo_ai$$
CREATE TRIGGER trg_mcp_ferramentas_escopo_ai AFTER INSERT ON mcp_ferramentas_escopo
FOR EACH ROW
BEGIN
  INSERT INTO mcp_ferramentas_escopo_log
    (id_registro, operacao, fk_ferramenta, fk_escopo, adicionado, cancelado, fk_colaborador)
  VALUES
    (NEW.id, 'INSERT', NEW.fk_ferramenta, NEW.fk_escopo, NEW.adicionado, NEW.cancelado, NEW.fk_colaborador);
END$$

DROP TRIGGER IF EXISTS trg_mcp_ferramentas_escopo_bu$$
CREATE TRIGGER trg_mcp_ferramentas_escopo_bu BEFORE UPDATE ON mcp_ferramentas_escopo
FOR EACH ROW
BEGIN
  INSERT INTO mcp_ferramentas_escopo_log
    (id_registro, operacao, fk_ferramenta, fk_escopo, adicionado, cancelado, fk_colaborador)
  VALUES
    (OLD.id, 'UPDATE', OLD.fk_ferramenta, OLD.fk_escopo, OLD.adicionado, OLD.cancelado, OLD.fk_colaborador);
END$$

DROP TRIGGER IF EXISTS trg_mcp_perfis_escopo_ai$$
CREATE TRIGGER trg_mcp_perfis_escopo_ai AFTER INSERT ON mcp_perfis_escopo
FOR EACH ROW
BEGIN
  INSERT INTO mcp_perfis_escopo_log
    (id_registro, operacao, perfil_codigo, fk_ferramenta_escopo, adicionado, cancelado, fk_colaborador)
  VALUES
    (NEW.id, 'INSERT', NEW.perfil_codigo, NEW.fk_ferramenta_escopo, NEW.adicionado, NEW.cancelado, NEW.fk_colaborador);
END$$

DROP TRIGGER IF EXISTS trg_mcp_perfis_escopo_bu$$
CREATE TRIGGER trg_mcp_perfis_escopo_bu BEFORE UPDATE ON mcp_perfis_escopo
FOR EACH ROW
BEGIN
  INSERT INTO mcp_perfis_escopo_log
    (id_registro, operacao, perfil_codigo, fk_ferramenta_escopo, adicionado, cancelado, fk_colaborador)
  VALUES
    (OLD.id, 'UPDATE', OLD.perfil_codigo, OLD.fk_ferramenta_escopo, OLD.adicionado, OLD.cancelado, OLD.fk_colaborador);
END$$

DELIMITER ;

-- ── Seed / bootstrap ──────────────────────────────────────────────────────────
-- Idempotente (ON DUPLICATE KEY UPDATE) para permitir reexecução do schema.sql.
-- O perfil ADMIN recebe LEITURA+USO em todas as ferramentas no momento do DDL:
-- as próprias ferramentas de administração (admin_*) são gate-adas por RBAC, e
-- sem esse bootstrap nenhum colaborador conseguiria usar admin_grant_perfil_scope
-- para conceder o primeiro acesso (ovo-galinha). Qualquer colaborador com
-- {"ADMIN": true} em grupopll_master.cadastro_colaborador.acesso_perfil herda
-- este acesso total e pode então administrar o restante via ferramentas MCP.

INSERT INTO mcp_escopos (codigo, descricao) VALUES
  ('LEITURA', 'Ver o código-fonte / definição da ferramenta'),
  ('USO',     'Executar a ferramenta')
ON DUPLICATE KEY UPDATE descricao = VALUES(descricao);

INSERT INTO mcp_ferramentas (nome, descricao, arquivo_fonte) VALUES
  ('whoami',                               'Retorna os dados do usuário autenticado a partir do JWT', 'whoami.tool.ts'),
  ('get_os',                               'Retorna todos os dados brutos de uma OS',                 'os.tool.ts'),
  ('get_service_title',                    'Retorna o tipo de serviço associado a um ID',             'os.tool.ts'),
  ('get_status_title',                     'Retorna o título do status associado a um ID',            'os.tool.ts'),
  ('cmv_parts_rupture_analysis',           'CMV — análise de ruptura de peças',                       'cmv.tool.ts'),
  ('cmv_parts_consumption_physical_match', 'CMV — consumo com match físico',                          'cmv.tool.ts'),
  ('cmv_parts_consumption_systemic_match', 'CMV — consumo com match sistêmico',                       'cmv.tool.ts'),
  ('cmv_parts_consumption_awaiting_match', 'CMV — consumo aguardando match',                          'cmv.tool.ts'),
  ('cmv_parts_operational_loss',           'CMV — perda operacional',                                 'cmv.tool.ts'),
  ('read_tool_source',                     'Lê o código-fonte .ts de uma ferramenta MCP em disco',    'read-source.tool.ts'),
  ('admin_register_tool',                  'Cadastra/atualiza uma ferramenta no registro RBAC',       'admin.tool.ts'),
  ('admin_link_tool_scope',                'Vincula um escopo a uma ferramenta',                      'admin.tool.ts'),
  ('admin_grant_perfil_scope',             'Concede um escopo de ferramenta a um perfil',             'admin.tool.ts'),
  ('admin_revoke_perfil_scope',            'Revoga (soft-delete) um escopo de ferramenta de um perfil','admin.tool.ts'),
  ('admin_list_grants',                    'Lista as concessões RBAC atuais',                         'admin.tool.ts')
ON DUPLICATE KEY UPDATE
  descricao     = VALUES(descricao),
  arquivo_fonte = VALUES(arquivo_fonte);

-- Toda ferramenta expõe LEITURA e USO.
INSERT INTO mcp_ferramentas_escopo (fk_ferramenta, fk_escopo)
SELECT t.id, s.id
  FROM mcp_ferramentas t
  CROSS JOIN mcp_escopos s
 WHERE s.codigo IN ('LEITURA', 'USO')
ON DUPLICATE KEY UPDATE fk_ferramenta = VALUES(fk_ferramenta);

-- Perfil ADMIN: acesso total (bootstrap).
INSERT INTO mcp_perfis_escopo (perfil_codigo, fk_ferramenta_escopo)
SELECT 'ADMIN', fe.id
  FROM mcp_ferramentas_escopo fe
ON DUPLICATE KEY UPDATE fk_ferramenta_escopo = VALUES(fk_ferramenta_escopo);

-- ── Permissões ────────────────────────────────────────────────────────────────
-- Este script não concede GRANTs a usuários. O acesso de leitura/escrita ao
-- banco `ai_mcp` é gerenciado fora do schema.sql (nível de usuário/infra do
-- MySQL) — não é responsabilidade da definição do schema, e criar/alterar
-- GRANTs aqui exigiria que o usuário que aplica o script tivesse privilégio
-- GRANT OPTION, o que não deveria ser premissa para simplesmente rodar as
-- migrações. Se precisar conceder acesso a um novo usuário de leitura,
-- faça isso manualmente (ex.: `GRANT SELECT ON ai_mcp.* TO 'usuario'@'%';`),
-- fora deste arquivo.
