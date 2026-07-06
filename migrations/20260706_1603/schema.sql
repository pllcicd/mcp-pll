-- Migration: PKCE (RFC 7636) + client_id/redirect_uri binding (RFC 7591) +
--            detecção de reuso de refresh token (family_id)
-- Contexto: auditoria de conformidade OAuth 2.0/2.1 do fluxo /oauth/* deste
-- servidor. Ver commit correspondente para o código que passa a usar estas colunas.
--
-- Execute: mysql -u root -p ai_mcp < migrations/20260706_1603/schema.sql
--
-- Idempotente: MySQL (ao contrário do MariaDB) não suporta
-- `ADD COLUMN IF NOT EXISTS`/`ADD KEY IF NOT EXISTS` — por isso cada
-- alteração de coluna/índice aqui é feita via checagem em
-- information_schema + SQL preparado dinamicamente, condicional à coluna/
-- índice ainda não existir. Seguro reaplicar este arquivo quantas vezes for
-- preciso.

USE ai_mcp;

-- ── oauth_tokens: liga token a client + família de refresh tokens ───────────

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'oauth_tokens' AND COLUMN_NAME = 'client_id'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE oauth_tokens ADD COLUMN client_id VARCHAR(64) NULL AFTER scopes',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'oauth_tokens' AND COLUMN_NAME = 'family_id'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE oauth_tokens ADD COLUMN family_id VARCHAR(64) NULL AFTER client_id',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'oauth_tokens' AND INDEX_NAME = 'idx_oauth_family'
);
SET @sql := IF(@idx_exists = 0,
  'ALTER TABLE oauth_tokens ADD KEY idx_oauth_family (family_id)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ── oauth_clients: novo — registro de clients (RFC 7591) ────────────────────
CREATE TABLE IF NOT EXISTS oauth_clients (
  client_id       VARCHAR(64)      NOT NULL,
  redirect_uris   TEXT             NOT NULL,          -- JSON array de URIs exatas permitidas
  created_at      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ── oauth_auth_codes: liga o code a client/redirect_uri/PKCE ────────────────

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'oauth_auth_codes' AND COLUMN_NAME = 'client_id'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE oauth_auth_codes ADD COLUMN client_id VARCHAR(64) NULL AFTER colaborador_id',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'oauth_auth_codes' AND COLUMN_NAME = 'redirect_uri'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE oauth_auth_codes ADD COLUMN redirect_uri VARCHAR(512) NULL AFTER client_id',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'oauth_auth_codes' AND COLUMN_NAME = 'code_challenge'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE oauth_auth_codes ADD COLUMN code_challenge VARCHAR(128) NULL AFTER redirect_uri',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'oauth_auth_codes' AND COLUMN_NAME = 'code_challenge_method'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE oauth_auth_codes ADD COLUMN code_challenge_method VARCHAR(16) NULL AFTER code_challenge',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
