/**
 * Azure AI Search — indexing and semantic retrieval of agent interactions.
 *
 * Graceful fallback: if AISEARCH_ENDPOINT is not set, every method is a no-op.
 *
 * IMPORTANT — privacy guard: context retrieval is always scoped to a specific
 * sessionId OR claimId. Raw cross-agent / cross-claimant retrieval is not
 * exposed to prevent data leakage into unrelated prompts.
 *
 * Index: agent-interactions (created externally or via provisionIndex below)
 */

import {
  SearchClient,
  SearchIndexClient,
  AzureKeyCredential,
  type SearchDocumentsResult,
  type SearchIndex,
} from '@azure/search-documents';
import { AzureOpenAI } from 'openai';
import type { InteractionDoc } from './cosmosService';

// ── Config ─────────────────────────────────────────────────────────────────

// ── Search doc shape (index fields) ────────────────────────────────────────

interface SearchInteractionDoc {
  id: string;
  agentId: string;
  sessionId: string;
  claimId?: string;
  interactionType: string;
  userContent: string;
  assistantContent: string;
  /** Combined user+assistant text for embedding / full-text search. */
  combinedContent: string;
  phase?: string;
  ts: string;
  contentVector?: number[];
}

// ── Lazy clients ───────────────────────────────────────────────────────────

let _searchClient: SearchClient<SearchInteractionDoc> | null = null;
let _indexClient: SearchIndexClient | null = null;
let _embeddingClient: AzureOpenAI | null = null;
let _initAttempted = false;

