import { ERC8004 } from './mantle';

export type AgentRole = 'conductor' | 'executor' | 'rwa' | 'researcher' | 'risk';

export interface Agent {
  id: number;
  role: AgentRole;
  name: string;
  description: string;
  cardUrl: string;
  color: string;
}

export interface Decision {
  id: number;
  agentId: number;
  agentRole: AgentRole;
  timestamp: number;
  task: string;
  reasoning: string;
  action: string;
  result: string;
  relatedTx?: string;
  isOnchain: boolean;
  logId?: number;
}

export interface ResearchData {
  mETH_APY: number;
  USDY_APY: number;
  mETH: string;
  USDY: string;
  LBFactory: string;
  source: string;
}

export const MANTLE_CHAIN_ID = 5000;
export const IDENTITY_REGISTRY = ERC8004.IdentityRegistry;
