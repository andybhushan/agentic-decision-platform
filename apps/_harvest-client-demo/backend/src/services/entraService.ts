/**
 * Entra (Entra ID) service for querying Microsoft Graph.
 * Includes caching (5 min TTL) and graceful degradation on errors.
 */

import { ClientSecretCredential } from '@azure/identity';
import { DefaultAzureCredential } from '@azure/identity';

export interface EntraUserProfile {
  id: string;
  displayName: string;
  mail?: string;
  department?: string;
  jobTitle?: string;
}

export interface EntraSignInActivity {
  lastSignInDateTime?: string;
  lastNonInteractiveSignInDateTime?: string;
}

export interface EntraRiskLevel {
  riskLevel: 'low' | 'medium' | 'high';
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

class EntraService {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private graphEndpoint = 'https://graph.microsoft.com/v1.0';

  constructor() {
    const tenantId = process.env.ENTRA_TENANT_ID;
    const clientId = process.env.ENTRA_CLIENT_ID;
    const clientSecret = process.env.ENTRA_CLIENT_SECRET;

    if (!tenantId || !clientId || !clientSecret) {
      console.warn('[EntraService] Missing Entra credentials — Entra integration disabled');
    }
  }

  private getCredential(): ClientSecretCredential | DefaultAzureCredential | null {
    const tenantId = process.env.ENTRA_TENANT_ID;
    const clientId = process.env.ENTRA_CLIENT_ID;
    const clientSecret = process.env.ENTRA_CLIENT_SECRET;

    if (!tenantId || !clientId || !clientSecret) {
      return null;
    }

    try {
      return new ClientSecretCredential(tenantId, clientId, clientSecret);
    } catch (error) {
      console.error('[EntraService] Failed to create credential:', error);
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

  async getUserProfile(userId: string): Promise<EntraUserProfile | null> {
    try {
      const cacheKey = `profile-${userId}`;
      const cached = this.getFromCache<EntraUserProfile>(cacheKey);
      if (cached) {
        return cached;
      }

      const credential = this.getCredential();
      if (!credential) {
        console.info('[EntraService] Entra credentials not available, returning null');
        return null;
      }

      const token = await credential.getToken('https://graph.microsoft.com/.default');
      const response = await fetch(`${this.graphEndpoint}/users/${userId}`, {
        headers: { Authorization: `Bearer ${token.token}` },
      });

      if (!response.ok) {
        console.warn(`[EntraService] Failed to fetch user ${userId}: ${response.statusText}`);
        return null;
      }

      const user = (await response.json()) as Record<string, unknown>;
      const profile: EntraUserProfile = {
        id: (user.id as string) || userId,
        displayName: (user.displayName as string) || 'Unknown',
        mail: (user.mail as string) || undefined,
        department: (user.department as string) || undefined,
        jobTitle: (user.jobTitle as string) || undefined,
      };

      this.setInCache(cacheKey, profile);
      return profile;
    } catch (error) {
      console.error('[EntraService] getUserProfile error:', error);
      return null;
    }
  }

  async getUserSignInActivity(userId: string): Promise<EntraSignInActivity | null> {
    try {
      const cacheKey = `signin-${userId}`;
      const cached = this.getFromCache<EntraSignInActivity>(cacheKey);
      if (cached) {
        return cached;
      }

      const credential = this.getCredential();
      if (!credential) {
        return null;
      }

      const token = await credential.getToken('https://graph.microsoft.com/.default');
      const response = await fetch(`${this.graphEndpoint}/users/${userId}`, {
        headers: { Authorization: `Bearer ${token.token}` },
      });

      if (!response.ok) {
        console.warn(`[EntraService] Failed to fetch sign-in activity for ${userId}`);
        return null;
      }

      const user = (await response.json()) as Record<string, unknown>;
      const activity: EntraSignInActivity = {
        lastSignInDateTime: (user.lastSignInDateTime as string) || undefined,
        lastNonInteractiveSignInDateTime: (user.lastNonInteractiveSignInDateTime as string) || undefined,
      };

      this.setInCache(cacheKey, activity);
      return activity;
    } catch (error) {
      console.error('[EntraService] getUserSignInActivity error:', error);
      return null;
    }
  }

  async getUserRiskLevel(userId: string): Promise<EntraRiskLevel | null> {
    try {
      const cacheKey = `risk-${userId}`;
      const cached = this.getFromCache<EntraRiskLevel>(cacheKey);
      if (cached) {
        return cached;
      }

      const credential = this.getCredential();
      if (!credential) {
        return null;
      }

      const token = await credential.getToken('https://graph.microsoft.com/.default');
      const response = await fetch(`${this.graphEndpoint}/users/${userId}`, {
        headers: { Authorization: `Bearer ${token.token}` },
      });

      if (!response.ok) {
        console.warn(`[EntraService] Failed to fetch risk level for ${userId}`);
        return null;
      }

      const user = (await response.json()) as Record<string, unknown>;
      const riskLevel = ((user.riskLevel as string) || 'low') as 'low' | 'medium' | 'high';

      const risk: EntraRiskLevel = { riskLevel };
      this.setInCache(cacheKey, risk);
      return risk;
    } catch (error) {
      console.error('[EntraService] getUserRiskLevel error:', error);
      return null;
    }
  }
}

export const entraService = new EntraService();
