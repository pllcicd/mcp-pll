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

-- ── Permissões ────────────────────────────────────────────────────────────────

GRANT SELECT ON ai_mcp.oauth_tokens        TO 'ai_mcp_dev'@'%';
GRANT SELECT ON ai_mcp.oauth_access_log    TO 'ai_mcp_dev'@'%';
GRANT SELECT ON ai_mcp.oauth_execution_log TO 'ai_mcp_dev'@'%';
GRANT SELECT ON ai_mcp.oauth_auth_codes    TO 'ai_mcp_dev'@'%';
FLUSH PRIVILEGES;
