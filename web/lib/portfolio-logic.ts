/**
 * Client-side version of the portfolio logic (mirrors agents/src/lib/portfolio-logic.ts).
 * Used to make the demo deterministic and show the "logic" to users/judges.
 */
import { RESEARCH_DATA } from './mantle';

export interface Allocation {
  mETHWeight: number;
  usdyWeight: number;
}

export interface RiskMetrics {
  expectedAPY: number;
  estimatedMaxDD: number;
  diversificationBenefit: string;
  liquidityScore: number; // 0-1
}

export function calculateBlendedAPY(allocation: Allocation, mETH_APY: number, USDY_APY: number): number {
  return allocation.mETHWeight * mETH_APY + allocation.usdyWeight * USDY_APY;
}

export function estimateRisk(allocation: Allocation, baseRiskMETH = 8.5): RiskMetrics {
  const { mETHWeight, usdyWeight } = allocation;
  const rawRisk = mETHWeight * baseRiskMETH + usdyWeight * 3.2;
  const diversification = usdyWeight * 2.8;

  const estimatedMaxDD = Math.max(3.2, rawRisk - diversification);
  const blendedAPY = calculateBlendedAPY(allocation, RESEARCH_DATA.mETH_APY, RESEARCH_DATA.USDY_APY);

  let benefit = "Low";
  if (usdyWeight > 0.3) benefit = "Material (low beta to mETH)";
  if (usdyWeight > 0.45) benefit = "Strong (excellent diversifier)";

  const liquidityScore = Math.max(0.6, 1 - Math.abs(usdyWeight - 0.35) * 0.8);

  return {
    expectedAPY: Number(blendedAPY.toFixed(2)),
    estimatedMaxDD: Number(estimatedMaxDD.toFixed(1)),
    diversificationBenefit: benefit,
    liquidityScore: Number(liquidityScore.toFixed(2)),
  };
}

const MAX_USDY_WEIGHT = 0.42;
const MIN_USDY_WEIGHT = 0.25;
const RISK_DIVISOR = 15;
const MIN_USDY_ADJUST = 0.15;
const USDY_DECREMENT = 0.025;
const MAX_ITER = 8;
const DD_HEADROOM = 1.2;
const MAX_USDY_FOR_BOOST = 0.40;
const BOOST_INCREMENT = 0.03;
const MIN_LIQUIDITY = 0.75;

export function suggestSafeAllocation(userRiskCap: number): Allocation & { rationale: string } {
  let usdyWeight = Math.min(MAX_USDY_WEIGHT, Math.max(MIN_USDY_WEIGHT, userRiskCap / RISK_DIVISOR));
  let mETHWeight = 1 - usdyWeight;

  let metrics = estimateRisk({ mETHWeight, usdyWeight });

  let iterations = 0;
  while (metrics.estimatedMaxDD > userRiskCap && iterations < MAX_ITER) {
    usdyWeight = Math.max(MIN_USDY_ADJUST, usdyWeight - USDY_DECREMENT);
    mETHWeight = 1 - usdyWeight;
    metrics = estimateRisk({ mETHWeight, usdyWeight });
    iterations++;
  }

  if (metrics.estimatedMaxDD < userRiskCap - DD_HEADROOM && usdyWeight < MAX_USDY_FOR_BOOST) {
    usdyWeight += BOOST_INCREMENT;
    mETHWeight = 1 - usdyWeight;
  }

  const rationale = `enhanced portfolio-logic (risk+liquidity): target DD ≤ ${userRiskCap}%, liquidity ≥ ${MIN_LIQUIDITY}. ` +
    `Final: ${Math.round(usdyWeight * 100)}% USDY. DD ${metrics.estimatedMaxDD}%, liquidity ${metrics.liquidityScore}. ${metrics.diversificationBenefit}.`;

  return {
    mETHWeight: Number(mETHWeight.toFixed(2)),
    usdyWeight: Number(usdyWeight.toFixed(2)),
    rationale,
  };
}

export function validateAllocation(allocation: Allocation, userRiskCap: number) {
  const metrics = estimateRisk(allocation);
  const valid = metrics.estimatedMaxDD <= userRiskCap && metrics.liquidityScore >= 0.7;

  return {
    valid,
    message: valid 
      ? `Validated: DD ${metrics.estimatedMaxDD}% ≤ ${userRiskCap}%, liquidity ${metrics.liquidityScore}. ${metrics.diversificationBenefit}.`
      : `Risk/liquidity violation: DD ${metrics.estimatedMaxDD}% or liquidity ${metrics.liquidityScore} out of policy.`,
    metrics,
  };
}
