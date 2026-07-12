/**
 * A365 (Microsoft 365) service for querying governance events.
 * Includes 10-min caching and graceful degradation.
 */

import { ClientSecretCredential } from '@azure/identity';

export interface A365ConditionalAccessEvent {
  timestamp: string;
  activity: string;
  result: 'Success' | 'Failure';
  initiatedBy?: string;
}

export interface A365UnusualAccessPatterns {
  hasAnomalies: boolean;
  details: string[];
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

class A365Service {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private graphEndpoint = 'https://graph.microsoft.com/v1.0';

  constructor() {
    const tenantId = process.env.A365_TENANT_ID || process.env.ENTRA_TENANT_ID;
    const clientId = process.env.A365_CLIENT_ID || process.env.ENTRA_CLIENT_ID;
    const clientSecret = process.env.A365_CLIENT_SECRET || process.env.ENTRA_CLIENT_SECRET;

    if (!tenantId || !clientId || !clientSecret) {
      console.warn('[A365Service] Missing A365 credentials — A365 integration disabled');
    }
  }

  private getCredential(): ClientSecretCredential | null {
    const tenantId = process.env.A365_TENANT_ID || process.env.ENTRA_TENANT_ID;
    const clientId = process.env.A365_CLIENT_ID || process.env.ENTRA_CLIENT_ID;
    const clientSecret = process.env.A365_CLIENT_SECRET || process.env.ENTRA_CLIENT_SECRET;

    if (!tenantId || !clientId || !clientSecret) {
      return null;
    }

    try {
      return new ClientSecretCredential(tenantId, clientId, clientSecret);
    } catch (error) {
      console.error('[A365Service] Failed to create credential:', error);
      return null;
    }
  }

  private isCacheValid(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    return Date.now() - entry.timestamp < CACHE_TTL_MS;
  }

  private getFromCache<T>(key: string): T | null {
    if (this.isCacheValid(key)) {
      return this.cache.get(key)?.data as T;
    }
    this.cache.delete(key);
    return null;
  }

  private setInCache<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  async getConditionalAccessEvents(userId: string, windowDays = 7): Promise<A365ConditionalAccessEvent[]> {
    try {
      const cacheKey = `ca-events-${userId}-${windowDays}`;
      const cached = this.getFromCache<A365ConditionalAccessEvent[]>(cacheKey);
      if (cached) {
        return cached;
      }

      const credential = this.getCredential();
      if (!credential) {
        console.info('[A365Service] A365 credentials not available, returning empty array');
        return [];
      }

      const token = await credential.getToken('https://graph.microsoft.com/.default');

      // Build filter: events from the last N days by this user
      const since = new Date();
      since.setDate(since.getDate() - windowDays);
      const sinceIso = since.toISOString();

      // Filter: initiatedBy/user/id eq userId
      const filter = `activityDateTime ge ${sinceIso} and initiatedBy/user/id eq '${userId}'`;
      const url = `${this.graphEndpoint}/auditLogs/directoryAudits?$filter=${encodeURIComponent(filter)}&$top=50&$orderby=activityDateTime desc`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token.token}` },
      });

      if (!response.ok) {
        console.warn(`[A365Service] Failed to fetch CA events for ${userId}: ${response.statusText}`);
        return [];
      }

      const data = (await response.json()) as Record<string, unknown>;
      const events = Array.isArray(data.value) ? data.value : [];

      const result: A365ConditionalAccessEvent[] = events.map((event: unknown) => {
        const e = event as Record<string, unknown>;
        return {
          timestamp: (e.activityDateTime as string) || new Date().toISOString(),
          activity: (e.activity as string) || 'Unknown',
          result: ((e.result as string) === 'Failure' ? 'Failure' : 'Success') as 'Success' | 'Failure',
          initiatedBy: ((e.initiatedBy as Record<string, unknown>)?.user as Record<string, unknown>)?.displayName as string | undefined,
        };
      });

      this.setInCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('[A365Service] getConditionalAccessEvents error:', error);
      return [];
    }
  }

  async getUnusualAccessPatterns(userId: string): Promise<A365UnusualAccessPatterns> {
    try {
      const cacheKey = `unusual-${userId}`;
      const cached = this.getFromCache<A365UnusualAccessPatterns>(cacheKey);
      if (cached) {
        return cached;
      }

      // Get last 24h of events
      const events = await this.getConditionalAccessEvents(userId, 1);

      const details: string[] = [];
      let hasAnomalies = false;

      // Heuristic: count failed sign-ins in last 24h
      const failedCount = events.filter((e) => e.result === 'Failure').length;
      if (failedCount > 3) {
        hasAnomalies = true;
        details.push(`${failedCount} failed sign-in attempts in last 24 hours`);
      }

      // Heuristic: detect multiple distinct IP addresses or countries (if available)
      // For demo purposes, we just track if user has any failures
      if (failedCount > 0 && failedCount <= 3) {
        details.push(`${failedCount} failed sign-in attempt(s) detected`);
      }

      const result: A365UnusualAccessPatterns = { hasAnomalies, details };
      this.setInCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('[A365Service] getUnusualAccessPatterns error:', error);
      return { hasAnomalies: false, details: [] };
    }
  }
}

export const a365Service = new A365Service();
