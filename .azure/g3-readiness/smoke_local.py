import base64
import hashlib
import json
import pathlib
import subprocess
import time
import uuid

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

ROOT = pathlib.Path(__file__).resolve().parent
OUTPUT = ROOT / "local-image-qualification"
HELPER = "alpine@sha256:294b683cb724975bec92580e1e685676bd4b50bda910ddb8c51d4cabeaec77e6"


def command(args):
    result = subprocess.run(args, text=True, capture_output=True)
    if result.returncode != 0:
        raise RuntimeError("LOCAL_DOCKER_COMMAND_FAILED")
    return result.stdout.strip()


def main():
    image = json.loads((OUTPUT / "LOCAL_IMAGE_QUALIFICATION.json").read_text())
    key = Ed25519PrivateKey.generate()
    public = base64.b64encode(key.public_key().public_bytes_raw()).decode()
    name = "nzila-g3-local-" + uuid.uuid4().hex
    args = ["docker", "run", "--detach", "--network", "none", "--read-only",
            "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
            "--name", name]
    env = {
        "G3_ENVIRONMENT": "integration-test",
        "G3_SOURCE_AUTHORITY": image["sourceAuthoritySha256"],
        "G3_SECRET_URI": "https://nzl-g3-test-001-kv.vault.azure.net/secrets/substrate-proof/" + "a" * 32,
        "AZURE_CLIENT_ID": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        "G3_PROBE_PUBLIC_KEY": public, "G3_PROOF_MODE": "synthetic-only",
        "IDENTITY_ENDPOINT": "http://127.0.0.1:1/msi/token",
        "IDENTITY_HEADER": "LOCAL_FAKE_NOT_AZURE_AUTH",
    }
    for k, v in env.items():
        args += ["--env", k + "=" + v]
    args += ["nzila-g3-local:" + image["G3_IMAGE_TAG"]]
    cid = command(args)
    results = []
    try:
        observed = json.loads(command(["docker", "inspect", cid]))[0]
        assert observed["State"]["Running"] is True
        assert observed["HostConfig"]["NetworkMode"] == "none"
        assert observed["Config"]["User"] == "65532:65532"
        assert not observed["NetworkSettings"]["Ports"]
        for path, authenticated, status, body in [
            ("/health", True, 200, '{"status":"ok"}'),
            ("/health", False, 401, '{"status":"unauthorized"}'),
            ("/ready", True, 503, '{"status":"not_ready"}'),
            ("/probes/live", False, 200, '{"status":"ok"}'),
            ("/probes/ready", False, 503, '{"status":"not_ready"}'),
        ]:
            request = ["docker", "run", "--rm", "--network", "container:" + cid,
                       HELPER, "wget", "-S", "-O", "-"]
            if authenticated:
                expiry = str(int(time.time()) + 60)
                nonce = uuid.uuid4().hex + uuid.uuid4().hex
                signature = base64.b64encode(key.sign(("GET\n" + path + "\n" + nonce + "\n" + expiry).encode())).decode()
                for k, v in [("X-G3-Expiry", expiry), ("X-G3-Nonce", nonce), ("X-G3-Signature", signature)]:
                    request += ["--header=" + k + ": " + v]
            request += ["http://127.0.0.1:3000" + path]
            result = subprocess.run(request, capture_output=True, text=True)
            assert f"HTTP/1.1 {status}" in result.stderr, (path, status)
            if status == 200:
                assert result.returncode == 0 and result.stdout == body, path
            results.append({"path": path, "authenticated": authenticated, "observedHttpStatus": status,
                            "bodyVerified": status == 200})
        command(["docker", "cp", cid + ":/g3-runtime", str(OUTPUT / "g3-runtime")])
        binary = (OUTPUT / "g3-runtime").read_bytes()
        assert binary[:4] == b"\x7fELF" and binary[4] == 2 and binary[5] == 1
        assert int.from_bytes(binary[18:20], "little") == 62
        command(["docker", "stop", "--time", "15", cid])
        observed = json.loads(command(["docker", "inspect", cid]))[0]
        assert observed["State"]["ExitCode"] == 0
        record = {"status": "PASS", "imageManifestDigest": image["observations"][0]["manifestDigest"],
                  "localExecutableSha256": hashlib.sha256(binary).hexdigest(),
                  "executablePlatform": "ELF64_LINUX_X86_64",
                  "observations": results, "network": "none", "publishedPorts": [],
                  "nonRoot": True, "gracefulStopExitCode": 0, "azureAuthentication": False,
                  "readinessMeaning": "503 is intentional when no local identity service exists; real Azure readiness remains unproven",
                  "privateSigningKeyPersisted": False}
    finally:
        command(["docker", "rm", "--force", cid])
        del key
    record["transactionContainerResiduals"] = []
    with (OUTPUT / "LOCAL_CONTAINER_SMOKE.json").open("x", encoding="utf-8") as stream:
        json.dump(record, stream, indent=2)
        stream.write("\n")
    print("Qualified local image runs as non-root with no network/published ports; signed health200, unsigned401, readiness503, graceful shutdown0; exact container removed")


if __name__ == "__main__":
    main()
