# Repository convergence source preservation

This is an inert archive of 144 historical source/configuration variants found during the 2026-10-17 repository cleanup. It preserves unmatched local material without applying it to the accepted application source. The initial base is recorded in SOURCE_MANIFEST.json.

The archive contains older Cora variants and two local integration tests, local authorization acceptance helpers, selected historical UE proof scripts, documentation variants, and infrastructure qualification harness inputs. These are retained for explicit maintainer disposition. They are not a new engineering increment, validated fixes, current readiness evidence, or a request to merge historical source into main. Existing product and operational holds remain in force.

[source-snapshots.zip](source-snapshots.zip) contains byte-exact snapshots. [SOURCE_MANIFEST.json](SOURCE_MANIFEST.json) maps every member to its original path, source worktree ID, origin branch/head and SHA-256. Worktree 0 is the former primary workspace; worktree 10 is the infrastructure provenance checkout. Duplicate names in different historical stages are intentional evidence of those stages.

The extracted source archive was scanned with the repository Gitleaks configuration. Three findings are loopback PostgreSQL credentials in synthetic acceptance-test defaults; their exact paths and lines are classified in the manifest. No scanner policy or allowlist was changed. No live credentials, cloud state, downloaded toolchains, binaries, customer data or large generated schema/census outputs are included in this archive. Broader local execution evidence is retained separately outside Git worktrees.

Validation here establishes archive byte integrity and source preservation. It does not qualify the archived historical implementation. This preservation PR is a draft, and no product merge or deployment is authorized by cleanup.
