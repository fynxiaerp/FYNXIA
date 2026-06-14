/**
 * Vitest global setup file.
 * Registered via vitest.config.ts setupFiles.
 *
 * Pre-registers 'server-only' as a no-op in Node's CJS require cache so that
 * server-only modules (pfx-metadata.ts, guards.ts, crypto.ts, etc.) can be
 * loaded via dynamic require() inside tests without throwing.
 *
 * ESM imports of 'server-only' are handled by vi.mock() in each test file.
 * This setup file handles the CJS require() path (used in pfx-metadata.test.ts
 * getExtractFn() helper).
 */

// Inject a no-op module into Node's require cache for 'server-only'
// Resolution: require.resolve finds the actual package path; we stub it.
import { createRequire } from 'node:module'

const req = createRequire(import.meta.url)

try {
  const serverOnlyPath = req.resolve('server-only')
  // Register a no-op stub in the require cache before any test loads it
  require.cache[serverOnlyPath] = {
    id: serverOnlyPath,
    filename: serverOnlyPath,
    loaded: true,
    exports: {},
    paths: [],
    children: [],
    parent: null,
    path: '',
  } as unknown as NodeJS.Module
} catch {
  // If server-only is not found, silently skip (not installed in some envs)
}
