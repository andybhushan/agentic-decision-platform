import * as signalR from "@microsoft/signalr";

// SignalR live-tail client. Subscribes to per-subject step events emitted by the Durable activity.
// Wire shape matches SignalRStepSink.PublishAsync — keep in sync.

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

function resolveApiBase(): string {
  if (typeof window !== "undefined") {
    const q = new URLSearchParams(window.location.search).get("api");
    if (q) return q.replace(/\/+$/, "");
  }
  const env = (import.meta.env.VITE_TRACES_API as string | undefined)?.trim();
  if (env) return env.replace(/\/+$/, "");
  return "/api";
}

export interface LiveTailConnection {
  stop(): Promise<void>;
}

export async function subscribeLiveTail(
  subjectId: string,
  onStep: (evt: LiveStepEvent) => void,
  onStateChange?: (state: string) => void,
): Promise<LiveTailConnection> {
  const base = resolveApiBase();
  const negotiateUrl = `${base}/negotiate?subject=${encodeURIComponent(subjectId)}`;

  const connection = new signalR.HubConnectionBuilder()
    .withUrl(negotiateUrl, {
      // The Functions Negotiate output is the raw payload (url + accessToken),
      // not the protocol-level negotiate; pass it as `customAccessTokenFactory` would
      // expect — but the @microsoft/signalr client handles the standard shape natively
      // when withUrl points to the negotiate URL.
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
    stop: async () => { await connection.stop(); },
  };
}
