import type { ToolContext } from './types';

export function registerWhoamiTool({ server, user, authorize }: ToolContext) {
  server.tool(
    'whoami',
    'Returns the authenticated user info from the JWT',
    async () => {
      const deny = await authorize('whoami');
      if (deny) return deny;

      console.log(user);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                userId: user.userId,
                email: user.email,
                nome: user.nome,
                profiles: user.profiles,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
