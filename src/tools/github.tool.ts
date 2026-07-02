import axios from 'axios';
import { z } from 'zod';
import type { ToolContext } from './types';

const GITHUB_ORG = 'pllcicd';

export function registerGithubTools({ server, authorize, user }: ToolContext) {
  server.tool(
    'create_github_issue',
    'Cria uma issue em um repositório GitHub da organização pllcicd (ex.: para registrar uma sugestão de nova ferramenta MCP encontrada durante uma análise)',
    {
      repo: z
        .string()
        .min(1)
        .describe(
          `Repositório de destino: "owner/repo" (ex.: "pllcicd/pll-erp") ou só o nome dentro da organização "${GITHUB_ORG}" (ex.: "mcp-pll", "pll-erp")`,
        ),
      titulo: z.string().min(1).describe('Título da issue'),
      corpo: z
        .string()
        .min(1)
        .describe(
          'Corpo da issue em Markdown. Ao sugerir uma nova ferramenta, deve conter: cliente/colaborador envolvido, a solicitação original, o que foi tentado e por que não foi possível, e a sugestão de ferramenta (nome, parâmetros, lógica). O autor (email/perfis) é anexado automaticamente, não é preciso incluí-lo.',
        ),
      labels: z
        .array(z.string())
        .optional()
        .describe('Labels do GitHub a aplicar na issue, ex.: ["sugestao-ferramenta"]'),
    },
    async ({ repo, titulo, corpo, labels }) => {
      const deny = await authorize('create_github_issue');
      if (deny) return deny;

      const token = process.env.GITHUB_TOKEN;
      if (!token) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Integração com GitHub não configurada: defina GITHUB_TOKEN (com acesso à organização pllcicd) no ambiente do servidor.',
            },
          ],
          isError: true,
        };
      }

      const fullRepo = repo.includes('/') ? repo : `${GITHUB_ORG}/${repo}`;
      const corpoComAutor = `${corpo}\n\n---\nAberto automaticamente via mcp-pll por **${user.nome}** <${user.email}> — perfis: ${user.profiles.join(', ') || '(nenhum)'}`;

      try {
        const response = await axios.post(
          `https://api.github.com/repos/${fullRepo}/issues`,
          { title: titulo, body: corpoComAutor, labels },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/vnd.github+json',
            },
          },
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                { numero: response.data.number, url: response.data.html_url },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Erro ao criar issue no GitHub (${fullRepo}): ${err.response?.data?.message ?? err.message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
