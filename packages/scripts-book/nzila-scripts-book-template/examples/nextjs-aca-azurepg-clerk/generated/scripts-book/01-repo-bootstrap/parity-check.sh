#!/usr/bin/env bash
set -euo pipefail

# -----------------------------------------------------------------------------
# parity-check.sh — Verify .sh / .ps1 / .py triplet parity for all scripts
# -----------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BOOK_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

EXIT_CODE=0

echo "==> Checking .sh / .ps1 / .py parity in $BOOK_ROOT ..."

# Check that every .sh has a .ps1 and .py
while IFS= read -r sh_file; do
  ps1_file="${sh_file%.sh}.ps1"
  py_file="${sh_file%.sh}.py"
  if [ ! -f "$ps1_file" ]; then
    echo "MISSING .ps1 for: $sh_file"
    EXIT_CODE=1
  fi
  if [ ! -f "$py_file" ]; then
    echo "MISSING .py  for: $sh_file"
    EXIT_CODE=1
  fi
done < <(find "$BOOK_ROOT" -name "*.sh" -type f)

# Check that every .ps1 has a .sh and .py
while IFS= read -r ps1_file; do
  sh_file="${ps1_file%.ps1}.sh"
  py_file="${ps1_file%.ps1}.py"
  if [ ! -f "$sh_file" ]; then
    echo "MISSING .sh  for: $ps1_file"
    EXIT_CODE=1
  fi
  if [ ! -f "$py_file" ]; then
    echo "MISSING .py  for: $ps1_file"
    EXIT_CODE=1
  fi
done < <(find "$BOOK_ROOT" -name "*.ps1" -type f)

# Check that every .py has a .sh and .ps1
while IFS= read -r py_file; do
  sh_file="${py_file%.py}.sh"
  ps1_file="${py_file%.py}.ps1"
  if [ ! -f "$sh_file" ]; then
    echo "MISSING .sh  for: $py_file"
    EXIT_CODE=1
  fi
  if [ ! -f "$ps1_file" ]; then
    echo "MISSING .ps1 for: $py_file"
    EXIT_CODE=1
  fi
done < <(find "$BOOK_ROOT" -name "*.py" -type f)

if [ "$EXIT_CODE" -eq 0 ]; then
  echo "==> All scripts have matching triplets. Parity OK."
else
  echo "==> Parity check FAILED. See mismatches above."
fi

exit $EXIT_CODE
