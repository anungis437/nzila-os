# Changelog

All notable changes to the Nzila Automation platform will be documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- **Pre-commit guardrails**: Lefthook hooks for gitleaks secret scanning, ESLint, and TypeScript checking on every commit; contract tests on push. (`lefthook.yml`)
- **Gitleaks monorepo config**: Custom `.gitleaks.toml` with Nzila-specific secret patterns (Clerk, Stripe, Azure Key Vault, database URLs, QBO) and monorepo allowlists.
- **CI secret-scan uses repo config**: `secret-scan.yml` now references `.gitleaks.toml` for consistent scanning rules between local and CI.
- **Contract test**: `precommit-guardrails.test.ts` verifies hooks, config, and docs exist.
- **Hardening docs**: `docs/hardening/BASELINE.md` (Phase 0 baseline report), `docs/hardening/secrets.md` (secret scanning guide).
