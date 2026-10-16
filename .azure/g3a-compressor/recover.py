"""Read-only local engine provenance, fixture export and public source snapshots."""

import hashlib
import json
from pathlib import Path
import subprocess
import tarfile
import urllib.request

HERE = Path(__file__).resolve().parent
FROZEN = HERE.parent / "g3-final-readiness" / "local-image-frozen"


def fresh(path, raw):
    with path.open("xb") as file:
        file.write(raw)


def record(name, value):
    fresh(HERE / name, (json.dumps(value, indent=2) + "\n").encode())


def read(name, command):
    result = subprocess.run(command, capture_output=True, timeout=60)
    record(name + ".json", {"command": command, "exitCode": result.returncode,
                           "stdout": result.stdout.decode(errors="replace"),
                           "stderr": result.stderr.decode(errors="replace"), "mutations": 0})
    if result.returncode:
        raise RuntimeError("LOCAL_PROVENANCE_READ_FAILED_" + name)
    return result.stdout


def main():
    for name, args in (
        ("DOCKER_VERSION", ["docker", "version", "--format", "{{json .}}"]),
        ("BUILDX_VERSION", ["docker", "buildx", "version"]),
        ("BUILDX_INSPECT", ["docker", "buildx", "inspect"]),
        ("CACHED_GO_IMAGES", ["docker", "image", "ls", "--digests", "--no-trunc", "golang", "--format", "{{json .}}"]),
    ):
        read(name, args)
    script = b'for p in /proc/[0-9]*/comm; do read n < "$p"; if [ "$n" = dockerd ]; then echo "${p%/comm}"; fi; done\n'
    result = subprocess.run(["wsl", "-d", "docker-desktop", "--", "sh", "-s"],
                            input=script, capture_output=True, timeout=30)
    candidates = result.stdout.decode().splitlines()
    if result.returncode or len(candidates) != 1 or not candidates[0].startswith("/proc/"):
        raise RuntimeError("EXACT_DOCKERD_PROCESS_NOT_BOUND")
    proc = candidates[0]
    link = read("DAEMON_EXECUTABLE_PATH", ["wsl", "-d", "docker-desktop", "--", "readlink", proc + "/exe"])
    if link.strip() != b"/usr/bin/dockerd":
        raise RuntimeError("DAEMON_EXECUTABLE_PATH_UNEXPECTED")
    path = HERE / "dockerd-original"
    with path.open("xb") as file:
        result = subprocess.run(["wsl", "-d", "docker-desktop", "--", "cat", proc + "/exe"],
                                stdout=file, stderr=subprocess.PIPE, timeout=120)
    if result.returncode:
        raise RuntimeError("EXACT_BINARY_EXPORT_FAILED")
    with path.open("rb") as file:
        digest = hashlib.file_digest(file, "sha256").hexdigest()
    record("EXACT_DAEMON_BINARY.json", {"source": proc + "/exe", "symlink": link.decode().strip(),
                                      "sha256": digest, "bytes": path.stat().st_size,
                                      "kind": "INTEGRATED_BUILDKIT_IN_DOCKERD_NOT_SEPARATE_BUILDKITD",
                                      "processExecutedOrModified": False})
    read("DAEMON_GO_BUILD_INFO", [
        "docker", "run", "--rm", "--pull", "never", "--network", "none",
        "--mount", "type=bind,source=" + str(HERE) + ",target=/evidence,readonly",
        "golang@sha256:3b15ba438c60ab8fabe5fee3b11025c0049e358b31feff384648f11fc8e335f8",
        "go", "version", "-m", "/evidence/dockerd-original",
    ])
    fixture_dir = HERE / "fixtures"
    fixture_dir.mkdir()
    with tarfile.open(FROZEN / "image-run1.tar") as archive:
        index = json.load(archive.extractfile("index.json"))
        if index["manifests"][0]["digest"] != "sha256:82b24793125bceae37828bb3c1adea26882a33cff5ca557fa49d370853db93b7":
            raise RuntimeError("FROZEN_MANIFEST_BINDING")
        manifest = json.load(archive.extractfile("blobs/sha256/" + index["manifests"][0]["digest"].split(":")[1]))
        import gzip
        entries = []
        for name, descriptor in zip(("app", "cert"), manifest["layers"]):
            compressed = archive.extractfile("blobs/sha256/" + descriptor["digest"].split(":")[1]).read()
            raw = gzip.decompress(compressed)
            if "sha256:" + hashlib.sha256(compressed).hexdigest() != descriptor["digest"]:
                raise RuntimeError("FROZEN_COMPRESSED_FIXTURE")
            prior = HERE.parent / "g3a-portable" / "clean-room-run1-qualified" / "transaction"
            number = 1 if name == "app" else 2
            if raw != (prior / ("layer" + str(number) + ".tar")).read_bytes():
                raise RuntimeError("EXACT_TAR_FIXTURE_CHANGED")
            fresh(fixture_dir / (name + ".tar"), raw)
            fresh(fixture_dir / (name + ".frozen.gz"), compressed)
            entries.append({"name": name, "tarSha256": hashlib.sha256(raw).hexdigest(),
                            "tarBytes": len(raw), "gzipSha256": hashlib.sha256(compressed).hexdigest(),
                            "gzipBytes": len(compressed)})
        record("FROZEN_FIXTURES.json", {"sourceArchive": str(FROZEN / "image-run1.tar"), "entries": entries,
                                      "applicationRebuilt": False})
    url = "https://api.github.com/repos/moby/buildkit/git/trees/v0.27.0?recursive=1"
    with urllib.request.urlopen(url, timeout=30) as response:
        raw = response.read(4000000)
    tree = json.loads(raw)
    if tree.get("truncated"):
        raise RuntimeError("PUBLIC_SOURCE_TREE_TRUNCATED")
    fresh(HERE / "PUBLIC_BUILDKIT_TREE.json", raw)
    paths = [entry["path"] for entry in tree["tree"]
             if "rewrite" in entry["path"] or "converter" in entry["path"]]
    record("PUBLIC_RELEVANT_PATHS.json", {"url": url, "paths": paths})
    print("EXACT_BINARY_AND_FROZEN_COMPRESSION_FIXTURES_RECOVERED")


if __name__ == "__main__":
    main()
