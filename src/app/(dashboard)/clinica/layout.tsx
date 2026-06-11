// src/app/(dashboard)/clinica/layout.tsx
// Mounts the CopilotTrigger on every /clinica/* page.
// Server Component — CopilotTrigger is 'use client' and renders as a client island.
// The trigger is position:fixed and the Sheet overlays — no page reflow.

import { CopilotTrigger } from '@/components/copilot/CopilotTrigger'

export default function ClinicaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <CopilotTrigger />
    </>
  )
}
