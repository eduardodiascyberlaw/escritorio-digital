// Dashboard broadcast helper — emit events to the visual dashboard
// Import and call from Paperclip pipeline points

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

const DASHBOARD_URL = process.env.DASHBOARD_API_URL || 'http://localhost:3200';
const DASHBOARD_KEY = process.env.DASHBOARD_BROADCAST_KEY || '';

export async function emitDashboard(event: DashboardEvent): Promise<void> {
  try {
    await fetch(`${DASHBOARD_URL}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-dashboard-key': DASHBOARD_KEY },
      body: JSON.stringify(event),
    });
  } catch {
    // Dashboard em baixo nao bloqueia o pipeline
  }
}

export const dashboard = {
  agentState:    (agentId: AgentId, state: AgentState, task?: string) =>
                   emitDashboard({ type: 'agent_state', agentId, state, task }),
  agentVisit:    (from: AgentId, to: AgentId) =>
                   emitDashboard({ type: 'agent_visit', from, to }),
  meetingStart:  (caller: string, members: AgentId[]) =>
                   emitDashboard({ type: 'meeting_start', caller, members }),
  meetingMsg:    (who: AgentId | string, msg: string, isHuman = false) =>
                   emitDashboard({ type: 'meeting_msg', who, msg, isHuman }),
  meetingEnd:    () =>
                   emitDashboard({ type: 'meeting_end' }),
  crmAccess:     (agentId: AgentId, drawer?: number) =>
                   emitDashboard({ type: 'crm_access', agentId, drawer }),
  lexcAccess:    (agentId: AgentId) =>
                   emitDashboard({ type: 'lexc_access', agentId }),
  ticket:        (from: AgentId, to: AgentId, tipo: string, proc?: string) =>
                   emitDashboard({ type: 'ticket_created', from, to, tipo, proc }),
  stats:         (data: { processos: number; tickets: number; msgs: number; pecas: number; clientes: number }) =>
                   emitDashboard({ type: 'stats', ...data }),
  alert:         (msg: string, level: 'info'|'warn'|'error' = 'info') =>
                   emitDashboard({ type: 'alert', level, msg }),
};
