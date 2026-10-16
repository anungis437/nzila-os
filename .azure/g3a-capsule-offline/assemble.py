"""Assemble cached runtime dependencies and frozen machinery without a pull."""

import encodings.idna
import encodings.utf_8
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import platform
import struct
import sys
import tarfile

SOURCE = Path("/sealed")
OUTPUT = Path("/output")


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def interpreter(raw):
    require(raw[:6] == b"\x7fELF\x02\x01" and struct.unpack_from("<H", raw, 18)[0] == 62,
            "CACHED_RUNTIME_NOT_LINUX_AMD64")
    offset = struct.unpack_from("<Q", raw, 32)[0]
    stride, count = struct.unpack_from("<HH", raw, 54)
    for index in range(count):
        position = offset + index * stride
        if struct.unpack_from("<I", raw, position)[0] == 3:
            start = struct.unpack_from("<Q", raw, position + 8)[0]
            size = struct.unpack_from("<Q", raw, position + 32)[0]
            return raw[start:start + size].rstrip(b"\0").decode("ascii")
    raise RuntimeError("DYNAMIC_PYTHON_LOADER_NOT_FOUND")


def main():
    require(platform.machine() == "x86_64", "PREPARATION_ARCH")
    expected = json.loads((OUTPUT / "FROZEN_SOURCE_BINDING.json").read_text())
    files = {}
    for name, item in expected.items():
        path = SOURCE.joinpath(*item["relativePath"].split("\\"))
        raw = path.read_bytes()
        require(sha(raw) == item["sha256"], "FROZEN_MODULE_CHANGED_" + name)
        files["app/" + name] = (raw, 0o400, "CAPSULE_EMBEDDED_FROZEN_MACHINERY")
    files["app/sources.json"] = (
        json.dumps({name: item["sha256"] for name, item in expected.items()}, sort_keys=True).encode(),
        0o400, "CAPSULE_EMBEDDED_SOURCE_BINDING")
    files["app/entry.py"] = ((OUTPUT / "entry.py").read_bytes(), 0o400, "CAPSULE_EMBEDDED_OFFLINE_ENTRYPOINT")

    # Resolve import dependencies in the cached preparation runtime, not a guest.
    sys.path.insert(0, str(SOURCE / "g3a-transaction"))
    for name in ("sealed_reader", "registry", "controller"):
        __import__(name)
    sys.path.insert(0, str(SOURCE / "g3a-ca-closure"))
    import guest_pipeline
    import _posixsubprocess
    require(guest_pipeline.live_entrypoint is not None, "CANDIDATE_PIPELINE_IMPORT")
    runtime = set()
    for module in sys.modules.values():
        filename = getattr(module, "__file__", None)
        if filename and filename.startswith("/usr/local/lib/python3.11/"):
            path = Path(filename)
            require("site-packages" not in path.parts, "UNBOUND_SITE_PACKAGE")
            runtime.add(path.resolve())
    python = Path("/usr/local/bin/python3.11")
    runtime.add(python.resolve())
    loader = Path(interpreter(python.read_bytes())).resolve()
    runtime.add(loader)
    for line in Path("/proc/self/maps").read_text().splitlines():
        path = line.split()[-1]
        if path.startswith(("/usr/lib/", "/usr/local/lib/")):
            runtime.add(Path(path).resolve())
    for path in sorted(runtime):
        require(path.is_file() and not path.is_symlink(), "RUNTIME_FILE_NOT_REGULAR")
        role = "CAPSULE_EMBEDDED_NATIVE_RUNTIME" if ".so" in path.name or path == python else "CAPSULE_EMBEDDED_STDLIB"
        files["runtime" + str(path)] = (path.read_bytes(), 0o500 if role.endswith("NATIVE_RUNTIME") else 0o400, role)
    libraries = sorted({str(Path(name).parent) for name in files
                        if name.startswith("runtime/") and ".so" in Path(name).name})
    config = {
        "python": "runtime" + str(python),
        "loader": "runtime" + str(loader),
        "pythonHome": "runtime/usr/local",
        "libraryDirectories": libraries,
        "candidateOnly": True,
    }
    files["runtime.json"] = (json.dumps(config, sort_keys=True).encode(), 0o400, "CAPSULE_EMBEDDED_RUNTIME_CONFIG")
    census = {name: {"sha256": sha(raw), "bytes": len(raw), "mode": mode, "classification": role}
              for name, (raw, mode, role) in sorted(files.items())}
    files["census.json"] = (json.dumps(census, sort_keys=True).encode(), 0o400, "CAPSULE_EMBEDDED_CENSUS")
    with (OUTPUT / "payload.tar").open("xb") as stream:
        with tarfile.open(fileobj=stream, mode="w", format=tarfile.USTAR_FORMAT) as archive:
            for name, (raw, mode, _) in sorted(files.items()):
                header = tarfile.TarInfo(name)
                header.size, header.mode, header.mtime = len(raw), mode, 946684800
                header.uid = header.gid = 0
                archive.addfile(header, io.BytesIO(raw))
    result = {
        "status": "CANDIDATE_RUNTIME_CENSUS_NOT_TRANSACTION_QUALIFICATION",
        "cachedImage": "sha256:e88e9763f943ec1834f992a4b51e0f24500486803e8bc534e5767af9ea65f6ce",
        "pythonVersion": sys.version,
        "pythonELFInterpreter": str(loader),
        "files": census,
        "archiveSha256": sha((OUTPUT / "payload.tar").read_bytes()),
        "archiveBytes": (OUTPUT / "payload.tar").stat().st_size,
        "embeddedMemberBytes": sum(item["bytes"] for item in census.values()),
        "compilerTreesEmbedded": False,
        "productBuildSourceEmbedded": False,
        "runtimeOCIOrFinalImageEmbedded": False,
        "credentialsEmbedded": False,
        "guestIsolationCapabilities": "NOT_OBSERVED",
        "CAInput": "STAGED_INPUT_NOT_EMBEDDED",
        "notProductionGuestCapsule": True,
    }
    with (OUTPUT / "RUNTIME_CENSUS.json").open("x") as stream:
        json.dump(result, stream, indent=2)
        stream.write("\n")
    print("CACHED_RUNTIME_CANDIDATE_ASSEMBLED_FILES=" + str(len(census)))


if __name__ == "__main__":
    main()
