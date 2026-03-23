import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import fastifyFormBody from '@fastify/formbody';
import path from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { DashboardEvent } from './types.js';
import { requireAuth } from './auth.js';
import { authRoutes } from './routes/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = Fastify({ logger: true });
const clients = new Set<any>();

// Resolve public dir: works both in dev (tsx server.ts) and prod (node dist/server.js)
const publicDir = existsSync(path.join(__dirname, 'public'))
  ? path.join(__dirname, 'public')
  : path.join(__dirname, '..', 'public');

await app.register(fastifyCors, {
  origin: [`https://${process.env.DASHBOARD_DOMAIN || 'office.sousaediasadvogados.pt'}`],
  credentials: true,
});

await app.register(fastifyFormBody);

await app.register(fastifyCookie);

await app.register(fastifySession, {
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production-min-32-chars!!',
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 365 * 24 * 60 * 60 * 1000,
  },
  saveUninitialized: false,
  rolling: true,
});

app.addHook('onRequest', requireAuth);

await app.register(fastifyStatic, {
  root: publicDir,
  prefix: '/',
});

await app.register(authRoutes);

// SSE endpoint
app.get('/events', (req, reply) => {
  const user = (req.session as any).user;

  reply.raw.setHeader('Content-Type', 'text/event-stream');
  reply.raw.setHeader('Cache-Control', 'no-cache');
  reply.raw.setHeader('Connection', 'keep-alive');
  reply.raw.setHeader('X-Accel-Buffering', 'no');
  reply.raw.flushHeaders();

  reply.raw.write(`data: ${JSON.stringify({
    type: 'alert', level: 'info',
    msg: `${user.displayName} ligado.`
  })}\n\n`);

  clients.add(reply.raw);
  app.log.info(`SSE connected: ${user.username} (total: ${clients.size})`);

  const hb = setInterval(() => reply.raw.write(': hb\n\n'), 30000);
  req.raw.on('close', () => {
    clearInterval(hb);
    clients.delete(reply.raw);
    app.log.info(`SSE disconnected: ${user.username} (total: ${clients.size})`);
  });

  return reply;
});

// Broadcast endpoint (called by Paperclip)
app.post('/broadcast', async (req, reply) => {
  if ((req.headers as any)['x-dashboard-key'] !== process.env.DASHBOARD_BROADCAST_KEY)
    return reply.status(401).send({ error: 'Unauthorized' });
  broadcast(req.body as DashboardEvent);
  return reply.send({ ok: true, clients: clients.size });
});

app.get('/health', async () => ({ ok: true, clients: clients.size, ts: new Date().toISOString() }));

export function broadcast(event: DashboardEvent) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  clients.forEach(c => { try { c.write(data); } catch { clients.delete(c); } });
}

const PORT = parseInt(process.env.DASHBOARD_PORT || '3200');
await app.listen({ port: PORT, host: '0.0.0.0' });
