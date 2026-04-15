# @nzila/contracts

Supporting contract package for domain-local and migration compatibility use.

## Owns

- Domain-local contract helper modules
- Compatibility contract utilities for packages not yet migrated

## Does Not Own

- Canonical cross-app platform contract surface

## New Work Guidance

- New cross-app or platform-facing contracts must be implemented in @nzila/platform-contracts.
- Keep this package for subordinate/domain-specific helpers and migration continuity.
