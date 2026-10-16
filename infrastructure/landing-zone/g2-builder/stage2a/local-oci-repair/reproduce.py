import hashlib
import json
import pathlib
import re
import shlex
import struct
import subprocess
import tarfile
import tempfile

ARCHIVE_SHA = "f27adb935022d94df8dc77719c322dda592c78a0d57a6f7dcdd8d900b248c454"
PAYLOAD_SHA = "2457502e49df5a77cd6403052c37ad7dc8cce95f3947378aa5e3dcf2f12703db"
TAG = "stage2a-" + PAYLOAD_SHA
ARTIFACT_TYPE = "application/vnd.nzila.g2.synthetic-health.v1"
PAYLOAD_TYPE = ARTIFACT_TYPE + "+json"
CREATED = "2000-01-01T00:00:00Z"
ROOT = pathlib.Path(__file__).resolve().parents[5]
E = ROOT / ".azure" / "evidence"
PREFIX = "G2_LOCAL_OCI_"


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def exclusive(path, body):
    with path.open("xb") as stream:
        stream.write(body)


def evidence(name, value):
    exclusive(E / (PREFIX + name), (json.dumps(value, indent=2) + "\n").encode())


def command(args):
    process = subprocess.run(args, capture_output=True, timeout=120)
    if process.returncode:
        raise RuntimeError("Local command failed: " + process.stderr.decode("utf-8", errors="replace"))
    return process.stdout


def linux_path(path):
    return command(["wsl", "-d", "docker-desktop", "--exec", "wslpath", "-u", path.as_posix()]).decode().strip()


def preserve_history():
    git = lambda *args: command(["git", "-C", str(ROOT), *args]).decode().strip()
    checkpoint = {"branch": git("branch", "--show-current"), "head": git("rev-parse", "HEAD"),
                  "status": git("status", "--short").splitlines()}
    seal = json.loads((E / "G2_SYNTHETIC_REVISED_FINAL_VERIFICATION.json").read_text())
    if checkpoint != seal["concurrency"]:
        raise ValueError("Concurrency drift")
    source = ROOT / "infrastructure" / "landing-zone" / "g2-builder" / "stage2a"
    for group in ("evidenceHashes", "priorEvidenceHashes"):
        for name, expected in seal[group].items():
            if sha(E / name).upper() != expected:
                raise ValueError("Historical evidence mismatch: " + name)
    for name, expected in seal["sourceHashes"].items():
        if sha(source / name).upper() != expected:
            raise ValueError("Historical source mismatch: " + name)
    record = {
        "concurrency": checkpoint, "priorEvidenceHashes": {
            path.name: sha(path) for path in E.iterdir() if path.is_file() and not path.name.startswith(PREFIX)},
        "priorSourceHashes": seal["sourceHashes"], "historicalVerification": "PASS",
        "azureCommandsExecuted": 0, "registryRequests": 0,
    }
    existing = E / (PREFIX + "CONCURRENCY_AND_HISTORY.json")
    if existing.exists():
        saved = json.loads(existing.read_text())
        if saved != record:
            raise ValueError("Local preparation history changed")
    else:
        evidence("CONCURRENCY_AND_HISTORY.json", record)


