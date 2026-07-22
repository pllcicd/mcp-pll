-- Migration: git_referencias vira genérica projeto→projeto (não mais amarrada
-- a ferramentas MCP)
-- Contexto: o formato anterior (ferramenta_nome → projeto alvo) só cobria o
-- caso "ferramenta MCP local depende de código externo". A necessidade real é
-- mais ampla: local exato em QUALQUER projeto → local exato em QUALQUER outro
-- projeto (ex.: arquivo/linhas em mcp-pll → endpoint em pll-api-nasajon), sem
-- depender de nome de tool MCP.
--
-- Execute: mysql -u root -p ai_mcp < migrations/20260722_1500/schema.sql
--
-- git_referencias só tinha 6 linhas de teste (nenhum consumidor real ainda),
-- então a tabela é recriada do zero em vez de ALTER TABLE incremental.
-- Idempotente: DROP TABLE IF EXISTS + CREATE TABLE IF NOT EXISTS.

USE ai_mcp;

DROP TABLE IF EXISTS git_referencias;

CREATE TABLE IF NOT EXISTS git_referencias (
  id                     BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,

  fk_projeto_origem      BIGINT UNSIGNED  NOT NULL,
  caminho_origem         VARCHAR(1024)    NOT NULL,
  linha_inicio_origem    INT UNSIGNED         NULL,
  linha_fim_origem       INT UNSIGNED         NULL,
  identificador_origem   VARCHAR(255)         NULL,

  fk_projeto_destino     BIGINT UNSIGNED  NOT NULL,
  caminho_destino        VARCHAR(1024)    NOT NULL,
  linha_inicio_destino   INT UNSIGNED         NULL,
  linha_fim_destino      INT UNSIGNED         NULL,
  identificador_destino  VARCHAR(255)         NULL,

  descricao              VARCHAR(1024)    NOT NULL DEFAULT '',
  adicionado             TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_git_referencias_origem (fk_projeto_origem),
  KEY idx_git_referencias_destino (fk_projeto_destino),
  CONSTRAINT fk_git_referencias_origem  FOREIGN KEY (fk_projeto_origem)  REFERENCES git_projetos(id),
  CONSTRAINT fk_git_referencias_destino FOREIGN KEY (fk_projeto_destino) REFERENCES git_projetos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
