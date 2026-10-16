"""Reuse the preserved deterministic local build algorithm on the new lane."""

import importlib.util
from pathlib import Path
import sys

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("historical_local_qualifier", HERE.parent / "g3-readiness" / "qualify_local.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.ROOT = HERE
module.SOURCE = HERE / "runtime"

if __name__ == "__main__":
    module.main()
