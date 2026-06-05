/**
 * Mantle + protocol constants for the Control Center (client + server).
 * Mirrors agents/src/lib/mantle.ts so both sides stay in sync.
 */

export const MANTLE_CHAIN_ID = 5000;
export const MANTLE_RPC = 'https://rpc.mantle.xyz';

export const TOKENS = {
  mETH: '0xcDA86A272531e8640cD7F1a92c01839911B90bb0',
  USDY: '0x5bE26527e817998A7206475496fDE1E68957c5A6',
  WETH: '0xdEAddEaDdeadDEadDEADDEAddEADDEAddead1111',
} as const;

export const MERCHANT_MOE = {
  LBFactory: '0xa6630671775c4EA2743840F9A5016dCf2A104054',
  LBRouter: '0x013e138EF6008ae5FDFDE29700e3f2Bc61d21E3a',
};

export const ERC8004 = {
  IdentityRegistry: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
  ReputationRegistry: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63',
};

export const MANTLESCAN = 'https://mantlescan.xyz';
export const EIGHT04SCAN = 'https://8004scan.io';

export const DEFAULT_METH_APY = 2.01;
export const DEFAULT_USDY_APY = 4.65;

export const RESEARCH_DATA = {
  mETH_APY: DEFAULT_METH_APY,
  USDY_APY: DEFAULT_USDY_APY,
  mETH: TOKENS.mETH,
  USDY: TOKENS.USDY,
  LBFactory: MERCHANT_MOE.LBFactory,
  source: 'mETH Protocol • Ondo Finance docs • Merchant Moe LB contracts + live RPC metadata reads (symbols, decimals, totalSupply, block in agents layer) + Pyth via mantle-agent-kit-sdk when available',
} as const;

/**
 * Mirrors agents research for UI/API consistency.
 * Note: actual live RPC (incl. supply, block, Moe LB pairs) happens in agents layer and server API; helpers for surfacing.
 */
export function getResearchNote(block?: number | bigint | null) {
  return block != null ? ` | Live RPC research verified at Mantle block ${Number(block)}` : '';
}

export interface LiveResearchData {
  block?: number;
  mETHSupply?: string;
  note: string;
}
