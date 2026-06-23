// Event bus / dispatch (T071 / issue #113).
// Publish/consume with a swappable transport. The durable, append-only, replayable log models the
// constitution Art. VI event-store contract; in production the transport is Azure Service Bus and the
// durable sink is the Cosmos event-store (Anand's WS2 ca-event-store). The agent/orchestrator depends
// on the EventBus interface, not the transport.
//
// Envelope = contracts/events/schemas/platform-event.schema.json (validated on publish).
import { readFileSync, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ENVELOPE = JSON.parse(readFileSync(resolve(here, "../../contracts/schemas/platform-event.schema.json"), "utf8"));

/** Minimal envelope validation (required + eventType enum + claimId pattern). Throws on invalid. */
function validateEnvelope(ev) {
  const errs = [];
  for (const r of ENVELOPE.required) if (!(r in ev)) errs.push(`missing ${r}`);
  if (ev.eventType && !ENVELOPE.properties.eventType.enum.includes(ev.eventType)) errs.push(`eventType "${ev.eventType}" not in enum`);
  if (ev.tier && !ENVELOPE.properties.tier.enum.includes(ev.tier)) errs.push(`tier "${ev.tier}" invalid`);
  if (ev.topic && !ENVELOPE.properties.topic.enum.includes(ev.topic)) errs.push(`topic "${ev.topic}" invalid`);
  const cid = ev.correlation?.claimId;
  if (!cid || !/^[A-Z]{2}-\d{4}-\d{7}$/.test(cid)) errs.push(`correlation.claimId invalid (${cid})`);
  if (errs.length) throw new Error("invalid event: " + errs.join("; "));
}

/**
 * @typedef {Object} EventBus
 * @property {(event: object) => Promise<object>} publish  resolves the stored event (with eventId/seq)
 * @property {(topicPrefix: string, handler: (e:object)=>void) => void} subscribe
 * @property {(filter?: {claimId?: string, fromSeq?: number}) => object[]} replay
 */

/**
 * In-memory bus with an append-only log = durable replay (Art. VI). Optionally mirrors the log to a
 * JSONL file so replay survives a restart (the "durable" AC) without standing up Cosmos locally.
 * @implements {EventBus}
 */
export class InMemoryEventBus {
  /** @param {{ persistPath?: string }} [opts] */
  constructor(opts = {}) {
    this._log = [];
    this._subs = [];
    this._seq = 0;
    this._persist = opts.persistPath ?? null;
    if (this._persist) {
      mkdirSync(dirname(this._persist), { recursive: true });
      if (existsSync(this._persist)) {
        for (const line of readFileSync(this._persist, "utf8").split("\n").filter(Boolean)) {
          const e = JSON.parse(line); this._log.push(e); this._seq = Math.max(this._seq, e.sequenceNumber);
        }
      }
    }
  }
  async publish(event) {
    validateEnvelope(event);
    const stored = { ...event, eventId: event.eventId ?? `evt_${this._seq + 1}`, sequenceNumber: ++this._seq };
    this._log.push(stored);                          // append-only (immutable)
    if (this._persist) appendFileSync(this._persist, JSON.stringify(stored) + "\n");
    for (const { prefix, handler } of this._subs) if (stored.topic.startsWith(prefix)) { try { handler(stored); } catch { /* DLQ in prod */ } }
    return stored;
  }
  subscribe(topicPrefix, handler) { this._subs.push({ prefix: topicPrefix, handler }); }
  /** Deterministic ordered replay (per-claim stream or full), the audit/rebuild path. */
  replay(filter = {}) {
    let evs = this._log;
    if (filter.claimId) evs = evs.filter((e) => e.correlation?.claimId === filter.claimId);
    if (filter.fromSeq != null) evs = evs.filter((e) => e.sequenceNumber >= filter.fromSeq);
    return [...evs].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  }
}

/**
 * Service Bus transport stub — the production swap. Same interface; publishes to a topic and the
 * Cosmos event-store consumer appends durably. Not implemented in staging.
 * @implements {EventBus}
 */
export class ServiceBusEventBus {
  constructor(cfg) { this._cfg = cfg; }
  async publish() { throw new Error("ServiceBusEventBus.publish: wire to sb-adp-claims-df + ca-event-store. Not implemented in staging."); }
  subscribe() { throw new Error("ServiceBusEventBus.subscribe: wire to a Service Bus subscription. Not implemented in staging."); }
  replay() { throw new Error("ServiceBusEventBus.replay: replay from the Cosmos event-store. Not implemented in staging."); }
}

export function getBus(opts = {}) {
  const kind = opts.kind ?? process.env.EVENT_BUS ?? "memory";
  if (kind === "memory") return new InMemoryEventBus(opts);
  if (kind === "servicebus") return new ServiceBusEventBus(opts);
  throw new Error(`Unknown EVENT_BUS: ${kind}`);
}
