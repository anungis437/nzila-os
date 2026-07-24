/**
 * Union-Eyes E2E — Bilingual Smoke Tests (FR-CA)
 *
 * Phase 0C.2 §13 — Populates the `bilingual-fr` Playwright project wired
 * in §8. Matched by testMatch glob `e2e/bilingual/**\/*.fr.spec.ts`.
 *
 * All assertions are delegated to `runBilingualSmokeSuite('fr-CA')` so
 * that the EN and FR spec files remain structurally identical and any
 * behavioural drift between locales must appear inside the shared helper
 * — not in one spec but not the other.
 *
 * Project use options (from playwright.config.ts):
 *   storageState: STORAGE_STATE_PATHS.member
 *   locale: 'fr-CA'
 *   dependencies: ['setup']
 */
import { runBilingualSmokeSuite } from './_helpers';

runBilingualSmokeSuite('fr-CA');
