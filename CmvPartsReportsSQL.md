# SQLs dos Relatórios de CMV (Custo da Mercadoria Vendida)

Fonte: `src/reports/queries/cmv.queries.ts` (usadas por `src/reports/reports.service.ts`).

As tabelas não qualificadas (`lab_pedido_peca`, `os`, `os_timeline`, `estoque_hit`, `indenizacao`, ...) pertencem ao banco da empresa (`grupopll_crmoema`). As tabelas prefixadas com `grupopll_master.` pertencem ao banco master.

Mapeamento com os arquivos originais da pasta `cmv/`:

| Constante / relatório | Endpoint/nome interno | Arquivo original |
|---|---|---|
| `PARTS_RUPTURE_ANALYSIS` | `parts-rupture-analysis` | `relatorio-peca-analise-ruptura` |
| `PARTS_CONSUMPTION_PHYSICAL_MATCH` | `parts-consumption-physical-match` | `relatorio-peca-consumo-global-casado-fisico` |
| `PARTS_CONSUMPTION_SYSTEMIC_MATCH` | `parts-consumption-systemic-match` | `relatorio-peca-consumo-global-casado-sistemico` |
| `PARTS_CONSUMPTION_AWAITING_MATCH` | `parts-consumption-awaiting-match` | `relatorio-peca-consumo-global-aguarda-casamento` |
| `PARTS_OPERATIONAL_LOSS` | `parts-operational-loss` | `relatorio-peca-perda-operacional` |
| `PARTS_STOCK_HIT` | `parts-stock-hit` | `relatorio-peca-estoque-hit` |

---

## 0. `cmv_parts_stock_hit` — Peças em estoque nunca vinculadas a um pedido

```sql
SELECT 	COUNT(estoque_hit.id) AS qtd, 'ESTOQUE_HIT' AS tipo, estoque.sku_tecnico,
			amar.titulo AS marca, amod.codigo AS cod_modelo,
			amod.titulo AS modelo, amod.titulo_comercial AS modelo_comercial,
			ebat.codigo AS capacidade_codigo, ebat.capacidade AS bateria_capacidade,
			ecor.codigo AS cod_cor, ecor.titulo AS cor, ecap.codigo AS cod_capacidade, ecap.titulo AS capacidade,
			efam.titulo AS peca_familia, estoque.sku_tecnico

FROM estoque_hit AS estoque_hit
INNER JOIN grupopll_master.estoque_codigo_fabricante AS ecf ON ecf.codigo_fabricante = estoque_hit.fk_codigo_fabricante
INNER JOIN grupopll_master.estoque AS estoque ON ecf.fk_sku_completo = estoque.sku_completo
INNER JOIN grupopll_master.aparelho_modelo AS amod ON estoque.fk_modelo = amod.codigo
INNER JOIN grupopll_master.estoque_bateria AS ebat ON amod.fk_bateria_capacidade = ebat.codigo
INNER JOIN grupopll_master.aparelho_marca AS amar ON amod.fk_marca = amar.codigo
INNER JOIN grupopll_master.estoque_cor AS ecor ON estoque.fk_cor = ecor.codigo
INNER JOIN grupopll_master.estoque_capacidade AS ecap ON estoque.fk_capacidade = ecap.codigo
INNER JOIN grupopll_master.estoque_familia AS efam ON estoque.fk_familia = efam.codigo

WHERE 	estoque.fk_tipo = 'PC' AND estoque_hit.fk_pedido IS NULL

GROUP BY estoque.sku_tecnico
```

---

## 1. `cmv_parts_rupture_analysis` — Análise de Ruptura de Peças

Pedidos cancelados nos últimos 6 meses.

