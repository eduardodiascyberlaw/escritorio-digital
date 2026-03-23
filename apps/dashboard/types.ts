export type AgentId = 'sonia' | 'rex' | 'iris' | 'lex' | 'nova';

export type AgentState =
  | 'idle' | 'meeting' | 'crm' | 'lexc'
  | 'visiting' | 'working' | 'offline';

export type DashboardEvent =
  | { type: 'agent_state'; agentId: AgentId; state: AgentState; task?: string }
  | { type: 'agent_visit'; from: AgentId; to: AgentId }
  | { type: 'meeting_start'; caller: string; members: AgentId[] }
  | { type: 'meeting_msg'; who: AgentId | string; msg: string; isHuman?: boolean }
  | { type: 'meeting_end' }
  | { type: 'crm_access'; agentId: AgentId; drawer?: number }
  | { type: 'lexc_access'; agentId: AgentId }
  | { type: 'ticket_created'; from: AgentId; to: AgentId; tipo: string; proc?: string }
  | { type: 'stats'; processos: number; tickets: number; msgs: number; pecas: number; clientes: number }
  | { type: 'alert'; level: 'info' | 'warn' | 'error'; msg: string };

export interface DashboardUser {
  username: string;
  displayName: string;
  role: 'admin' | 'member';
  passwordHash: string;
}

export interface SessionUser {
  username: string;
  displayName: string;
  role: 'admin' | 'member';
  loginAt: number;
}

declare module '@fastify/session' {
  interface SessionData {
    user?: SessionUser;
  }
}
