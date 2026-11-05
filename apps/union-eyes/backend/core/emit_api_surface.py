"""Emit the API surface of every reachable model serializer: what a client can read, may write, and must send.

``api_surface.json`` is generated (never hand-edited) so that a change to what the API returns or accepts is a diff in
review rather than a side effect of a model change. A unit test regenerates it and fails when the committed file is
stale. A reachable view is one a URL resolves to whose permissions are not ``DenyAllPermission``.

Run from apps/union-eyes/backend:  python -m core.emit_api_surface [--write]
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

OUTPUT = Path(__file__).with_name("api_surface.json")


def build() -> dict:
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    import django

    django.setup()
    from core import exposure

    surface = {}
    for serializer, model in exposure.live_serializers().items():
        fields = serializer().fields
        surface[f"{serializer.__module__}.{serializer.__name__}"] = {
            "table": model._meta.db_table,
            "readable": sorted(n for n, f in fields.items() if not f.write_only),
            "write_only": sorted(n for n, f in fields.items() if f.write_only),
            "required": sorted(n for n, f in fields.items() if f.required and not f.read_only),
            "read_only": sorted(n for n, f in fields.items() if f.read_only),
        }
    return {"generatedBy": "core/emit_api_surface.py", "serializers": dict(sorted(surface.items()))}


def main(argv: list[str]) -> int:
    text = json.dumps(build(), indent=1, sort_keys=True) + "\n"
    if "--write" in argv:
        OUTPUT.write_text(text, encoding="utf-8", newline="\n")
        print(f"wrote {OUTPUT}")
    else:
        sys.stdout.write(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
