/**
 * Contract addresses and ABIs for Conductor on Mantle.
 * Update these after every deployment + registration.
 */

import { ERC8004, MANTLE_CHAIN_ID as CHAIN } from './mantle';

export const MANTLE_CHAIN_ID = CHAIN;

export const DECISION_LOGGER_ADDRESS = (process.env.NEXT_PUBLIC_DECISION_LOGGER_ADDRESS || '0x40E51Bdc032F31cb394BBCCF63f66Ac65CAd8807') as `0x${string}`; // Use NEXT_PUBLIC_DECISION_LOGGER_ADDRESS env var for Vercel etc. Current default is the deployed testnet address.

export const IS_LIVE_ONCHAIN = DECISION_LOGGER_ADDRESS !== '0x0000000000000000000000000000000000000000';

export const IDENTITY_REGISTRY = ERC8004.IdentityRegistry;
export const REPUTATION_REGISTRY = ERC8004.ReputationRegistry;

// Full DecisionLogger ABI (strengthened version with metrics, economy, verification, parent chains).
// Update DECISION_LOGGER_ADDRESS after every deploy.
export const DECISION_LOGGER_ABI = [
  {
    "inputs": [
      { "internalType": "uint256", "name": "agentId", "type": "uint256" },
      { "internalType": "string", "name": "task", "type": "string" },
      { "internalType": "string", "name": "reasoning", "type": "string" },
      { "internalType": "string", "name": "action", "type": "string" },
      { "internalType": "string", "name": "result", "type": "string" },
      { "internalType": "bytes32", "name": "relatedTx", "type": "bytes32" }
    ],
    "name": "logDecision",
    "outputs": [{ "internalType": "uint256", "name": "logId", "type": "uint256" }],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "agentId", "type": "uint256" },
      { "internalType": "string", "name": "task", "type": "string" },
      { "internalType": "string", "name": "reasoning", "type": "string" },
      { "internalType": "string", "name": "action", "type": "string" },
      { "internalType": "string", "name": "result", "type": "string" },
      { "internalType": "uint256", "name": "blendedAPY", "type": "uint256" },
      { "internalType": "uint256", "name": "riskScoreBps", "type": "uint256" },
      { "internalType": "uint256", "name": "liquidityScoreBps", "type": "uint256" },
      { "internalType": "uint256", "name": "serviceFeesTotal", "type": "uint256" },
      { "internalType": "bytes32", "name": "relatedTx", "type": "bytes32" },
      { "internalType": "uint256", "name": "parentDecisionId", "type": "uint256" },
      { "internalType": "string", "name": "allocationJson", "type": "string" },
      { "internalType": "bytes32", "name": "reasoningHash", "type": "bytes32" }
    ],
    "name": "logDecisionWithMetrics",
    "outputs": [{ "internalType": "uint256", "name": "logId", "type": "uint256" }],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "payerAgentId", "type": "uint256" },
      { "internalType": "uint256", "name": "payeeAgentId", "type": "uint256" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" },
      { "internalType": "string", "name": "service", "type": "string" },
      { "internalType": "uint256", "name": "decisionLogId", "type": "uint256" }
    ],
    "name": "recordServicePayment",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "agentId", "type": "uint256" }],
    "name": "verifyAgentWithERC8004",
    "outputs": [{ "internalType": "bool", "name": "verified", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "agentId", "type": "uint256" }],
    "name": "getAgentStats",
    "outputs": [
      { "internalType": "uint256", "name": "count", "type": "uint256" },
      { "internalType": "uint256", "name": "avgRiskBps", "type": "uint256" },
      { "internalType": "uint256", "name": "totalServiceFees", "type": "uint256" },
      { "internalType": "uint256", "name": "lastDecisionId", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "logId", "type": "uint256" }],
    "name": "getDecision",
    "outputs": [
      {
        "components": [
          { "internalType": "uint256", "name": "agentId", "type": "uint256" },
          { "internalType": "uint256", "name": "timestamp", "type": "uint256" },
          { "internalType": "string", "name": "task", "type": "string" },
          { "internalType": "string", "name": "reasoning", "type": "string" },
          { "internalType": "string", "name": "action", "type": "string" },
          { "internalType": "string", "name": "result", "type": "string" },
          { "internalType": "bytes32", "name": "relatedTx", "type": "bytes32" },
          { "internalType": "address", "name": "caller", "type": "address" },
          { "internalType": "uint256", "name": "blendedAPY", "type": "uint256" },
          { "internalType": "uint256", "name": "riskScoreBps", "type": "uint256" },
          { "internalType": "uint256", "name": "liquidityScoreBps", "type": "uint256" },
          { "internalType": "uint256", "name": "serviceFeesTotal", "type": "uint256" },
          { "internalType": "uint256", "name": "parentDecisionId", "type": "uint256" },
          { "internalType": "string", "name": "allocationJson", "type": "string" },
          { "internalType": "bytes32", "name": "reasoningHash", "type": "bytes32" }
        ],
        "internalType": "struct DecisionLogger.Decision",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getDecisionCount",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "count", "type": "uint256" }],
    "name": "getRecentDecisions",
    "outputs": [
      {
        "components": [
          { "internalType": "uint256", "name": "agentId", "type": "uint256" },
          { "internalType": "uint256", "name": "timestamp", "type": "uint256" },
          { "internalType": "string", "name": "task", "type": "string" },
          { "internalType": "string", "name": "reasoning", "type": "string" },
          { "internalType": "string", "name": "action", "type": "string" },
          { "internalType": "string", "name": "result", "type": "string" },
          { "internalType": "bytes32", "name": "relatedTx", "type": "bytes32" },
          { "internalType": "address", "name": "caller", "type": "address" },
          { "internalType": "uint256", "name": "blendedAPY", "type": "uint256" },
          { "internalType": "uint256", "name": "riskScoreBps", "type": "uint256" },
          { "internalType": "uint256", "name": "liquidityScoreBps", "type": "uint256" },
          { "internalType": "uint256", "name": "serviceFeesTotal", "type": "uint256" },
          { "internalType": "uint256", "name": "parentDecisionId", "type": "uint256" },
          { "internalType": "string", "name": "allocationJson", "type": "string" },
          { "internalType": "bytes32", "name": "reasoningHash", "type": "bytes32" }
        ],
        "internalType": "struct DecisionLogger.Decision[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "agentId", "type": "uint256" }, { "internalType": "address", "name": "operator", "type": "address" }],
    "name": "registerAgent",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "logId", "type": "uint256" }, { "internalType": "string", "name": "actionType", "type": "string" }, { "internalType": "bytes", "name": "data", "type": "bytes" }],
    "name": "simulateDeFiAction",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "withdrawAccumulatedFees",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "accumulatedFees",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "logId", "type": "uint256" },
      { "indexed": true, "internalType": "uint256", "name": "agentId", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" },
      { "indexed": false, "internalType": "string", "name": "task", "type": "string" },
      { "indexed": false, "internalType": "string", "name": "action", "type": "string" },
      { "indexed": false, "internalType": "bytes32", "name": "relatedTx", "type": "bytes32" }
    ],
    "name": "DecisionLogged",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "logId", "type": "uint256" },
      { "indexed": true, "internalType": "uint256", "name": "agentId", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "blendedAPY", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "riskScoreBps", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "liquidityScoreBps", "type": "uint256" }
    ],
    "name": "DecisionLoggedWithMetrics",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "payerAgentId", "type": "uint256" },
      { "indexed": true, "internalType": "uint256", "name": "payeeAgentId", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" },
      { "indexed": false, "internalType": "string", "name": "service", "type": "string" },
      { "indexed": true, "internalType": "uint256", "name": "decisionLogId", "type": "uint256" }
    ],
    "name": "ServiceFeePaid",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "logId", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" },
      { "indexed": false, "internalType": "address", "name": "payer", "type": "address" }
    ],
    "name": "FeeReceived",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "logId", "type": "uint256" },
      { "indexed": false, "internalType": "string", "name": "actionType", "type": "string" },
      { "indexed": false, "internalType": "bytes", "name": "data", "type": "bytes" }
    ],
    "name": "DeFiActionSimulated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "agentId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "registry", "type": "address" },
      { "indexed": false, "internalType": "bool", "name": "success", "type": "bool" },
      { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }
    ],
    "name": "AgentVerified",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "to", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "FeesWithdrawn",
    "type": "event"
  }
] as const;

// ERC-8004 IdentityRegistry (minimal for registration & lookup)
export const IDENTITY_REGISTRY_ABI = [
  {
    "inputs": [{ "internalType": "string", "name": "agentURI", "type": "string" }],
    "name": "register",
    "outputs": [{ "internalType": "uint256", "name": "agentId", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "agentId", "type": "uint256" }],
    "name": "tokenURI",
    "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "agentId", "type": "uint256" }],
    "name": "ownerOf",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;
