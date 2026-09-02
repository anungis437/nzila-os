/**
 * db/rls-storage-authority-manifest.ts
 *
 * PR #752 round 9: COMPATIBILITY FACADE. The canonical storage-authority
 * registry used to live entirely in this single file (8009 lines), which
 * exceeded the repository's 8000-line hard cap
 * (tooling/contract-tests/file-size-enforcement.test.ts). It has been
 * split into domain-partitioned modules under db/rls-storage-authority/
 * (see db/rls-storage-authority/types.ts for the full doctrine and
 * db/rls-storage-authority/index.ts for the composition). This file
 * contains NO registry data of its own — it only re-exports the composed
 * registry so every existing `from '.../rls-storage-authority-manifest'`
 * import keeps working unchanged.
 *
 * Add new entries to the appropriate domain module under
 * db/rls-storage-authority/, never here.
 */
export * from './rls-storage-authority'
