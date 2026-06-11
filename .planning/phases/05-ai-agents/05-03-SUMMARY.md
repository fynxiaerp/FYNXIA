---
phase: "05"
plan: "03"
subsystem: copilot-ui
tags: [ai, copilot, sidebar, useChat, zustand, sheet, scroll-area]
dependency_graph:
  requires: ["05-02"]
  provides: ["copilot-sidebar-ui", "clinica-layout-trigger"]
  affects: ["src/app/(dashboard)/clinica/*"]
tech_stack:
  added:
    - "@ai-sdk/react useChat (v6 DefaultChatTransport)"
    - "shadcn Sheet (base-ui/dialog backed)"
    - "shadcn ScrollArea (base-ui/scroll-area backed)"
    - "zustand useCopilotStore"
  patterns:
    - "DefaultChatTransport({ api }) for v6 useChat (api not in useChat options directly)"
    - "Client island CopilotTrigger in Server Component clinica/layout.tsx"
    - "message.parts filtering for type=text (v6 — NOT message.content)"
    - "isLoading = status==='submitted' || status==='streaming'"
key_files:
  created:
    - src/components/ui/sheet.tsx
    - src/components/ui/scroll-area.tsx
    - src/lib/stores/copilot-store.ts
    - src/components/copilot/CopilotTrigger.tsx
    - src/components/copilot/CopilotSidebar.tsx
    - src/components/copilot/MessageList.tsx
    - src/components/copilot/MessageBubble.tsx
    - src/components/copilot/SuggestedPrompts.tsx
    - src/components/copilot/CopilotInput.tsx
    - src/app/(dashboard)/clinica/layout.tsx
  modified: []
decisions:
  - "DefaultChatTransport({ api: '/api/copilot' }) pattern for v6 — api not a top-level useChat option"
  - "message.parts[] filter type=text (v6 API, not message.content string)"
  - "isLoading derived from status === 'submitted' || 'streaming' (v6, not isLoading boolean)"
  - "Tasks 1+2 executed atomically (sub-components required for Task 1 tsc verify)"
  - "Live copilot verification (Task 4) deferred to UAT — no AI_GATEWAY_API_KEY provisioned"
metrics:
  duration_minutes: 7
  completed_date: "2026-06-11"
  tasks_completed: 3
  files_created: 10
  files_modified: 0
requirements: [AI-01]
---

# Phase 05 Plan 03: Copilot Sidebar UI Summary

