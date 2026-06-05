/**
 * Pure business logic for portfolio decisions.
 * These functions provide deterministic calculations that the Conductor and sub-agents
 * "call" (via prompts + JS) to make grounded decisions instead of pure LLM guesswork.
 *
 * This is key for high-quality, auditable multi-agent logic.
 * Enhanced with liquidity awareness and re-planning support for top-tier hackathon quality.
 */

export interface Yields {
  mETH: number;
  USDY: number;
}

export interface Allocation {
  mETHWeight: number; // 0-1
  usdyWeight: number; // 0-1
}

export interface RiskMetrics {
  expectedAPY: number;
  estimatedMaxDD: number;
  diversificationBenefit: string;
  liquidityScore: number; // 0-1, higher = better liquidity for the allocation
}

import { DEFAULT_METH_APY, DEFAULT_USDY_APY } from './mantle';

/**
 * Computes blended APY for a given allocation.
 */
export function calculateBlendedAPY(allocation: Allocation, yields: Yields): number {
  const { mETHWeight, usdyWeight } = allocation;
  if (Math.abs(mETHWeight + usdyWeight - 1) > 0.001) {
    throw new Error("Weights must sum to 1");
  }
  return mETHWeight * yields.mETH + usdyWeight * yields.USDY;
}

/**
 * Enhanced risk model with liquidity impact.
 * Assumes mETH has higher volatility, USDY is more stable (RWA).
 * Liquidity score penalizes large concentrated positions on Moe.
 */
export function estimateRisk(allocation: Allocation, baseRiskMETH = 8.5): RiskMetrics {
  const { mETHWeight, usdyWeight } = allocation;

  const rawRisk = mETHWeight * baseRiskMETH + usdyWeight * 3.2;
  const diversification = usdyWeight * 2.8;

  const estimatedMaxDD = Math.max(3.2, rawRisk - diversification);

  const blendedAPY = calculateBlendedAPY(allocation, { mETH: DEFAULT_METH_APY, USDY: DEFAULT_USDY_APY });

  let benefit = "Low";
  if (usdyWeight > 0.3) benefit = "Material (low beta to mETH)";
  if (usdyWeight > 0.45) benefit = "Strong (excellent diversifier)";

  // Simple liquidity model: larger USDY slice on LB has good depth, but extreme concentration hurts
  const liquidityScore = Math.max(0.6, 1 - Math.abs(usdyWeight - 0.35) * 0.8);

  return {
    expectedAPY: Number(blendedAPY.toFixed(2)),
    estimatedMaxDD: Number(estimatedMaxDD.toFixed(1)),
    diversificationBenefit: benefit,
    liquidityScore: Number(liquidityScore.toFixed(2)),
  };
}

/**
 * Core logic: suggest a safe allocation, now with liquidity awareness.
 */
const MAX_USDY_WEIGHT = 0.42;
const MIN_USDY_WEIGHT = 0.28;
const RISK_DIVISOR = 15;
const MIN_LIQUIDITY = 0.75;
const MAX_ITERATIONS = 12;
const MIN_USDY_ADJUST = 0.15;
const USDY_DECREMENT = 0.025;
const SWEET_SPOT = 0.35;
const SMALL_ADJUST = 0.01;
const DD_HEADROOM = 1.0;
const LIQ_THRESHOLD = 0.8;
const MAX_USDY_FOR_BOOST = 0.40;
const BOOST_INCREMENT = 0.03;

export function suggestSafeAllocation(
  userRiskCap: number,
  yields: Yields = { mETH: DEFAULT_METH_APY, USDY: DEFAULT_USDY_APY }
): Allocation & { rationale: string } {
  let usdyWeight = Math.min(MAX_USDY_WEIGHT, Math.max(MIN_USDY_WEIGHT, userRiskCap / RISK_DIVISOR));
  let mETHWeight = 1 - usdyWeight;

  let metrics = estimateRisk({ mETHWeight, usdyWeight });

  let iterations = 0;
  while ((metrics.estimatedMaxDD > userRiskCap || metrics.liquidityScore < MIN_LIQUIDITY) && iterations < MAX_ITERATIONS) {
    if (metrics.estimatedMaxDD > userRiskCap) {
      usdyWeight = Math.max(MIN_USDY_ADJUST, usdyWeight - USDY_DECREMENT);
    } else {
      // adjust towards sweet spot for liquidity
      usdyWeight = usdyWeight > SWEET_SPOT ? usdyWeight - SMALL_ADJUST : usdyWeight + SMALL_ADJUST;
    }
    mETHWeight = 1 - usdyWeight;
    metrics = estimateRisk({ mETHWeight, usdyWeight });
    iterations++;
  }

  // Final yield boost if headroom
  if (metrics.estimatedMaxDD < userRiskCap - DD_HEADROOM && metrics.liquidityScore > LIQ_THRESHOLD && usdyWeight < MAX_USDY_FOR_BOOST) {
    usdyWeight += BOOST_INCREMENT;
    mETHWeight = 1 - usdyWeight;
    metrics = estimateRisk({ mETHWeight, usdyWeight });
  }

  const rationale = `Using enhanced risk + liquidity model: target DD ≤ ${userRiskCap}%, liquidity ≥ ${MIN_LIQUIDITY}. ` +
    `Final: ${Math.round(usdyWeight * 100)}% USDY / ${Math.round(mETHWeight * 100)}% mETH. ` +
    `DD ${metrics.estimatedMaxDD}%, liquidityScore ${metrics.liquidityScore}. ${metrics.diversificationBenefit}.`;

  return {
    mETHWeight: Number(mETHWeight.toFixed(2)),
    usdyWeight: Number(usdyWeight.toFixed(2)),
    rationale,
  };
}

/**
 * Validates a proposed allocation against user risk and liquidity.
 */
export function validateAllocation(
  allocation: Allocation,
  userRiskCap: number
): { valid: boolean; message: string; metrics: RiskMetrics } {
  const metrics = estimateRisk(allocation);
  const valid = metrics.estimatedMaxDD <= userRiskCap && metrics.liquidityScore >= 0.7;

  return {
    valid,
    message: valid
      ? `Allocation OK. APY ${metrics.expectedAPY}%, DD ${metrics.estimatedMaxDD}% ≤ ${userRiskCap}%, liquidity ${metrics.liquidityScore}. ${metrics.diversificationBenefit}.`
      : `Invalid: DD ${metrics.estimatedMaxDD}% or liquidity ${metrics.liquidityScore} out of policy. Re-plan needed.`,
    metrics,
  };
}

/**
 * Simulate small "service fee" between agents for the economy aspect (logged on-chain).
 */
export function computeServiceFee(fromAgent: string, toAgent: string, baseAmount: number): number {
  // 0.5% fee for using specialist service
  return Number((baseAmount * 0.005).toFixed(4));
}
