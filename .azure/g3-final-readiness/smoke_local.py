"""Private/network-none local image execution, without Azure identity or secrets."""

import base64
import hashlib
import json
from pathlib import Path
import secrets
import subprocess
import sys
import time
import uuid

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

HERE = Path(__file__).resolve().parent
HELPER = "alpine@sha256:294b683cb724975bec92580e1e685676bd4b50bda910ddb8c51d4cabeaec77e6"


def command(args):
    result = subprocess.run(args, capture_output=True, text=True, timeout=45)
    if result.returncode:
        raise RuntimeError("LOCAL_DOCKER_COMMAND_FAILED: " + result.stderr)
    return result.stdout.strip()


def main():
    output = HERE / sys.argv[1]
    image = json.loads((output / "LOCAL_IMAGE_QUALIFICATION.json").read_text())
    key = Ed25519PrivateKey.generate()
    challenge_value = secrets.token_hex(32)
    expected = hashlib.sha256(challenge_value.encode()).hexdigest()
    del challenge_value
    challenge_id = "g3-" + uuid.uuid4().hex
    env = {
        "G3_ENVIRONMENT": "integration-test", "G3_PROOF_MODE": "synthetic-only",
        "G3_SOURCE_AUTHORITY": image["sourceAuthoritySha256"],
        "G3_SECRET_URI": "https://nzl-g3-test-001-kv.vault.azure.net/secrets/substrate-proof/" + "a" * 32,
        "AZURE_CLIENT_ID": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        "G3_RUNTIME_PRINCIPAL_ID": "11111111-2222-3333-4444-555555555555",
        "G3_PULL_CLIENT_ID": "22222222-3333-4444-5555-666666666666",
        "IDENTITY_ENDPOINT": "http://127.0.0.1:1/msi/token", "IDENTITY_HEADER": "LOCAL_FAKE_ONLY",
        "G3_EXPECTED_SECRET_SHA256": expected, "G3_CHALLENGE_ID": challenge_id,
        "G3_PROBE_PUBLIC_KEY": base64.b64encode(key.public_key().public_bytes_raw()).decode(),
    }
    args = [
        "docker", "run", "--detach", "--network", "none", "--read-only", "--cap-drop", "ALL",
        "--security-opt", "no-new-privileges", "--name", "nzila-g3-final-" + uuid.uuid4().hex,
    ]
    for name, value in env.items():
        args += ["--env", name + "=" + value]
    args += ["nzila-g3-local:" + image["G3_IMAGE_TAG"]]
    cid = command(args)
    observations = []
    try:
        initial = json.loads(command(["docker", "inspect", cid]))[0]
        if not initial["State"]["Running"] or initial["Config"]["User"] != "65532:65532":
            raise RuntimeError("LOCAL_RUNTIME_NOT_RUNNING_NONROOT")
        if initial["HostConfig"]["NetworkMode"] != "none" or initial["NetworkSettings"]["Ports"]:
            raise RuntimeError("LOCAL_RUNTIME_EXPOSED")
        tests = [
            ("/health", True, 200, "ok"), ("/health", False, 401, "unauthorized"),
            ("/ready", True, 503, "not_ready"), ("/proof/secret", False, 401, "unauthorized"),
            ("/proof/secret", True, 503, "INCONCLUSIVE"),
            ("/proof/pull-token", True, 503, "INCONCLUSIVE"),
            ("/proof/runtime-acr-write", True, 503, "INCONCLUSIVE"),
            ("/probes/live", False, 200, "ok"), ("/probes/ready", False, 503, "not_ready"),
        ]
        for path, authenticated, code, status in tests:
            headers = ["Host: localhost", "Connection: close"]
            if authenticated:
                expiry, nonce = str(int(time.time()) + 60), secrets.token_hex(32)
                signed = key.sign(("GET\n" + path + "\n" + nonce + "\n" + expiry).encode())
                headers += [
                    "X-G3-Expiry: " + expiry, "X-G3-Nonce: " + nonce,
                    "X-G3-Signature: " + base64.b64encode(signed).decode(),
                ]
            request = "GET " + path + " HTTP/1.1\r\n" + "\r\n".join(headers) + "\r\n\r\n"
            raw = command([
                "docker", "run", "--rm", "--network", "container:" + cid, HELPER,
                "sh", "-c", 'printf "%s" "$1" | nc -w 4 127.0.0.1 3000', "request", request,
            ])
            header, body = raw.split("\n\n", 1)
            if int(header.splitlines()[0].split()[1]) != code:
                raise RuntimeError("LOCAL_HTTP_STATUS_MISMATCH: " + path)
            result = json.loads(body)
            if result["status"] != status or any(x in body for x in ["access_token", expected, "LOCAL_FAKE"]):
                raise RuntimeError("LOCAL_BODY_OR_HYGIENE_FAILURE")
            observations.append({"path": path, "authenticated": authenticated, "httpStatus": code, "schema": result})
        command(["docker", "cp", cid + ":/g3-runtime", str(output / "g3-runtime")])
        binary = (output / "g3-runtime").read_bytes()
        if binary[:5] != b"\x7fELF\x02" or binary[18:20] != b"\x3e\x00":
            raise RuntimeError("LOCAL_EXECUTABLE_PLATFORM_INVALID")
        command(["docker", "stop", "--time", "15", cid])
        final = json.loads(command(["docker", "inspect", cid]))[0]
        if final["State"]["ExitCode"] != 0:
            raise RuntimeError("LOCAL_GRACEFUL_STOP_FAILED")
        record = {
            "status": "PASS", "scope": "LOCAL_ONLY_NO_AZURE_RUNTIME_PROOF",
            "imageManifestDigest": image["observations"][0]["manifestDigest"],
            "localExecutableSha256": hashlib.sha256(binary).hexdigest(),
            "nonRoot": True, "network": "none", "publishedPorts": [],
            "observations": observations, "gracefulStopExitCode": 0,
            "challenge": {"id": challenge_id, "expectedSha256": expected,
                          "scope": "LOCAL_QUALIFICATION_ONLY_NOT_TARGET_BOOTSTRAP", "clearValuePersisted": False},
            "privateSigningKeyPersisted": False, "azureCalls": 0,
        }
    finally:
        command(["docker", "rm", "--force", cid])
        del key
    record["transactionContainerResiduals"] = []
    with (output / "LOCAL_CONTAINER_SMOKE.json").open("x", encoding="utf-8") as file:
        json.dump(record, file, indent=2)
        file.write("\n")
    print("LOCAL_SMOKE = PASS; signed health/proofs, expected fail-closed readiness, non-root, shutdown0")


if __name__ == "__main__":
    main()
