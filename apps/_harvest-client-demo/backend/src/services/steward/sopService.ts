/**
 * SOP (Standard Operating Procedure) service — the Digital Steward's governance
 * controls.
 *
 * SOPs live as markdown documents in `backend/src/data/sops/*.md`. Each has YAML
 * front-matter (id/title/version/…) and `##`-delimited sections. This service:
 *
 *  1. loadSops()       — reads + parses every SOP, computing a SHA-256 checksum.
 *  2. getControlBlock()— returns a compact, DETERMINISTIC governance block that is
 *                        ALWAYS injected into the steward prompt. This is the true
 *                        "agent control": it does not depend on probabilistic
 *                        retrieval, so the core rules apply even if search is down.
 *  3. searchSops()     — vector retrieval over the dedicated `sop-chunks` Azure AI
 *                        Search index, with a local keyword fallback so it degrades
 *                        gracefully when AI Search is unavailable.
 *  4. syncSops()       — change detection: compares each SOP's checksum against a
 *                        persisted manifest (Cosmos `steward-sops`), re-indexes
 *                        added/changed SOPs, updates the manifest, and returns a
 *                        change report. This is "what happens when an SOP changes".
 *
 * Everything degrades gracefully: with no AI Search the control block + keyword
 * fallback still work; with no Cosmos, sync reports against an in-memory manifest.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { SearchClient, AzureKeyCredential } from '@azure/search-documents';
import { CosmosRepository } from '../cosmosRepository';
import { embedText } from '../aiSearchService';
import {
  SopCategory,
  SopDocument,
  SopFrontMatter,
  SopChunk,
  SopSearchResult,
  SopManifestEntry,
  SopSyncItem,
  SopChangeReport,
} from '../../types/steward';

// ── SOP directory resolution ────────────────────────────────────────────────
// Runs under ts-node in dev (__dirname → src/services/steward). Fall back to a
// few well-known locations so it also works from a compiled dist or an odd cwd.
function resolveSopDir(): string {
  const candidates = [
    path.resolve(__dirname, '../../data/sops'),
    path.resolve(process.cwd(), 'src/data/sops'),
    path.resolve(process.cwd(), 'backend/src/data/sops'),
    path.resolve(process.cwd(), 'dist/data/sops'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

const SOP_DIR = resolveSopDir();

// ── Front-matter parsing ────────────────────────────────────────────────────
interface ParsedFrontMatter {
  data: Record<string, string>;
  body: string;
}

/**
 * Minimal YAML front-matter parser (no js-yaml dependency). Handles simple
 * `key: value` pairs and folded scalars (`key: >` followed by indented lines).
 */
function parseFrontMatter(raw: string): ParsedFrontMatter {
  const normalized = raw.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---')) {
    return { data: {}, body: normalized };
  }
  const end = normalized.indexOf('\n---', 3);
  if (end === -1) {
    return { data: {}, body: normalized };
  }
  const fmBlock = normalized.slice(3, end).replace(/^\n/, '');
  const body = normalized.slice(end + 4).replace(/^\n/, '');

  const data: Record<string, string> = {};
  const lines = fmBlock.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const foldMatch = line.match(/^(\w[\w-]*):\s*>\s*$/);
    if (foldMatch) {
      const key = foldMatch[1];
      const collected: string[] = [];
      let j = i + 1;
      for (; j < lines.length; j++) {
        if (/^\s+\S/.test(lines[j]) || lines[j].trim() === '') {
          if (lines[j].trim() === '') continue;
          collected.push(lines[j].trim());
        } else {
          break;
        }
      }
      data[key] = collected.join(' ').trim();
      i = j - 1;
      continue;
    }
    const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (kv) {
      data[kv[1]] = kv[2].trim();
    }
  }
  return { data, body };
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// ── Loading ─────────────────────────────────────────────────────────────────
let _cache: SopDocument[] | null = null;

