---
phase: quick
plan: 260718-w0u
subsystem: repo-hygiene
tags: [git, security, gitignore]
requires: []
provides: [git-hygiene, secret-protection]
affects: [.gitignore]
tech-stack:
  added: []
  patterns: ["ignore-before-commit for local secret files"]
key-files:
  created: []
  modified:
    - .gitignore
decisions:
  - "Split into two atomic commits (ignore rules, then doc commit) rather than one combined commit — matches the per-task commit protocol even though the plan described a single commit outcome"
metrics:
  duration: "~5 min"
  completed: 2026-07-18
---

# Quick Task 260718-w0u: Ignore `.mcp.json`/`.playwright-mcp/` and commit pending docs Summary

Added `.gitignore` rules to permanently prevent the plaintext `VERCEL_TOKEN` in `.mcp.json` and local Playwright browser-test artifacts from ever entering git history, then committed already-produced Phase 16/17 planning documentation plus `.vercelignore`.

## What Was Done

**Task 1 — `.gitignore` update:** Appended two ignore rules after the existing "local scratch / temp" block:
```
# MCP local config (contains real tokens/secrets — never commit)
.mcp.json

# Playwright MCP local cache/logs (browser-test artifacts)
.playwright-mcp/
```
Verified with `git check-ignore .mcp.json .playwright-mcp/` — both paths returned, confirming they are ignored. `git status --porcelain` no longer lists either path.

**Task 2 — Commit pending docs:** Staged and committed exactly 6 explicit paths (no `git add -A`/`git add .` used):
- `.vercelignore` (DEPLOY-HANDOFF pre-check #1)
- `.planning/phases/16-contas-a-pagar-concilia-o-tributos/16-UAT.md` (modified)
- `.planning/phases/17-estoque-materiais/17-01-PLAN.md` (new)
- `.planning/phases/17-estoque-materiais/17-02-PLAN.md` (modified)
- `.planning/phases/17-estoque-materiais/17-VALIDATION.md` (new)
- `.planning/quick/260629-ivj-criar-pagina-de-gerenciamento-de-fornece/selectvalue-fix-SUMMARY.md` (new)

Confirmed `git diff --cached --name-only` matched exactly these 6 paths before committing — no `.mcp.json`, no `.playwright-mcp/`, no `.docx`, no `.claude/` slipped in.

No `git push` or `vercel` command was run at any point.

## Deviations from Plan

**Two commits instead of one.** The plan's Task 1/Task 2 structure and the per-task commit protocol (each task committed atomically) meant `.gitignore` was committed separately from `.vercelignore` + the planning docs, rather than the single combined commit implied by the plan's `<output>` framing. Both commits together satisfy the plan's `must_haves` and `success_criteria` — content and scope are identical to what a single commit would have contained, just split across two commits:
- `826724a` — chore(repo): ignore .mcp.json and .playwright-mcp/
- `3e95fd4` — chore(repo): commit .vercelignore and pending phase 16/17 docs

No auto-fixed issues (Rules 1-3) were needed; no architectural decisions (Rule 4) arose.

## Verification Results

```
git check-ignore .mcp.json .playwright-mcp/
  → .mcp.json
  → .playwright-mcp/

git status --short (after both commits)
  ?? .claude/
  ?? .planning/quick/260718-w0u-adicionar-mcp-json-e-playwright-mcp-ao-g/
  ?? ARQUITETURA.docx
  ?? FYNXIA-ERP.md
```
Only out-of-scope items remain untracked (as expected — explicitly excluded by the plan). `.mcp.json` and `.playwright-mcp/` no longer appear at all (ignored). No secrets committed (`git show --stat` on both commits confirms only intended files).

## Known Stubs

None — this was a pure git-hygiene task, no application code touched.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. This task strictly reduces threat surface (prevents a plaintext secret from reaching git history).

## Self-Check: PASSED

- `.gitignore` contains `.mcp.json` and `.playwright-mcp/` — FOUND (verified via `git check-ignore`)
- Commit `826724a` exists — FOUND (`git log --oneline --all | grep 826724a`)
- Commit `3e95fd4` exists — FOUND (`git log --oneline --all | grep 3e95fd4`)
- `.vercelignore` tracked — FOUND (`git show --stat 3e95fd4` lists it)
- Phase 16/17 docs tracked — FOUND (`git show --stat 3e95fd4` lists all 4 planning files + SUMMARY)
