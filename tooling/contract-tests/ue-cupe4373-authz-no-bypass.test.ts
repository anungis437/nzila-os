/**
 * Contract Test — Cupe4373 Demo Authz: No Bypass Regression
 *
 * Asserts that the surface area where the `isCupe4373DemoRuntime()`
 * authorization bypass was deliberately REMOVED (as part of Gap 7 closure)
 * never re-introduces it. These files must always run their real role
 * check against the seeded demo personas (member / steward / officer),
 * never short-circuit because the runtime profile happens to be demo.
 *
 * If you intentionally need to grant demo-mode access to one of these
 * surfaces, do it via the role assignment in the seed
 * (`scripts/seed-cupe4373-demo.ts`) — never by re-adding a runtime bypass.
 *
 * @invariant UE-AUTHZ-NO-BYPASS-001
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');

/**
 * Files where the cupe4373 demo bypass MUST NOT appear. Each entry is a
 * workspace-relative path. The contract is: the literal substring
 * `isCupe4373DemoRuntime` may not occur anywhere in the file.
 */
const NO_BYPASS_FILES = [
  // Dashboard route guard — must always enforce minRole
  'apps/union-eyes/lib/dashboard/require-dashboard-access.ts',
  // GET/POST /api/members — must not short-circuit on demo profile
  'apps/union-eyes/app/api/members/route.ts',
] as const;

const FORBIDDEN_TOKEN = 'isCupe4373DemoRuntime';

describe('UE-AUTHZ-NO-BYPASS-001 — Cupe4373 demo bypass removed from authz surfaces', () => {
  for (const rel of NO_BYPASS_FILES) {
    it(`${rel} contains no isCupe4373DemoRuntime reference`, () => {
      const abs = join(ROOT, rel);
      expect(
        existsSync(abs),
        `Expected protected authz surface to exist: ${rel}`,
      ).toBe(true);

      const content = readFileSync(abs, 'utf-8');
      const found = content.includes(FORBIDDEN_TOKEN);

      expect(
        found,
        [
          `Forbidden cupe4373 demo bypass token "${FORBIDDEN_TOKEN}" found in ${rel}.`,
          'This surface must enforce its real role/auth check — never short-circuit on demo profile.',
          'If you need demo-mode access, grant it via the seeded persona role',
          '(scripts/seed-cupe4373-demo.ts), not via a runtime bypass.',
        ].join('\n'),
      ).toBe(false);
    });
  }
});
