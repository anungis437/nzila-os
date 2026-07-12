// Test stub for the `server-only` package so server modules can be imported in
// the node test environment. In production, `server-only` throws if pulled into
// a client bundle; under vitest we replace it with a no-op.
export {}
