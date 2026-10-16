"""Read-only, hash-checked reuse of qualified transaction primitives."""

import hashlib
import importlib.util
from pathlib import Path
import sys

CORE_ROOT = "3d155ebc2a739ff9c91fd7011e8497878f34fd3390c6d0ecbd0554c730313f81"
TRANSACTION_ROOT = "0c216d4b17146236bf632640df6fef84c31deea7a9d814637e14714f6e0859a4"
PROOF_SHA = "5f82bd226a27fd1d066a211bb527049097c049181eae92ebf9b3fae3e16683d8"
CORE_SHA = "3b444e003474b5717ff549c5cafaf9cb761835eea3b4844e1344aa9e61581da4"
BINDING_SHA = "e7fccc15dc3a795ad4b229f4fc9f018dd34e708c0a0611ca172ac3aec2fd1ef0"
SOURCES = {
    "sealed_reader": "c7ac915a4b5d295eb23f55a5ceea801a4f9a0bcaded04e7839a30a7a0743bc68",
    "registry": "7bec4d91c595cdca243bb325ac1d0c6c8d33bb839fbeff3ae27460e44412d89e",
    "controller": "178eedd08cac6444e6a4c0ee50477ec376e827a809f4bee1c4b2df2be327571b",
}


def checked(path: Path, sha: str) -> bytes:
    if not path.is_file() or path.is_symlink():
        raise RuntimeError("REGULAR_HASH_BOUND_FILE_REQUIRED")
    raw = path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != sha:
        raise RuntimeError("FROZEN_SOURCE_HASH_MISMATCH")
    return raw


def load(transaction: Path) -> dict:
    # All bytes are checked before any module is executed.
    payloads = {name: checked(transaction / (name + ".py"), sha)
                for name, sha in SOURCES.items()}
    modules = {}
    for name, raw in payloads.items():
        existing = sys.modules.get(name)
        if existing is not None:
            if Path(existing.__file__).resolve() != (transaction / (name + ".py")).resolve():
                raise RuntimeError("FROZEN_MODULE_NAMESPACE_COLLISION")
            modules[name] = existing
            continue
        spec = importlib.util.spec_from_file_location(name, transaction / (name + ".py"))
        module = importlib.util.module_from_spec(spec)
        sys.modules[name] = module
        exec(compile(raw, str(transaction / (name + ".py")), "exec"), module.__dict__)
        modules[name] = module
    return modules
