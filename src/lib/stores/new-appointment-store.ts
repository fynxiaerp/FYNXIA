// src/lib/stores/new-appointment-store.ts
// One-shot trigger store connecting the (Server Component) "Nova Consulta" header
// button to the (client) AgendaCalendar creation dialog.
// Per CLAUDE.md: transient client UI state → Zustand.

import { create } from 'zustand'

interface NewAppointmentStore {
  open: boolean
  openDialog: () => void // header button sets open = true
  reset: () => void // calendar consumes the signal, sets open = false
}

export const useNewAppointmentStore = create<NewAppointmentStore>((set) => ({
  open: false,
  openDialog: () => set({ open: true }),
  reset: () => set({ open: false }),
}))
