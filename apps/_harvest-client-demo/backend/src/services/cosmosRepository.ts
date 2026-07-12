/**
 * Generic Cosmos DB repository.
 *
 * T must have an `id: string` field (Cosmos document id = partition key).
 * Uses a single shared CosmosClient for the process lifetime.
 */
import { CosmosClient, type Container, type CosmosClientOptions, type JSONValue } from '@azure/cosmos';

let _client: CosmosClient | null = null;
let _clientInit = false;

function getSharedClient(): CosmosClient | null {
  if (_clientInit) return _client;
  _clientInit = true;

  const endpoint = process.env.COSMOS_ENDPOINT ?? '';
  const key = process.env.COSMOS_KEY ?? '';

  if (!endpoint) {
    console.warn('[CosmosRepo] COSMOS_ENDPOINT not set — Cosmos unavailable');
    return null;
  }

  try {
    const opts: CosmosClientOptions = key ? { endpoint, key } : { endpoint };
    _client = new CosmosClient(opts);
    return _client;
  } catch (err) {
    console.error('[CosmosRepo] Client init failed:', err);
    return null;
  }
}

export class CosmosRepository<T extends { id: string }> {
  private readonly containerName: string;
  private readonly dbName: string;
  private _container: Container | null = null;
  private _containerInit = false;

  constructor(containerName: string) {
    this.containerName = containerName;
    this.dbName = process.env.COSMOS_DB_NAME ?? 'project-imagine';
  }

  getContainer(): Container | null {
    if (this._containerInit) return this._container;
    this._containerInit = true;

    const client = getSharedClient();
    if (!client) return null;

    try {
      this._container = client.database(this.dbName).container(this.containerName);
      return this._container;
    } catch (err) {
      console.error(`[CosmosRepo:${this.containerName}] Container access failed:`, err);
      return null;
    }
  }

  isAvailable(): boolean {
    return this.getContainer() !== null;
  }

  async ensureContainer(partitionKeyPath = '/id'): Promise<boolean> {
    const client = getSharedClient();
    if (!client) return false;

    try {
      const { database } = await client.databases.createIfNotExists({ id: this.dbName });
      const { container } = await database.containers.createIfNotExists({
        id: this.containerName,
        partitionKey: { paths: [partitionKeyPath] },
      });
      this._container = container;
      this._containerInit = true;
      return true;
    } catch (err) {
      console.error(`[CosmosRepo:${this.containerName}] Container ensure failed:`, err);
      return false;
    }
  }

  async findAll(): Promise<T[]> {
    const c = this.getContainer();
    if (!c) return [];
    const { resources } = await c.items
      .query<T>('SELECT * FROM c WHERE c.id != "__seed_meta"')
      .fetchAll();
    return resources;
  }

  async findById(id: string): Promise<T | null> {
    const c = this.getContainer();
    if (!c) return null;
    try {
      const { resource } = await c.item(id, id).read<T>();
      return resource ?? null;
    } catch (err: any) {
      if (err.code === 404) return null;
      throw err;
    }
  }

  async create(item: T): Promise<T> {
    const c = this.getContainer();
    if (!c) throw new Error(`[CosmosRepo:${this.containerName}] Cosmos not available`);
    const { resource } = await c.items.create<T>(item);
    return resource!;
  }

  async upsert(item: T): Promise<T> {
    const c = this.getContainer();
    if (!c) throw new Error(`[CosmosRepo:${this.containerName}] Cosmos not available`);
    const { resource } = await c.items.upsert<T>(item);
    return resource!;
  }

  async update(id: string, updates: Partial<Omit<T, 'id'>>): Promise<T | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    return this.upsert({ ...existing, ...updates, id } as T);
  }

  async delete(id: string): Promise<boolean> {
    const c = this.getContainer();
    if (!c) return false;
    try {
      await c.item(id, id).delete();
      return true;
    } catch (err: any) {
      if (err.code === 404) return false;
      throw err;
    }
  }

  async count(): Promise<number> {
    const c = this.getContainer();
    if (!c) return 0;
    const { resources } = await c.items
      .query<number>('SELECT VALUE COUNT(1) FROM c WHERE c.id != "__seed_meta"')
      .fetchAll();
    return resources[0] ?? 0;
  }

  async query<R = T>(querySpec: {
    query: string;
    parameters?: { name: string; value: JSONValue }[];
  }): Promise<R[]> {
    const c = this.getContainer();
    if (!c) return [];
    const { resources } = await c.items.query<R>(querySpec).fetchAll();
    return resources;
  }

  async isSeedComplete(): Promise<boolean> {
    const c = this.getContainer();
    if (!c) return false;
    try {
      const { resource } = await c.item('__seed_meta', '__seed_meta').read();
      return resource != null;
    } catch {
      return false;
    }
  }

  async markSeedComplete(): Promise<void> {
    const c = this.getContainer();
    if (!c) return;
    await c.items.upsert({ id: '__seed_meta', seededAt: new Date().toISOString() });
  }
}
