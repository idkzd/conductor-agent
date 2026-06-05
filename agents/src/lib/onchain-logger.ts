/**
 * Real on-chain logging client for agents (strengthened DecisionLogger).
 * Supports both simple logDecision and the powerful logDecisionWithMetrics (stores deterministic portfolio numbers + economy + parent chains).
 *
 * When DECISION_LOGGER_ADDRESS + DEPLOYER_PRIVATE_KEY are set, real writes happen on Mantle.
 * Otherwise fully simulated (demo mode) — still returns structured data for the UI/trace.
 */

import { createWalletClient, createPublicClient, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mantle } from 'viem/chains';
import { ERC8004 } from './mantle.js';

const DECISION_LOGGER = (process.env.DECISION_LOGGER_ADDRESS || '0x40E51Bdc032F31cb394BBCCF63f66Ac65CAd8807') as Hex; // Deployed on Mantle Testnet using user's key from contracts/.env. Set DECISION_LOGGER_ADDRESS env for overrides/mainnet.

const DECISION_LOGGER_ABI = [
  {
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'task', type: 'string' },
      { name: 'reasoning', type: 'string' },
      { name: 'action', type: 'string' },
      { name: 'result', type: 'string' },
      { name: 'relatedTx', type: 'bytes32' },
    ],
    name: 'logDecision',
    outputs: [{ name: 'logId', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'task', type: 'string' },
      { name: 'reasoning', type: 'string' },
      { name: 'action', type: 'string' },
      { name: 'result', type: 'string' },
      { name: 'blendedAPY', type: 'uint256' },
      { name: 'riskScoreBps', type: 'uint256' },
      { name: 'liquidityScoreBps', type: 'uint256' },
      { name: 'serviceFeesTotal', type: 'uint256' },
      { name: 'relatedTx', type: 'bytes32' },
      { name: 'parentDecisionId', type: 'uint256' },
      { name: 'allocationJson', type: 'string' },
      { name: 'reasoningHash', type: 'bytes32' },
    ],
    name: 'logDecisionWithMetrics',
    outputs: [{ name: 'logId', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'payerAgentId', type: 'uint256' },
      { name: 'payeeAgentId', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
      { name: 'service', type: 'string' },
      { name: 'decisionLogId', type: 'uint256' },
    ],
    name: 'recordServicePayment',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'agentId', type: 'uint256' }],
    name: 'verifyAgentWithERC8004',
    outputs: [{ name: 'verified', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'withdrawAccumulatedFees',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'accumulatedFees',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// ReputationRegistry (deep ERC-8004 integration: post real performance feedback using metrics from decisions)
const REPUTATION_REGISTRY = ERC8004.ReputationRegistry as Hex;
const REPUTATION_ABI = [
  {
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'value', type: 'int128' },
      { name: 'valueDecimals', type: 'uint8' },
      { name: 'tag1', type: 'string' },
      { name: 'tag2', type: 'string' },
      { name: 'endpoint', type: 'string' },
      { name: 'feedbackURI', type: 'string' },
      { name: 'feedbackHash', type: 'bytes32' },
    ],
    name: 'giveFeedback',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

const publicClient = createPublicClient({
  chain: mantle,
  transport: http(process.env.MANTLE_RPC || 'https://rpc.mantle.xyz'),
});

let walletClient: ReturnType<typeof createWalletClient> | null = null;
let account: ReturnType<typeof privateKeyToAccount> | null = null;

if (process.env.DEPLOYER_PRIVATE_KEY) {
  account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY as Hex);
  walletClient = createWalletClient({
    account,
    chain: mantle,
    transport: http(process.env.MANTLE_RPC || 'https://rpc.mantle.xyz'),
  });
  console.log('[OnChain] Wallet client ready for', account.address);
} else {
  console.log('[OnChain] No DEPLOYER_PRIVATE_KEY — all logs will be simulated (demo mode)');
}

export interface LogDecisionParams {
  agentId: number;
  task: string;
  reasoning: string;
  action: string;
  result: string;
  relatedTx?: Hex;
}

export interface LogRichParams extends LogDecisionParams {
  blendedAPY: number;        // e.g. 312
  riskScoreBps: number;      // 620
  liquidityScoreBps: number; // 8100
  serviceFeesTotal: number;
  parentDecisionId?: number;
  allocationJson?: string;
  reasoningHash?: Hex;
}

export async function logDecisionOnChain(params: LogDecisionParams): Promise<{ logId: number; txHash?: Hex; simulated: boolean; error?: string }> {
  // thin wrapper — real runs should prefer logDecisionWithMetricsOnChain when metrics are available
  return logDecisionWithMetricsOnChain({
    ...params,
    blendedAPY: 0,
    riskScoreBps: 0,
    liquidityScoreBps: 0,
    serviceFeesTotal: 0,
  });
}

export async function logDecisionWithMetricsOnChain(params: LogRichParams): Promise<{ logId: number; txHash?: Hex; simulated: boolean; error?: string }> {
  const relatedTx = (params.relatedTx || '0x0000000000000000000000000000000000000000000000000000000000000000') as Hex;
  const parent = BigInt(params.parentDecisionId || 0);
  const alloc = params.allocationJson || '';
  const rHash = (params.reasoningHash || '0x0000000000000000000000000000000000000000000000000000000000000000') as Hex;

  if (!walletClient || !account || DECISION_LOGGER === '0x0000000000000000000000000000000000000000') {
    const fakeLogId = Math.floor(100 + Math.random() * 900);
    console.log('[OnChain DEMO] Would log RICH decision agent', params.agentId, 'APY=', params.blendedAPY, 'riskBps=', params.riskScoreBps, '→ fake', fakeLogId);
    return { logId: fakeLogId, simulated: true };
  }

  try {
    const hash = await walletClient.writeContract({
      address: DECISION_LOGGER,
      abi: DECISION_LOGGER_ABI,
      functionName: 'logDecisionWithMetrics',
      args: [
        BigInt(params.agentId),
        params.task,
        params.reasoning,
        params.action,
        params.result,
        BigInt(params.blendedAPY),
        BigInt(params.riskScoreBps),
        BigInt(params.liquidityScoreBps),
        BigInt(params.serviceFeesTotal),
        relatedTx,
        parent,
        alloc,
        rHash,
      ],
    } as any);  // viem + complex ABI union typing workaround; client already has chain+account

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const logId = Number(receipt.blockNumber) % 10000;
    console.log('[OnChain] RICH decision logged tx:', hash, 'logId~', logId, 'metrics:', params.blendedAPY, params.riskScoreBps);
    return { logId, txHash: hash, simulated: false };
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    console.error('[OnChain] Rich log failed, fallback sim', errMsg);
    return { logId: 999, simulated: true, error: errMsg };
  }
}

export async function recordServicePaymentOnChain(
  payerAgentId: number,
  payeeAgentId: number,
  amount: number,
  service: string,
  decisionLogId: number = 0
): Promise<{ txHash?: Hex; simulated: boolean }> {
  if (!walletClient || !account || DECISION_LOGGER === '0x0000000000000000000000000000000000000000') {
    console.log('[OnChain DEMO] Would recordServicePayment', payerAgentId, '→', payeeAgentId, amount, service);
    return { simulated: true };
  }
  try {
    const hash = await walletClient.writeContract({
      address: DECISION_LOGGER,
      abi: DECISION_LOGGER_ABI,
      functionName: 'recordServicePayment',
      args: [BigInt(payerAgentId), BigInt(payeeAgentId), BigInt(amount), service, BigInt(decisionLogId)],
    } as any);  // viem + complex ABI union typing workaround; client already has chain+account
    await publicClient.waitForTransactionReceipt({ hash });
    console.log('[OnChain] ServicePayment recorded:', hash);
    return { txHash: hash, simulated: false };
  } catch (err) {
    console.error('[OnChain] recordServicePayment failed', err);
    return { simulated: true };
  }
}

export async function verifyAgentOnChain(agentId: number): Promise<{ verified: boolean; txHash?: Hex; simulated: boolean }> {
  if (!walletClient || !account || DECISION_LOGGER === '0x0000000000000000000000000000000000000000') {
    console.log('[OnChain DEMO] Would verifyAgentWithERC8004', agentId);
    return { verified: false, simulated: true };
  }
  try {
    const hash = await walletClient.writeContract({
      address: DECISION_LOGGER,
      abi: DECISION_LOGGER_ABI,
      functionName: 'verifyAgentWithERC8004',
      args: [BigInt(agentId)],
    } as any);  // viem + complex ABI union typing workaround; client already has chain+account
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    // For simplicity we don't parse the event here; caller can getDecision or listen
    return { verified: true, txHash: hash, simulated: false };
  } catch (err) {
    console.error('[OnChain] verify failed', err);
    return { verified: false, simulated: true };
  }
}

/**
 * Post ERC-8004 Reputation feedback for an agent using real Conductor decision metrics.
 * Called optionally after logDecisionWithMetrics when REPUTATION enabled.
 * value e.g. blendedAPY scaled, or composite trust score.
 * Requires a non-owner client key (DEMO_REVIEWER_PK or separate) to avoid self-feedback guard.
 */
export async function giveReputationFeedback(
  agentId: number,
  value: number, // e.g. 8500 for 85.00
  valueDecimals = 2,
  tag1 = 'conductor-performance',
  tag2 = 'yield-risk-liquidity',
  endpoint = 'https://conductor-agent.vercel.app'
): Promise<{ success: boolean; txHash?: Hex; simulated: boolean; error?: string }> {
  if (!walletClient || !account || REPUTATION_REGISTRY === ('0x0000000000000000000000000000000000000000' as Hex)) {
    console.log('[OnChain DEMO] Would giveFeedback to ERC-8004 ReputationRegistry', agentId, 'value=', value);
    return { success: true, simulated: true };
  }
  // Note: if this wallet is the agent owner, registry will revert self-feedback.
  // Use a distinct reviewer key for real signals (or call from different account).
  try {
    const hash = await walletClient.writeContract({
      address: REPUTATION_REGISTRY,
      abi: REPUTATION_ABI,
      functionName: 'giveFeedback',
      args: [
        BigInt(agentId),
        BigInt(value),
        valueDecimals,
        tag1,
        tag2,
        endpoint,
        '', // optional feedbackURI (can link to IPFS Decision export)
        '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex,
      ],
    } as any);
    await publicClient.waitForTransactionReceipt({ hash });
    console.log('[OnChain] Reputation giveFeedback posted for agent', agentId, 'tx:', hash);
    return { success: true, txHash: hash, simulated: false };
  } catch (err: any) {
    console.warn('[OnChain] giveReputationFeedback (may be self-feedback guard or no reviewer key):', err?.message?.slice(0, 120));
    return { success: false, simulated: true, error: String(err?.message || err) };
  }
}
