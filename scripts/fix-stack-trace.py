"""Bulk-fix py/stack-trace-exposure: replace str(e)/exc in error response dicts with a generic message."""
import re
import pathlib

source_dirs = [
    "apps/abr/backend",
    "apps/agrimo/backend",
    "apps/union-eyes/backend/services",
    "apps/union-eyes/backend/auth_core",
    "apps/union-eyes/backend/compliance",
    "apps/union-eyes/backend/billing",
    "apps/union-eyes/backend/middleware",
]

# Match 'error': str(e/exc)
pattern_sq_str = re.compile(r"'error'\s*:\s*str\([a-zA-Z_]+\)")
pattern_dq_str = re.compile(r'"error"\s*:\s*str\([a-zA-Z_]+\)')
# Match "error": f"...: {exc}"  or  "error": f"...{e}"  (f-strings exposing exception)
pattern_sq_fstr = re.compile(r"'error'\s*:\s*f['\"].*?\{[a-zA-Z_]+\}.*?['\"]")
pattern_dq_fstr = re.compile(r'"error"\s*:\s*f".*?\{[a-zA-Z_]+\}.*?"')


def replace_file(filepath: pathlib.Path) -> int:
    content = filepath.read_text(encoding="utf-8")
    original = content
    content = pattern_sq_str.sub("'error': 'An error occurred'", content)
    content = pattern_dq_str.sub('"error": "An error occurred"', content)
    content = pattern_sq_fstr.sub("'error': 'An error occurred'", content)
    content = pattern_dq_fstr.sub('"error": "An error occurred"', content)
    if content != original:
        filepath.write_text(content, encoding="utf-8")
        return 1
    return 0


total_replacements = 0
total_files = 0
for src_dir in source_dirs:
    for py_file in pathlib.Path(src_dir).rglob("*.py"):
        if ".venv" not in str(py_file) and "__pycache__" not in str(py_file):
            changed = replace_file(py_file)
            if changed:
                total_files += 1
                total_replacements += changed
                print(f"  Fixed {changed} in {py_file}")

print(f"\nDone: {total_replacements} replacements across {total_files} files")