```sql
-- Análise Ruptura de Peças

SELECT 	lpp.fk_os AS os, otsc.titulo AS seguradora, ots.cod_subtipo AS subtipo_servico, ots.titulo AS tipo_servico,
			lpp.id AS pedido_id, col_pedido.nome AS colaborador_pedido, lpp.local_sistema AS local_pedido,
			amar.titulo AS marca, amod.codigo AS cod_modelo,
			amod.titulo AS modelo, amod.titulo_comercial AS modelo_comercial,
			ecor.codigo AS cod_cor, ecor.titulo AS cor, ecap.codigo AS cod_capacidade, ecap.titulo AS capacidade,
			efam.titulo AS peca_familia, lpp.fk_sku_tecnico AS sku_tecnico,
			col_pedido.nome AS colaborador_pedido_segundo, segundo_pedido.local_sistema AS local_sistema_segundo_pedido,
			segundo_pedido.fk_sku_tecnico AS sku_tecnico_segundo_pedido,
			modelo_segundo.codigo AS modelo_segundo_pedido_codigo, modelo_segundo.titulo_comercial AS modelo_segundo_pedido,
			cor_segundo.codigo AS cor_segundo_pedido_codigo, cor_segundo.titulo AS cor_segundo_pedido,
			cap_segundo.codigo AS cap_segundo_pedido_codigo, cap_segundo.titulo AS cap_segundo_pedido,
			-- motivo_cancelamento.id AS motivo_cancelamento_id,
			itip.titulo AS indenizacao_tipo, imot.titulo AS indenizacao_motivo,
			motivo_cancelamento.titulo AS motivo_cancelamento,
			case
				when indenizacao.fk_tipo = 2 then 'INDENIZACAO_DINHEIRO'
				when SUBSTRING(segundo_pedido.fk_sku_tecnico, 6, 5) <> amod.codigo then 'MODELO_MODIFICADO'
				when SUBSTRING(segundo_pedido.fk_sku_tecnico, 13, 2) <> ecap.codigo then 'CAPACIDADE_MODIFICADA'
				when SUBSTRING(segundo_pedido.fk_sku_tecnico, 11, 2) <> ecor.codigo then 'COR_MODIFICADA'
				when SUBSTRING(segundo_pedido.fk_sku_tecnico, 5, 9) = SUBSTRING(lpp.fk_sku_tecnico, 5, 9) then 'MESMO_APARELHO'
				when ots.cod_subtipo = 'RF' AND os_timeline.pagamento_franquia IS NULL then 'RF_SEM_PAGAMENTO_FRANQUIA'
				when segundo_pedido.fk_sku_tecnico IS NOT NULL then 'ANALISAR'
			ELSE NULL END AS analise


FROM lab_pedido_peca AS lpp
INNER JOIN os ON lpp.fk_os = os.id
INNER JOIN os_timeline ON os_timeline.fk_os = os.id
INNER JOIN grupopll_master.cadastro_colaborador AS col_pedido ON lpp.fk_colaborador_pedido = col_pedido.id
INNER JOIN grupopll_master.os_tipo_servico AS ots ON os.fk_os_tipo_servico = ots.id
INNER JOIN grupopll_master.os_tipo_servico_categoria AS otsc ON ots.fk_categoria = otsc.id
LEFT JOIN grupopll_master.aparelho_modelo AS amod ON os.fk_modelo = amod.id
LEFT JOIN grupopll_master.aparelho_marca AS amar ON amod.fk_marca = amar.codigo
LEFT JOIN grupopll_master.estoque_cor AS ecor ON os.fk_modelo_cor = ecor.id
LEFT JOIN grupopll_master.estoque_capacidade AS ecap ON os.fk_modelo_capacidade = ecap.id
LEFT JOIN grupopll_master.estoque_familia AS efam ON SUBSTRING(lpp.fk_sku_tecnico, 3, 3) = efam.codigo
INNER JOIN grupopll_master.lab_pedido_motivo_cancelamento AS motivo_cancelamento ON lpp.fk_motivo_pedido_cancelamento = motivo_cancelamento.id
LEFT JOIN lab_pedido_peca AS segundo_pedido ON lpp.fk_os = segundo_pedido.fk_os AND lpp.id <> segundo_pedido.id
	AND SUBSTRING(lpp.fk_sku_tecnico, 1, 2) = SUBSTRING(segundo_pedido.fk_sku_tecnico, 1, 2)
	AND segundo_pedido.data_cancelamento IS NULL
LEFT JOIN grupopll_master.estoque_cor AS cor_segundo ON SUBSTRING(segundo_pedido.fk_sku_tecnico, 11, 2) = cor_segundo.codigo
LEFT JOIN grupopll_master.estoque_capacidade AS cap_segundo ON SUBSTRING(segundo_pedido.fk_sku_tecnico, 13, 2) = cap_segundo.codigo
LEFT JOIN grupopll_master.aparelho_modelo AS modelo_segundo ON SUBSTRING(segundo_pedido.fk_sku_tecnico, 6, 5) = modelo_segundo.codigo
LEFT JOIN grupopll_master.cadastro_colaborador AS col_pedido_segundo ON segundo_pedido.fk_colaborador_pedido = col_pedido_segundo.id
LEFT JOIN indenizacao ON indenizacao.fk_os = os.id AND indenizacao.cancelado IS NULL
LEFT JOIN grupopll_master.indenizacao_motivo AS imot ON indenizacao.fk_motivo = imot.id
LEFT JOIN grupopll_master.indenizacao_tipo AS itip ON indenizacao.fk_tipo = itip.id

WHERE lpp.adicionado >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
AND lpp.data_cancelamento IS NOT NULL AND lpp.fk_sku_tecnico LIKE 'PC%' -- AND motivo_cancelamento.id = 17
GROUP BY lpp.fk_os, SUBSTRING(lpp.fk_sku_tecnico, 1, 5)
```

