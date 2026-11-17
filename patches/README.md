# Reviewed dependency patches

`picomatch@4.0.7.patch` addresses the known single-branch repeated-extglob
backtracking patterns in [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)
and multi-character literal prefix overlap described in the upstream issue.
The registry's latest release is 4.0.7 and the advisory lists no patched release
as observed on November 17, 2026. This patch is not an upstream release or an
audit waiver. The unmodified advisory scan continues to report the HIGH finding.

The patch extends the existing parser's risky-pattern literalization to repeated
wildcard operands and overlapping literal prefixes, including case-insensitive
JavaScript and Unicode case folding. It preserves safe flattened
character repetitions and ordinary globs. The recursion tuning option cannot
disable these security guards. Risky expressions are matched literally, following
the parser's existing safety behavior; they do not retain unrestricted extglob
matching semantics.

The lockfile binds the patch's SHA-256. Docker copies the patch before the frozen
dependency installation. The SBOM records the upstream tarball separately from
the patch and verifies the committed patch digest.

Run `node --test tooling/security/picomatch-repeated-extglob.test.mjs`. The exploit
cases execute in killable subprocesses with a fixed timeout. The same cases fail
against the integrity-verified, unpatched upstream tarball. This evidence covers
the named cases, and does not claim all possible regular expressions are safe.

Replace this patch only after reviewing a verified upstream fix and rerunning the
dependency scan, these regressions, the application build and the applicable
integrated qualification checks. No vulnerability threshold is relaxed here.
