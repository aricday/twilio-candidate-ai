import type { EdgeId, NodeId } from '../../../shared/types';

interface NodeDef {
  id: NodeId;
  x: number;
  y: number;
  title: string;
  sub: string;
  color: string;
}

const W = 120;
const H = 60;

const NODES: NodeDef[] = [
  { id: 'browser', x: 10, y: 130, title: 'Voice SDK', sub: '@twilio/voice-sdk', color: '#60a5fa' },
  { id: 'voice', x: 175, y: 50, title: 'Programmable Voice', sub: 'TwiML App', color: '#f87171' },
  { id: 'relay', x: 175, y: 210, title: 'ConversationRelay', sub: 'Flux STT • TTS', color: '#f87171' },
  { id: 'backend', x: 340, y: 130, title: 'Candidate AI', sub: 'agent • Express • ws', color: '#cbd5e1' },
  { id: 'openai', x: 505, y: 50, title: 'OpenAI', sub: 'gpt-5.4-nano', color: '#34d399' },
  { id: 'ats', x: 505, y: 210, title: 'iCIMS ATS', sub: 'stub records', color: '#a5b4fc' },
];

const COLUMNS = [
  { x: 70, label: 'YOUR BROWSER' },
  { x: 235, label: 'TWILIO' },
  { x: 400, label: 'CUSTOMER BACKEND' },
  { x: 565, label: 'VENDORS' },
];

const EDGES: { id: EdgeId; d: string; label: string; lx: number; ly: number; nodes: [NodeId, NodeId] }[] = [
  { id: 'browser-voice', d: 'M130,145 C152,145 152,80 175,80', label: 'WebRTC', lx: 128, ly: 98, nodes: ['browser', 'voice'] },
  { id: 'voice-backend', d: 'M295,80 C318,80 318,145 340,145', label: 'TwiML', lx: 322, ly: 98, nodes: ['voice', 'backend'] },
  { id: 'voice-relay', d: 'M235,110 L235,210', label: '<Connect>', lx: 241, ly: 164, nodes: ['voice', 'relay'] },
  { id: 'relay-backend', d: 'M295,240 C318,240 318,175 340,175', label: 'WebSocket', lx: 322, ly: 232, nodes: ['relay', 'backend'] },
  { id: 'backend-openai', d: 'M460,145 C482,145 482,80 505,80', label: 'stream', lx: 487, ly: 98, nodes: ['backend', 'openai'] },
  { id: 'backend-ats', d: 'M460,175 C482,175 482,240 505,240', label: 'tools', lx: 487, ly: 232, nodes: ['backend', 'ats'] },
  { id: 'browser-backend', d: 'M70,190 C70,330 400,330 400,190', label: 'token • live events', lx: 235, ly: 306, nodes: ['browser', 'backend'] },
];

interface Props {
  nowEdges: EdgeId[];
  turnEdges: EdgeId[];
  onNodeClick: (id: NodeId) => void;
}

export function Diagram({ nowEdges, turnEdges, onNodeClick }: Props) {
  const activeNodes = new Set(EDGES.filter((e) => nowEdges.includes(e.id)).flatMap((e) => e.nodes));

  return (
    <svg viewBox="0 0 640 320" className="h-full w-full" role="img" aria-label="Call architecture diagram">
      {COLUMNS.map((c) => (
        <text key={c.label} x={c.x} y={22} textAnchor="middle" className="fill-slate-500 text-[10px] font-semibold tracking-widest">
          {c.label}
        </text>
      ))}

      {EDGES.map((e) => {
        const state = nowEdges.includes(e.id) ? 'now' : turnEdges.includes(e.id) ? 'last' : 'idle';
        const stroke = state === 'now' ? 'var(--color-accent)' : state === 'last' ? '#64748b' : '#334155';
        const anchor = e.id === 'voice-relay' ? 'start' : 'middle';
        return (
          <g key={e.id}>
            <path
              d={e.d}
              fill="none"
              stroke={stroke}
              strokeWidth={state === 'now' ? 3 : 2}
              className={state === 'now' ? 'edge-now' : undefined}
              style={{ transition: 'stroke 300ms' }}
            />
            <text
              x={e.lx}
              y={e.ly}
              textAnchor={anchor}
              className={`text-[9px] ${state === 'now' ? 'fill-[var(--color-accent)] font-semibold' : 'fill-slate-500'}`}
            >
              {e.label}
            </text>
          </g>
        );
      })}

      {NODES.map((n) => {
        const active = activeNodes.has(n.id);
        return (
          <g key={n.id} onClick={() => onNodeClick(n.id)} className="cursor-pointer" role="button" aria-label={`Show code for ${n.title}`}>
            <rect
              x={n.x}
              y={n.y}
              width={W}
              height={H}
              rx={10}
              fill="#0f172a"
              stroke={active ? 'var(--color-accent)' : '#334155'}
              strokeWidth={active ? 2.5 : 1.5}
              style={{ transition: 'stroke 300ms' }}
            />
            <rect x={n.x} y={n.y + 12} width={3} height={H - 24} rx={1.5} fill={n.color} />
            <text x={n.x + W / 2} y={n.y + 27} textAnchor="middle" className="fill-slate-100 text-[11px] font-semibold">
              {n.title}
            </text>
            <text x={n.x + W / 2} y={n.y + 43} textAnchor="middle" className="fill-slate-400 font-mono text-[9px]">
              {n.sub}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
