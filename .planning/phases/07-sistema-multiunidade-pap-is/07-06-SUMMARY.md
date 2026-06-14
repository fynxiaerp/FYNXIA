---
phase: "07"
plan: "06"
subsystem: icp-keystore-ai-config-rbac-ui
tags: [sys-02, sys-03, sys-04, role-02, icp-brasil, certificates, ai-agent-config, pfx, aes-encrypt, rbac-matrix, server-actions, rhf, zod, design-system]
dependency_graph:
  requires:
    - "07-03: MODULE_PERMISSIONS matrix + isReadOnly + extractPfxMetadata + assertNotReadOnly + certificates/ai_agent_config migrations"
    - "07-04: db push applied all migrations; certificates + ai_agent_config tables live"
    - "07-05: config route pattern (empresa page), assertNotReadOnly guard established"
  provides:
    - "src/lib/validators/certificate.ts: certificateSchema (5MB cap, .pfx/.p12 only, password non-empty)"
    - "src/actions/certificate.ts: uploadCertificate (assertNotReadOnly → admin/superadmin/ti gate → extractPfxMetadata → expiry check → service-role bucket → encrypt(password) → insert → audit); getCertificate return type CertificatePublic = Omit<CertRow, 'cert_password_enc'|'storage_path'>"
    - "src/actions/ai-agent-config.ts: listAiAgentConfig + saveAiAgentConfig (assertNotReadOnly + admin gate + onConflict clinic_id,agent_key)"
    - "src/lib/ai-agent-config-types.ts: AUTONOMY_LEVELS, AGENT_KEYS, AiAgentConfigRow types (extracted from 'use server' file)"
    - "src/app/(dashboard)/config/certificado/page.tsx: SYS-02 cert upload + metadata view"
    - "src/app/(dashboard)/config/ia/page.tsx: SYS-04 AI autonomy config (L0-L4 per agent)"
    - "src/app/(dashboard)/config/perfis/page.tsx: SYS-03 read-only perfis matrix"
    - "src/components/config/CertificateUpload.tsx: cert upload form + metadata card display"
    - "src/components/config/AiAutonomyForm.tsx: per-agent L0-L4 Select + enabled Switch"
    - "src/components/config/PerfisMatrix.tsx: 11-role x 7-module read-only table from MODULE_PERMISSIONS"
    - "src/__tests__/config/certificate.test.ts: 46 tests covering all above"
  affects:
    - "Phase 8 (DOC): cert signing reads certificates.storage_path + cert_password_enc server-side via admin client"
    - "Phase 10 (AIG): ai_agent_config autonomy enforcement reads this plan's stored config"
    - "All future plans: assertNotReadOnly pattern + admin gate pattern established in cert + AI actions"
tech_stack:
  added: []
  patterns:
    - "'use server' files can only export async functions — constants/types extracted to src/lib/ai-agent-config-types.ts"
    - "CertificatePublic = Omit<CertRow, 'cert_password_enc' | 'storage_path'> — compile-time secret exclusion"
    - "uploadCertificate: FormData → Buffer → extractPfxMetadata → expiry check → createAdminClient().storage → encrypt() → insert"
    - "File upload validation: filename extension + sizeBytes checked in certificateSchema (server-side); File object validated in action before forwarding"
    - "AiAutonomyForm: useTransition for optimistic updates + revert on failure (consistent with UnitsManager pattern)"
    - "@base-ui Select.Root onValueChange receives (value: T | null, eventDetails) — handler must guard against null"
key_files:
  created:
    - src/lib/validators/certificate.ts
    - src/actions/certificate.ts
    - src/actions/ai-agent-config.ts
    - src/lib/ai-agent-config-types.ts
    - src/app/(dashboard)/config/certificado/page.tsx
    - src/app/(dashboard)/config/ia/page.tsx
    - src/app/(dashboard)/config/perfis/page.tsx
    - src/components/config/CertificateUpload.tsx
    - src/components/config/AiAutonomyForm.tsx
    - src/components/config/PerfisMatrix.tsx
    - src/__tests__/config/certificate.test.ts
  modified: []
