/**
 * parity.ts — Parity enforcement for .sh / .ps1 / .py script triplets.
 */

import path from "node:path";
import fs from "fs-extra";
import fg from "fast-glob";
import pc from "picocolors";

const BASH_STUB = `#!/usr/bin/env bash
set -euo pipefail

# AUTO-GENERATED stub — implement parity for this script.
echo "TODO: implement parity"
exit 1
`;

const PS1_STUB = `Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# AUTO-GENERATED stub — implement parity for this script.
Write-Host "TODO: implement parity"
exit 1
`;

const PY_STUB = `#!/usr/bin/env python3
"""AUTO-GENERATED stub — implement parity for this script."""

import sys

def main() -> None:
    print("TODO: implement parity")
    sys.exit(1)

if __name__ == "__main__":
    main()
`;

const EXTENSIONS = [".sh", ".ps1", ".py"] as const;

const STUBS: Record<string, string> = {
  ".sh": BASH_STUB,
  ".ps1": PS1_STUB,
  ".py": PY_STUB,
};

export interface ParityResult {
  ok: boolean;
  missing: string[];
  generated: string[];
}

/**
 * Check and optionally fix script parity in a directory.
 *
 * @param dir       Directory to check
 * @param strict    If true, do NOT generate stubs — just report failures
 * @param fix       If true and not strict, generate stub files for missing pairs
 */
export async function enforceScriptParity(
  dir: string,
  strict: boolean,
  fix: boolean,
): Promise<ParityResult> {
  const missing: string[] = [];
  const generated: string[] = [];

  const shFiles = await fg("**/*.sh", { cwd: dir, onlyFiles: true });
  const ps1Files = await fg("**/*.ps1", { cwd: dir, onlyFiles: true });
  const pyFiles = await fg("**/*.py", { cwd: dir, onlyFiles: true });

  const scriptMap = new Map<string, Set<string>>();

  for (const f of shFiles) {
    const base = f.replace(/\.sh$/, "");
    if (!scriptMap.has(base)) scriptMap.set(base, new Set());
    scriptMap.get(base)!.add(".sh");
  }
  for (const f of ps1Files) {
    const base = f.replace(/\.ps1$/, "");
    if (!scriptMap.has(base)) scriptMap.set(base, new Set());
    scriptMap.get(base)!.add(".ps1");
  }
  for (const f of pyFiles) {
    const base = f.replace(/\.py$/, "");
    if (!scriptMap.has(base)) scriptMap.set(base, new Set());
    scriptMap.get(base)!.add(".py");
  }

  for (const [base, exts] of scriptMap) {
    for (const ext of EXTENSIONS) {
      if (!exts.has(ext)) {
        const filePath = `${base}${ext}`;
        missing.push(filePath);

        if (!strict && fix) {
          const fullPath = path.join(dir, filePath);
          await fs.ensureDir(path.dirname(fullPath));
          await fs.writeFile(fullPath, STUBS[ext], "utf-8");
          generated.push(filePath);
          console.log(pc.yellow(`  Generated stub: ${filePath}`));
        }
      }
    }
  }

  return {
    ok: missing.length === 0,
    missing,
    generated,
  };
}
