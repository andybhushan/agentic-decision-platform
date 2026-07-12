import { CosmosRepository } from '../cosmosRepository';
import { SearchClient, AzureKeyCredential } from '@azure/search-documents';
import { embedText } from '../aiSearchService';
import {
  ClaimChunk,
  ClaimChunkMetadata,
  Conversation,
  VectorSearchRequest,
  VectorSearchResult,
  IndexingJobStatus,
} from '../../types/steward';

/**
 * Interface for Cosmos DB operations.
 * Implementations handle claim chunk storage, vector search, and conversation persistence.
 */
export interface CosmosServiceInterface {
  /** Store a claim chunk with its embedding */
  upsertClaimChunk(chunk: ClaimChunk): Promise<void>;

  /** Batch upsert claim chunks */
  upsertClaimChunks(chunks: ClaimChunk[]): Promise<void>;

  /** Vector search for relevant claim chunks with access control filters */
  vectorSearch(request: VectorSearchRequest): Promise<VectorSearchResult[]>;

  /** Get a conversation by ID */
  getConversation(conversationId: string, tenantId: string): Promise<Conversation | null>;

  /** Save or update a conversation */
  upsertConversation(conversation: Conversation): Promise<void>;

  /** List conversations for a user */
  listConversations(tenantId: string, userId: string): Promise<Conversation[]>;

  /** Delete a conversation */
  deleteConversation(conversationId: string, tenantId: string): Promise<void>;

  /** Get indexing job status */
  getIndexingStatus(jobId: string): Promise<IndexingJobStatus | null>;

  /** Fetch all live claims from the production `claims` container (for RAG indexing). */
  getAllLiveClaims(): Promise<any[]>;

  /** Test connection to Cosmos DB */
  testConnection(): Promise<boolean>;
}

/**
 * Live Cosmos DB + Azure AI Search service.
 * - Conversations persisted in Cosmos `steward-conversations` container.
 * - Claim chunks persisted in Cosmos `steward-chunks` (source of truth) AND
 *   mirrored into the dedicated `claims-chunks` Azure AI Search index (with
 *   embeddings) for true vector/hybrid RAG retrieval.
 * - vectorSearch() queries `claims-chunks` first (vector+keyword hybrid when
 *   embeddings are available), falling back to a Cosmos keyword search
 *   against the live `claims` container if AI Search is unavailable/empty.
 */
export class LiveCosmosService implements CosmosServiceInterface {
  private conversationsRepo = new CosmosRepository<Conversation & { id: string }>('steward-conversations');
  private chunksRepo = new CosmosRepository<ClaimChunk>('steward-chunks');
  private indexingRepo = new CosmosRepository<IndexingJobStatus & { id: string }>('steward-indexing');
  private claimsRepo = new CosmosRepository<any>('claims');
  /** Dedicated index for claim-chunk RAG (vector + keyword). */
  private claimsSearchClient: SearchClient<any> | null = null;

  constructor() {
    const endpoint = process.env.AISEARCH_ENDPOINT;
    const key = process.env.AISEARCH_KEY;
    const claimsIndex = process.env.AISEARCH_CLAIMS_INDEX_NAME || 'claims-chunks';
    if (endpoint && key) {
      try {
        this.claimsSearchClient = new SearchClient(endpoint, claimsIndex, new AzureKeyCredential(key));
        console.log('[StewardCosmos] Azure AI Search (claims RAG) connected →', claimsIndex);
      } catch (err) {
        console.warn('[StewardCosmos] AI Search init failed:', err);
      }
    } else {
      console.warn('[StewardCosmos] AISEARCH_ENDPOINT/KEY not set — falling back to Cosmos keyword search');
    }
    // Ensure containers exist (fire and forget — do not block startup)
    this.conversationsRepo.ensureContainer('/tenantId').catch(() => {});
    this.chunksRepo.ensureContainer('/tenantId').catch(() => {});
    this.indexingRepo.ensureContainer('/id').catch(() => {});
  }

  async upsertClaimChunk(chunk: ClaimChunk): Promise<void> {
    await this.chunksRepo.upsert(chunk);
    await this.mirrorChunkToSearch(chunk);
  }

  async upsertClaimChunks(chunks: ClaimChunk[]): Promise<void> {
    for (const chunk of chunks) {
      await this.chunksRepo.upsert(chunk);
      await this.mirrorChunkToSearch(chunk);
    }
  }

