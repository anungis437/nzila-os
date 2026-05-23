/**
 * Contract test: hard-fail vocabulary must not appear on UnionEyes public
 * marketing surfaces. This is the CI hard-stop for narrative drift.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import { describe, expect, it } from "vitest";

import { findViolations, PUBLIC_MESSAGES_NAMESPACES } from "../marketing/config/forbidden-vocabulary";

const APP_ROOT = path.resolve(__dirname, "..", "..");

const PUBLIC_MARKETING_ROUTES = [
  "trust",
  "story",
  "governance",
  "contact",
  "pilot-request",
  // "case-studies", // hidden until pilots complete
  "pricing",
  "solutions",
  "status",
  "platform",
  "features",
  "executive-intelligence",
  "insights",
  "organizational-continuity",
  "for-clc",
  "for-federations",
  "for-leadership",
  "for-members",
  "for-representatives",
  "proof",
];

async function collectPublicSurfaces(): Promise<string[]> {
  const marketing = await fg(
    [
      "app/[[]locale[]]/page.tsx",
      "app/[[]locale[]]/layout.tsx",
      "app/[[]locale[]]/(marketing)/layout.tsx",
      "app/[[]locale[]]/(marketing)/page.tsx",
      ...PUBLIC_MARKETING_ROUTES.map(
        (r) => `app/[[]locale[]]/(marketing)/${r}/**/page.tsx`,
      ),
      ...PUBLIC_MARKETING_ROUTES.map(
        (r) => `app/[[]locale[]]/(marketing)/${r}/**/layout.tsx`,
      ),
      ...PUBLIC_MARKETING_ROUTES.map(
        (r) => `app/[[]locale[]]/${r}/**/page.tsx`,
      ),
      ...PUBLIC_MARKETING_ROUTES.map(
        (r) => `app/[[]locale[]]/${r}/**/layout.tsx`,
      ),
      "app/(marketing)/**/page.tsx",
      "app/(marketing)/**/layout.tsx",
    ],
    {
      cwd: APP_ROOT,
      absolute: true,
    },
  );
  const messages = await fg("messages/*.json", {
    cwd: APP_ROOT,
    absolute: true,
  });
  return [...marketing, ...messages];
}

describe("marketing vocabulary (public surfaces)", () => {
  it("contains zero hard-fail forbidden terms", async () => {
    const files = await collectPublicSurfaces();
    expect(files.length).toBeGreaterThan(0);

    const failures: string[] = [];
    for (const abs of files) {
      const text = await fs.readFile(abs, "utf8");
      const isMessages = abs.replace(/\\/g, "/").includes("/messages/");
      const hits = findViolations(text, {
        isPublicSurface: true,
        ...(isMessages
          ? { publicMessagesNamespaces: PUBLIC_MESSAGES_NAMESPACES }
          : {}),
      }).filter((h) => h.term.severity === "hard-fail");
      for (const h of hits) {
        const rel = path.relative(APP_ROOT, abs).replace(/\\/g, "/");
        failures.push(
          `${rel}:${h.line}  [${h.term.category}] "${h.term.term}" — ${h.excerpt}`,
        );
      }
    }

    if (failures.length > 0) {
      throw new Error(
        `Hard-fail narrative vocabulary detected on public surfaces:\n` +
          failures.map((f) => `  - ${f}`).join("\n"),
      );
    }
  }, 30_000);
});
