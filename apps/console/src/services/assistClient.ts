// POST /api/assist: the member-facing assistant. Context is assembled server-side and
// scoped to the signed-in member; the browser only ever sends the conversation.
// Shape mirrors Functions/MemberAssist.cs.

import { resolveApiBase } from "./config";

export interface AssistMessage {
  role: "user" | "assistant";
  content: string;
}

export async function askAssist(
  industry: string,
  memberId: string,
  messages: AssistMessage[],
): Promise<string> {
  const base = resolveApiBase();
  const res = await fetch(`${base}/assist`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ industry, memberId, messages }),
  });
  if (!res.ok) throw new Error(`askAssist: HTTP ${res.status} ${res.statusText}`);
  const body = (await res.json()) as { reply?: string };
  return body.reply ?? "";
}
