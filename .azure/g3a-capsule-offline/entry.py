"""Offline dependency self-test, not an authorized transaction entrypoint."""

import hashlib
import json
import os
from pathlib import Path
import ssl
import sys


def main():
    root = Path(sys.argv[1]).resolve()
    app = root / "app"
    binding = json.loads((app / "sources.json").read_text())
    for name, expected in binding.items():
        if hashlib.sha256((app / name).read_bytes()).hexdigest() != expected:
            raise RuntimeError("CAPSULE_MODULE_SHA_MISMATCH")
    sys.path[:] = [str(app), *(path for path in sys.path if path and
                             Path(path).resolve().is_relative_to(root))]
    import frozen
    modules = frozen.load(app)
    import guest_pipeline
    import encodings.idna
    import encodings.utf_8
    import _posixsubprocess

    if modules["registry"].MANIFEST != "sha256:82b24793125bceae37828bb3c1adea26882a33cff5ca557fa49d370853db93b7":
        raise RuntimeError("FROZEN_MANIFEST_MISMATCH")
    if os.environ.get("PATH") != "/unavailable" or os.environ.get("DOCKER_HOST"):
        raise RuntimeError("AMBIENT_EXECUTABLE_OR_ENGINE")
    native = []
    for name, module in sorted(sys.modules.items()):
        location = getattr(module, "__file__", None)
        if location and not location.startswith("<"):
            if not Path(location).resolve().is_relative_to(root):
                raise RuntimeError("HOST_RUNTIME_DEPENDENCY_" + name)
            native.append({"module": name, "path": str(Path(location).relative_to(root))})
    try:
        guest_pipeline.live_entrypoint()
    except RuntimeError as error:
        if str(error) != "G3A_AUTHORITY_CONSUMED_LIVE_EXECUTION_DISABLED":
            raise
    else:
        raise RuntimeError("LIVE_EXECUTION_NOT_DISABLED")
    print(json.dumps({
        "status": "PASS_OFFLINE_IMPORT_ONLY",
        "python": sys.version.split()[0],
        "ssl": ssl.OPENSSL_VERSION,
        "importedRuntimeCensus": native,
        "liveExecution": "DISABLED",
        "networkRequests": 0,
        "transactionQualified": False,
    }, sort_keys=True))


if __name__ == "__main__":
    main()
