/**
 * Conductor — the real orchestrator.
 * Can be run as CLI, imported by Next.js API route, or triggered from frontend demo.
 *
 * MVP flow:
 * 1. Receive user goal
 * 2. Use LLM (real or god-tier mock) to plan + delegate
 * 3. Call sub-agent "modules" (in same process for MVP, network in future)
 * 4. Every important step is logged to DecisionLogger via onchain-logger
 * 5. Return full traceable result
 */

import { getLLMClient, type AgentDecision } from '../lib/llm';
import { CONDUCTOR_SYSTEM, TRADING_EXECUTOR_SYSTEM, RWA_OPTIMIZER_SYSTEM, RESEARCHER_SYSTEM, RISK_MANAGER_SYSTEM, buildUserGoalPrompt } from '../lib/prompts';
import { logDecisionOnChain, logDecisionWithMetricsOnChain, recordServicePaymentOnChain, giveReputationFeedback } from '../lib/onchain-logger';
import { 
  researchYields, 
  getResearchSummary, 
  suggestSafeAllocation, 
  validateAllocation, 
  estimateRisk,
  type Allocation 
} from '../lib/defi-research.js';
import { computeServiceFee } from '../lib/portfolio-logic.js';

export interface RunConductorResult {
  goal: string;
  decisions: Array<{
    agentId: number;
    agentName: string;
    decision: AgentDecision;
    onchain: { logId: number; txHash?: string; simulated: boolean };
  }>;
  summary: string;
  error?: string;           // anti-error: if present, run had issues but may contain partial decisions
  partial?: boolean;        // true if we recovered some results despite failures
}

const AGENT_NAMES: Record<number, string> = {
  1: 'Conductor',
  2: 'Trading Executor',
  3: 'RWA Optimizer',
  4: 'Researcher',
  5: 'Risk Manager',
};