key-decisions:
  - "Constants and types extracted from ai-agent-config.ts into src/lib/ai-agent-config-types.ts — Next.js enforces that 'use server' files export only async functions; exporting const/type causes runtime build failure"
  - "AiAutonomyForm.tsx imports saveAiAgentConfig from @/actions/ai-agent-config and types from @/lib/ai-agent-config-types to satisfy both the 'use server' constraint and client component usage"
  - "CertificateUpload uses Alert (not sonner) for feedback — consistent with EmpresaForm v1 convention; sonner is not in package.json"
  - "getCertificate selects explicit column list (excluding cert_password_enc and storage_path) + uses CertificatePublic = Omit<CertRow, ...> — double protection: column omission at query level + type exclusion at compile time"
  - "@base-ui Select.Root onValueChange callback signature is (value: T | null, eventDetails) not (value: string) — handler must guard against null with early return"
  - "PerfisMatrix is 'use client' (simpler; no server data needed — MODULE_PERMISSIONS is a static export from proxy.ts)"
requirements-completed: [SYS-02, SYS-03, SYS-04, ROLE-02]
duration: 14min
completed: "2026-06-14"
---

# Phase 07 Plan 06: Certificado ICP + Autonomia IA + Perfis Config UI Summary

ICP-Brasil A1 certificate secure keystore (upload .pfx → node-forge metadata extraction → expiry rejection → service-role private bucket → AES-256-GCM password encryption → Omit<> type-level secret exclusion), AI autonomy L0–L4 config per agent persisted to ai_agent_config, and read-only 11-role × 7-module permission matrix display — all admin-gated with assertNotReadOnly().

---

## Performance

- **Duration:** 14 min
- **Started:** 2026-06-14T02:30:18Z
- **Completed:** 2026-06-14T02:44:09Z
- **Tasks:** 3
- **Files created:** 11

## Accomplishments

- SYS-02: ICP-Brasil A1 certificate upload flow — validates .pfx/.p12 (≤5MB, node-forge parse, expiry check), stores bytes in private `icp-certificates` bucket via service role, AES-256-GCM encrypts password, inserts metadata row; `getCertificate` return type is `CertificatePublic = Omit<CertRow, 'cert_password_enc' | 'storage_path'>` — secrets excluded at compile time (T-07-18)
- SYS-04: AI autonomy config UI — per-agent (confirmation, collection) L0–L4 Select + enabled Switch calling `saveAiAgentConfig` which upserts with `onConflict: 'clinic_id,agent_key'` (partial unique index match); Fase 10 note inline
- SYS-03: Perfis matrix — read-only shadcn Table rendering all 11 roles × 7 modules from `MODULE_PERMISSIONS` (proxy.ts source of truth); governance roles (socio/dpo) can view /config/perfis (config readOnly:true); auditor has no /config access

## Task Commits

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Certificate validator + upload Server Action | 30b653d | src/lib/validators/certificate.ts, src/actions/certificate.ts |
| 2 | AI autonomy action + certificado/ia/perfis pages + components | 1c23f20 | src/actions/ai-agent-config.ts, src/lib/ai-agent-config-types.ts, 3 pages, 3 components |
| 3 | Tests for certificate validation + AI config gate + perfis matrix | 4b8fd22 | src/__tests__/config/certificate.test.ts |

---

## Verification

- `npx vitest run src/__tests__/config/certificate.test.ts` → 46 PASS (GREEN)
- `npx vitest run` (full suite) → 653 tests, 43 files, all GREEN (no regressions)
- `npx tsc --noEmit` → exit 0 (clean after each task)
- `npx next build` → green; /config/certificado, /config/ia, /config/perfis all appear in route list
- Confirmed: `MODULE_PERMISSIONS.socio.config?.readOnly === true` (WARNING 6 — governance can view /config/perfis)
- Confirmed: `MODULE_PERMISSIONS.auditor.config === undefined` (auditor blocked from /config entirely)
- Confirmed: no raw `slate-`/`gray-`/`text-white`/`bg-white` in the 3 new components (grep returns comments only)
- Confirmed: `getCertificate` selects explicit column list + CertificatePublic Omit<> — double secret exclusion

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 'use server' file cannot export non-async values**
- **Found during:** Task 2 — `npx next build`
- **Issue:** `ai-agent-config.ts` exported `AUTONOMY_LEVELS`, `AGENT_KEYS`, `AiAgentConfigRow` (constants + interface). Next.js 16 runtime throws `"A 'use server' file can only export async functions, found object"` — causes build failure for `/config/ia`.
- **Fix:** Extracted all non-async exports to `src/lib/ai-agent-config-types.ts`. Both `ai-agent-config.ts` (action) and `AiAutonomyForm.tsx` (client component) import types from the new file.
- **Files modified:** src/actions/ai-agent-config.ts, src/components/config/AiAutonomyForm.tsx; created src/lib/ai-agent-config-types.ts
- **Verification:** `npx next build` green after fix
- **Committed in:** 1c23f20

