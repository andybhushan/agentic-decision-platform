/**
 * FNOLSessionStore — IndexedDB persistence for FNOL sessions.
 *
 * Stores:
 *   sessions  — FNOLClientSession snapshots, keyed by sessionId
 *   opQueue   — offline OfflineOp records, autoIncrement PK
 *
 * All methods are async and return Promises.
 * The store is a singleton; call `fnolStore.open()` once on app mount.
 */

import type { FNOLClientSession, OfflineOp } from '../domain/fnol/types';

const DB_NAME = 'fnol-pwa';
const DB_VERSION = 1;
const STORE_SESSIONS = 'sessions';
const STORE_OP_QUEUE = 'opQueue';

class FNOLSessionStore {
  private db: IDBDatabase | null = null;

  async open(): Promise<void> {
    if (this.db) return;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
          db.createObjectStore(STORE_SESSIONS, { keyPath: 'sessionId' });
        }
        if (!db.objectStoreNames.contains(STORE_OP_QUEUE)) {
          db.createObjectStore(STORE_OP_QUEUE, { autoIncrement: true, keyPath: 'id' });
        }
      };

      req.onsuccess = (e) => {
        this.db = (e.target as IDBOpenDBRequest).result;
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  private getDB(): IDBDatabase {
    if (!this.db) throw new Error('FNOLSessionStore not opened — call open() first');
    return this.db;
  }

  // ── Session snapshot ────────────────────────────────────────────────────────

  async saveSnapshot(session: FNOLClientSession): Promise<void> {
    const db = this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SESSIONS, 'readwrite');
      const req = tx.objectStore(STORE_SESSIONS).put(session);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async loadSnapshot(sessionId: string): Promise<FNOLClientSession | null> {
    const db = this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SESSIONS, 'readonly');
      const req = tx.objectStore(STORE_SESSIONS).get(sessionId);
      req.onsuccess = () => resolve((req.result as FNOLClientSession) ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  /** Return all incomplete (non-submitted, non-escalated) sessions. */
  async listIncompleteSessions(): Promise<FNOLClientSession[]> {
    const db = this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SESSIONS, 'readonly');
      const req = tx.objectStore(STORE_SESSIONS).getAll();
      req.onsuccess = () => {
        const all = (req.result as FNOLClientSession[]) ?? [];
        resolve(all.filter((s) => s.phase !== 'SUBMITTED' && s.phase !== 'ESCALATED'));
      };
      req.onerror = () => reject(req.error);
    });
  }

  // ── Offline operation queue ─────────────────────────────────────────────────

  async queueOp(op: Omit<OfflineOp, 'id'>): Promise<number> {
    const db = this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_OP_QUEUE, 'readwrite');
      const req = tx.objectStore(STORE_OP_QUEUE).add(op);
      req.onsuccess = () => resolve(req.result as number);
      req.onerror = () => reject(req.error);
    });
  }

  async getQueuedOps(): Promise<OfflineOp[]> {
    const db = this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_OP_QUEUE, 'readonly');
      const req = tx.objectStore(STORE_OP_QUEUE).getAll();
      req.onsuccess = () => resolve((req.result as OfflineOp[]) ?? []);
      req.onerror = () => reject(req.error);
    });
  }

  async clearOp(id: number): Promise<void> {
    const db = this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_OP_QUEUE, 'readwrite');
      const req = tx.objectStore(STORE_OP_QUEUE).delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}

export const fnolStore = new FNOLSessionStore();
