import { FastifyRequest, FastifyReply } from 'fastify';

const PUBLIC_PATHS = new Set(['/login', '/auth/login', '/auth/logout', '/health']);

export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const urlPath = req.url.split('?')[0];
  if (PUBLIC_PATHS.has(urlPath)) return;
  if (urlPath === '/broadcast') return;

  const user = (req.session as any).user;
  if (!user) {
    if (urlPath === '/events') return reply.status(401).send({ error: 'Unauthorized' });
    return reply.redirect('/login');
  }
}