def reproduce(archive):
    preserve_history()
    if sha(archive) != ARCHIVE_SHA:
        raise ValueError("Approved archive hash mismatch")
    payload = (E / "G2_SYNTHETIC_PRODUCTION_PAYLOAD.json").read_bytes()
    if hashlib.sha256(payload).hexdigest() != PAYLOAD_SHA:
        raise ValueError("Sealed payload changed")
    observations = []
    with tempfile.TemporaryDirectory(prefix="nzila-local-oci-") as temporary:
        workspace = pathlib.Path(temporary)
        with tarfile.open(archive, "r:gz") as release:
            members = release.getmembers()
            if set(v.name for v in members) != {"oras", "LICENSE"} or any(not v.isfile() for v in members):
                raise ValueError("Unexpected release members")
            with release.extractfile("oras") as binary:
                executable = workspace / "oras"
                exclusive(executable, binary.read())
        elf = executable.read_bytes()[:20]
        if elf[:6] != b"\x7fELF\x02\x01" or struct.unpack("<H", elf[18:20])[0] != 62:
            raise ValueError("Not approved Linux AMD64 ELF")
        executable_linux = linux_path(executable)
        binary_authority = {"archiveSha256": sha(archive), "binarySha256": sha(executable),
                 "platform": "Linux AMD64", "acquisition": "Official GitHub release asset; hash equal approved private artifact",
                 "versionExpected": "1.3.4", "runtime": "Existing local docker-desktop WSL; unshare -n; env -i"}
        authority_path = E / (PREFIX + "BINARY_AUTHORITY.json")
        if authority_path.exists():
            if json.loads(authority_path.read_text()) != binary_authority:
                raise ValueError("Binary authority changed")
        else:
            evidence("BINARY_AUTHORITY.json", binary_authority)
        for number in (1, 2):
            run = workspace / ("run" + str(number))
            run.mkdir()
            exclusive(run / "synthetic-health.json", payload)
            run_linux = linux_path(run)
            arguments = [executable_linux, "push", "--oci-layout", run_linux + "/layout:" + TAG,
                         "--artifact-type", ARTIFACT_TYPE, "--image-spec", "v1.1",
                         "--annotation", "org.opencontainers.image.created=" + CREATED,
                         "--export-manifest", run_linux + "/manifest.json",
                         "synthetic-health.json:" + PAYLOAD_TYPE]
            shell = "set -eu\ncd " + shlex.quote(run_linux) + "\n" + shlex.join([executable_linux, "version"]) + "\n" + shlex.join(arguments) + "\n"
            exclusive(run / "reproduce.sh", shell.encode())
            output = command(["wsl", "-d", "docker-desktop", "--exec", "unshare", "-n", "env", "-i",
                              "PATH=/usr/bin:/bin", "HOME=" + run_linux, "TMPDIR=" + run_linux,
                              "LANG=C", "LC_ALL=C", "sh", run_linux + "/reproduce.sh"])
            if re.search(rb"(?m)^Version:\s+1\.3\.4\s*$", output) is None:
                raise ValueError("Actual ORAS version mismatch: " + output.decode())
            target = E / (PREFIX + "RUN" + str(number))
            target.mkdir()
            paths = [run / "manifest.json", *(v for v in (run / "layout").rglob("*") if v.is_file())]
            hashes = {}
            for path in paths:
                relative = path.relative_to(run)
                destination = target / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                exclusive(destination, path.read_bytes())
                hashes[str(relative)] = sha(path)
            manifest = json.loads((run / "manifest.json").read_bytes())
            for descriptor in (manifest["config"], *manifest["layers"]):
                blob = run / "layout" / "blobs" / "sha256" / descriptor["digest"].split(":")[1]
                if "sha256:" + sha(blob) != descriptor["digest"] or blob.stat().st_size != descriptor["size"]:
                    raise ValueError("Emitted descriptor/blob mismatch")
            observation = {"run": number, "networkIsolation": "Linux unshare -n",
                           "arguments": arguments, "stdout": output.decode(), "layoutHashes": hashes,
                           "actualManifest": manifest, "manifestDigest": "sha256:" + sha(run / "manifest.json"),
                           "configDigest": manifest["config"]["digest"], "payloadDigest": manifest["layers"][0]["digest"]}
            observations.append(observation)
            evidence("RUN" + str(number) + "_OBSERVATION.json", observation)
        for key in ("manifestDigest", "configDigest", "payloadDigest"):
            if observations[0][key] != observations[1][key]:
                raise ValueError("Packaging nondeterministic: " + key)
        evidence("DETERMINISM.json", {"status": "PASS", "manifestDigest": observations[0]["manifestDigest"],
                 "configDigest": observations[0]["configDigest"], "payloadDigest": observations[0]["payloadDigest"],
                 "azureMutation": "NO", "registryMutation": "NO"})
        print(json.dumps(observations[0]["actualManifest"], indent=2))
        print("Two actual approved-binary no-network runs deterministic:", observations[0]["manifestDigest"])


if __name__ == "__main__":
    import sys
    reproduce(pathlib.Path(sys.argv[1]))
