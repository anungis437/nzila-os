"""Exclusive offline probe build/test record. No guest or Azure execution."""

import hashlib
import json
from pathlib import Path
import subprocess

HERE = Path(__file__).resolve().parent
COMPILER = "golang@sha256:3b15ba438c60ab8fabe5fee3b11025c0049e358b31feff384648f11fc8e335f8"


def main():
    args = [
        "docker", "run", "--rm", "--network", "none", "--mount",
        "type=bind,source=" + str(HERE / "probe") + ",target=/src", "--workdir", "/src",
        "--env", "CGO_ENABLED=0", "--env", "GOTOOLCHAIN=local", "--env", "GOPROXY=off",
        "--env", "GOSUMDB=off", COMPILER, "sh", "-c",
        'gofmt -w main.go main_test.go && go test -v ./... && go vet ./... && '
        'go build -trimpath -buildvcs=false -ldflags="-buildid= -s -w" -o g3-private-probe .',
    ]
    result = subprocess.run(args, capture_output=True, text=True, timeout=120)
    with (HERE / "PROBE_LOCAL_BUILD_LOG_V3.txt").open("x", encoding="utf-8") as file:
        file.write(result.stdout + result.stderr)
    if result.returncode:
        raise RuntimeError("PROBE_LOCAL_BUILD_FAILURE")
    path = HERE / "probe" / "g3-private-probe"
    raw = path.read_bytes()
    if raw[:5] != b"\x7fELF\x02" or raw[18:20] != b"\x3e\x00":
        raise RuntimeError("PROBE_ELF_PLATFORM_INVALID")
    value = {
        "status": "PASS_LOCAL_PROTOCOL_COMPONENT_NOT_GUEST_CALLER",
        "command": args, "testsAndVet": "PASS", "linuxAmd64StaticBuild": True,
        "binaryBytes": len(raw), "binarySha256": hashlib.sha256(raw).hexdigest(),
        "goSources": {name: hashlib.sha256((HERE / "probe" / name).read_bytes()).hexdigest()
                      for name in ("go.mod", "main.go", "main_test.go")},
        "signingPrivateKeyPersistence": "MEMORY_ONLY", "runtimeIdentityAttached": False,
        "scope": "DOES_NOT_IMPLEMENT_SECRET_BOOTSTRAP_OR_PULL_UAMI_REPOSITORY_TEST_CALLER",
        "guestExecution": False, "azureMutations": 0, "registryMutations": 0,
    }
    with (HERE / "PROBE_LOCAL_QUALIFICATION_V3.json").open("x", encoding="utf-8") as file:
        json.dump(value, file, indent=2)
        file.write("\n")
    print("PRIVATE_PROBE_PROTOCOL_TEST_BUILD = PASS_LOCAL_ONLY")


if __name__ == "__main__":
    main()
