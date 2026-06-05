# Deferred Items — Phase 02 Clinical MVP

## Out-of-scope pre-existing TypeScript errors

These errors existed before 02-03 and are NOT caused by 02-03 changes.
Confirmed by `git stash` test showing same errors at the 9fdc7a3 commit.

| File | Error | Status |
|------|-------|--------|
| `src/components/agenda/AgendaCalendar.tsx:8` | `Cannot find module '@fullcalendar/core'` — `@fullcalendar/core` types not in `dependencies` | Pre-existing from 02-02 |
| `src/components/agenda/AgendaCalendar.tsx:320` | `Parameter 'arg' implicitly has an 'any' type` | Pre-existing from 02-02 |

**Suggested fix (for 02-04 or maintenance):** Add `@fullcalendar/core` to `devDependencies` or `dependencies`, add explicit type annotation to the `arg` parameter in the eventContent callback.
