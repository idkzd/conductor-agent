'use client';


import { Agent } from '@/lib/types';
import { ConductorMark } from './ConductorMark';

interface AgentHierarchyProps {
  agents: Agent[];
  selectedAgentId?: number | null;
  onSelectAgent?: (id: number | null) => void;
}

export function AgentHierarchy({ agents, selectedAgentId, onSelectAgent }: AgentHierarchyProps) {
  const [root, ...children] = agents;

  return (
    <div className="lg:col-span-3 card p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="section-title flex items-center gap-2">
            AGENT ORCHESTRA <ConductorMark className="w-3.5 h-3.5 text-emerald-400/70" />
          </div>
          <div className="text-2xl font-semibold tracking-tight mt-1">The 5-Agent Conductor Orchestra on Mantle <span className="text-xs text-white/40">(click to filter)</span></div>
        </div>
      </div>

      {/* Root Conductor */}
      <div 
        onClick={() => onSelectAgent?.(root.id === selectedAgentId ? null : root.id)}
        className={`agent-root p-6 mb-3 flex items-center gap-5 cursor-pointer transition-all ${selectedAgentId === root.id ? 'ring-1 ring-purple-400' : 'hover:ring-1 hover:ring-white/20'}`}
      >
        <div className="agent-icon" style={{ background: root.color }}>C</div>
        <div className="flex-1">
          <div className="font-semibold text-lg flex items-center gap-2.5">
            {root.name}
            <span className="text-xs px-2.5 py-px rounded bg-white/10 text-purple-300 font-mono tracking-widest">ROOT ORCHESTRATOR</span>
          </div>
          <div className="text-sm text-white/60 mt-px pr-8">{root.description}</div>
        </div>
        <a href={root.cardUrl} target="_blank" className="text-xs px-4 py-2 rounded-full border border-purple-400/30 hover:bg-purple-950/30 text-purple-400 flex items-center gap-1.5">VIEW CARD</a>
      </div>

      {/* Sub-agents - Conductor Orchestra */}
      <div className="text-xs text-white/40 pl-1 mb-2 tracking-widest flex items-center gap-2">CONDUCTOR DELEGATES TO <span className="text-emerald-400/50">→</span></div>
      <div className="space-y-2 pl-4 border-l-2 border-dashed border-white/10">
        {children.map((agent) => (
          <div 
            key={agent.id} 
            onClick={() => onSelectAgent?.(agent.id === selectedAgentId ? null : agent.id)}
            className={`agent-child p-4 flex gap-4 items-start group cursor-pointer transition-all ${selectedAgentId === agent.id ? 'ring-1 ring-blue-400' : 'hover:ring-1 hover:ring-white/20'}`}
          >
            <div className="agent-icon mt-0.5" style={{ background: agent.color, width: '34px', height: '34px', fontSize: '12px' }}>
              {agent.role === 'executor' ? 'E' : agent.role === 'rwa' ? 'R' : agent.role === 'researcher' ? 'S' : agent.role === 'risk' ? 'K' : 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{agent.name}</div>
              <div className="text-xs text-white/60 leading-tight mt-0.5">{agent.description}</div>
              <a href={agent.cardUrl} target="_blank" className="inline-block text-[10px] mt-1.5 text-white/50 hover:text-white border-b border-dotted border-white/30">agent card →</a>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 text-xs text-white/40 pl-1">
        All 5 agents registered as ERC-721 NFTs in the canonical IdentityRegistry. Full discoverability + ERC-8004 reputation layer. Live Pyth via mantle-agent-kit-sdk.
      </div>
    </div>
  );
}
