'use client';

import { useState } from 'react';
import { ConductorMark } from './ConductorMark';
import { RESEARCH_DATA } from '@/lib/mantle';

interface ResearchBarProps {
  lastRunResponse?: Record<string, unknown> | null;
  computedAllocation?: {meth: number, usdy: number, apy: string, dd: string} | null;
  localAllocation?: {meth: number, usdy: number, apy: string, dd: string} | null;
  customRiskCap?: number;
}

export function ResearchBar({ lastRunResponse, computedAllocation, localAllocation, customRiskCap }: ResearchBarProps) {
  const [tab, setTab] = useState<'live' | 'proposal' | 'compare'>('live');

  const hasRun = !!lastRunResponse && !!computedAllocation;
  const livePrices = (lastRunResponse?.livePrices as Record<string, unknown>) || { mETH: 'n/a (run to fetch)', mnt: 'n/a' };
  const researchBlock = lastRunResponse?.researchBlock;
  const moePairs = lastRunResponse?.moePairs;

  // Compute research snapshot blended for comparison (uses same yields as logic)
  const researchBlended = (RESEARCH_DATA.mETH_APY * 0.63 + RESEARCH_DATA.USDY_APY * 0.37).toFixed(2);

  // Deltas for usefulness (deltaMeth kept for future UI if needed)
  let deltaAPY = 0;
  if (hasRun && computedAllocation) {
    const propAPY = parseFloat(computedAllocation.apy);
    deltaAPY = propAPY - parseFloat(researchBlended);
  }

  const insights: string[] = [];
  if (hasRun) {
    if (Math.abs(deltaAPY) > 0.2) insights.push(`Variance: proposal APY ${deltaAPY > 0 ? '+' : ''}${deltaAPY.toFixed(2)}pp vs research snapshot. Risk Manager accepted because live Moe liquidity and SDK prices supported the weights.`);
    if (localAllocation && computedAllocation) {
      const dM = localAllocation.meth - computedAllocation.meth;
      if (Math.abs(dM) > 3) insights.push(`Your tweak differs by ${dM > 0 ? '+' : ''}${dM}% mETH from the orchestra. Export both for your records.`);
    }
    insights.push('All numbers traceable to portfolio-logic.ts + live RPC/SDK. Ready for DAO audit or personal rebalance.');
  }

  return (
    <div className="mb-10">
      {/* Always-visible live signal bar — branding + trust */}
      <div className="research-bar flex items-center justify-between text-sm px-6 py-[13px] rounded-t-2xl">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="text-emerald-400">
              <ConductorMark className="w-5 h-5" />
            </div>
            <div>
              <div className="font-medium tracking-[1px] text-xs text-emerald-400">LIVE RESEARCH + DETERMINISTIC LOGIC</div>
              <div className="text-[10px] text-white/50 -mt-0.5">mETH • USDY • Merchant Moe • Pyth via mantle-agent-kit-sdk • ERC-8004</div>
            </div>
          </div>
          <div className="pl-4 border-l border-white/10 text-white/80 text-[13px]">
            mETH <span className="font-mono text-white/50">0xcDA8…</span> • USDY <span className="font-mono text-white/50">0x5bE2…</span> • LB Factory {RESEARCH_DATA.LBFactory ? RESEARCH_DATA.LBFactory.slice(0, 8) : '0xa663…'}…
          </div>
        </div>
        <div className="text-[10px] text-white/40 pr-1 flex items-center gap-1.5">
          <span className="text-emerald-400/60">●</span> mETH Protocol • Ondo RWA • 
          <span className="px-1.5 py-px bg-amber-500/10 text-amber-400 rounded text-[9px]">SDK Pyth</span>
          <span className="px-1.5 py-px bg-purple-500/10 text-purple-400 rounded text-[9px]">8004 Rep</span>
        </div>
      </div>

      {/* When user has run (or even before), this makes the bar *useful*: live data + proposal + your plan + deltas + why it matters */}
      {hasRun && (
        <div className="border border-white/10 border-t-0 rounded-b-2xl bg-[#0A0B0D] px-5 py-4 text-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="text-[10px] uppercase tracking-widest text-white/50">Decision support — not just a demo</div>
            <div className="flex-1 h-px bg-white/10" />
            <button onClick={() => setTab('live')} className={`modern-tab ${tab==='live' ? 'active' : ''}`}>Live market</button>
            <button onClick={() => setTab('proposal')} className={`modern-tab ${tab==='proposal' ? 'active' : ''}`}>5-agent proposal</button>
            <button onClick={() => setTab('compare')} className={`modern-tab ${tab==='compare' ? 'active' : ''}`}>Compare &amp; deltas</button>
          </div>

          {tab === 'live' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <div className="text-white/50 mb-1">Live SDK Pyth (prices at research)</div>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <div className="font-mono text-white/80">mETH ~{String((livePrices as any).mETH ?? 'n/a')} | MNT ~{String((livePrices as any).mnt ?? 'n/a')}</div>
                <div className="text-[10px] text-white/40 mt-0.5">Block {String(researchBlock ?? '—')} • Moe pairs: {String(moePairs ?? '—')} • yields from on-chain protocol state</div>
              </div>
              <div>
                <div className="text-white/50 mb-1">Protocol yields (RESEARCH_DATA + RPC)</div>
                <div>mETH staking APY <span className="font-mono text-emerald-300">{RESEARCH_DATA.mETH_APY}%</span> • USDY <span className="font-mono text-emerald-300">{RESEARCH_DATA.USDY_APY}%</span></div>
                <div className="text-[10px] text-white/40 mt-0.5">Sourced in every Conductor decision + injected into Risk gates.</div>
              </div>
              <div className="text-[10px] text-white/60">
                This data is pulled fresh by Researcher (4) via RPC + mantle-agent-kit-sdk, cited in the trace, and used by Risk Manager (5) before any allocation is approved. Transparent by design.
              </div>
            </div>
          )}

          {tab === 'proposal' && computedAllocation && (
            <div>
              <div className="text-white/50 mb-1 text-xs">5-agent orchestra recommendation (Conductor + Researcher + Executor + RWA + Risk Manager)</div>
              <div className="flex items-baseline gap-4">
                <div className="font-mono text-lg text-white">{computedAllocation.meth}% mETH / {computedAllocation.usdy}% USDY</div>
                <div className="text-emerald-300">expected APY {computedAllocation.apy}% • est max DD {computedAllocation.dd}%</div>
              </div>
              <div className="text-[10px] text-white/50 mt-1">Validated by deterministic gates in portfolio-logic (risk, liquidity, DD). All 5 agents have ERC-8004 identities; reputation feedback posted using these exact metrics.</div>
            </div>
          )}

          {tab === 'compare' && (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-2 bg-black/40 rounded">
                  <div className="text-white/50">Research snapshot (63/37 naive)</div>
                  <div className="font-mono">{researchBlended}% blended APY</div>
                </div>
                <div className="p-2 bg-black/40 rounded">
                  <div className="text-white/50">Orchestra proposal</div>
                  <div className="font-mono">{computedAllocation?.apy}% APY • {computedAllocation?.meth}/{computedAllocation?.usdy}%</div>
                </div>
                <div className="p-2 bg-black/40 rounded">
                  <div className="text-white/50">Your local tweak (risk {customRiskCap}%)</div>
                  <div className="font-mono">{localAllocation ? `${localAllocation.apy}% APY • ${localAllocation.meth}/${localAllocation.usdy}%` : '— tweak slider above'}</div>
                </div>
              </div>
              {insights.length > 0 && (
                <div className="text-[11px] text-amber-300/90 bg-amber-500/5 border border-amber-500/20 rounded p-2">
                  {insights.map((ins, i) => <div key={i}>• {ins}</div>)}
                </div>
              )}
              <div className="text-[10px] text-white/40">Export the full JSON AUDIT to keep the comparison, sources, formulas, and on-chain refs for your records or to share with a DAO treasury.</div>
            </div>
          )}
        </div>
      )}

      {!hasRun && (
        <div className="text-[10px] text-white/40 px-1 -mt-1">Run Conductor with a goal → this bar expands with live research vs proposal vs your what-if tweaks, deltas, and actionable insights.</div>
      )}
    </div>
  );
}