---

## 2. `cmv_parts_consumption_physical_match` — Consumo solicitado e casado físico

> **Atualizado (2026-07):** relatório deixou de ser agregado por (SKU, dia) e passou a trazer **uma linha por pedido** (`lpp.id`), para suportar dedup por `(os, sku_tecnico)` e filtro por resultado de atendimento no consumidor (motor MRP/`automacao_mrp_4_0.py`). Campos novos: `os` (número da OS) e `lab_servico` (título do resultado de atendimento mais recente da OS, via `laboratorio.fk_servico_realizado → grupopll_master.lab_servico.titulo`, respeitando soft-delete com `lab_servico.cancelado IS NULL`). `qtd` agora é sempre `1`.

```sql
-- Consumo solicitado e casado físico

SELECT 	1 AS qtd, 'CASADO FISICAMENTE' AS tipo,
			otsc.titulo AS seguradora, ots.cod_subtipo AS subtipo_servico, ots.titulo AS tipo_servico,
			lpp.id AS pedido_id, lpp.local_sistema AS local_pedido, os.id AS os,
			amar.titulo AS marca, amod.codigo AS cod_modelo,
			amod.titulo AS modelo, amod.titulo_comercial AS modelo_comercial,
			ebat.codigo AS capacidade_codigo, ebat.capacidade AS bateria_capacidade,
			ecor.codigo AS cod_cor, ecor.titulo AS cor, ecap.codigo AS cod_capacidade, ecap.titulo AS capacidade,
			efam.titulo AS peca_familia, lpp.fk_sku_tecnico AS sku_tecnico,
			DATE(lpp.adicionado) AS data_solicitacao, lab_info.lab_servico AS lab_servico

FROM lab_pedido_peca AS lpp
INNER JOIN estoque_hit ON estoque_hit.fk_pedido = lpp.id
INNER JOIN os ON lpp.fk_os = os.id
INNER JOIN os_timeline ON os_timeline.fk_os = os.id
INNER JOIN grupopll_master.os_tipo_servico AS ots ON os.fk_os_tipo_servico = ots.id
INNER JOIN grupopll_master.os_tipo_servico_categoria AS otsc ON ots.fk_categoria = otsc.id
LEFT JOIN grupopll_master.aparelho_modelo AS amod ON os.fk_modelo = amod.id
LEFT JOIN grupopll_master.estoque_bateria AS ebat ON amod.fk_bateria_capacidade = ebat.codigo
LEFT JOIN grupopll_master.aparelho_marca AS amar ON amod.fk_marca = amar.codigo
LEFT JOIN grupopll_master.estoque_cor AS ecor ON os.fk_modelo_cor = ecor.id
LEFT JOIN grupopll_master.estoque_capacidade AS ecap ON os.fk_modelo_capacidade = ecap.id
LEFT JOIN grupopll_master.estoque_familia AS efam ON SUBSTRING(lpp.fk_sku_tecnico, 3, 3) = efam.codigo
LEFT JOIN (
	SELECT lab.fk_os, ls.titulo AS lab_servico
	FROM laboratorio AS lab
	INNER JOIN (
		SELECT fk_os, MAX(id) AS max_id FROM laboratorio GROUP BY fk_os
	) AS latest ON latest.fk_os = lab.fk_os AND latest.max_id = lab.id
	INNER JOIN grupopll_master.lab_servico AS ls ON ls.id = lab.fk_servico_realizado AND ls.cancelado IS NULL
) AS lab_info ON lab_info.fk_os = os.id

WHERE 	lpp.adicionado >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
			AND lpp.data_cancelamento IS NULL AND lpp.data_casado IS NOT NULL
			AND lpp.fk_sku_tecnico LIKE 'PC%'

ORDER BY sku_tecnico, data_solicitacao
```

