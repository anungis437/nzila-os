"""Deterministic USTAR: sixteen regular files, unchanged candidate plus exact inputs."""
import json
import re
import tarfile
from delivery_guard import CANDIDATE, HERE, INPUTS, OFFLINE, fresh, guard, sha


def main():
    initial = guard()
    names = {}
    text = (CANDIDATE / "frozen_bindings.go").read_text()
    for name, size, digest in re.findall(r'"([^"]+)":\s+\{(\d+), "([a-f0-9]{64})"\}', text):
        names[name] = {"name": name, "bytes": int(size), "sha256": digest,
                       "mode": 0o555 if name in ("portable-assembler", "compressor-go1256") else 0o444}
    assert len(names) == 15 and sum(x["bytes"] for x in names.values()) == 265077049
    hashes = {str(p): sha(p) for p in CANDIDATE.iterdir() if p.is_file()}
    hashes[str(OFFLINE)] = sha(OFFLINE)
    for name, item in names.items():
        path = INPUTS / name
        assert path.is_file() and not path.is_symlink() and path.stat().st_size == item["bytes"]
        assert sha(path) == item["sha256"]
        hashes[str(path)] = item["sha256"]
    fresh("PRESERVED_BYTES.json", {"hashes": hashes, "initialBaseline": initial})
    names["g3a-final-runner"] = {"name": "g3a-final-runner", "bytes": 28094588,
                                "sha256": sha(CANDIDATE / "production-runner"), "mode": 0o500}
    assert names["g3a-final-runner"]["sha256"] == "9889228f05e27a95593ba02e44e54127985175d4748bf98e0c6600bb662d1273"
    guard()
    with (HERE / "g3a-proof-capsule").open("xb") as output:
        with tarfile.open(fileobj=output, mode="w", format=tarfile.USTAR_FORMAT) as archive:
            for name, item in sorted(names.items()):
                guard()
                info = tarfile.TarInfo(name)
                info.size, info.mode, info.mtime = item["bytes"], item["mode"], 0
                path = CANDIDATE / "production-runner" if name == "g3a-final-runner" else INPUTS / name
                with path.open("rb") as stream:
                    archive.addfile(info, stream)
    spec = {"schema": "g3a-hard-delivery-bundle/v1", "members": list(sorted(names.values(), key=lambda x: x["name"])),
            "bundleSha256": sha(HERE / "g3a-proof-capsule"),
            "bundleBytes": (HERE / "g3a-proof-capsule").stat().st_size,
            "regularFiles": 16, "frozenInputBytes": 265077049,
            "candidateSha256": names["g3a-final-runner"]["sha256"], "candidateBytes": 28094588,
            "contractSha256": "043faf5dc2eab0d14b1ecd06fd6f0b3c33ae27d25e2dbc2e1238ecdc7c5f32e9"}
    fresh("BUNDLE_CENSUS.json", spec)
    source = "package main\n\nconst bundleSHA = " + json.dumps(spec["bundleSha256"]) + "\n"
    source += "const bundleBytes int64 = " + str(spec["bundleBytes"]) + "\n"
    source += "const candidateSHA = " + json.dumps(spec["candidateSha256"]) + "\n"
    source += "const candidateBytes int64 = 28094588\n"
    source += "const contractSHA = " + json.dumps(spec["contractSha256"]) + "\n"
    source += "var boundFiles = []fileSpec{\n"
    for item in spec["members"]:
        source += '{"%s", %d, "%s", %#o},\n' % (item["name"], item["bytes"], item["sha256"], item["mode"])
    source += "}\n"
    fresh("bundle_binding.go", source)
    fresh("proof_dictionary.bin", (CANDIDATE / "proof_dictionary.bin").read_bytes())
    fresh("proof_evidence_reader.py", (CANDIDATE / "proof_evidence_reader.py").read_bytes())
    print(json.dumps({"bundleSha256": spec["bundleSha256"], "bundleBytes": spec["bundleBytes"], "files": 16}))


if __name__ == "__main__":
    main()
