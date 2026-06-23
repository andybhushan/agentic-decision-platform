// Feedback capture (T072 / issue #114). NET-NEW (not in the WS2 pack).
// Captures adjuster feedback on a decision disposition as labeled events for later prompt-tuning/eval.
// MVP = CAPTURE ONLY (no auto-tuning). Emits a Tier-2 `feedback.captured` PlatformEvent onto the bus,
// so feedback lands in the same append-only spine (Art. VI) and is replayable. The exported set is the
// seed for the ASSERT eval harness (#119) and the prompt-tuning loop (#123) — capture now, automate later.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const LABELS = ["agreed", "overrode", "corrected"];

/**
 * Capture one feedback item.
 * @param {import("../event-bus/bus.mjs").EventBus} bus
 * @param {{ claimId: string, decisionId: string, label: "agreed"|"overrode"|"corrected", reason?: string, correctedValue?: string, actor: {id: string, role?: string}, correlationId?: string }} fb
 */
export async function captureFeedback(bus, fb) {
  if (!LABELS.includes(fb.label)) throw new Error(`label must be one of ${LABELS.join("/")}`);
  if (!fb.decisionId) throw new Error("decisionId required");
  return bus.publish({
    tier: "decision",
    eventType: "feedback.captured",
    topic: "platform.feedback",
    schemaVersion: "1",
    timestamp: new Date().toISOString(),
    producedBy: "decision-queue-ui",
    actor: { type: "human", id: fb.actor.id, role: fb.actor.role ?? "adjuster" },
    correlation: { claimId: fb.claimId, decisionId: fb.decisionId, correlationId: fb.correlationId ?? "feedback" },
    payload: { decisionId: fb.decisionId, label: fb.label, reason: fb.reason, correctedValue: fb.correctedValue },
  });
}

/**
 * Export all captured feedback from the bus into an eval-ready dataset (grouped + summarized).
 * This is the hand-off point to #119 (ASSERT) / #123 (tuning) — but does NOT tune anything (MVP).
 */
export function exportFeedback(bus, outPath) {
  const items = bus.replay({}).filter((e) => e.eventType === "feedback.captured").map((e) => ({
    claimId: e.correlation.claimId, decisionId: e.payload.decisionId, label: e.payload.label,
    reason: e.payload.reason ?? null, correctedValue: e.payload.correctedValue ?? null, capturedAt: e.timestamp,
  }));
  const summary = { total: items.length, byLabel: LABELS.reduce((a, l) => ((a[l] = items.filter((i) => i.label === l).length), a), {}) };
  // override rate = a key F8/F9 KPI (override + correct vs total)
  summary.overrideRate = items.length ? +(((summary.byLabel.overrode + summary.byLabel.corrected) / items.length).toFixed(3)) : 0;
  if (outPath) { mkdirSync(dirname(outPath), { recursive: true }); writeFileSync(outPath, JSON.stringify({ summary, items }, null, 2) + "\n"); }
  return { summary, items };
}
