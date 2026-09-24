#!/usr/bin/env node
// Fails closed if inventory-relevant paths have unstaged/untracked changes,
// so `pnpm inventory:generate` never scans a mixed staged/unstaged tree.
import { execFileSync } from "node:child_process";

const PREFIXES = [
  "apps/",
  "packages/",
  "tooling/contract-tests/",
  ".github/workflows/",
  "governance/exceptions/",
];
const EXACT_FILES = new Set(["README.md", "README.business.md", "ARCHITECTURE.md"]);
const WORKSPACE_MANIFEST = /^(services|tooling)\/[^/]+\/package\.json$/;
const TOOLING_TEST = /^tooling\/.*\.(test|spec)\.(ts|tsx|js|jsx)$/;

function isInventoryRelevant(path) {
  if (EXACT_FILES.has(path)) return true;
  if (WORKSPACE_MANIFEST.test(path) || TOOLING_TEST.test(path)) return true;
  return PREFIXES.some((prefix) => path.startsWith(prefix));
}

const porcelain = execFileSync("git", ["status", "--porcelain=v1", "-z"], {
  encoding: "utf8",
});

const dirtyPaths = [];
for (const entry of porcelain.split("\0").filter(Boolean)) {
  const stagedStatus = entry[0];
  const unstagedStatus = entry[1];
  // entry[3..] is the path (renames use "old\0new"; the new path is what
  // shows up next in the -z stream, so this only inspects the reported path).
  const path = entry.slice(3);

  const hasUnstagedChange = unstagedStatus !== " " || stagedStatus === "?";
  if (hasUnstagedChange && isInventoryRelevant(path)) {
    dirtyPaths.push(path);
  }
}

if (dirtyPaths.length > 0) {
  console.error(
    "\n🚫 inventory-sync: unstaged/untracked changes found under inventory-relevant paths:\n"
  );
  for (const path of dirtyPaths) console.error(`  - ${path}`);
  console.error(
    "\n`pnpm inventory:generate` scans the working tree, not the staged set — " +
      "running it now would bake these unstaged changes into the commit.\n" +
      "Stage them (`git add`) or stash them (`git stash -k`) before committing.\n"
  );
  process.exit(1);
}
