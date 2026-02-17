#!/usr/bin/env python3
"""Bootstrap courtlens-platform for local development (cross-platform)."""

import sys
import os
import subprocess
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent


def main() -> None:
    print("==> Bootstrapping courtlens-platform ...")

    # 1. Install pnpm dependencies
    print("--- Installing pnpm dependencies ---")
    os.chdir(REPO_ROOT)
    subprocess.run(["pnpm", "install", "--frozen-lockfile"], check=True)

    # 2. Copy environment template if .env.local does not exist
    env_local = REPO_ROOT / ".env.local"
    env_example = REPO_ROOT / ".env.example"
    if not env_local.exists():
        print("--- Copying .env.example → .env.local ---")
        env_local.write_text(env_example.read_text())
    else:
        print("--- .env.local already exists, skipping copy ---")

    # 3. Database setup placeholder
    print("--- Running database setup ---")
    result = subprocess.run(
        ["pnpm", "--filter", "apps/web", "run", "db:push"]
    )
    if result.returncode != 0:
        print("WARNING: db:push failed — verify DATABASE_URL in .env.local")

    print(
        "==> Bootstrap complete. Run 'pnpm --filter apps/web run dev' to start."
    )


if __name__ == "__main__":
    main()
