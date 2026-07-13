// POST /api/assist: the member-facing assistant. Context is assembled server-side and
// scoped to the signed-in member; the browser only ever sends the conversation.
// Shape mirrors Functions/MemberAssist.cs.

import { resolveApiBase } from "./config";

export interface AssistMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CopilotAnswer {
  reply: string;
  toolsUsed: string[];
  followUps: string[];
}

// POST /api/copilot: the operator copilot (platform console). A Microsoft Agent Framework
// agent with journal, records, and Fabric Data Agent tools; toolsUsed feeds source chips
// and followUps feed the contextual next-question chips.
export async function askCopilot(messages: AssistMessage[]): Promise<CopilotAnswer> {
  const base = resolveApiBase();
  const res = await fetch(`${base}/copilot`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) throw new Error(`askCopilot: HTTP ${res.status} ${res.statusText}`);
  const body = (await res.json()) as Partial<CopilotAnswer>;
  return { reply: body.reply ?? "", toolsUsed: body.toolsUsed ?? [], followUps: body.followUps ?? [] };
}

export interface AssistAnswer {
  reply: string;
  followUps: string[];
}

export async function askAssist(
  industry: string,
  memberId: string,
  messages: AssistMessage[],
): Promise<AssistAnswer> {
  const base = resolveApiBase();
  const res = await fetch(`${base}/assist`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ industry, memberId, messages }),
  });
  if (!res.ok) throw new Error(`askAssist: HTTP ${res.status} ${res.statusText}`);
  const body = (await res.json()) as Partial<AssistAnswer>;
  return { reply: body.reply ?? "", followUps: body.followUps ?? [] };
}