function getClients(): {
  search: SearchClient<SearchInteractionDoc> | null;
  index: SearchIndexClient | null;
  embed: AzureOpenAI | null;
} {
  if (_initAttempted) return { search: _searchClient, index: _indexClient, embed: _embeddingClient };
  _initAttempted = true;

  // Read lazily — dotenv has already run by the time this is first called.
  const endpoint = process.env.AISEARCH_ENDPOINT ?? '';
  const key = process.env.AISEARCH_KEY ?? '';
  const indexName = process.env.AISEARCH_INDEX_NAME ?? 'agent-interactions';
  const embeddingDeployment = process.env.AZURE_EMBEDDING_DEPLOYMENT ?? 'text-embedding-3-small';
  const foundryEndpoint = process.env.FOUNDRY_PROJECT_ENDPOINT ?? '';
  const foundryKey = process.env.FOUNDRY_API_KEY ?? '';

  if (!endpoint) {
    console.warn('[AISearchService] AISEARCH_ENDPOINT not set — semantic retrieval disabled');
    return { search: null, index: null, embed: null };
  }

  try {
    const cred = new AzureKeyCredential(key);
    _searchClient = new SearchClient<SearchInteractionDoc>(endpoint, indexName, cred);
    _indexClient = new SearchIndexClient(endpoint, cred);
    console.info(`[AISearchService] Connected → ${indexName}`);

    if (foundryEndpoint && foundryKey) {
      // Extract base endpoint (without /api/projects/... suffix)
      const baseEndpoint = foundryEndpoint.split('/api/projects/')[0];
      _embeddingClient = new AzureOpenAI({
        endpoint: baseEndpoint,
        apiKey: foundryKey,
        deployment: embeddingDeployment,
        apiVersion: '2024-02-01',
      });
    } else {
      console.warn('[AISearchService] No Foundry endpoint/key — vector embeddings disabled, keyword search only');
    }

    return { search: _searchClient, index: _indexClient, embed: _embeddingClient };
  } catch (err) {
    console.error('[AISearchService] Init failed — falling back to no-op:', err);
    return { search: null, index: null, embed: null };
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export async function embedText(text: string): Promise<number[] | undefined> {
  const { embed } = getClients();
  if (!embed) return undefined;
  try {
    const res = await embed.embeddings.create({
      input: text,
      model: process.env.AZURE_EMBEDDING_DEPLOYMENT ?? 'text-embedding-3-small',
    });
    return res.data[0].embedding;
  } catch (err) {
    console.error('[AISearchService] embedText failed (non-fatal):', err);
    return undefined;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Index an interaction document (fire-and-forget safe). */
export async function indexInteraction(doc: InteractionDoc): Promise<void> {
  const { search } = getClients();
  if (!search) return;

  const combined = `User: ${doc.userContent}\nAssistant: ${doc.assistantContent}`;
  const vector = await embedText(combined);

  const searchDoc: SearchInteractionDoc = {
    id: doc.id ?? `${doc.sessionId}-${Date.now()}`,
    agentId: doc.agentId,
    sessionId: doc.sessionId,
    claimId: doc.claimId,
    interactionType: doc.interactionType,
    userContent: doc.userContent,
    assistantContent: doc.assistantContent,
    combinedContent: combined,
    phase: doc.phase,
    ts: doc.ts,
    ...(vector ? { contentVector: vector } : {}),
  };

  try {
    await search.uploadDocuments([searchDoc]);
  } catch (err) {
    console.error('[AISearchService] indexInteraction failed (non-fatal):', err);
  }
}

/**
 * Retrieve the top-N most relevant past interactions for the given session or claim.
 * ALWAYS scoped to sessionId or claimId — never cross-claimant.
 *
 * Returns formatted context strings ready to inject into agent instructions.
 */
export async function retrieveContext(opts: {
  sessionId?: string;
  claimId?: string;
  queryText: string;
  topN?: number;
}): Promise<string[]> {
  const { search } = getClients();
  if (!search) return [];

  const { sessionId, claimId, queryText, topN = 3 } = opts;
  if (!sessionId && !claimId) return [];

  try {
    const vector = await embedText(queryText);

    // Build an OData filter to scope to this session/claim only.
    const filter = sessionId
      ? `sessionId eq '${sessionId}'`
      : `claimId eq '${claimId}'`;

    const searchOptions: Parameters<typeof search.search>[1] = {
      filter,
      top: topN,
      select: ['userContent', 'assistantContent', 'phase', 'ts'] as any,
    };

    if (vector) {
      // Hybrid: vector + keyword
      (searchOptions as any).vectorSearchOptions = {
        queries: [
          {
            kind: 'vector',
            vector,
            kNearestNeighborsCount: topN,
            fields: ['contentVector'],
          },
        ],
      };
    }

    const results: SearchDocumentsResult<SearchInteractionDoc> = await search.search(queryText, searchOptions);

    const context: string[] = [];
    for await (const r of results.results) {
      const doc = r.document;
      context.push(
        `[${doc.ts}${doc.phase ? ` | phase: ${doc.phase}` : ''}]\nUser: ${doc.userContent}\nAgent: ${doc.assistantContent}`,
      );
    }
    return context;
  } catch (err) {
    console.error('[AISearchService] retrieveContext failed (non-fatal):', err);
    return [];
  }
}

/** Return active search mode for health/diagnostics. */
export function getSearchMode(): 'search+vector' | 'search-only' | 'disabled' {
  const { search, embed } = getClients();
  if (!search) return 'disabled';
  return embed ? 'search+vector' : 'search-only';
}

/**
 * Create (or update) the agent-interactions index in Azure AI Search.
 *
 * Idempotent: uses createOrUpdateIndex so re-running is safe. The vector field
 * dimension defaults to text-embedding-3-small (1536); override with
 * AZURE_EMBEDDING_DIM if you point AZURE_EMBEDDING_DEPLOYMENT at another model.
 */
export async function provisionIndex(): Promise<{ created: boolean; name: string }> {
  const { index } = getClients();
  if (!index) {
    throw new Error('AISEARCH_ENDPOINT/KEY not configured — cannot provision index');
  }

  const name = process.env.AISEARCH_INDEX_NAME ?? 'agent-interactions';
  const dimensions = Number(process.env.AZURE_EMBEDDING_DIM ?? 1536);

  const definition: SearchIndex = {
    name,
    fields: [
      { name: 'id', type: 'Edm.String', key: true, filterable: true },
      { name: 'agentId', type: 'Edm.String', filterable: true, facetable: true },
      { name: 'sessionId', type: 'Edm.String', filterable: true },
      { name: 'claimId', type: 'Edm.String', filterable: true },
      { name: 'interactionType', type: 'Edm.String', filterable: true, facetable: true },
      { name: 'userContent', type: 'Edm.String', searchable: true },
      { name: 'assistantContent', type: 'Edm.String', searchable: true },
      { name: 'combinedContent', type: 'Edm.String', searchable: true },
      { name: 'phase', type: 'Edm.String', filterable: true, facetable: true },
      { name: 'ts', type: 'Edm.String', filterable: true, sortable: true },
      {
        name: 'contentVector',
        type: 'Collection(Edm.Single)',
        searchable: true,
        vectorSearchDimensions: dimensions,
        vectorSearchProfileName: 'vector-profile',
      },
    ],
    vectorSearch: {
      algorithms: [{ name: 'hnsw-algo', kind: 'hnsw' }],
      profiles: [{ name: 'vector-profile', algorithmConfigurationName: 'hnsw-algo' }],
    },
  };

  const existed = (await listIndexNames(index)).includes(name);
  await index.createOrUpdateIndex(definition);
  console.info(`[AISearchService] Index '${name}' ${existed ? 'updated' : 'created'} (vector dim ${dimensions})`);
  return { created: !existed, name };
}

/**
 * Create (or update) the dedicated `claims-chunks` Azure AI Search index used
 * for Digital Steward RAG retrieval. This is intentionally separate from the
 * `agent-interactions` index (which is telemetry/audit-log scoped) — claim
 * chunk documents (summary / policy_details / investigation_notes / etc.)
 * have a different schema and are queried independently.
 *
 * Idempotent: uses createOrUpdateIndex so re-running is safe.
 */
export async function provisionClaimsChunksIndex(): Promise<{ created: boolean; name: string }> {
  const { index } = getClients();
  if (!index) {
    throw new Error('AISEARCH_ENDPOINT/KEY not configured — cannot provision index');
  }

  const name = process.env.AISEARCH_CLAIMS_INDEX_NAME ?? 'claims-chunks';
  const dimensions = Number(process.env.AZURE_EMBEDDING_DIM ?? 1536);

  const definition: SearchIndex = {
    name,
    fields: [
      { name: 'id', type: 'Edm.String', key: true, filterable: true },
      { name: 'claimId', type: 'Edm.String', filterable: true, facetable: true },
      { name: 'policyId', type: 'Edm.String', filterable: true },
      { name: 'tenantId', type: 'Edm.String', filterable: true },
      { name: 'section', type: 'Edm.String', filterable: true, facetable: true },
      { name: 'content', type: 'Edm.String', searchable: true },
      { name: 'claimType', type: 'Edm.String', filterable: true, facetable: true },
      { name: 'status', type: 'Edm.String', filterable: true, facetable: true },
      { name: 'dateOfLoss', type: 'Edm.String', filterable: true },
      { name: 'priority', type: 'Edm.String', filterable: true, facetable: true },
      { name: 'metadataJson', type: 'Edm.String' },
      { name: 'chunkVersion', type: 'Edm.String', filterable: true },
      { name: 'createdAt', type: 'Edm.String', filterable: true, sortable: true },
      {
        name: 'contentVector',
        type: 'Collection(Edm.Single)',
        searchable: true,
        vectorSearchDimensions: dimensions,
        vectorSearchProfileName: 'vector-profile',
      },
    ],
    vectorSearch: {
      algorithms: [{ name: 'hnsw-algo', kind: 'hnsw' }],
      profiles: [{ name: 'vector-profile', algorithmConfigurationName: 'hnsw-algo' }],
    },
  };

  const existed = (await listIndexNames(index)).includes(name);
  await index.createOrUpdateIndex(definition);
  console.info(`[AISearchService] Index '${name}' ${existed ? 'updated' : 'created'} (vector dim ${dimensions})`);
  return { created: !existed, name };
}

/**
 * Create (or update) the dedicated `sop-chunks` Azure AI Search index used to
 * retrieve Standard Operating Procedure (SOP) sections for the Digital Steward.
 * SOPs act as agent controls (escalation matrix, delegated authority, SIU/legal/
 * medical referral procedures). Kept separate from claims-chunks and
 * agent-interactions so SOP governance content is queried independently.
 *
 * Idempotent: uses createOrUpdateIndex so re-running is safe.
 */
export async function provisionSopChunksIndex(): Promise<{ created: boolean; name: string }> {
  const { index } = getClients();
  if (!index) {
    throw new Error('AISEARCH_ENDPOINT/KEY not configured — cannot provision index');
  }

  const name = process.env.AISEARCH_SOP_INDEX_NAME ?? 'sop-chunks';
  const dimensions = Number(process.env.AZURE_EMBEDDING_DIM ?? 1536);

  const definition: SearchIndex = {
    name,
    fields: [
      { name: 'id', type: 'Edm.String', key: true, filterable: true },
      { name: 'sopId', type: 'Edm.String', filterable: true, facetable: true },
      { name: 'title', type: 'Edm.String', searchable: true },
      { name: 'version', type: 'Edm.String', filterable: true },
      { name: 'category', type: 'Edm.String', filterable: true, facetable: true },
      { name: 'section', type: 'Edm.String', searchable: true, filterable: true },
      { name: 'content', type: 'Edm.String', searchable: true },
      { name: 'createdAt', type: 'Edm.String', filterable: true, sortable: true },
      {
        name: 'contentVector',
        type: 'Collection(Edm.Single)',
        searchable: true,
        vectorSearchDimensions: dimensions,
        vectorSearchProfileName: 'vector-profile',
      },
    ],
    vectorSearch: {
      algorithms: [{ name: 'hnsw-algo', kind: 'hnsw' }],
      profiles: [{ name: 'vector-profile', algorithmConfigurationName: 'hnsw-algo' }],
    },
  };

  const existed = (await listIndexNames(index)).includes(name);
  await index.createOrUpdateIndex(definition);
  console.info(`[AISearchService] Index '${name}' ${existed ? 'updated' : 'created'} (vector dim ${dimensions})`);
  return { created: !existed, name };
}

async function listIndexNames(index: SearchIndexClient): Promise<string[]> {
  const names: string[] = [];
  try {
    for await (const n of index.listIndexesNames()) names.push(n);
  } catch {
    /* listing unsupported / permission — treat as unknown */
  }
  return names;
}
