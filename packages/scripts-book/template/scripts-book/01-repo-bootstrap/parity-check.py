#!/usr/bin/env python3
"""Verify every .sh has matching .ps1 AND .py, every .ps1 has matching .sh AND .py, and every .py has matching .sh AND .ps1."""

import sys
import os
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
BOOK_ROOT = SCRIPT_DIR.parent

EXTENSIONS = [".sh", ".ps1", ".py"]


def main() -> None:
    exit_code = 0

    print(f"==> Checking .sh / .ps1 / .py parity in {BOOK_ROOT} ...")

    # Collect all script files by extension
    scripts: dict[str, list[Path]] = {ext: [] for ext in EXTENSIONS}
    for ext in EXTENSIONS:
        scripts[ext] = sorted(BOOK_ROOT.rglob(f"*{ext}"))

    # For each extension, verify the other two counterparts exist
    for ext in EXTENSIONS:
        other_exts = [e for e in EXTENSIONS if e != ext]
        for script_path in scripts[ext]:
            for other_ext in other_exts:
                counterpart = script_path.with_suffix(other_ext)
                if not counterpart.exists():
                    print(f"MISSING {other_ext} for: {script_path}")
                    exit_code = 1

    if exit_code == 0:
        print("==> All scripts have matching triplets. Parity OK.")
    else:
        print("==> Parity check FAILED. See mismatches above.")

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
