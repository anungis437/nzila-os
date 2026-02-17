#!/usr/bin/env python3
"""Run pending database migrations (cross-platform)."""

import sys
import os
import subprocess
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent


def main() -> None:
    # Ensure DATABASE_URL is set
    if not os.environ.get("DATABASE_URL"):
        print("ERROR: DATABASE_URL is not set. Export it or add it to .env.local.")
        sys.exit(1)

    print("==> Running database migrations ...")

    os.chdir(REPO_ROOT)
    subprocess.run(
        ["pnpm", "--filter", "{{PRIMARY_APP_PATH}}", "run", "db:migrate"],
        check=True,
    )

    print("==> Migrations applied successfully.")


if __name__ == "__main__":
    main()