export async function runConductor(goal: string): Promise<RunConductorResult> {
  console.log('\n=== CONDUCTOR START ===');
  console.log('Goal:', goal);

  if (!goal || typeof goal !== 'string' || goal.trim().length < 8) {
    return {
      goal: goal || '',
      decisions: [],
      summary: 'Invalid goal provided (too short or empty).',
      error: 'INVALID_GOAL',
      partial: false,
    };
  }

  let decisions: RunConductorResult['decisions'] = [];

  try {
    const llm = await getLLMClient();

    // === 1. Research Phase (always first) ===
    console.log('[Conductor] Phase 1: Researching live data...');
    const researchSummary = await getResearchSummary(goal);
    const liveYields = await researchYields();
    if (liveYields.block) {
      console.log(`[Conductor] Live research confirmed at Mantle block ${liveYields.block}`);
    }

    // === 2. High-level Planning with deterministic logic ===
    // Extract risk cap from goal (simple heuristic, LLM can do better too)
    const riskMatch = goal.match(/(\d+(?:\.\d+)?)%/);
    const userRiskCap = riskMatch ? parseFloat(riskMatch[1]) : 7;

    const yieldsForLogic = { mETH: liveYields.mETH_APY, USDY: liveYields.USDY_APY };
    const suggested = suggestSafeAllocation(userRiskCap, yieldsForLogic);
    const validation = validateAllocation(suggested, userRiskCap);

    const planningContext = `
LIVE YIELDS: mETH=${liveYields.mETH_APY}%, USDY=${liveYields.USDY_APY}%
USER RISK CAP: ${userRiskCap}%
SUGGESTED ALLOCATION (from portfolio-logic): ${Math.round(suggested.mETHWeight*100)}% mETH / ${Math.round(suggested.usdyWeight*100)}% USDY
VALIDATION: ${validation.message}
DETERMINISTIC RATIONALE: ${suggested.rationale}
`;

    const enrichedPrompt = `${buildUserGoalPrompt(goal)}

=== LIVE RESEARCH + DETERMINISTIC PORTFOLIO LOGIC ===
${researchSummary}

${planningContext}

You MUST use the suggested allocation (or a close validated variant) as the basis for your plan.
Cite the exact numbers from portfolio-logic in your reasoning.`;

    const first = await llm.complete(CONDUCTOR_SYSTEM, enrichedPrompt);

    const log1 = await logDecisionOnChain({
      agentId: 1,
      task: first.task,
      reasoning: first.reasoning,
      action: first.action,
      result: first.result,
    });
    // Include live research proof + SDK note in the first decision (makes the whole trace auditable)
    if (liveYields.block) {
      first.result += ` | Live RPC research at block ${liveYields.block} + Pyth via mantle-agent-kit-sdk. Researcher (4) will deliver full packet.`;
    }
    if (liveYields.livePrices) {
      first.result += ` | livePrices mETH=${liveYields.livePrices.mETH || 'n/a'}`;
    }
    decisions.push({ agentId: 1, agentName: 'Conductor', decision: first, onchain: log1 });

    // === 3. Delegation Phase with explicit replan loop and tool simulation ===
    let current = first;
    let rounds = 0;
    const MAX_ROUNDS = 8;
    let currentAllocation: Allocation = suggested;
    let replanCount = 0;

    while (current.next !== 'COMPLETE' && rounds < MAX_ROUNDS) {
      rounds++;

      let nextSystem = '';
      let nextAgentId = 1;
      let extraContext = `Current validated allocation: ${Math.round(currentAllocation.mETHWeight*100)}% mETH / ${Math.round(currentAllocation.usdyWeight*100)}% USDY. Risk+liquidity: ${JSON.stringify(estimateRisk(currentAllocation))}`;

      // Improved delegation selection: explicit "next" wins. Only fall back to action keywords for legacy/ambiguous cases.
      // Risk Manager check is deliberately high priority once we have proposals.
      if (current.next.includes('Researcher')) {
        nextSystem = RESEARCHER_SYSTEM;
        nextAgentId = 4;
        extraContext += `\nFocus: fetch fresh live research (RPC + SDK Pyth if available) for mETH/USDY/Moe. Cite exact block/supply/pairs/prices.`;
      } else if (current.next.includes('RiskManager') || current.next.includes('Risk')) {
        nextSystem = RISK_MANAGER_SYSTEM;
        nextAgentId = 5;
        extraContext += `\nFocus: strict re-validation of current allocation against user risk cap and liquidity gates using portfolio-logic. You may REVISE.`;
      } else if (current.next.includes('TradingExecutor') || current.action.includes('Executor')) {
        nextSystem = TRADING_EXECUTOR_SYSTEM;
        nextAgentId = 2;
        extraContext += `\nFocus: execution quality, liquidity impact and slippage for the mETH leg on Merchant Moe LB. You can propose small adjustments if needed.`;
      } else if (current.next.includes('RWAOptimizer') || (current.action.includes('RWA') && !current.action.includes('Risk'))) {
        nextSystem = RWA_OPTIMIZER_SYSTEM;
        nextAgentId = 3;
        extraContext += `\nFocus: confirm or adjust USDY weight for best risk/liquidity/yield. Return a clear proposed %USDY if different.`;
      } else if (current.next.includes('RiskManager')) {
        // duplicate safety
        nextSystem = RISK_MANAGER_SYSTEM;
        nextAgentId = 5;
      } else {
        nextSystem = CONDUCTOR_SYSTEM;
        nextAgentId = 1;
        extraContext += `\nYou are in replan mode. Re-compute safe allocation using portfolio-logic and decide next delegation (prefer Researcher or RiskManager).`;
      }

      const subDecision = await llm.complete(nextSystem, 
        `Previous Conductor/sub decision + any reflections: ${JSON.stringify({task: current.task, action: current.action, result: current.result})}\n\n` +
        `=== LIVE RESEARCH + ENHANCED PORTFOLIO LOGIC (use these exact numbers) ===\n${planningContext}\n${extraContext}\n\n` +
        `Current goal: ${goal}\n\n` +
        `You are agent #${nextAgentId}. Deliver your specialist service (A2A-style handoff/task), cite the numbers above, declare the service you provided (so Conductor can pay you via recordServicePayment), perform your internal REFLECTION (self-critique) and output the strict JSON. ` +
        `If you have a better allocation weight, put it clearly as "PROPOSE: XX% USDY" in the action field. This handoff is A2A-compatible for future remote agents.`
      );

      // === Generalized proposal parsing + economy layer for ALL subs (improved) ===
      // Any agent (2,3,4,5) that outputs a clear "PROPOSE: XX% USDY" can influence the allocation if it passes validation.
      // This makes Researcher and especially Risk Manager able to course-correct.
      const weightMatch = subDecision.action.match(/PROPOSE:\s*(\d{1,2})%\s*USDY/i) || subDecision.action.match(/(\d{1,2})%\s*USDY/i);
      if (weightMatch) {
        const proposedUsdy = Math.min(0.5, Math.max(0.15, parseInt(weightMatch[1]) / 100));
        const newAlloc: Allocation = { mETHWeight: 1 - proposedUsdy, usdyWeight: proposedUsdy };
        const newVal = validateAllocation(newAlloc, userRiskCap);

        if (newVal.valid) {
          const serviceName = nextAgentId === 4 ? 'research packet' : nextAgentId === 5 ? 'risk gate validation' : nextAgentId === 3 ? 'RWA allocation proposal' : 'execution analysis';
          const fee = computeServiceFee('Conductor', ['Executor','RWA','Researcher','Risk Manager'][nextAgentId-2] || 'specialist', 80);

          console.log(`[Conductor] Agent#${nextAgentId} (${AGENT_NAMES[nextAgentId]}) proposed ${weightMatch[1]}% USDY via ${serviceName} (validated). Fee: ${fee}`);

          currentAllocation = newAlloc;

          await logDecisionOnChain({
            agentId: 1,
            task: `Service settlement + value received from ${AGENT_NAMES[nextAgentId]}`,
            reasoning: `Sub-agent #${nextAgentId} delivered ${serviceName}. Validated against portfolio-logic. Paying simulated fee to maintain economy incentives.`,
            action: `PAY ${fee} (sim) to #${nextAgentId} for ${serviceName}`,
            result: `Allocation updated to ${Math.round(newAlloc.usdyWeight*100)}% USDY. Metrics now: ${JSON.stringify(estimateRisk(newAlloc))}`,
          });
          await recordServicePaymentOnChain(1, nextAgentId, Math.round(fee), serviceName);
        } else {
          console.log(`[Conductor] Agent#${nextAgentId} proposal rejected by validateAllocation. Forcing replan / Risk re-check.`);
          replanCount++;
          current.next = nextAgentId === 5 ? 'COMPLETE' : 'SYNTHESIZE';
        }
      }

      // Strong forcing: after Executor or RWA delivered a (possibly updated) proposal, the next thing must be Risk Manager gate.
      // This prevents the "RWA proposes → Conductor picks RWA again" loop we saw in early runs.
      if ((nextAgentId === 2 || nextAgentId === 3) && current.next !== 'COMPLETE') {
        current.next = 'DELEGATE:RiskManager';
      }

      const log = await logDecisionOnChain({
        agentId: nextAgentId,
        task: subDecision.task,
        reasoning: subDecision.reasoning,
        action: subDecision.action,
        result: subDecision.result,
      });

      decisions.push({
        agentId: nextAgentId,
        agentName: AGENT_NAMES[nextAgentId],
        decision: subDecision,
        onchain: log,
      });

      // A2A-style handoff logging (inspired by Google A2A protocol + our internal delegation)
      console.log(`[Conductor] A2A-style handoff completed: Task delivered to #${nextAgentId} (${AGENT_NAMES[nextAgentId]}), response received with reflection/service declaration. Ready for next in graph.`);

      // Always pay Researcher for the foundational live data service (even if it didn't propose weights).
      if (nextAgentId === 4) {
        const rFee = 0.45;
        console.log(`[Conductor] Researcher (4) provided verified live research + SDK data. Recording service payment to economy layer.`);
        await recordServicePaymentOnChain(1, 4, Math.round(rFee * 100), 'live on-chain + Pyth research packet');
      }

      // After Risk Manager has spoken (the final gate), force the loop toward synthesis/complete.
      if (nextAgentId === 5) {
        current.next = 'SYNTHESIZE';
      }

      // Deep ERC-8004 Reputation for EVERY participating agent (using live metrics from the current allocation).
      // This is called for Researcher, Executor, RWA, and Risk Manager on every delivery.
      const subM = estimateRisk(currentAllocation);
      const tag = nextAgentId === 4 ? 'research' 
                : nextAgentId === 5 ? 'risk-gate' 
                : nextAgentId === 3 ? 'rwa-risk' 
                : 'moe-exec';
      const valueForRep = Math.max(65, Math.round((subM.expectedAPY || 3.0) * 38 + (subM.liquidityScore || 0.8) * 20));
      giveReputationFeedback(
        nextAgentId,
        valueForRep,
        2,
        'conductor-orchestra',
        tag
      ).catch(() => {});

      current = subDecision;

      // Anti-loop / robust termination (anti-error): once we got a SYNTHESIZE from RWA, treat as ready to exit delegation loop
      if (current.next === 'SYNTHESIZE') {
        current = { ...current, next: 'COMPLETE' as const };
      }

      // === Explicit final risk gate (improved logic) ===
      if (rounds > 3 && current.next === 'COMPLETE') {
        const finalCheck = validateAllocation(currentAllocation, userRiskCap);
        if (!finalCheck.valid) {
          console.log('[Conductor] Final check failed. Forcing one more replan for safety.');
          current.next = 'SYNTHESIZE'; // force another Conductor step
          replanCount++;
        }
      }
    }

    // === 4. Final Synthesis with full trace and economy signals ===
    const finalMetrics = estimateRisk(currentAllocation);
    const serviceFeesTotal = decisions.filter(d => d.decision.action.includes('PAY') || d.decision.action.includes('fee')).length * 0.5; // rough

    const finalPrompt = `All sub-agents have reported after ${rounds} rounds (${replanCount} replans). 
Final allocation: ${Math.round(currentAllocation.mETHWeight*100)}% mETH / ${Math.round(currentAllocation.usdyWeight*100)}% USDY.
Metrics: ${JSON.stringify(finalMetrics)}.
Total simulated service fees paid: ~${serviceFeesTotal}.

Synthesize the final recommendation with explicit numbers, mention the logic steps and any replans, and mark next=COMPLETE for goal:\n${goal}\n\nLIVE RESEARCH + FINAL NUMBERS + EXECUTION TRACE:\n${planningContext}\n\nLast outputs: ${JSON.stringify(decisions.slice(-3))}`;

    const final = await llm.complete(CONDUCTOR_SYSTEM, finalPrompt);

    const allocJson = JSON.stringify({ mETH: Number(currentAllocation.mETHWeight.toFixed(4)), USDY: Number(currentAllocation.usdyWeight.toFixed(4)) });
    const reasoningHash = '0x' + Buffer.from(final.reasoning.slice(0, 64)).toString('hex').padEnd(64, '0') as any; // lightweight commitment for demo

    const log = await logDecisionWithMetricsOnChain({
      agentId: 1,
      task: final.task,
      reasoning: final.reasoning,
      action: final.action,
      result: final.result,
      blendedAPY: Math.round(finalMetrics.expectedAPY * 100),
      riskScoreBps: Math.round(finalMetrics.estimatedMaxDD * 100),
      liquidityScoreBps: Math.round(finalMetrics.liquidityScore * 10000),
      serviceFeesTotal: Math.round(serviceFeesTotal * 100),
      allocationJson: allocJson,
      parentDecisionId: 0,
    });
    decisions.push({ agentId: 1, agentName: 'Conductor', decision: final, onchain: log });

    // Deep ERC-8004 Reputation signal (using live metrics). Non-blocking; may be simulated if no reviewer key or self-guard.
    // This fulfills "use Validation/Reputation" from research (giveFeedback with real decision data).
    giveReputationFeedback(
      1,
      Math.round(finalMetrics.expectedAPY * 50), // e.g. 150 for ~3% blended -> positive trust signal
      2,
      'conductor-orchestra',
      'yield-risk'
    ).catch(() => {});

    const summary = final.result;
    console.log(`=== CONDUCTOR COMPLETE (rounds=${rounds}, replans=${replanCount}) ===\n`);
    return { goal, decisions, summary };

  } catch (error: any) {
    console.error('[Conductor] Error in orchestration logic (anti-error recovery):', error);

    // Anti-error resilience: return whatever we managed to produce + error info
    // so callers (API, UI, CLI) can still show a useful partial trace instead of total failure.
    const errMsg = error?.message || String(error);
    return {
      goal,
      decisions,           // may be partial
      summary: decisions.length > 0
        ? `Partial run due to error. Last successful step produced: ${decisions[decisions.length-1]?.decision?.result || 'N/A'}`
        : `Conductor failed early: ${errMsg}`,
      error: errMsg,
      partial: decisions.length > 0,
    };
  }
}

// Allow direct CLI run
if (import.meta.url === `file://${process.argv[1]}`) {
  const goal = process.argv.slice(2).join(' ') || 
    "Optimize my portfolio yield with risk no higher than 6.5%, with strong focus on mETH and USDY";
  
  runConductor(goal).then(r => {
    console.dir(r, { depth: 3 });
    process.exit(0);
  });
}
