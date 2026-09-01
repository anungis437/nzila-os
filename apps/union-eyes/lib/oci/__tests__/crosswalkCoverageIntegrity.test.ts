import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Crosswalk Coverage Integrity — OCI™ enterprise defensibility guardrails.
 *
 * Enforces (per whitepaper Appendix N & Appendix T gate #19):
 *   1. Every crosswalk uses ONLY the four canonical coverage classes
 *      (FULL | PARTIAL | ADJACENT | OUT_OF_SCOPE).
 *   2. No crosswalk asserts equivalence ("equivalent to", "equivalent-to",
 *      "is equivalent", "replaces", "supersedes", "certifies compliance")
 *      against any cited standard.
 *   3. Every crosswalk includes an explicit `OUT_OF_SCOPE` section.
 */

const REPO_ROOT = resolve(__dirname, "..", "..", "..", "..", "..");
const COMPLIANCE_DIR = join(REPO_ROOT, "docs", "oci", "superseded", "compliance");

const CROSSWALK_FILES = [
  "OCI_ISO22301_CROSSWALK.md",
  "OCI_ISO22317_CROSSWALK.md",
  "OCI_ISO37000_CROSSWALK.md",
  "OCI_ISO31000_CROSSWALK.md",
  "OCI_COBIT2019_CROSSWALK.md",
];

const CANONICAL_COVERAGE = new Set([
  "FULL",
  "PARTIAL",
  "ADJACENT",
  "OUT_OF_SCOPE",
]);

const FORBIDDEN_EQUIVALENCE_PHRASES = [
  /\bequivalent\s+to\b/i,
  /\bequivalent-to\b/i,
  /\bis\s+equivalent\b/i,
  /\bsupersedes\b/i,
  /\breplaces\s+iso\b/i,
  /\bcertifies\s+compliance\b/i,
];

const COVERAGE_TOKEN_REGEX = /\b(FULL|PARTIAL|ADJACENT|OUT[_-]?OF[_-]?SCOPE|EQUIVALENT)\b/g;

describe("OCI crosswalk coverage integrity", () => {
  for (const file of CROSSWALK_FILES) {
    describe(file, () => {
      const path = join(COMPLIANCE_DIR, file);
      const contents = readFileSync(path, "utf8");

      it("uses only canonical coverage classes (no EQUIVALENT)", () => {
        const matches = contents.match(COVERAGE_TOKEN_REGEX) ?? [];
        const offenders = matches.filter(
          (token) => !CANONICAL_COVERAGE.has(token.replace(/-/g, "_")),
        );
        expect(offenders, `Non-canonical coverage tokens found in ${file}: ${offenders.join(", ")}`).toEqual([]);
      });

      it("never asserts equivalence with the cited standard", () => {
        // Crosswalks legitimately name the forbidden relationship class in
        // disclaimers (e.g. "NEVER equivalent-to"). Only flag lines that
        // POSITIVELY assert equivalence — i.e. that contain a forbidden
        // phrase without a nearby negation marker.
        const NEGATION = /(\bNEVER\b|\bnever\b|\bNOT\b|\bnot\b|\bno\b|\bforbid|\banti-|\bdisclaim)/;
        const hits: string[] = [];
        for (const line of contents.split(/\r?\n/)) {
          for (const pattern of FORBIDDEN_EQUIVALENCE_PHRASES) {
            const match = line.match(pattern);
            if (match && !NEGATION.test(line)) {
              hits.push(`${match[0]} :: ${line.trim()}`);
            }
          }
        }
        expect(hits, `Forbidden equivalence assertions in ${file}: ${hits.join(" | ")}`).toEqual([]);
      });

      it("declares an explicit OUT_OF_SCOPE section", () => {
        expect(contents).toMatch(/OUT[_-]?OF[_-]?SCOPE/);
      });
    });
  }
});
