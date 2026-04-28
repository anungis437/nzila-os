// Vitest shim for `server-only` — the real module throws when imported by
// non-server-component bundles, which trips up node-environment tests.
export {}