/** Read + parse every SOP markdown file. Cached; call reloadSops() to refresh. */
export function loadSops(): SopDocument[] {
  if (_cache) return _cache;
  const docs: SopDocument[] = [];
  let files: string[] = [];
  try {
    files = fs.readdirSync(SOP_DIR).filter((f) => f.toLowerCase().endsWith('.md'));
  } catch (err) {
    console.warn(`[SopService] Could not read SOP dir ${SOP_DIR}:`, err);
    _cache = [];
    return _cache;
  }
  for (const file of files.sort()) {
    try {
      const full = path.join(SOP_DIR, file);
      const raw = fs.readFileSync(full, 'utf8');
      const { data, body } = parseFrontMatter(raw);
      if (!data.id || !data.title) {
        console.warn(`[SopService] Skipping ${file} — missing id/title front-matter`);
        continue;
      }
      const checksum = crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
      const fm: SopFrontMatter = {
        id: data.id,
        title: data.title,
        version: data.version ?? '1.0.0',
        effectiveDate: data.effectiveDate ?? '',
        owner: data.owner ?? '',
        category: (data.category as SopCategory) ?? 'general',
        appliesTo: data.appliesTo,
        summary: data.summary,
      };
      docs.push({ ...fm, body, checksum, fileName: file });
    } catch (err) {
      console.warn(`[SopService] Failed to parse ${file}:`, err);
    }
  }
  _cache = docs;
  return _cache;
}

export function reloadSops(): SopDocument[] {
  _cache = null;
  return loadSops();
}

export function listSops(): SopFrontMatter[] {
  return loadSops().map(({ body, checksum, fileName, ...fm }) => fm);
}

export function getSopById(id: string): SopDocument | null {
  return loadSops().find((d) => d.id.toLowerCase() === id.toLowerCase()) ?? null;
}

