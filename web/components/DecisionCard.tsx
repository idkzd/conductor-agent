'use client';

import { motion } from 'framer-motion';
import { CheckCircle, ExternalLink, Play } from 'lucide-react';
import { Agent, Decision } from '@/lib/types';
import { MANTLESCAN } from '@/lib/mantle';
import { ConductorMark } from './ConductorMark';

interface DecisionCardProps {
  decision: Decision;
  agent: Agent;
  onSimulateLog: (d: Decision) => void;
  onCopy: (text: string, label?: string) => void;
}

export function DecisionCard({ decision: d, agent, onSimulateLog, onCopy }: DecisionCardProps) {
  const isConductor = d.agentRole === 'conductor';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="timeline-item group"
    >
      <div className={`timeline-dot ${isConductor ? 'conductor' : d.agentRole === 'executor' ? 'executor' : d.agentRole === 'rwa' ? 'rwa' : d.agentRole === 'researcher' ? 'researcher' : d.agentRole === 'risk' ? 'risk' : 'conductor'}`}>
        {isConductor && <ConductorMark className="w-3.5 h-3.5 text-purple-200" />}
        {d.agentRole === 'executor' && <Play className="w-3.5 h-3.5 text-blue-200" />}
        {d.agentRole === 'rwa' && <CheckCircle className="w-3.5 h-3.5 text-emerald-200" />}
        {d.agentRole === 'researcher' && <span className="text-amber-200 text-xs">S</span>}
        {d.agentRole === 'risk' && <span className="text-red-200 text-xs">!</span>}
      </div>

      <div className="timeline-content">
        <div className="flex items-center gap-3 mb-2">
          <div className="font-semibold text-[15px]" style={{ color: agent.color }}>
            {agent.name}
          </div>
          <div className="text-xs text-white/40 font-mono tabular-nums">
            {new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          {d.logId && <div className="text-[10px] px-2 py-px rounded bg-white/5 text-white/50">LOG #{d.logId}</div>}
        </div>

        <div className="flex items-start justify-between mb-4 pr-2">
          <div className="font-medium tracking-tight text-[15.5px]">{d.task}</div>
          <button
            onClick={() => onCopy(d.reasoning, 'Reasoning copied')}
            className="text-[10px] px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-white/60 active:bg-white/5 transition flex items-center gap-1 ml-3 flex-shrink-0"
            title="Copy chain-of-thought"
          >
            COPY CoT
          </button>
        </div>

        <div className="reasoning mb-5 group">
          {d.reasoning}
          <button
            onClick={() => onCopy(`${d.reasoning}\n\nAction: ${d.action}\n\nResult: ${d.result}`, 'Full decision copied')}
            className="opacity-0 group-hover:opacity-100 absolute top-2 right-2 text-[9px] px-1.5 py-px rounded bg-black/70 hover:bg-black text-white/70 transition"
          >
            copy full
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-7 gap-y-3 text-sm">
          <div>
            <div className="uppercase text-xs text-white/50 mb-px flex items-center gap-1.5">
              ACTION TAKEN
              <button onClick={() => onCopy(d.action, 'Action copied')} className="text-[9px] text-white/40 hover:text-white/70">copy</button>
            </div>
            <div className="leading-snug">{d.action}</div>
          </div>
          <div>
            <div className="uppercase text-xs text-white/50 mb-px flex items-center gap-1.5">
              RESULT / IMPACT
              <button onClick={() => onCopy(d.result, 'Result copied')} className="text-[9px] text-white/40 hover:text-white/70">copy</button>
            </div>
            <div className="leading-snug text-white/90">{d.result}</div>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-white/10 flex items-center gap-3 flex-wrap">
          {d.isOnchain ? (
            <div className="proof-badge onchain flex items-center gap-1.5 text-xs">
              <CheckCircle className="w-3.5 h-3.5" /> VERIFIED ON-CHAIN
              {d.relatedTx && (
                <a href={`${MANTLESCAN}/tx/${d.relatedTx.replace('...', '')}`} target="_blank" className="scan-link font-mono ml-1">
                  {d.relatedTx}
                </a>
              )}
            </div>
          ) : (
            <button
              onClick={() => onSimulateLog(d)}
              className="text-xs flex items-center gap-2 px-4 py-1.5 rounded-2xl bg-white/5 hover:bg-white/10 active:bg-white/[0.03] border border-white/10 transition font-medium"
            >
              WRITE TO DECISIONLOGGER (demo)
            </button>
          )}
          <a href={agent.cardUrl} target="_blank" className="text-xs text-white/50 hover:text-white flex items-center gap-1 ml-auto">
            {agent.name} CARD <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </motion.div>
  );
}
