import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getModelNode as getArchivedModelNode,
  getSubflow as getArchivedSubflow,
  modelNodes as archivedModelNodes,
  subflows as archivedSubflows,
  topEdges as archivedTopEdges,
  type ModelNode,
  type Subflow,
  type SubflowEdge,
} from '../data/claimsModel';
import { api } from '../services/api';

interface ClaimsModelData {
  nodes: ModelNode[];
  subflows: Subflow[];
  topEdges: SubflowEdge[];
}

interface ClaimsModelLoadResult {
  model: ClaimsModelData;
  usingFallback: boolean;
  error: string | null;
}

const archivedClaimsModel: ClaimsModelData = {
  nodes: Object.keys(archivedModelNodes)
    .map((id) => getArchivedModelNode(id))
    .filter((node): node is ModelNode => Boolean(node)),
  subflows: Object.keys(archivedSubflows)
    .map((id) => getArchivedSubflow(id))
    .filter((subflow): subflow is Subflow => Boolean(subflow)),
  topEdges: archivedTopEdges,
};

let cachedResult: ClaimsModelLoadResult | null = null;
let loadPromise: Promise<ClaimsModelLoadResult> | null = null;

function fallbackResult(error: unknown): ClaimsModelLoadResult {
  return {
    model: archivedClaimsModel,
    usingFallback: true,
    error: error instanceof Error ? error.message : 'Failed to load claims model',
  };
}

async function loadClaimsModel(): Promise<ClaimsModelLoadResult> {
  if (cachedResult) {
    return cachedResult;
  }

  if (!loadPromise) {
    loadPromise = api
      .getClaimsModel()
      .then((model) => ({ model, usingFallback: false, error: null }))
      .catch((error: unknown) => fallbackResult(error))
      .then((result) => {
        cachedResult = result;
        return result;
      })
      .finally(() => {
        loadPromise = null;
      });
  }

  return loadPromise;
}

export const useClaimsModel = () => {
  const [model, setModel] = useState<ClaimsModelData | null>(cachedResult?.model ?? null);
  const [loading, setLoading] = useState(!cachedResult);
  const [error, setError] = useState<string | null>(cachedResult?.error ?? null);
  const [usingFallback, setUsingFallback] = useState(cachedResult?.usingFallback ?? false);

  useEffect(() => {
    let cancelled = false;

    loadClaimsModel()
      .then((result) => {
        if (cancelled) return;
        setModel(result.model);
        setUsingFallback(result.usingFallback);
        setError(result.error);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const nodes = model?.nodes ?? [];
  const subflows = model?.subflows ?? [];
  const topEdges = model?.topEdges ?? [];

  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const subflowMap = useMemo(() => new Map(subflows.map((subflow) => [subflow.parentId, subflow])), [subflows]);

  const getModelNode = useCallback((id: string) => nodeMap.get(id), [nodeMap]);
  const getSubflow = useCallback((id: string) => subflowMap.get(id), [subflowMap]);
  const getSubflowNode = useCallback(
    (subflowId: string, nodeId: string) => subflowMap.get(subflowId)?.nodes.find((node) => node.id === nodeId),
    [subflowMap],
  );

  return {
    nodes,
    subflows,
    topEdges,
    getSubflow,
    getModelNode,
    getSubflowNode,
    loading,
    error,
    usingFallback,
  };
};