---

## 3. `cmv_parts_consumption_systemic_match` — Consumo solicitado e casado sistêmico

```sql
-- Consumo solicitado e casado sistêmico

WITH relatorio AS (
	SELECT 	COUNT(lpp.id) AS qtd, 'CASADO SISTEMICAMENTE' AS tipo,
				otsc.titulo AS seguradora, ots.cod_subtipo AS subtipo_servico, ots.titulo AS tipo_servico,
				lpp.id AS pedido_id, lpp.local_sistema AS local_pedido,
				amar.titulo AS marca, amod.codigo AS cod_modelo,
				amod.titulo AS modelo, amod.titulo_comercial AS modelo_comercial,
				ebat.codigo AS capacidade_codigo, ebat.capacidade AS bateria_capacidade,
				ecor.codigo AS cod_cor, ecor.titulo AS cor, ecap.codigo AS cod_capacidade, ecap.titulo AS capacidade,
				efam.titulo AS peca_familia, lpp.fk_sku_tecnico AS sku_tecnico,
				DATE(lpp.adicionado) AS data_solicitacao

	FROM lab_pedido_peca AS lpp
	INNER JOIN estoque_hit ON estoque_hit.fk_pedido = lpp.id
	INNER JOIN os ON lpp.fk_os = os.id
	INNER JOIN os_timeline ON os_timeline.fk_os = os.id
	INNER JOIN grupopll_master.os_tipo_servico AS ots ON os.fk_os_tipo_servico = ots.id
	INNER JOIN grupopll_master.os_tipo_servico_categoria AS otsc ON ots.fk_categoria = otsc.id
	LEFT JOIN grupopll_master.aparelho_modelo AS amod ON os.fk_modelo = amod.id
	LEFT JOIN grupopll_master.estoque_bateria AS ebat ON amod.fk_bateria_capacidade = ebat.codigo
	LEFT JOIN grupopll_master.aparelho_marca AS amar ON amod.fk_marca = amar.codigo
	LEFT JOIN grupopll_master.estoque_cor AS ecor ON os.fk_modelo_cor = ecor.id
	LEFT JOIN grupopll_master.estoque_capacidade AS ecap ON os.fk_modelo_capacidade = ecap.id
	LEFT JOIN grupopll_master.estoque_familia AS efam ON SUBSTRING(lpp.fk_sku_tecnico, 3, 3) = efam.codigo

	WHERE 	lpp.adicionado >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
				AND lpp.data_cancelamento IS NULL AND lpp.data_casado IS NOT NULL
				AND lpp.fk_sku_tecnico LIKE 'PC%'

	GROUP BY lpp.fk_sku_tecnico, DATE(lpp.adicionado)
)
SELECT qtd, tipo, sku_tecnico, marca, modelo, modelo_comercial, peca_familia, capacidade, cor, bateria_capacidade, data_solicitacao
FROM relatorio
ORDER BY sku_tecnico, data_solicitacao
```

