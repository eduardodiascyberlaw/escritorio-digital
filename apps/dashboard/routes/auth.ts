import { FastifyInstance } from 'fastify';
import { findUser, verifyPassword, changePassword } from '../users.js';

export async function authRoutes(app: FastifyInstance) {

  app.get('/login', async (req, reply) => {
    if ((req.session as any).user) return reply.redirect('/');
    return reply.sendFile('login.html');
  });

  app.post<{ Body: { username: string; password: string } }>('/auth/login', async (req, reply) => {
    const { username, password } = req.body;
    if (!username || !password) return reply.redirect('/login?error=empty');

    const user = await findUser(username);
    const valid = user ? await verifyPassword(user, password) : false;

    if (!valid || !user) {
      await new Promise(r => setTimeout(r, 500));
      return reply.redirect('/login?error=invalid');
    }

    (req.session as any).user = {
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      loginAt: Date.now(),
    };
    await req.session.save();
    return reply.redirect('/');
  });

  app.post('/auth/logout', async (req, reply) => {
    await req.session.destroy();
    return reply.redirect('/login');
  });

  app.post<{ Body: { currentPassword: string; newPassword: string } }>(
    '/auth/change-password', async (req, reply) => {
      const sessionUser = (req.session as any).user;
      if (!sessionUser) return reply.status(401).send({ error: 'Unauthorized' });

      const { currentPassword, newPassword } = req.body;
      if (!newPassword || newPassword.length < 8)
        return reply.status(400).send({ error: 'Minimo 8 caracteres' });

      const user = await findUser(sessionUser.username);
      if (!user || !(await verifyPassword(user, currentPassword)))
        return reply.status(400).send({ error: 'Password actual incorrecta' });

      await changePassword(sessionUser.username, newPassword);
      return reply.send({ ok: true });
    }
  );

  app.get('/auth/me', async (req, reply) => {
    const user = (req.session as any).user;
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });
    return reply.send({ username: user.username, displayName: user.displayName, role: user.role });
  });
}
