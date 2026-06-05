/**
 * Beautiful standalone demo runner.
 * Run with: cd agents && npm run demo
 * It will execute a full Conductor trace (mock or real LLM) and log decisions on-chain (if configured).
 */

import { runConductor } from './index.js';

const GOAL = process.argv.slice(2).join(' ') || 
  "Optimize income of my portfolio with risk no higher than 7%, with strong focus on mETH and USDY";

console.log('🎼 Starting Conductor standalone demo...\n');

runConductor(GOAL)
  .then((result) => {
    console.log('\n========== FINAL SUMMARY ==========');
    console.log(result.summary);
    console.log('\nAll decisions have been (or will be) written to DecisionLogger on Mantle.');
    console.log('Open the Control Center frontend to see the beautiful timeline + on-chain proofs.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Demo failed:', err);
    process.exit(1);
  });