> **Nota:** o literal `tipo` desta query está como `'CASADO SISTEMICAMENTE'`, igual ao do relatório de "aguardando casamento" abaixo — provavelmente copy/paste do original que ainda não foi corrigido para diferenciar os relatórios.

---

## 4. `cmv_parts_consumption_awaiting_match` — Consumo solicitado aguardando casamento

```sql
-- Consumo solicitado poré sem casamento

WITH relatorio AS (
	SELECT 	COUNT(lpp.id) AS qtd, 'CASADO SISTEMICAMENTE' AS tipo,
				otsc.titulo AS seguradora, ots.cod_subtipo AS subtipo_servico, ots.titulo AS tipo_servico,
				lpp.id AS pedido_id, lpp.local_sistema AS local_pedido,
				amar.titulo AS marca, amod.codigo AS cod_modelo,
				amod.titulo AS modelo, amod.titulo_comercial AS modelo_comercial,
				ebat.codigo AS capacidade_codigo, ebat.capacidade AS bateria_capacidade,
				ecor.codigo AS cod_cor, ecor.titulo AS cor, ecap.codigo AS cod_capacidade, ecap.titulo AS capacidade,
				efam.titulo AS peca_familia, lpp.fk_sku_tecnico AS sku_tecnico,
				DATE(lpp.adicionado) AS data_solicitacao

	FROM lab_pedido_peca AS lpp
	LEFT JOIN estoque_hit ON estoque_hit.fk_pedido = lpp.id
	INNER JOIN os ON lpp.fk_os = os.id
	INNER JOIN os_timeline ON os_timeline.fk_os = os.id
	INNER JOIN grupopll_master.os_tipo_servico AS ots ON os.fk_os_tipo_servico = ots.id
	INNER JOIN grupopll_master.os_tipo_servico_categoria AS otsc ON ots.fk_categoria = otsc.id
	LEFT JOIN grupopll_master.aparelho_modelo AS amod ON os.fk_modelo = amod.id
	LEFT JOIN grupopll_master.estoque_bateria AS ebat ON amod.fk_bateria_capacidade = ebat.codigo
	LEFT JOIN grupopll_master.aparelho_marca AS amar ON amod.fk_marca = amar.codigo
	LEFT JOIN grupopll_master.estoque_cor AS ecor ON os.fk_modelo_cor = ecor.id
	LEFT JOIN grupopll_master.estoque_capacidade AS ecap ON os.fk_modelo_capacidade = ecap.id
	LEFT JOIN grupopll_master.estoque_familia AS efam ON SUBSTRING(lpp.fk_sku_tecnico, 3, 3) = efam.codigo

	WHERE 	lpp.adicionado >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
				AND lpp.data_cancelamento IS NULL AND estoque_hit.id IS NULL AND lpp.data_direcionado IS NULL AND lpp.data_casado IS NULL
				AND lpp.fk_sku_tecnico LIKE 'PC%'

	GROUP BY lpp.fk_sku_tecnico, DATE(lpp.adicionado)
)
SELECT qtd, tipo, sku_tecnico, marca, modelo, modelo_comercial, peca_familia, capacidade, cor, bateria_capacidade, data_solicitacao
FROM relatorio
ORDER BY sku_tecnico, data_solicitacao
```

> Corrigido: antes esta query estava idêntica à de "casado sistêmico" (bug de cópia). Agora filtra corretamente pedidos sem `estoque_hit`, sem `data_direcionado` e sem `data_casado`.

---

