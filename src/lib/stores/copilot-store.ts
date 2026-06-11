// src/lib/stores/copilot-store.ts
// Client-only Zustand store for copilot sidebar open/closed state (UI only).
// Per CLAUDE.md: transient client UI state → Zustand.
// Conversation lives in useChat (resets on navigation); only open/closed persists here.

import { create } from 'zustand'

interface CopilotStoreState {
  open: boolean
  setOpen: (v: boolean) => void
  toggle: () => void
}

export const useCopilotStore = create<CopilotStoreState>((set) => ({
  open: false,
  setOpen: (v) => set({ open: v }),
  toggle: () => set((s) => ({ open: !s.open })),
}))
