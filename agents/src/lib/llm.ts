/**
 * LLM abstraction for Conductor.
 * - In production / with key: uses Anthropic (best reasoning) or OpenAI compatible.
 * - In demo / no key: extremely high quality deterministic mock that produces
 *   beautiful, realistic, hackathon-winning traces.
 *
 * This allows the entire demo to be runnable instantly while still showing
 * the exact same output shape as a real powerful model would produce.
 */

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

const DecisionSchema = z.object({
  task: z.string(),
  reasoning: z.string().min(20),
  action: z.string(),
  result: z.string(),
  next: z.enum(['DELEGATE:Researcher', 'DELEGATE:TradingExecutor', 'DELEGATE:RWAOptimizer', 'DELEGATE:RiskManager', 'SYNTHESIZE', 'COMPLETE']),
});

export type AgentDecision = z.infer<typeof DecisionSchema>;

export interface LLMClient {
  complete(system: string, user: string): Promise<AgentDecision>;
}

const USE_REAL = !!process.env.ANTHROPIC_API_KEY || !!process.env.OPENAI_API_KEY;

let anthropic: Anthropic | null = null;
if (process.env.ANTHROPIC_API_KEY) {
  anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function parseJsonish(text: string): any {
  // Try to extract the first JSON object
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found in model response");
  return JSON.parse(match[0]);
}

/** High-quality mock — now upgraded to match the much stronger, specialized prompts.
 * Produces realistic, citation-heavy, sometimes "imperfect" proposals that trigger real validation/replan logic in conductor/index.ts.
 * Always tries to echo numbers from the LIVE RESEARCH + planningContext that the real Conductor injects.
 */
function mockComplete(system: string, user: string): AgentDecision {
  const goalLower = user.toLowerCase();

  // Try to extract the deterministic numbers that Conductor always injects
  const riskMatch = user.match(/USER RISK CAP:\s*(\d+(?:\.\d+)?)%/) || goalLower.match(/(\d+(?:\.\d+)?)%/);
  const riskCap = riskMatch ? parseFloat(riskMatch[1]) : 7;

  const suggestedMatch = user.match(/SUGGESTED ALLOCATION[^:]*:\s*(\d+)%\s*mETH\s*\/\s*(\d+)%\s*USDY/i);
  const suggestedMeth = suggestedMatch ? parseInt(suggestedMatch[1]) : Math.max(58, 100 - Math.floor(riskCap * 5.5));
  const suggestedUsdy = suggestedMatch ? parseInt(suggestedMatch[2]) : Math.min(42, Math.floor(riskCap * 5.5));

  const apyMatch = user.match(/expectedAPY[:\s]*([\d.]+)/i);
  const baseApy = apyMatch ? parseFloat(apyMatch[1]) : (suggestedMeth * 2.01 + suggestedUsdy * 4.65) / 100;

  const blockMatch = user.match(/block\s+(\d+)/i);
  const liveBlock = blockMatch ? blockMatch[1] : '96270xxx';

  // === CONDUCTOR ===
  if (system.includes('CONDUCTOR')) {
    if (user.includes('Synthesize the final') || user.includes('All sub-agents have reported') || user.includes('mark next=COMPLETE') || user.includes('FINALIZE')) {
      return {
        task: "Synthesize final allocation + prepare immutable audit log + economy settlement",
        reasoning: `Full 5-agent team delivered after ${user.includes('rounds') ? 'multiple' : 'standard'} rounds. Researcher (4) supplied live block ${liveBlock} + Pyth SDK prices. Executor (2) confirmed mETH execution feasible <5bp. RWA (3) proposed ${suggestedUsdy}% USDY for +${(suggestedUsdy*0.019).toFixed(2)}pp uplift. Risk Manager (5) re-ran validateAllocation + estimateRisk — gates PASSED (DD ${ (riskCap*0.8).toFixed(1) }% < ${riskCap}%, liquidityScore ≥0.78). All service fees recorded. Will call logDecisionWithMetrics + recordServicePayment + giveFeedback on ERC-8004 ReputationRegistry for agents 1-5 using blendedAPY=${baseApy.toFixed(2)}.`,
        action: "FINALIZE. Log rich metrics (APY/risk/liquidity + allocationJson) to DecisionLogger. Record 4 service payments. Post giveFeedback (yield-risk + risk-gate + research + moe-exec tags) for the whole orchestra. Emit 8004scan + mantlescan proof links.",
        result: `5-agent verified plan locked: ${suggestedMeth}% mETH / ${suggestedUsdy}% USDY. estAPY ${baseApy.toFixed(2)}%. estDD <${riskCap}%. Full CoT + fees + reputation signals committed on-chain under Conductor #1. User (or any DAO) can replay the exact portfolio-logic + research packet forever.`,
        next: 'COMPLETE',
      };
    }

    // First real move — always prefer fresh Researcher
    return {
      task: goalLower.slice(0, 80) + (goalLower.length > 80 ? '...' : ''),
      reasoning: `User goal parsed. Risk cap extracted ≤${riskCap}%. The deterministic suggestSafeAllocation (riskCap / 15, clamped 0.28-0.42 USDY) produced base suggestion ${suggestedMeth}% mETH / ${suggestedUsdy}% USDY with rationale in context. LiquidityScore and estMaxDD from estimateRisk also provided. To make everything auditable I must first get a fresh research packet from Researcher (4) that includes current block, mETH supply proof, Moe LBFactory pair count, and Pyth prices via mantle-agent-kit-sdk. Only then delegate execution/RWA work. This satisfies the "Researcher first" constitution.`,
      action: "DELEGATE:Researcher (4) for verified live data (RPC + SDK Pyth) before any capital allocation work.",
      result: `5-agent orchestra activated (Conductor#1 + Researcher#4 + Executor#2 + RWA#3 + Risk#5). Will cite block ${liveBlock} + portfolio-logic numbers in every subsequent step. Decision will be logged with metrics to DecisionLogger.`,
      next: 'DELEGATE:Researcher',
    };
  }

  // === TRADING EXECUTOR (2) ===
  if (system.includes('TRADING EXECUTOR')) {
    const execSlip = suggestedMeth > 65 ? 3 : 5;
    return {
      task: "mETH execution feasibility + opportunity cost on Merchant Moe LB",
      reasoning: `Context shows current validated allocation ${suggestedMeth}% mETH. Live research (block ${liveBlock}) + Moe LBFactory data confirms deep liquidity. For ${suggestedMeth}% weight on a realistic user size, est. slippage on tight LB ~${execSlip}bp. Native mETH staking APY from context is stable. Rebalancing cost negligible vs yield. I can support the mETH core or a small concentrated position. Service delivered: execution analysis + recommended LB range for the orchestra. This justifies a small serviceFee from Conductor.`,
      action: `PROPOSE: Maintain ${Math.max(55, suggestedMeth-3)}-${Math.min(70, suggestedMeth+5)}% mETH core (staking + narrow 1780-2100 range on Moe). Prepares clean dry powder for the USDY leg without hurting liquidityScore.`,
      result: `mETH leg executable with <${execSlip}bp impact. Opportunity cost vs pure staking <0.15pp. Liquidity contribution to portfolio remains excellent. Ready to hand to RWA Optimizer (3).`,
      next: 'DELEGATE:RWAOptimizer',
    };
  }

  // === RWA OPTIMIZER (3) ===
  if (system.includes('RWA OPTIMIZER')) {
    // Sometimes propose a slightly different % to trigger Conductor's validation + possible replan path
    let proposedUsdy = suggestedUsdy;
    if (Math.random() > 0.55) {
      proposedUsdy = Math.min(42, Math.max(26, suggestedUsdy + (riskCap > 8 ? 4 : -3)));
    }
    const uplift = (proposedUsdy * 0.019).toFixed(2);
    return {
      task: `Risk-adjusted USDY sizing for user cap ≤${riskCap}%`,
      reasoning: `Received suggested ${suggestedUsdy}% USDY + full metrics from planningContext (liquidityScore, estMaxDD). Live USDY APY from Researcher context is strong. Moe depth for USDY pairs supports the size with low slippage. I calculate that moving to ${proposedUsdy}% USDY would give +${uplift}pp blended while still leaving headroom on DD and keeping liquidityScore healthy. This is the service I deliver: a concrete, model-backed proposal the Risk Manager can gate.`,
      action: `PROPOSE: ${proposedUsdy}% USDY (tight concentrated position on Moe LB, single-sided or 50/50 range). Remaining ${100-proposedUsdy}% as mETH core.`,
      result: `Marginal portfolio APY uplift +${uplift}pp vs pure mETH. New estMaxDD still < ${riskCap}%. liquidityScore improves to ~0.81. Allocation ready for independent Risk Manager (5) validation.`,
      next: 'DELEGATE:RiskManager',
    };
  }

  // === RESEARCHER (4) — now much richer, matches the strong prompt ===
  if (system.includes('RESEARCHER')) {
    const pairs = 37 + Math.floor(Math.random() * 9);
    return {
      task: "Fresh live on-chain + SDK research packet for goal",
      reasoning: `Performed researchYields() + researchMoePoolDepth() + direct RPC reads. At block ${liveBlock}: mETH symbol/decimals/totalSupply confirmed on-chain (~28.7k supply). USDY decimals 18, accumulating. Moe LBFactory.getNumberOfLBPairs returned ${pairs}. Pyth prices fetched via mantle-agent-kit-sdk (pythGetTokenPrice for mETH + MNT/USD). No anomalies in supply or pair count. Correlation note: USDY materially lower beta than mETH. This packet will be injected into Executor, RWA and Risk contexts. Service delivered to Conductor and the rest of the 5-agent team.`,
      action: `DELIVER: block=${liveBlock}, mETH_APY=2.01, USDY_APY=4.65, livePrices mETH~2456.8 (Pyth SDK), MNT~0.72, Moe pairs=${pairs}, mETH supply proof attached. Source: on-chain RPC + mantle-agent-kit-sdk.`,
      result: "Research packet delivered and cited. All downstream agents now have verifiable live data instead of stale assumptions. Fee for research service eligible.",
      next: 'DELEGATE:TradingExecutor',
    };
  }

  // === RISK MANAGER (5) — the strict one. Sometimes revises. ===
  if (system.includes('RISK MANAGER')) {
    const proposedUsdyMatch = user.match(/PROPOSE:\s*(\d+)%\s*USDY/i) || user.match(/(\d{1,2})%\s*USDY/i);
    const incomingUsdy = proposedUsdyMatch ? parseInt(proposedUsdyMatch[1]) : suggestedUsdy;

    // Risk Manager sometimes forces a more conservative number to demonstrate the gate
    let decisionUsdy = incomingUsdy;
    let gateResult = 'PASSED';
    let actionText = `APPROVE allocation at ${100-incomingUsdy}% mETH / ${incomingUsdy}% USDY`;

    const simulatedDD = (riskCap * 0.79 + (incomingUsdy - 32) * 0.04);
    if (simulatedDD > riskCap * 0.95 || incomingUsdy > 41) {
      decisionUsdy = Math.max(26, Math.min(36, Math.floor(riskCap * 5.2)));
      gateResult = 'REVISED';
      actionText = `REVISE: PROPOSE ${decisionUsdy}% USDY (safer). Brings estMaxDD back to ${(riskCap*0.81).toFixed(1)}% and liquidityScore to 0.82`;
    }

    return {
      task: "Independent portfolio-logic risk + liquidity gate validation",
      reasoning: `Received proposal for ~${incomingUsdy}% USDY. Re-executed validateAllocation(proposal, ${riskCap}) and estimateRisk using the live yields from Researcher context. Computed: estMaxDD=${simulatedDD.toFixed(1)}%, liquidityScore=${(0.79 + (decisionUsdy-30)*0.003).toFixed(2)}. ${gateResult === 'PASSED' ? 'All gates satisfied (DD < cap, liquidity >=0.75).' : 'Slight breach on stress DD / liquidity tail — I am forcing a safer counter-proposal using the same suggest/validate logic Conductor uses.'} REFLECTION (self-critique): I verified against the exact planningContext numbers and Researcher block data. No hallucinated yields. This REVISE is the smallest adjustment that satisfies the constitution. A2A skill "risk_gate_validation" exercised. This is the core service of agent #5: preventing loss of capital for the user and protecting the reputation of the whole orchestra. Will tag my own 8004 reputation with 'risk-gate'.`,
      action: actionText,
      result: `Gate ${gateResult}. Final safe weights for synthesis: ${100-decisionUsdy}% mETH / ${decisionUsdy}% USDY. estAPY ~${(baseApy + (decisionUsdy - suggestedUsdy)*0.015).toFixed(2)}%, estMaxDD ${(riskCap*0.81).toFixed(1)}% ≤ cap. Allocation may now be logged with full metrics.`,
      next: 'SYNTHESIZE',
    };
  }

  // Fallback final (very robust)
  return {
    task: "Synthesize final allocation + prepare immutable audit log",
    reasoning: `All 5 agents contributed. Researcher (4) block ${liveBlock}. Executor confirmed execution. RWA proposed slice. Risk Manager (5) performed final validate/estimateRisk pass — PASSED. Service fees between Conductor and 2/3/4/5 recorded. Full trace + metrics will be written via logDecisionWithMetrics + giveFeedback on ERC-8004 for every agentId using the live blendedAPY/risk/liquidity values. REFLECTION (Conductor self-critique): Cross-checked every sub's output against live research packet and portfolio-logic context. No ungrounded claims. All handoffs were A2A-style (task + data part). Economy layer complete (payments to all specialists). Ready for immutable log.`,
    action: "FINALIZE + LOG + REPUTATION. Emit DecisionLogger entries + 8004scan links. A2A-compatible artifact for other orchestrators.",
    result: `Orchestra plan ready: ${suggestedMeth}% mETH / ${suggestedUsdy}% USDY. estAPY ${baseApy.toFixed(2)}%. All steps verifiable on Mantle. User or any third party can re-run the exact portfolio-logic against the cited research packet. Reflection applied for quality.`,
    next: 'COMPLETE',
  };
}

export async function getLLMClient(): Promise<LLMClient> {
  if (!USE_REAL) {
    console.log('[LLM] Using high-fidelity mock (no ANTHROPIC_API_KEY)');
    return {
      async complete(system, user) {
        // Simulate thinking latency for realistic demo
        await new Promise(r => setTimeout(r, 420 + Math.random() * 280));
        const raw = mockComplete(system, user);
        return DecisionSchema.parse(raw);
      },
    };
  }

  // Real path (Anthropic preferred)
  if (anthropic) {
    return {
      async complete(system, user) {
        const msg = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1200,
          system,
          messages: [{ role: 'user', content: user }],
        });
        const text = msg.content.map(c => (c.type === 'text' ? c.text : '')).join('');
        const parsed = parseJsonish(text);
        return DecisionSchema.parse(parsed);
      },
    };
  }

  // Fallback: you can easily add OpenAI here
  throw new Error('No supported LLM client configured');
}
