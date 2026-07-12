import type { InteractionDoc } from './cosmosService';
import type { GovernanceConsistencyReport, GovernanceSyntheticDataset } from './governanceSyntheticTypes';
import { evaluateSyntheticConsistency, generateSyntheticGovernanceDataset } from './governanceSyntheticGenerator';

let dataset: GovernanceSyntheticDataset | null = null;
let consistency: GovernanceConsistencyReport | null = null;

export function isSyntheticGovernanceModeEnabled(): boolean {
  return dataset !== null;
}

export function getSyntheticGovernanceInteractions(): InteractionDoc[] {
  return dataset?.interactions ?? [];
}

export function getSyntheticGovernanceState(): {
  enabled: boolean;
  seed: string | null;
  generatedAt: string | null;
  windowDays: number | null;
  interactionCount: number;
  consistency: GovernanceConsistencyReport | null;
} {
  return {
    enabled: dataset !== null,
    seed: dataset?.seed ?? null,
    generatedAt: dataset?.generatedAt ?? null,
    windowDays: dataset?.windowDays ?? null,
    interactionCount: dataset?.interactions.length ?? 0,
    consistency,
  };
}

export function loadSyntheticGovernanceDataset(options: {
  seed?: string;
  windowDays?: number;
  interactionsPerAgent?: number;
} = {}): {
  dataset: GovernanceSyntheticDataset;
  consistency: GovernanceConsistencyReport;
} {
  const nextDataset = generateSyntheticGovernanceDataset({
    seed: options.seed ?? 'governance-demo-seed',
    windowDays: options.windowDays ?? 30,
    interactionsPerAgent: options.interactionsPerAgent ?? 140,
  });
  const nextConsistency = evaluateSyntheticConsistency(nextDataset);
  dataset = nextDataset;
  consistency = nextConsistency;
  return { dataset: nextDataset, consistency: nextConsistency };
}

export function resetSyntheticGovernanceDataset(): void {
  dataset = null;
  consistency = null;
}