**One-liner:** Right-side Sheet sidebar with AI SDK v6 useChat wired to /api/copilot, floating Bot trigger on every /clinica/* page, context-aware suggested prompts, streaming bubbles, and read-only enforcement (D-05).

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1+2 | shadcn primitives + store + all copilot components | 4d60986 | 9 files (sheet, scroll-area, copilot-store, 5 copilot components) |
| 3 | Mount trigger in clinica/layout.tsx | ca076a8 | src/app/(dashboard)/clinica/layout.tsx |

---

## What Was Built

### CopilotTrigger (`src/components/copilot/CopilotTrigger.tsx`)
Fixed `bottom-4 right-4 sm:bottom-6 sm:right-6 z-40` button: `h-12 w-12 rounded-full bg-primary shadow-lg`. Bot icon → X when open. `aria-label` and `aria-expanded` toggle. Renders `<CopilotSidebar />` alongside.

### CopilotSidebar (`src/components/copilot/CopilotSidebar.tsx`)
Sheet `side="right"` controlled by `useCopilotStore`. Hosts AI SDK v6 `useChat` via `DefaultChatTransport({ api: '/api/copilot' })`. `sendMessage({text})` submit, `setMessages([])` clear. `isLoading = status==='submitted'||'streaming'`. Delegates to `MessageList` and `CopilotInput`.

### MessageList (`src/components/copilot/MessageList.tsx`)
`ScrollArea` + `aria-live="polite"` + `aria-label="Conversa com o copiloto"`. Auto-scroll on new message. Empty state: "Olá, como posso ajudar?" + `<SuggestedPrompts/>`. Typing indicator (3 `animate-bounce` dots) when `isLoading` and last message is user. Error bubble with `text-destructive`.

### MessageBubble (`src/components/copilot/MessageBubble.tsx`)
User: `ml-auto max-w-[80%] bg-muted px-3 py-2 rounded-xl rounded-br-sm`. Assistant: `mr-auto max-w-[85%] px-3 py-2` (no fill). Renders `message.parts` filtering `part.type === 'text'`. Streaming cursor `<span aria-hidden>` on last assistant message while loading.

### SuggestedPrompts (`src/components/copilot/SuggestedPrompts.tsx`)
3 chips via `usePathname()`: agenda → today's schedule prompts; financeiro* → receivables prompts; default → how-to prompts. `rounded-full border bg-muted px-3 py-2 gap-2` per spec. Click calls `onPick(text)` → immediate submit.

### CopilotInput (`src/components/copilot/CopilotInput.tsx`)
Controlled `<textarea aria-label="Mensagem para o copiloto">` `min-h-[40px] max-h-[120px] resize-none`. Enter submits, Shift+Enter newline. Bottom row: "Limpar conversa" (ghost button left) + "Perguntar" (Button right, `disabled` when empty or loading). D-05: no mutation buttons.

### useCopilotStore (`src/lib/stores/copilot-store.ts`)
Zustand: `{ open, setOpen, toggle }`. Client-only UI state. Conversation lives in `useChat` (resets on navigation).

### clinica/layout.tsx (`src/app/(dashboard)/clinica/layout.tsx`)
Server Component: `{children}` + `<CopilotTrigger />`. Trigger is `position:fixed` — no reflow. Covers all `/clinica/*` routes.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] AI SDK v6 useChat does not accept `api` directly**
- **Found during:** Task 1 (tsc verification)
- **Issue:** `useChat({ api: '/api/copilot' })` → TS2353 "api does not exist in UseChatOptions". In v6, `api` is configured on the transport layer, not the hook directly.
- **Fix:** Used `const copilotTransport = new DefaultChatTransport({ api: '/api/copilot' })` imported from `'ai'`, passed as `useChat({ transport: copilotTransport })`.
- **Files modified:** `src/components/copilot/CopilotSidebar.tsx`
- **Commit:** 4d60986

**2. [Rule 1 - Bug] PROMPT_SETS index access returns `T | undefined` in strict TS**
- **Found during:** Task 1 (tsc verification)
- **Issue:** `PROMPT_SETS['/clinica/financeiro']` typed as `[string,string,string] | undefined` despite key being literal.
- **Fix:** Added non-null assertion `!` on the guaranteed key access.
- **Files modified:** `src/components/copilot/SuggestedPrompts.tsx`
- **Commit:** 4d60986

### Tasks 1+2 Executed Atomically
Tasks 1 and 2 were planned as separate steps but were built in one pass — sub-components (MessageList, MessageBubble, etc.) were required for Task 1's `tsc --noEmit` verify to pass (CopilotSidebar imports them). Both committed together in one atomic commit per plan intent.

---

## Deferred UAT

### Live Copilot Verification (Task 4 — checkpoint:human-verify)
- **Status:** UAT-DEFERRED
- **Reason:** No `AI_GATEWAY_API_KEY` provisioned in local environment (same pattern as Asaas sandbox UAT in Phase 3 and WhatsApp live send in Phase 4).
- **What was verified instead:** `npx tsc --noEmit` exit 0; `npx next build` clean; all pre-existing test suites remain GREEN (tools.test.ts 12/12, chat-route.test.ts 9/9 from 05-02).
- **Pre-existing RED tests:** 28 failures in `collection-agent.test.ts` + `whatsapp-inbound.test.ts` — RED-by-design Wave 4/5 scaffolds for future plans 05-04 and 05-05 (documented in 05-02 SUMMARY, not introduced by this plan).
- **How to verify when key is available:**
  1. `npm run dev`, log in, visit `/clinica/agenda`
  2. Confirm Bot trigger appears `bottom-right`; click → Sheet slides in
  3. Empty state shows "Olá, como posso ajudar?" + 3 agenda chips
  4. Click a chip → streamed answer (or graceful 503 error bubble if key absent)
  5. "Limpar conversa" → messages clear, chips reappear, no dialog
  6. Navigate to `/clinica/financeiro` → trigger present, financeiro chips
  7. Confirm NO action buttons in panel (D-05)

---

## Known Stubs

None. All components render live data from `useChat` messages and `usePathname`. No hardcoded empty values flow to UI rendering. Suggested prompts are static copy (intentional — no dynamic data needed).

---

## Threat Surface Scan

No new network endpoints or auth paths introduced. Components are client-only UI consuming the `/api/copilot` endpoint (already in 05-02 threat model). No new trust boundary introduced.

T-5-ui-eop: Confirmed — panel has NO action buttons. "Limpar conversa" clears in-memory only (`setMessages([])`), no server mutation. D-05 enforced.

---

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/components/copilot/CopilotSidebar.tsx | FOUND |
| src/components/copilot/CopilotTrigger.tsx | FOUND |
| src/app/(dashboard)/clinica/layout.tsx | FOUND |
| src/lib/stores/copilot-store.ts | FOUND |
| src/components/ui/sheet.tsx | FOUND |
| src/components/ui/scroll-area.tsx | FOUND |
| commit 4d60986 | FOUND |
| commit ca076a8 | FOUND |
