# Institutional extension source preservation

This draft preserves the 57-file institutional extension from the isolated
`agents/pasted-text-processing-4a973147` worktree on current main. It does not
continue Checkpoint 5, introduce production persistence, expose a route, deploy,
or authorize customer data. The original worktree is retained untouched.

The [manifest](./INSTITUTIONAL_EXTENSION_PRESERVATION_MANIFEST.json) classifies
every source file, its purpose, origin and SHA-256. Fifty-six files are exact
byte copies at transfer. The lockfile carries only the two intended workspace
importer changes onto main's current lockfile; main's resolutions are retained.
Hook-required repository inventory is generated separately from this source set.

## Semantic boundaries

- Extend the existing institutional-intelligence package through its opt-in
  foundation and operating exports; preserve existing lineage/dependency APIs.
- Mission lifecycle, specialist acceptance, institutional operations and read
  models are embedded capabilities. No standalone NIA implementation is claimed.
- Ontology and directed graph additions are opt-in subpaths. Shared contracts
  define explicit scopes and provenance; shape validation does not grant trust.
- The existing local SQLite adapter is a synthetic persistence proof. It is not
  a production store, and this preservation adds no database or migration.
- Existing checkpoint documents retain their historical baselines and holds.
  Their old shared-DB coordination observations are not a fresh ruling on main.

MISSION's horizon is **Institutional Mission Intelligence**. **Funding Design
Workbench** is the initial product. Mission is not equivalent to funding; this
generic institutional runtime does not implement or certify the entire horizon
or the initial product.

## Qualification boundary

Run affected package lint/typechecks and tests, docs validation, governance audit,
secret scan and the repository inventory required by the existing hooks. This is
a preservation draft, not a request for PR review or a production qualification.
Full repository review gates remain required before requesting review.

After commit, verify all 57 intended source files against committed blobs and
the original source hashes. A clean preserved branch does not imply that the
retained original worktree has been cleaned.
