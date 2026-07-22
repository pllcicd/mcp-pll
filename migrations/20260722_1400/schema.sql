-- Migration: substitui git_arquivos por git_referencias
-- Contexto: git_arquivos (catálogo genérico de arquivos por projeto) foi um
-- erro de arquitetura — nunca chegou a ser populada com dados reais. A
-- necessidade real é referência cruzada: uma ferramenta MCP local que
-- depende de código físico em OUTRO projeto git (ex.: um endpoint que vive
-- em pll-api-nasajon, usado pela ferramenta cmv_parts_rupture_analysis deste
-- projeto). git_referencias guarda arquivo/linhas/nome do endpoint no projeto
-- alvo, para qualquer IA lendo via MCP ir direto ao ponto sem reexplorar o
-- outro repositório.
--
-- Execute: mysql -u root -p ai_mcp < migrations/20260722_1400/schema.sql
--
-- Idempotente: DROP TABLE IF EXISTS + CREATE TABLE IF NOT EXISTS. git_arquivos
-- nunca teve dados reais gravados, então o DROP é seguro.

USE ai_mcp;

DROP TABLE IF EXISTS git_arquivos;

CREATE TABLE IF NOT EXISTS git_referencias (
  id               BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  fk_git_projeto   BIGINT UNSIGNED  NOT NULL,           -- projeto ALVO (onde o código vive)
  ferramenta_nome  VARCHAR(255)     NOT NULL,           -- ferramenta MCP local que depende disso (mcp_ferramentas.nome)
  caminho          VARCHAR(1024)    NOT NULL,           -- caminho do arquivo no projeto alvo
  linha_inicio     INT UNSIGNED         NULL,
  linha_fim        INT UNSIGNED         NULL,
  identificador    VARCHAR(255)         NULL,           -- nome do endpoint/rota/função, ex.: 'POST /consulta-nasajon'
  descricao        VARCHAR(1024)    NOT NULL DEFAULT '',
  adicionado       TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_git_referencias_projeto (fk_git_projeto),
  KEY idx_git_referencias_ferramenta (ferramenta_nome),
  CONSTRAINT fk_git_referencias_projeto FOREIGN KEY (fk_git_projeto) REFERENCES git_projetos(id),
  CONSTRAINT fk_git_referencias_ferramenta FOREIGN KEY (ferramenta_nome) REFERENCES mcp_ferramentas(nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
