"""Pytest conftest — inserts the repo root onto sys.path.

The generator lives at ``scripts/courtlens/build_legacy_inventory.py`` and
tests import it as ``scripts.courtlens.build_legacy_inventory``. When
pytest is invoked with ``pytest scripts/courtlens/tests`` from the repo
root, ``sys.path`` gets ``scripts/courtlens/tests`` but not the repo
root itself. This conftest fixes that.
"""

from __future__ import annotations

import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[3]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))