  /** Best-effort mirror of a claim chunk into the `claims-chunks` AI Search index, embedding included. */
  private async mirrorChunkToSearch(chunk: ClaimChunk): Promise<void> {
    if (!this.claimsSearchClient) return;
    try {
      const vector = await embedText(chunk.content);
      // Azure AI Search document keys only allow letters, digits, _, -, = — the
      // Cosmos chunk id uses ':' as a separator, so sanitise it for the search key.
      const searchKey = chunk.id.replace(/[^A-Za-z0-9_\-=]/g, '_');
      await this.claimsSearchClient.uploadDocuments([
        {
          id: searchKey,
          claimId: chunk.claimId,
          policyId: chunk.policyId,
          tenantId: chunk.tenantId,
          section: chunk.section,
          content: chunk.content,
          claimType: chunk.metadata?.claimType ?? '',
          status: chunk.metadata?.status ?? '',
          dateOfLoss: chunk.metadata?.dateOfLoss ?? '',
          priority: chunk.metadata?.priority ?? '',
          metadataJson: JSON.stringify(chunk.metadata ?? {}),
          chunkVersion: chunk.chunkVersion,
          createdAt: chunk.createdAt,
          ...(vector ? { contentVector: vector } : {}),
        },
      ]);
    } catch (err) {
      console.warn(`[StewardCosmos] Failed to mirror chunk ${chunk.id} to AI Search (non-fatal):`, err);
    }
  }

  async vectorSearch(request: VectorSearchRequest): Promise<VectorSearchResult[]> {
    const topK = request.topK ?? 5;

    // 1. Try Azure AI Search (claims-chunks index) — vector+keyword hybrid when embeddings are available
    if (this.claimsSearchClient) {
      try {
        const vector = await embedText(request.query);
        const selectFields = ['id', 'claimId', 'policyId', 'tenantId', 'section', 'content', 'metadataJson', 'chunkVersion', 'createdAt'] as any;
        const filter = request.filters?.claimId ? `claimId eq '${request.filters.claimId}'` : undefined;

        let results;
        if (vector) {
          // Pure vector query (no full-text search term): Azure returns the raw
          // cosine-similarity score (0–1) rather than an RRF-fused hybrid rank
          // score, which is what `minSimilarity` thresholds expect.
          results = await this.claimsSearchClient.search(undefined, {
            top: topK,
            select: selectFields,
            filter,
            vectorSearchOptions: {
              queries: [
                {
                  kind: 'vector',
                  vector,
                  kNearestNeighborsCount: topK,
                  fields: ['contentVector'],
                },
              ],
            },
          } as any);
        } else {
          // No embedding client configured — fall back to keyword-only full-text search.
          results = await this.claimsSearchClient.search(request.query, {
            top: topK,
            searchFields: ['content'],
            select: selectFields,
            filter,
          });
        }

        const hits: VectorSearchResult[] = [];
        for await (const r of results.results) {
          const doc = r.document as any;
          let metadata: ClaimChunkMetadata = { claimType: '', status: '', dateOfLoss: '' };
          try {
            if (doc.metadataJson) metadata = JSON.parse(doc.metadataJson);
          } catch {
            // ignore malformed metadata JSON
          }
          const chunk: ClaimChunk = {
            id: doc.id ?? '',
            claimId: doc.claimId ?? '',
            policyId: doc.policyId ?? '',
            tenantId: doc.tenantId ?? request.tenantId,
            section: doc.section ?? 'summary',
            content: doc.content ?? '',
            metadata,
            chunkVersion: doc.chunkVersion ?? '1',
            createdAt: doc.createdAt ?? new Date().toISOString(),
          };
          // Pure vector queries return a genuine cosine-similarity-like score in [0,1];
          // keyword-only (BM25) scores are unbounded, so normalise those defensively.
          const rawScore = r.score ?? 0;
          const similarity = vector ? Math.min(Math.max(rawScore, 0), 1) : Math.min(rawScore / 10, 1);
          hits.push({ chunk, similarity });
        }
        const filtered = hits.filter(h => h.similarity >= (request.minSimilarity ?? 0));
        if (filtered.length > 0) return filtered;
      } catch (err) {
        console.warn('[StewardCosmos] AI Search query failed, falling back:', err);
      }
    }

    // 2. Keyword fallback — query the live `claims` container
    return this.cosmosKeywordSearch(request, topK);
  }