**2. [Rule 1 - Bug] @base-ui Select.Root onValueChange callback signature mismatch**
- **Found during:** Task 2 — `npx tsc --noEmit`
- **Issue:** The shadcn `<Select>` is built on `@base-ui/react/select`. Its `onValueChange` prop signature is `(value: T | null, eventDetails: SelectRootChangeEventDetails) => void`, not `(value: string) => void`. TypeScript raised TS2322 on the `handleLevelChange` handler in `AiAutonomyForm.tsx`.
- **Fix:** Changed handler signature to `(value: AutonomyLevel | null)` with early return on null.
- **Files modified:** src/components/config/AiAutonomyForm.tsx
- **Verification:** `npx tsc --noEmit` clean
- **Committed in:** 1c23f20

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs caught by build/tsc before commit)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

---

## Known Stubs

None — all data flows are wired:
- CertificateUpload loads real cert metadata from `getCertificate()` and submits to `uploadCertificate()` Server Action
- AiAutonomyForm loads from `listAiAgentConfig()` and saves via `saveAiAgentConfig()` Server Action
- PerfisMatrix imports and renders live `MODULE_PERMISSIONS` from proxy.ts (not a hardcoded table)

---

## Threat Flags

All mitigations from plan's threat model applied:

| Threat | Mitigation Applied |
|--------|-------------------|
| T-07-18 (cert_password_enc / storage_path leaking to client) | Explicit column select in getCertificate (no storage_path/cert_password_enc); CertificatePublic = Omit<CertRow, 'cert_password_enc' \| 'storage_path'> compile-time guarantee; password AES-256-GCM encrypted before insert |
| T-07-19 (read-only/non-admin uploading cert or raising AI autonomy) | assertNotReadOnly() first in uploadCertificate + saveAiAgentConfig; admin/superadmin(/ti for cert) role gate |
| T-07-20 (oversized .pfx upload) | certificateSchema: sizeBytes.max(MAX_CERT_SIZE_BYTES) = 5 MB cap |
| T-07-21 (malicious certificate subject) | extractPfxMetadata output treated as display-only; parameterized inserts; expired certs rejected |
| T-07-22 (invalid cert / wrong password accepted) | extractPfxMetadata throws → upload aborted with friendly Portuguese error |

---

## Self-Check

| Check | Result |
|-------|--------|
| src/lib/validators/certificate.ts exists | FOUND |
| src/lib/validators/certificate.ts contains MAX_CERT_SIZE_BYTES | FOUND |
| src/actions/certificate.ts exists | FOUND |
| src/actions/certificate.ts contains assertNotReadOnly | FOUND |
| src/actions/certificate.ts contains encrypt( | FOUND |
| src/actions/certificate.ts contains icp-certificates | FOUND |
| src/actions/certificate.ts contains createAdminClient | FOUND |
| src/actions/certificate.ts contains not_after < new Date() | FOUND |
| src/actions/certificate.ts contains Omit< | FOUND |
| src/actions/certificate.ts contains cert_password_enc | FOUND |
| src/actions/certificate.ts contains storage_path | FOUND |
| src/actions/certificate.ts contains CertificatePublic | FOUND |
| src/actions/ai-agent-config.ts exists | FOUND |
| src/actions/ai-agent-config.ts contains assertNotReadOnly | FOUND |
| src/actions/ai-agent-config.ts contains AUTONOMY_LEVELS | FOUND |
| src/actions/ai-agent-config.ts contains onConflict.*clinic_id,agent_key | FOUND |
| src/lib/ai-agent-config-types.ts contains L0..L4 | FOUND |
| src/app/(dashboard)/config/certificado/page.tsx contains PageHeader | FOUND |
| src/app/(dashboard)/config/ia/page.tsx contains PageHeader | FOUND |
| src/app/(dashboard)/config/perfis/page.tsx contains PageHeader | FOUND |
| src/components/config/CertificateUpload.tsx contains uploadCertificate | FOUND |
| src/components/config/AiAutonomyForm.tsx contains saveAiAgentConfig | FOUND |
| src/components/config/PerfisMatrix.tsx contains MODULE_PERMISSIONS | FOUND |
| src/__tests__/config/certificate.test.ts exists | FOUND |
| 46 tests GREEN | CONFIRMED |
| 653 total tests GREEN (no regressions) | CONFIRMED |
| tsc --noEmit exit 0 | CONFIRMED |
| next build green | CONFIRMED |
| commit 30b653d | FOUND |
| commit 1c23f20 | FOUND |
| commit 4b8fd22 | FOUND |

## Self-Check: PASSED
