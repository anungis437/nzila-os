import hashlib
import io
import json
import pathlib
import subprocess
import sys
import tarfile

ROOT = pathlib.Path(__file__).resolve().parent
SOURCE = ROOT / "runtime"
EPOCH = 946684800
BUILDER = "golang@sha256:3b15ba438c60ab8fabe5fee3b11025c0049e358b31feff384648f11fc8e335f8"


def digest(content):
    return "sha256:" + hashlib.sha256(content).hexdigest()


def run(args, log):
    result = subprocess.run(args, text=True, capture_output=True)
    with log.open("x", encoding="utf-8") as stream:
        stream.write(result.stdout + result.stderr)
    if result.returncode != 0:
        raise RuntimeError(f"LOCAL_COMMAND_FAILED: {log.name}")
    return result.stdout


def inspect(archive):
    with tarfile.open(archive) as stream:
        files = {}
        for member in stream.getmembers():
            if member.isfile():
                if member.name in files:
                    raise RuntimeError("DUPLICATE_OCI_PATH")
                files[member.name] = stream.extractfile(member).read()
    assert json.loads(files["oci-layout"]) == {"imageLayoutVersion": "1.0.0"}
    index = json.loads(files["index.json"])
    assert index["schemaVersion"] == 2 and len(index["manifests"]) == 1
    descriptor = index["manifests"][0]
    assert descriptor["platform"] == {"architecture": "amd64", "os": "linux"}

    def blob(item):
        content = files["blobs/sha256/" + item["digest"].split(":")[1]]
        assert digest(content) == item["digest"] and len(content) == item["size"]
        return content

    raw_manifest = blob(descriptor)
    manifest = json.loads(raw_manifest)
    assert manifest["schemaVersion"] == 2
    assert manifest["mediaType"] == "application/vnd.oci.image.manifest.v1+json"
    raw_config = blob(manifest["config"])
    config = json.loads(raw_config)
    assert config["os"] == "linux" and config["architecture"] == "amd64"
    assert config["config"]["User"] == "65532:65532"
    assert config["config"]["Entrypoint"] == ["/g3-runtime"]
    layer_digests = []
    for layer in manifest["layers"]:
        blob(layer)
        layer_digests.append(layer["digest"])
    return {
        "configDigest": digest(raw_config),
        "manifestDigest": descriptor["digest"],
        "indexDigest": digest(files["index.json"]),
        "platform": "linux/amd64",
        "imageBlobBytes": len(raw_manifest) + len(raw_config) + sum(v["size"] for v in manifest["layers"]),
        "ociArchiveBytes": archive.stat().st_size,
        "layerDigests": layer_digests,
        "uncompressedLayerDigests": config["rootfs"]["diff_ids"],
        "config": config,
    }


def main():
    output = ROOT / sys.argv[1]
    output.mkdir()
    names = ["go.mod", "main.go", "main_test.go", "Dockerfile", ".dockerignore"]
    with (output / "source.tar").open("xb") as file:
        with tarfile.open(fileobj=file, mode="w", format=tarfile.USTAR_FORMAT) as archive:
            for name in sorted(names):
                content = (SOURCE / name).read_bytes()
                entry = tarfile.TarInfo(name)
                entry.size = len(content)
                entry.mtime = EPOCH
                entry.mode = 0o644
                archive.addfile(entry, io.BytesIO(content))
    authority = digest((output / "source.tar").read_bytes()).split(":")[1]
    tag = "g3-" + authority
    observations = []
    for number in (1, 2):
        archive = output / f"image-run{number}.tar"
        run([
            "docker", "buildx", "build", "--platform", "linux/amd64", "--network", "none",
            "--no-cache", "--provenance=false", "--sbom=false",
            "--build-arg", f"SOURCE_DATE_EPOCH={EPOCH}", "--tag", f"nzila-g3-local:{tag}",
            "--output", f"type=oci,dest={archive},rewrite-timestamp=true",
            str(SOURCE),
        ], output / f"build-run{number}.log")
        observations.append(inspect(archive))
    for key in ("configDigest", "manifestDigest", "indexDigest", "layerDigests", "uncompressedLayerDigests", "imageBlobBytes"):
        assert observations[0][key] == observations[1][key], f"INDEPENDENT_IMAGE_MISMATCH: {key}"
    result = {
        "G3_LOCAL_IMAGE_BUILD": "PASS",
        "G3_LOCAL_REPRODUCIBILITY": "PASS",
        "sourceAuthoritySha256": authority,
        "sourceFileHashes": {name: digest((SOURCE / name).read_bytes()) for name in names},
        "BASE_IMAGE_REFERENCE": BUILDER,
        "BASE_IMAGE_DIGEST": BUILDER.split("@")[1],
        "BASE_IMAGE_ARCHITECTURE": "amd64",
        "BASE_IMAGE_OS": "linux",
        "runtimeBase": "scratch",
        "runtimeBaseDigest": "NOT_APPLICABLE_EMPTY_ROOTFS",
        "compiler": "go1.27.2 linux/amd64",
        "sourceDateEpoch": EPOCH,
        "G3_IMAGE_REPOSITORY": "g3-synthetic-runtime",
        "G3_IMAGE_TAG": tag,
        "G3_DEPLOYMENT_IMAGE_REFERENCE": "nzilag2tzo75uuozprbo.azurecr.io/g3-synthetic-runtime@" + observations[0]["manifestDigest"],
        "observations": observations,
        "registryPushes": 0,
        "targetRegistryReads": 0,
        "azureCalls": 0,
        "runtimeQualification": "LOCAL_IMAGE_ONLY_NOT_AZURE_RUNTIME_PROOF",
    }
    with (output / "LOCAL_IMAGE_QUALIFICATION.json").open("x", encoding="utf-8") as stream:
        json.dump(result, stream, indent=2)
        stream.write("\n")
    print(json.dumps({k: result[k] for k in ("G3_LOCAL_IMAGE_BUILD", "G3_LOCAL_REPRODUCIBILITY", "G3_IMAGE_TAG", "G3_DEPLOYMENT_IMAGE_REFERENCE")}, indent=2))


if __name__ == "__main__":
    main()