## 5. `cmv_parts_operational_loss` — Perda operacional (cancelado com saída de estoque)

> **Atualizado (2026-07):** relatório deixou de ser agregado por (SKU, dia) e passou a trazer **uma linha por pedido** (`lpp.id`), mesma mudança de grão do relatório `PARTS_CONSUMPTION_PHYSICAL_MATCH` acima. Campos novos: `os`, `lab_servico` (mesma origem/regra de soft-delete descrita acima) e `motivo_cancelamento` (`grupopll_master.lab_pedido_motivo_cancelamento.titulo`, já usado internamente para filtrar `retirada_estoque = '1'`, agora também exposto na saída). `qtd` agora é sempre `1`.

```sql
-- Cancelado com saida de estoque

SELECT 	1 AS qtd, 'PERDA OPERACIONAL' AS tipo,
			otsc.titulo AS seguradora, ots.cod_subtipo AS subtipo_servico, ots.titulo AS tipo_servico,
			lpp.id AS pedido_id, lpp.local_sistema AS local_pedido, os.id AS os,
			amar.titulo AS marca, amod.codigo AS cod_modelo,
			amod.titulo AS modelo, amod.titulo_comercial AS modelo_comercial,
			ebat.codigo AS capacidade_codigo, ebat.capacidade AS bateria_capacidade,
			ecor.codigo AS cod_cor, ecor.titulo AS cor, ecap.codigo AS cod_capacidade, ecap.titulo AS capacidade,
			efam.titulo AS peca_familia, lpp.fk_sku_tecnico AS sku_tecnico,
			DATE(lpp.adicionado) AS data_solicitacao, lab_info.lab_servico AS lab_servico,
			motivo_cancelamento.titulo AS motivo_cancelamento

FROM lab_pedido_peca AS lpp
INNER JOIN grupopll_master.lab_pedido_motivo_cancelamento AS motivo_cancelamento ON lpp.fk_motivo_pedido_cancelamento = motivo_cancelamento.id
INNER JOIN os ON lpp.fk_os = os.id
INNER JOIN os_timeline ON os_timeline.fk_os = os.id
INNER JOIN grupopll_master.os_tipo_servico AS ots ON os.fk_os_tipo_servico = ots.id
INNER JOIN grupopll_master.os_tipo_servico_categoria AS otsc ON ots.fk_categoria = otsc.id
LEFT JOIN grupopll_master.aparelho_modelo AS amod ON os.fk_modelo = amod.id
LEFT JOIN grupopll_master.estoque_bateria AS ebat ON amod.fk_bateria_capacidade = ebat.codigo
LEFT JOIN grupopll_master.aparelho_marca AS amar ON amod.fk_marca = amar.codigo
LEFT JOIN grupopll_master.estoque_cor AS ecor ON os.fk_modelo_cor = ecor.id
LEFT JOIN grupopll_master.estoque_capacidade AS ecap ON os.fk_modelo_capacidade = ecap.id
LEFT JOIN grupopll_master.estoque_familia AS efam ON SUBSTRING(lpp.fk_sku_tecnico, 3, 3) = efam.codigo
LEFT JOIN (
	SELECT lab.fk_os, ls.titulo AS lab_servico
	FROM laboratorio AS lab
	INNER JOIN (
		SELECT fk_os, MAX(id) AS max_id FROM laboratorio GROUP BY fk_os
	) AS latest ON latest.fk_os = lab.fk_os AND latest.max_id = lab.id
	INNER JOIN grupopll_master.lab_servico AS ls ON ls.id = lab.fk_servico_realizado AND ls.cancelado IS NULL
) AS lab_info ON lab_info.fk_os = os.id

WHERE 	lpp.adicionado >= DATE_SUB(NOW(), INTERVAL 6 MONTH) AND lpp.data_cancelamento IS NOT NULL
			AND lpp.fk_sku_tecnico LIKE 'PC%' AND motivo_cancelamento.retirada_estoque = '1'

ORDER BY sku_tecnico, data_solicitacao
```
