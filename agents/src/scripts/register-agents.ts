/**
 * Register all Conductor agents in the canonical Mantle ERC-8004 IdentityRegistry.
 *
 * Prerequisites:
 *   - DEPLOYER_PRIVATE_KEY with MNT for gas
 *   - Agent card JSONs hosted at stable public URLs (Vercel / GitHub raw / IPFS)
 *
 * After successful registration, copy the returned agentIds into:
 *   - web/app/page.tsx (AGENTS array)
 *   - agent cards themselves (registrations field)
 *   - contracts deployment notes
 *
 * Usage:
 *   cd agents && npm run register
 */

import { createWalletClient, createPublicClient, http, type Hex, parseEventLogs } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mantle } from 'viem/chains';

import { ERC8004 } from '../lib/mantle.js';

const IDENTITY_REGISTRY = ERC8004.IdentityRegistry as Hex;

// Full minimal ABI from ERC-8004 spec (register + optional metadata + views)
const IDENTITY_ABI = [
  {
    inputs: [{ name: 'agentURI', type: 'string' }],
    name: 'register',
    outputs: [{ name: 'agentId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'agentURI', type: 'string' },
      {
        name: 'metadata',
        type: 'tuple[]',
        components: [
          { name: 'metadataKey', type: 'string' },
          { name: 'metadataValue', type: 'bytes' },
        ],
      },
    ],
    name: 'register',
    outputs: [{ name: 'agentId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'agentId', type: 'uint256' }, { name: 'metadataKey', type: 'string' }],
    name: 'getMetadata',
    outputs: [{ name: '', type: 'bytes' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// ReputationRegistry ABI (from erc-8004/erc-8004-contracts abis) for post-registration feedback
// This deepens ERC-8004 usage: after identity, agents can receive on-chain reputation signals
// using real decision metrics (blendedAPY/risk) from Conductor runs (see onchain-logger + conductor).
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

const ERC721_TRANSFER_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: true, name: 'tokenId', type: 'uint256' },
    ],
    name: 'Transfer',
    type: 'event',
  },
] as const;

async function main() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY as Hex;
  if (!pk) {
    console.error('❌ Set DEPLOYER_PRIVATE_KEY in .env');
    process.exit(1);
  }

  const account = privateKeyToAccount(pk);
  const wallet = createWalletClient({ account, chain: mantle, transport: http(process.env.MANTLE_RPC || 'https://rpc.mantle.xyz') });
  const publicClient = createPublicClient({ chain: mantle, transport: http(process.env.MANTLE_RPC || 'https://rpc.mantle.xyz') });

  console.log('Registering Conductor agents on Mantle IdentityRegistry...');
  console.log('Operator:', account.address);
  console.log('');

  // After deploying web to Vercel (or using GitHub Pages / IPFS), replace with permanent URLs.
  // The cards were written based on deep research of the ERC-8004 spec + actual Mantle addresses.
  const cards = {
    conductor: 'https://your-vercel.app/agent-cards/conductor.json',
    executor: 'https://your-vercel.app/agent-cards/trading-executor.json',
    rwa: 'https://your-vercel.app/agent-cards/rwa-optimizer.json',
    researcher: 'https://your-vercel.app/agent-cards/researcher.json',
    risk: 'https://your-vercel.app/agent-cards/risk-manager.json',
  };

  const agentsToRegister = [
    { name: 'Conductor', uri: cards.conductor },
    { name: 'Trading Executor', uri: cards.executor },
    { name: 'RWA Optimizer', uri: cards.rwa },
    { name: 'Researcher', uri: cards.researcher || 'https://your-vercel.app/agent-cards/researcher.json' },
    { name: 'Risk Manager', uri: cards.risk || 'https://your-vercel.app/agent-cards/risk-manager.json' },
  ];

  const registered: { name: string; agentId?: number; tx: string }[] = [];

  for (const a of agentsToRegister) {
    console.log(`→ Registering ${a.name}...`);
    try {
      const hash = await wallet.writeContract({
        address: IDENTITY_REGISTRY,
        abi: IDENTITY_ABI,
        functionName: 'register',
        args: [a.uri],
      });
      console.log('  tx:', hash);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      // Parse real ERC-721 Transfer to get the exact minted agentId (uint256, matches DecisionLogger + 8004)
      let agentId: number | undefined;
      try {
        const transferLogs = parseEventLogs({
          abi: ERC721_TRANSFER_ABI,
          logs: receipt.logs,
          eventName: 'Transfer',
        });
        const mintedLog = transferLogs.find((l: any) => (l.args?.to || '').toLowerCase() === account.address.toLowerCase());
        if (mintedLog?.args?.tokenId != null) {
          agentId = Number(mintedLog.args.tokenId);
        }
      } catch {}
      if (!agentId) {
        // Fallback: often sequential; log note
        console.log('  (could not auto-parse tokenId from logs — check receipt on mantlescan)');
      }

      console.log(`  ✅ ${a.name} registered. agentId=${agentId ?? '?'} (use this exact number in UI/agents/exports)`);
      registered.push({ name: a.name, agentId, tx: hash });

      // === Deepened ERC-8004: post a sample reputation feedback (from erc-8004/awesome + spec) ===
      // Uses giveFeedback on ReputationRegistry with metrics-style value. In real runs Conductor posts
      // live blendedAPY/risk/liquidity feedback after DecisionLogger log (see future onchain-logger extension).
      // Self-feedback (owner->own agent) is prevented by registry; use DEMO_REVIEWER_PK for a distinct client.
      const reviewerPk = process.env.DEMO_REVIEWER_PK as Hex | undefined;
      if (reviewerPk && agentId != null) {
        try {
          const reviewer = privateKeyToAccount(reviewerPk);
          const reviewerWallet = createWalletClient({ account: reviewer, chain: mantle, transport: http(process.env.MANTLE_RPC || 'https://rpc.mantle.xyz') });
          const fbHash = await reviewerWallet.writeContract({
            address: ERC8004.ReputationRegistry as Hex,
            abi: REPUTATION_ABI,
            functionName: 'giveFeedback',
            args: [
              BigInt(agentId),
              BigInt(8700), // 87.00 — positive demo score from "portfolio performance"
              2,
              'hackathon-demo',
              'conductor-orchestra',
              'https://conductor-agent.vercel.app',
              '', // feedbackURI can point to Decision export
              '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex,
            ],
          });
          console.log(`  + Reputation feedback tx for ${a.name}: ${fbHash}`);
        } catch (fbErr) {
          console.log(`  (Reputation giveFeedback skipped/demo-only: ${(fbErr as Error).message?.slice(0,80)})`);
        }
      } else if (agentId != null) {
        console.log(`  (To post live Reputation feedback, set DEMO_REVIEWER_PK and re-run; or call giveFeedback from a non-owner client using agentId=${agentId})`);
      }

      console.log('');
    } catch (e) {
      console.error(`  Failed to register ${a.name}:`, e);
    }
  }

  console.log('Done. Update references with exact agentIds printed above (and in cards/AGENTS).');
  console.log('Registered summary:', registered);

  // === Top-team convenience: ready-to-paste updates for frontend + cards ===
  if (registered.length > 0) {
    console.log('\n========== COPY-PASTE READY UPDATES ==========');
    console.log('// 1. In web/app/page.tsx — replace the AGENTS ids if they differ from 1,2,3:');
    registered.forEach((r, idx) => {
      if (r.agentId) console.log(`// ${r.name}: id: ${r.agentId}`);
    });
    console.log('\n// 2. Update agent cards registrations (in public/agent-cards/*.json and hosted versions):');
    console.log('Add to each card:');
    console.log('  "registrations": [');
    registered.forEach((r, i) => {
      if (r.agentId) {
        console.log(`    { "agentRegistry": "eip155:5000:${ERC8004.IdentityRegistry}", "agentId": ${r.agentId} }${i < registered.length-1 ? ',' : ''}`);
      }
    });
    console.log('  ]');
    console.log('========================================================\n');
  }
}

main();
