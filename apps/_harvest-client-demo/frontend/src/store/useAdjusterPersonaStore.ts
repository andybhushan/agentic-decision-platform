import { create } from 'zustand';
import type { AdjusterProfile } from '../types';

const STORAGE_KEY = 'baneox_active_adjuster_id';

interface AdjusterPersonaState {
  adjusters: AdjusterProfile[];
  activeAdjusterId: string | null;
  setAdjusters: (adjusters: AdjusterProfile[]) => void;
  setActiveAdjuster: (adjusterId: string | null) => void;
  hydrateActiveAdjuster: () => void;
}

function readStoredAdjusterId(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

function writeStoredAdjusterId(adjusterId: string | null): void {
  if (typeof window === 'undefined') return;
  if (!adjusterId) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, adjusterId);
}

export const useAdjusterPersonaStore = create<AdjusterPersonaState>((set) => ({
  adjusters: [],
  activeAdjusterId: readStoredAdjusterId(),
  setAdjusters: (adjusters) =>
    set((state) => {
      const nextActiveId = state.activeAdjusterId && adjusters.some((adjuster) => adjuster.id === state.activeAdjusterId)
        ? state.activeAdjusterId
        : adjusters[0]?.id ?? null;
      writeStoredAdjusterId(nextActiveId);
      return {
        adjusters,
        activeAdjusterId: nextActiveId,
      };
    }),
  setActiveAdjuster: (adjusterId) => {
    writeStoredAdjusterId(adjusterId);
    set({ activeAdjusterId: adjusterId });
  },
  hydrateActiveAdjuster: () => set({ activeAdjusterId: readStoredAdjusterId() }),
}));
