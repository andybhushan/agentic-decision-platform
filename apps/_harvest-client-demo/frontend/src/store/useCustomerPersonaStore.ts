import { create } from 'zustand';
import type { CustomerPersona } from '../types';

const STORAGE_KEY = 'baneox_active_customer_id';

interface CustomerPersonaState {
  personas: CustomerPersona[];
  activeCustomerId: string | null;
  setPersonas: (personas: CustomerPersona[]) => void;
  setActiveCustomer: (customerId: string | null) => void;
  hydrateActiveCustomer: () => void;
}

export function readStoredCustomerPersonaId(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

function writeStoredCustomerPersonaId(customerId: string | null): void {
  if (typeof window === 'undefined') return;
  if (!customerId) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, customerId);
}

export const useCustomerPersonaStore = create<CustomerPersonaState>((set) => ({
  personas: [],
  activeCustomerId: readStoredCustomerPersonaId(),
  setPersonas: (personas) =>
    set((state) => {
      const nextActiveId = state.activeCustomerId && personas.some((persona) => persona.id === state.activeCustomerId)
        ? state.activeCustomerId
        : personas[0]?.id ?? null;
      writeStoredCustomerPersonaId(nextActiveId);
      return {
        personas,
        activeCustomerId: nextActiveId,
      };
    }),
  setActiveCustomer: (customerId) => {
    writeStoredCustomerPersonaId(customerId);
    set({ activeCustomerId: customerId });
  },
  hydrateActiveCustomer: () => set({ activeCustomerId: readStoredCustomerPersonaId() }),
}));
