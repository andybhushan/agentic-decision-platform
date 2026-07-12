import { useEffect, useState } from 'react';
import { api } from '../services/api';
import {
  workforces as archivedWorkforces,
  type Workforce,
  type WorkforceStage,
  type WorkforceMember,
  type FoundMember,
  type CoordinatedWorker,
} from '../data/claimsWorkforce.seed';

export const useWorkforces = () => {
  const [workforces, setWorkforces] = useState<Workforce[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;

    api
      .getWorkforces()
      .then((data) => {
        if (cancelled) return;
        setWorkforces(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setWorkforces(archivedWorkforces);
        setUsingFallback(true);
        setError(err instanceof Error ? err.message : 'Failed to load workforces');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { workforces, loading, error, usingFallback };
};

export function findMember(workforces: Workforce[], memberId: string): FoundMember | undefined {
  for (const workforce of workforces) {
    for (const stage of workforce.stages) {
      const member = stage.members.find((candidate) => candidate.id === memberId);
      if (member) {
        return { member, stage, workforce };
      }
    }
  }
  return undefined;
}

export function findStageById(workforces: Workforce[], stageId: string): WorkforceStage | undefined {
  for (const workforce of workforces) {
    const stage = workforce.stages.find((candidate) => candidate.id === stageId);
    if (stage) {
      return stage;
    }
  }
  return undefined;
}

export function stageAgents(stage: WorkforceStage): WorkforceMember[] {
  return stage.members.filter((member) => member.kind !== 'orchestrator');
}

export function stageOrchestrator(stage: WorkforceStage): WorkforceMember | undefined {
  return stage.members.find((member) => member.kind === 'orchestrator');
}

export function buildCoordinationTree(
  workforces: Workforce[],
  stage: WorkforceStage,
  visited: Set<string> = new Set([stage.id]),
): CoordinatedWorker[] {
  const childIds = stage.coordinates ?? [];
  const result: CoordinatedWorker[] = [];

  for (const childId of childIds) {
    if (visited.has(childId)) continue;
    const childStage = findStageById(workforces, childId);
    if (!childStage) continue;
    const orchestrator = stageOrchestrator(childStage);
    if (!orchestrator) continue;

    visited.add(childId);
    result.push({
      stage: childStage,
      orchestrator,
      agents: stageAgents(childStage),
      children: buildCoordinationTree(workforces, childStage, visited),
    });
  }

  return result;
}
