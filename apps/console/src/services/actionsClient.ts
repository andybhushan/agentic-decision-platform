// POST /api/actions: the governed-action write side. Journals an operator action as an
// immutable row on the subject's trace (agentId "human.operator") and pushes it on the
// SignalR tail. Shape mirrors ExecuteAction.cs.

import { resolveApiBase } from "./config";

export interface ActionRequest {
  subjectId: string;
  traceId: string;
  actionId: string;
  label: string;
  rationale?: string;
}

export interface ActionResult {
  accepted: boolean;
  subjectId: string;
  traceId: string;
  stepId: string;
  actionId: string;
  journaledAt: string;
}

export async function executeAction(request: ActionRequest): Promise<ActionResult> {
  const base = resolveApiBase();
  const res = await fetch(`${base}/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(`executeAction: HTTP ${res.status} ${res.statusText}`);
  return (await res.json()) as ActionResult;
}
