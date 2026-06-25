/**
 * Mapeamento de ferramentas MCP → perfis necessários.
 *
 * profiles: lista de perfis (chaves de acesso_perfil com valor true no colaborador).
 *           Deixe [] para liberar a ferramenta a todos os colaboradores autenticados.
 *
 * mode:
 *   'any' → basta o colaborador ter UM dos perfis listados (OR)
 *   'all' → o colaborador precisa ter TODOS os perfis listados (AND)
 *
 * Exemplo:
 *   get_os: { profiles: ['crm', 'supervisor'], mode: 'any' }
 *   → acessa quem tiver 'crm' OU 'supervisor' em acesso_perfil
 */

export interface ToolAccess {
  profiles: string[];
  mode: 'any' | 'all';
}

export const TOOL_ACCESS: Record<string, ToolAccess> = {
  whoami:            { profiles: [], mode: 'any' },
  get_os:            { profiles: [], mode: 'any' },
  get_service_title: { profiles: [], mode: 'any' },
  get_status_title:  { profiles: [], mode: 'any' },

  // Relatórios CMV — API externa Grupo PLL
  cmv_parts_rupture_analysis:          { profiles: [], mode: 'any' },
  cmv_parts_consumption_physical_match: { profiles: [], mode: 'any' },
  cmv_parts_consumption_systemic_match: { profiles: [], mode: 'any' },
  cmv_parts_consumption_awaiting_match: { profiles: [], mode: 'any' },
  cmv_parts_operational_loss:          { profiles: [], mode: 'any' },
};