// ── Chunking ────────────────────────────────────────────────────────────────
/** Split an SOP body into retrievable chunks, one per `##` section. */
export function chunkSop(doc: SopDocument): SopChunk[] {
  const lines = doc.body.split('\n');
  const chunks: SopChunk[] = [];
  let currentHeading = 'Overview';
  let buffer: string[] = [];

  const flush = () => {
    const content = buffer.join('\n').trim();
    if (content) {
      chunks.push({
        id: `${doc.id}::${slugify(currentHeading)}`,
        sopId: doc.id,
        title: doc.title,
        version: doc.version,
        category: doc.category,
        section: currentHeading,
        // Prefix each chunk with SOP identity so retrieved context is self-describing.
        content: `${doc.id} — ${doc.title} (v${doc.version})\nSection: ${currentHeading}\n\n${content}`,
      });
    }
    buffer = [];
  };

  for (const line of lines) {
    const h = line.match(/^##\s+(.*)$/);
    if (h) {
      flush();
      currentHeading = h[1].replace(/^\d+\.\s*/, '').trim();
    } else if (line.match(/^#\s+/)) {
      // top-level H1 title line — skip, identity already carried in content prefix
      continue;
    } else {
      buffer.push(line);
    }
  }
  flush();
  return chunks;
}

/** All chunks across all SOPs. */
export function allSopChunks(): SopChunk[] {
  return loadSops().flatMap(chunkSop);
}

// ── Deterministic control block (ALWAYS injected) ───────────────────────────
/**
 * A compact, authoritative governance block summarising the non-negotiable
 * controls. Injected into the steward system prompt on every interaction so the
 * core rules apply even without retrieval. Full detail lives in the SOP files;
 * this is the enforced summary.
 */
export function getControlBlock(): string {
  const sops = loadSops();
  const catalogue = sops
    .map((s) => `  - ${s.id} — ${s.title} (v${s.version})`)
    .join('\n');

  return [
    'GOVERNANCE CONTROLS (Standard Operating Procedures — authoritative, always apply):',
    'These SOPs are agent controls. Follow them exactly. If your suggestion would conflict with a control below, defer to the control.',
    '',
    'ESCALATION & REFERRAL (SOP-001):',
    '  - Two independent axes. Specialist referrals (SIU / Legal / Medical) are DIRECT — any adjuster may raise them immediately, regardless of seniority, with NO supervisor sign-off.',
    '  - Authority escalation is separate: only settlement/exposure ABOVE the adjuster’s limit needs a Claims Supervisor/Manager (for financial approval, not to permit the referral).',
    '  - Never tell an adjuster to route a fraud/coverage concern "up through a supervisor" before it can reach a specialist.',
    '',
    'DELEGATED SETTLEMENT AUTHORITY (SOP-002):',
    '  - Junior ≈ $5k; Senior ≈ $15k–$25k (individually assigned); Principal ≈ $50k; Lead ≈ $100k; above $100k → Claims Manager / Committee.',
    '  - Use the ACTIVE adjuster’s own limit from context. If exposure exceeds it, an authority escalation is required.',
    '',
    'FRAUD / SIU (SOP-003, SOP-011):',
    '  - Suspected fraud / staged-loss indicators → DIRECT SIU referral. A high-severity anomaly blocks auto-approval. Fraud Investigation is never auto-approved.',
    '',
    'COVERAGE (SOP-004): excluded → decision hard-blocked (deny for human review); ambiguous → escalate to Legal / senior. Do not state a coverage position before required review.',
    'INJURY (SOP-005): any injury indicated → mandatory human review regardless of amount; refer to Medical.',
    '',
    'EVIDENCE (SOP-007): if any required evidence is missing or unverified → recommend "request more information", not approve/deny. Never close an evidence gap by assumption.',
    '',
    'DECISION GOVERNANCE (SOP-010): outcomes are approve / reject / escalate / more-info. Senior approval is required for: over-limit, low confidence (<0.70), ambiguous coverage, injury, high-severity anomalies, or decision types Settlement Approval / Policy Interpretation / Fraud Investigation / Duplicate Claim Review. Straight-through processing is limited to glass-only or total-loss-obvious claims that are within authority, high-confidence, fully covered, anomaly-free, and fully verified.',
    '',
    'STAFFING (SOP-008): never route work to an "away" adjuster or beyond an adjuster’s authority limit; on leave/at-capacity, reassign to an available, skill-matched, suitably authorised adjuster.',
    '',
    'STEWARD BOUNDARY (SOP-013): you are ADVISORY ONLY. You do not approve, deny, or authorise settlements or make coverage determinations. You may execute a routing/escalation action ONLY when explicitly instructed, and must confirm and log it.',
    '',
    'SOP CATALOGUE (current versions):',
    catalogue,
  ].join('\n');
}

// ── Retrieval (AI Search with keyword fallback) ─────────────────────────────
let _searchClient: SearchClient<any> | null | undefined;

function getSopSearchClient(): SearchClient<any> | null {
  if (_searchClient !== undefined) return _searchClient;
  const endpoint = process.env.AISEARCH_ENDPOINT;
  const key = process.env.AISEARCH_KEY;
  const index = process.env.AISEARCH_SOP_INDEX_NAME || 'sop-chunks';
  if (endpoint && key) {
    try {
      _searchClient = new SearchClient(endpoint, index, new AzureKeyCredential(key));
      console.log('[SopService] Azure AI Search (SOP controls) connected →', index);
    } catch (err) {
      console.warn('[SopService] SOP AI Search init failed:', err);
      _searchClient = null;
    }
  } else {
    _searchClient = null;
  }
  return _searchClient;
}

function sanitizeKey(id: string): string {
  return id.replace(/[^A-Za-z0-9_\-=]/g, '_');
}

/**
 * Retrieve the most relevant SOP sections for a query. Tries vector search over
 * the `sop-chunks` index; falls back to a local keyword score over loaded chunks.
 */
export async function searchSops(query: string, topK = 4): Promise<SopSearchResult[]> {
  const client = getSopSearchClient();
  if (client) {
    try {
      const vector = await embedText(query);
      const select = ['id', 'sopId', 'title', 'version', 'category', 'section', 'content'] as any;
      let results;
      if (vector) {
        results = await client.search(undefined, {
          top: topK,
          select,
          vectorSearchOptions: {
            queries: [{ kind: 'vector', vector, kNearestNeighborsCount: topK, fields: ['contentVector'] }],
          },
        } as any);
      } else {
        results = await client.search(query, { top: topK, searchFields: ['content', 'section', 'title'], select });
      }
      const hits: SopSearchResult[] = [];
      for await (const r of results.results) {
        const d = r.document as any;
        const chunk: SopChunk = {
          id: d.id ?? '',
          sopId: d.sopId ?? '',
          title: d.title ?? '',
          version: d.version ?? '',
          category: (d.category as SopCategory) ?? 'general',
          section: d.section ?? '',
          content: d.content ?? '',
        };
        const raw = r.score ?? 0;
        const similarity = vector ? Math.min(Math.max(raw, 0), 1) : Math.min(raw / 10, 1);
        hits.push({ chunk, similarity });
      }
      if (hits.length > 0) return hits;
    } catch (err) {
      console.warn('[SopService] SOP AI Search query failed, using keyword fallback:', err);
    }
  }
  return keywordSearch(query, topK);
}

function keywordSearch(query: string, topK: number): SopSearchResult[] {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  if (terms.length === 0) return [];
  const scored = allSopChunks().map((chunk) => {
    const text = chunk.content.toLowerCase();
    let score = 0;
    for (const t of terms) {
      let idx = text.indexOf(t);
      while (idx !== -1) {
        score += 1;
        idx = text.indexOf(t, idx + t.length);
      }
    }
    return { chunk, similarity: Math.min(score / (terms.length * 4), 1) };
  });
  return scored
    .filter((s) => s.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

// ── Indexing + change detection (sync) ──────────────────────────────────────
const manifestRepo = new CosmosRepository<SopManifestEntry & { id: string }>('steward-sops');
let _manifestEnsured = false;

async function ensureManifest(): Promise<void> {
  if (_manifestEnsured) return;
  _manifestEnsured = true;
  await manifestRepo.ensureContainer('/id').catch(() => {});
}

/** In-memory manifest fallback when Cosmos is unavailable (per-process). */
const _memoryManifest = new Map<string, SopManifestEntry>();

async function readManifest(): Promise<Map<string, SopManifestEntry>> {
  await ensureManifest();
  if (!manifestRepo.isAvailable()) return new Map(_memoryManifest);
  try {
    const entries = await manifestRepo.findAll();
    return new Map(entries.map((e) => [e.sopId, e]));
  } catch {
    return new Map(_memoryManifest);
  }
}

async function writeManifestEntry(entry: SopManifestEntry): Promise<void> {
  _memoryManifest.set(entry.sopId, entry);
  if (!manifestRepo.isAvailable()) return;
  try {
    await manifestRepo.upsert({ ...entry, id: entry.id });
  } catch (err) {
    console.warn(`[SopService] Failed to persist manifest for ${entry.sopId}:`, err);
  }
}

async function deleteManifestEntry(sopId: string): Promise<void> {
  _memoryManifest.delete(sopId);
  if (!manifestRepo.isAvailable()) return;
  try {
    await manifestRepo.delete(sopId);
  } catch {
    /* ignore */
  }
}

/** Push one SOP's chunks into the `sop-chunks` AI Search index. */
async function indexSopChunks(doc: SopDocument): Promise<number> {
  const client = getSopSearchClient();
  const chunks = chunkSop(doc);
  if (!client) return 0;
  const docs = await Promise.all(
    chunks.map(async (chunk) => {
      const vector = await embedText(chunk.content).catch(() => null);
      return {
        id: sanitizeKey(chunk.id),
        sopId: chunk.sopId,
        title: chunk.title,
        version: chunk.version,
        category: chunk.category,
        section: chunk.section,
        content: chunk.content,
        createdAt: new Date().toISOString(),
        ...(vector ? { contentVector: vector } : {}),
      };
    }),
  );
  try {
    await client.uploadDocuments(docs);
  } catch (err) {
    console.warn(`[SopService] Failed to index chunks for ${doc.id}:`, err);
    return 0;
  }
  return docs.length;
}

/** Remove one SOP's chunks from the index (best-effort). */
async function deindexSop(sopId: string, chunkIds: string[]): Promise<void> {
  const client = getSopSearchClient();
  if (!client || chunkIds.length === 0) return;
  try {
    await client.deleteDocuments(chunkIds.map((id) => ({ id: sanitizeKey(id) })) as any);
  } catch (err) {
    console.warn(`[SopService] Failed to de-index ${sopId}:`, err);
  }
}

/**
 * Change detection + propagation. Compares each SOP file's checksum against the
 * persisted manifest, (re)indexes added/changed SOPs, de-indexes removed ones,
 * updates the manifest, and returns a per-SOP change report.
 */
export async function syncSops(): Promise<SopChangeReport> {
  const docs = reloadSops();
  const manifest = await readManifest();
  const seen = new Set<string>();
  const items: SopSyncItem[] = [];

  for (const doc of docs) {
    seen.add(doc.id);
    const prev = manifest.get(doc.id);
    const chunkCount = chunkSop(doc).length;

    if (!prev) {
      const chunksIndexed = await indexSopChunks(doc);
      await writeManifestEntry({
        id: doc.id,
        sopId: doc.id,
        version: doc.version,
        checksum: doc.checksum,
        chunkCount,
        lastIndexedAt: new Date().toISOString(),
      });
      items.push({ sopId: doc.id, title: doc.title, version: doc.version, status: 'added', currentChecksum: doc.checksum, chunksIndexed });
    } else if (prev.checksum !== doc.checksum) {
      const chunksIndexed = await indexSopChunks(doc);
      await writeManifestEntry({
        id: doc.id,
        sopId: doc.id,
        version: doc.version,
        checksum: doc.checksum,
        chunkCount,
        lastIndexedAt: new Date().toISOString(),
      });
      items.push({
        sopId: doc.id,
        title: doc.title,
        version: doc.version,
        status: 'changed',
        previousChecksum: prev.checksum,
        currentChecksum: doc.checksum,
        chunksIndexed,
      });
    } else {
      items.push({ sopId: doc.id, title: doc.title, version: doc.version, status: 'unchanged', currentChecksum: doc.checksum });
    }
  }

  // Removed SOPs — present in manifest, absent on disk.
  for (const [sopId, entry] of manifest) {
    if (seen.has(sopId)) continue;
    await deindexSop(sopId, []);
    await deleteManifestEntry(sopId);
    items.push({ sopId, title: sopId, version: entry.version, status: 'removed', previousChecksum: entry.checksum });
  }

  const report: SopChangeReport = {
    ranAt: new Date().toISOString(),
    totalSops: docs.length,
    changed: items.filter((i) => i.status === 'changed').length,
    added: items.filter((i) => i.status === 'added').length,
    removed: items.filter((i) => i.status === 'removed').length,
    unchanged: items.filter((i) => i.status === 'unchanged').length,
    items,
  };
  console.log(
    `[SopService] Sync complete — ${report.added} added, ${report.changed} changed, ${report.removed} removed, ${report.unchanged} unchanged.`,
  );
  return report;
}

/** Lightweight status for admin/UI: loaded SOPs + last-indexed state. */
export async function getSopStatus(): Promise<{
  sopDir: string;
  aiSearchEnabled: boolean;
  sops: Array<SopFrontMatter & { checksum: string; chunkCount: number; indexed: boolean; lastIndexedAt?: string }>;
}> {
  const docs = loadSops();
  const manifest = await readManifest();
  return {
    sopDir: SOP_DIR,
    aiSearchEnabled: getSopSearchClient() !== null,
    sops: docs.map((d) => {
      const m = manifest.get(d.id);
      return {
        id: d.id,
        title: d.title,
        version: d.version,
        effectiveDate: d.effectiveDate,
        owner: d.owner,
        category: d.category,
        appliesTo: d.appliesTo,
        summary: d.summary,
        checksum: d.checksum,
        chunkCount: chunkSop(d).length,
        indexed: !!m && m.checksum === d.checksum,
        lastIndexedAt: m?.lastIndexedAt,
      };
    }),
  };
}
