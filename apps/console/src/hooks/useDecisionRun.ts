import { useCallback, useEffect, useRef, useState } from "react";
import {
  pollUntilTerminal,
  resolveHitl,
  startRun,
  type RunStarted,
  type RunStatus,
} from "../services/runClient";
import { fetchTrace, type TraceFetchResult } from "../services/traceClient";
import {
  subscribeLiveTail,
  type LiveStepEvent,
  type LiveTailConnection,
  type LiveTailState,
} from "../services/liveTail";
import type { HitlOption, Trace } from "../services/types";

// Drives one subject's decision run end to end: SignalR live tail, orchestration start,
// status polling, the HITL gate, and the final immutable-trace fetch. Page-agnostic;
// LiveRunPage and DecisionModePage both sit on top of this.

export type RunPhase = "idle" | "starting" | "streaming" | "done" | "error";

export interface DecisionRun {
  phase: RunPhase;
  run: RunStarted | null;
  runStatus: RunStatus | null;
  liveSteps: LiveStepEvent[];
  tailState: LiveTailState | "off";
  trace: Trace | null;
  traceIsLive: boolean;
  openGate: LiveStepEvent | null;
  hitlOptions: HitlOption[];
  hitlBusy: boolean;
  error: string | null;
  start: (packageId: string, forceHitlAtAgentId?: string, backend?: string) => Promise<void>;
  resolveGate: (option: HitlOption) => Promise<void>;
  loadTrace: (traceId?: string) => Promise<void>;
  clear: () => void;
}

export function useDecisionRun(subjectId: string, onRunFinished?: () => void): DecisionRun {
  const [phase, setPhase] = useState<RunPhase>("idle");
  const [run, setRun] = useState<RunStarted | null>(null);
  const [runStatus, setRunStatus] = useState<RunStatus | null>(null);
  const [liveSteps, setLiveSteps] = useState<LiveStepEvent[]>([]);
  const [tailState, setTailState] = useState<LiveTailState | "off">("off");
  const [trace, setTrace] = useState<Trace | null>(null);
  const [traceIsLive, setTraceIsLive] = useState(false);
  const [openGate, setOpenGate] = useState<LiveStepEvent | null>(null);
  const [hitlOptions, setHitlOptions] = useState<HitlOption[]>([]);
  const [hitlBusy, setHitlBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tailRef = useRef<LiveTailConnection | null>(null);
  const runRef = useRef<RunStarted | null>(null);
  const finishedRef = useRef(onRunFinished);
  finishedRef.current = onRunFinished;

  useEffect(() => {
    return () => {
      tailRef.current?.stop().catch(() => {});
      tailRef.current = null;
    };
  }, []);

  const applyTraceResult = useCallback((result: TraceFetchResult) => {
    // The bundled demo trace is a dev fallback for the lab page, not a truth source here:
    // if the API had no live trace, show nothing rather than fiction.
    if (result.source === "live") {
      setTrace(result.trace);
      setTraceIsLive(true);
    }
  }, []);

  const loadTrace = useCallback(
    async (traceId?: string) => {
      const result = await fetchTrace(subjectId, traceId);
      applyTraceResult(result);
    },
    [subjectId, applyTraceResult],
  );

  // Blank slate for browsing to a stage that has not been run yet.
  const clear = useCallback(() => {
    setTrace(null);
    setTraceIsLive(false);
    setLiveSteps([]);
    setRunStatus(null);
    setOpenGate(null);
    setHitlOptions([]);
    setError(null);
    setPhase("idle");
  }, []);

  const onLiveStep = useCallback(
    (evt: LiveStepEvent) => {
      setLiveSteps((prev) =>
        prev.some((s) => s.stepId === evt.stepId && s.traceId === evt.traceId)
          ? prev.map((s) => (s.stepId === evt.stepId && s.traceId === evt.traceId ? evt : s))
          : [...prev, evt],
      );
      if (evt.hitlGateId && evt.status === "needs-human-review") {
        setOpenGate(evt);
        // Gate is open: the in-flight trace carries the declared HITL options.
        fetchTrace(subjectId, evt.traceId)
          .then((t) => {
            if (t.source === "live") setHitlOptions(t.trace.hitlOptions ?? []);
          })
          .catch(() => {});
      }
      if (evt.hitlGateId && evt.status === "completed") {
        setOpenGate(null);
      }
    },
    [subjectId],
  );

  const start = useCallback(
    async (packageId: string, forceHitlAtAgentId?: string, backend?: string) => {
      setPhase("starting");
      setError(null);
      setLiveSteps([]);
      setRunStatus(null);
      setOpenGate(null);
      setHitlOptions([]);

      try {
        await tailRef.current?.stop().catch(() => {});
        tailRef.current = null;

        const started = await startRun(subjectId, packageId, forceHitlAtAgentId, backend);
        setRun(started);
        runRef.current = started;

        tailRef.current = await subscribeLiveTail(subjectId, onLiveStep, (s) => setTailState(s));
        setPhase("streaming");

        const terminal = await pollUntilTerminal(started.runId, (s) => setRunStatus(s), { intervalMs: 2500 });

        await tailRef.current?.stop().catch(() => {});
        tailRef.current = null;
        setTailState("off");
        setOpenGate(null);

        const result = await fetchTrace(subjectId, terminal.result?.traceId);
        applyTraceResult(result);
        setPhase(terminal.status === "Completed" ? "done" : "error");
        if (terminal.status !== "Completed") setError(`Run ended with status ${terminal.status}`);
        finishedRef.current?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setPhase("error");
        await tailRef.current?.stop().catch(() => {});
        tailRef.current = null;
        setTailState("off");
      }
    },
    [subjectId, onLiveStep, applyTraceResult],
  );

  const resolveGate = useCallback(async (option: HitlOption) => {
    const current = runRef.current;
    if (!current) return;
    setHitlBusy(true);
    try {
      await resolveHitl(current.runId, option.optionId, option.overrideOutput);
      // The gate step flips to completed on the live tail; onLiveStep clears openGate.
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setHitlBusy(false);
    }
  }, []);

  return {
    phase,
    run,
    runStatus,
    liveSteps,
    tailState,
    trace,
    traceIsLive,
    openGate,
    hitlOptions,
    hitlBusy,
    error,
    start,
    resolveGate,
    loadTrace,
    clear,
  };
}