  private async cosmosKeywordSearch(request: VectorSearchRequest, topK: number): Promise<VectorSearchResult[]> {
    try {
      const claims = await this.claimsRepo.findAll();
      const terms = request.query.toLowerCase().split(/\s+/).filter(Boolean);

      const scored = claims
        .filter((c: any) => !request.filters?.claimId || c.id === request.filters.claimId)
        .map((c: any) => {
          const text = [
            c.id, c.claimantName, c.incidentType, c.claimStage,
            c.blockerReason, c.notes, c.policyContext?.coverageType,
            ...(c.auditTrail ?? []).map((a: any) => a.action),
          ].filter(Boolean).join(' ').toLowerCase();

          const matches = terms.filter(t => text.includes(t)).length;
          const similarity = matches / Math.max(terms.length, 1);
          return { claim: c, similarity };
        })
        .filter(r => r.similarity >= (request.minSimilarity ?? 0.1))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);

      return scored.map(({ claim, similarity }) => ({
        chunk: {
          id: `cosmos-${claim.id}`,
          claimId: claim.id,
          policyId: claim.policyId ?? '',
          tenantId: request.tenantId,
          section: 'summary' as const,
          content: `Claim ${claim.id} — ${claim.claimantName}: ${claim.incidentType} | Stage: ${claim.claimStage} | Priority: ${claim.priority} | Blocker: ${claim.blockerReason ?? 'none'}`,
          metadata: {
            claimType: claim.incidentType ?? '',
            status: claim.claimStage ?? '',
            dateOfLoss: claim.dateOfLoss ?? '',
            priority: claim.priority,
          },
          chunkVersion: '1',
          createdAt: new Date().toISOString(),
        },
        similarity,
      }));
    } catch (err) {
      console.warn('[StewardCosmos] Cosmos keyword fallback failed:', err);
      return [];
    }
  }

  async getConversation(conversationId: string, tenantId: string): Promise<Conversation | null> {
    try {
      const c = await this.conversationsRepo.findById(conversationId);
      if (c && c.tenantId === tenantId) return c as Conversation;
      return null;
    } catch {
      return null;
    }
  }

  async upsertConversation(conversation: Conversation): Promise<void> {
    await this.conversationsRepo.upsert(conversation as Conversation & { id: string });
  }

  async listConversations(tenantId: string, userId: string): Promise<Conversation[]> {
    try {
      return await this.conversationsRepo.query<Conversation>({
        query: 'SELECT * FROM c WHERE c.tenantId = @tenantId AND c.userId = @userId ORDER BY c.updatedAt DESC',
        parameters: [
          { name: '@tenantId', value: tenantId },
          { name: '@userId', value: userId },
        ],
      });
    } catch {
      return [];
    }
  }

  async deleteConversation(conversationId: string, tenantId: string): Promise<void> {
    const conv = await this.getConversation(conversationId, tenantId);
    if (conv) await this.conversationsRepo.delete(conversationId);
  }

  async getIndexingStatus(jobId: string): Promise<IndexingJobStatus | null> {
    try {
      return await this.indexingRepo.findById(jobId) as IndexingJobStatus | null;
    } catch {
      return null;
    }
  }

  async getAllLiveClaims(): Promise<any[]> {
    return this.claimsRepo.findAll();
  }

  async testConnection(): Promise<boolean> {
    return this.conversationsRepo.isAvailable();
  }
}

/**
 * Factory — always returns the live service when COSMOS_ENDPOINT is present.
 * No mocks in production code.
 * NOTE: Evaluated lazily (first call) so dotenv has loaded by the time this runs.
 */
export class CosmosServiceFactory {
  private static instance: CosmosServiceInterface | null = null;

  static create(): CosmosServiceInterface {
    if (this.instance) return this.instance;
    const endpoint = process.env.COSMOS_ENDPOINT;
    if (!endpoint) {
      throw new Error(
        '[StewardCosmos] COSMOS_ENDPOINT is required. Set it in .env — no mock fallback.'
      );
    }
    console.log('[StewardCosmos] Using live Cosmos DB + AI Search service');
    this.instance = new LiveCosmosService();
    return this.instance;
  }
}
