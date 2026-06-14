// Manual mock for 'server-only' package.
// Vitest respects __mocks__/ for both ESM (vi.mock) and CJS (require()).
// This allows server-only modules (pfx-metadata.ts, guards.ts, etc.)
// to be loaded in Vitest's Node test environment without throwing.
// Production behavior is unchanged — Next.js does NOT use __mocks__/.
