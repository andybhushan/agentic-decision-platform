// POST /api/intake: a new subject enters the platform at runtime. The server assigns the
// next subject id following the corpus's own pattern and stores the record durably; the
// subject is immediately runnable and queued. Shape mirrors PostIntake.cs.

import { resolveApiBase } from "./config";

export interface IntakeResult {
  subjectId: string;
  industry: string;
  useCase: string;
  channel: string;
  receivedAt: string;
}

export async function submitIntake(industry: string, channel: string, record: unknown): Promise<IntakeResult> {
  const base = resolveApiBase();
  const res = await fetch(`${base}/intake`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ industry, channel, record }),
  });
  if (!res.ok) throw new Error(`submitIntake: HTTP ${res.status} ${res.statusText}`);
  return (await res.json()) as IntakeResult;
}
