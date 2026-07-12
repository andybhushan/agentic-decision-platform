import * as signalR from "@microsoft/signalr";
import { resolveApiBase } from "./config";

// SignalR live-tail client. Subscribes to per-subject step events emitted by the Durable activity.
// Wire shape matches SignalRStepSink.PublishAsync; keep in sync.
//
// Connection pattern (verified live 2026-07-10): the Functions negotiate endpoint at
// /api/negotiate?subject=X returns the raw Azure SignalR connection info { url, accessToken }.
// We must call it ourselves and connect to that url with the token. Do NOT point
// HubConnectionBuilder.withUrl at the negotiate endpoint: the JS client appends its own
// /negotiate segment and 404s.

export interface LiveStepEvent {
  traceId: string;
  stepId: string;
  label: string;
  agentId: string;
  confidence: number;
  status: string;
  origin: string;
  outputSummary: string;
  durationMs: number;
  hitlGateId?: string | null;
  toolCallCount?: number;
  emittedAt: string;
}

export type LiveTailState = "connected" | "reconnecting" | "closed";

export interface LiveTailConnection {
  stop(): Promise<void>;
}

interface NegotiatePayload {
  url: string;
  accessToken: string;
}

async function negotiate(subjectId: string): Promise<NegotiatePayload> {
  const base = resolveApiBase();
  const res = await fetch(`${base}/negotiate?subject=${encodeURIComponent(subjectId)}`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`negotiate: HTTP ${res.status} ${res.statusText}`);
  return (await res.json()) as NegotiatePayload;
}

export async function subscribeLiveTail(
  subjectId: string,
  onStep: (evt: LiveStepEvent) => void,
  onStateChange?: (state: LiveTailState) => void,
): Promise<LiveTailConnection> {
  const info = await negotiate(subjectId);

  const connection = new signalR.HubConnectionBuilder()
    .withUrl(info.url, {
      // Re-negotiate on every (re)connect so reconnects never ride an expired token.
      accessTokenFactory: async () => (await negotiate(subjectId)).accessToken,
    })
    .withAutomaticReconnect()
    .configureLogging(signalR.LogLevel.Warning)
    .build();

  connection.on("step", (payload: LiveStepEvent) => {
    onStep(payload);
  });

  connection.onreconnecting(() => onStateChange?.("reconnecting"));
  connection.onreconnected(() => onStateChange?.("connected"));
  connection.onclose(() => onStateChange?.("closed"));

  await connection.start();
  onStateChange?.("connected");

  return {
    stop: async () => {
      await connection.stop();
    },
  };
}
