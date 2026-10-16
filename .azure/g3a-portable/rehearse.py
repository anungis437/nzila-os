"""Host isolates a clean room only; transaction has no host engine or image access."""

import hashlib
import json
from pathlib import Path
import subprocess
import sys

HERE = Path(__file__).resolve().parent
COMPILER = "golang@sha256:3b15ba438c60ab8fabe5fee3b11025c0049e358b31feff384648f11fc8e335f8"


def write(path, raw):
    with path.open("xb") as file:
        file.write(raw)


def main():
    mode = sys.argv[1] if len(sys.argv) == 2 else ""
    if mode == "freeze":
        args = ["docker", "run", "--rm", "--network", "none", "--mount",
                "type=bind,source=" + str(HERE / "assembler") + ",target=/src",
                "--workdir", "/src", "--env", "CGO_ENABLED=0", "--env", "GOTOOLCHAIN=local",
                "--env", "GOPROXY=off", "--env", "GOSUMDB=off", COMPILER, "sh", "-c",
                'gofmt -w main.go main_test.go && go test -v ./... && go vet ./... && '
                'go build -trimpath -buildvcs=false -ldflags="-buildid= -s -w" -o portable-assembler .']
        result = subprocess.run(args, capture_output=True, text=True, timeout=180)
        write(HERE / "ASSEMBLER_QUALIFICATION_LOG_V2.txt", (result.stdout + result.stderr).encode())
        if result.returncode:
            raise RuntimeError("ASSEMBLER_QUALIFICATION_FAILED")
        binary = (HERE / "assembler" / "portable-assembler").read_bytes()
        write(HERE / "inputs" / "portable-assembler-v2", binary)
        sources = {name: hashlib.sha256((HERE / "assembler" / name).read_bytes()).hexdigest()
                   for name in ("go.mod", "main.go", "main_test.go")}
        write(HERE / "ASSEMBLER_QUALIFICATION_V2.json", (json.dumps({
            "command": args, "tests": "PASS_3", "vet": "PASS",
            "binarySha256": hashlib.sha256(binary).hexdigest(), "bytes": len(binary),
            "sourceHashes": sources, "localDevelopmentCompilerOnly": COMPILER,
        }, indent=2) + "\n").encode())
        print("ASSEMBLER_FROZEN")
        return
    if mode not in ("run1-qualified", "run2"):
        raise RuntimeError("EXACT_FRESH_RUN_REQUIRED")
    output = HERE / ("clean-room-" + mode)
    output.mkdir()
    (output / "transaction").mkdir()
    args = [
        "docker", "run", "--rm", "--pull", "never", "--network", "none",
        "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
        "--memory", "3g", "--pids-limit", "256",
        "--tmpfs", "/work:rw,exec,size=2g", "--tmpfs", "/tmp:rw,exec,size=256m",
        "--tmpfs", "/usr/local/go:rw,noexec,size=1m", "--tmpfs", "/go:rw,noexec,size=1m",
        "--env", "PATH=/unavailable", "--env", "DOCKER_HOST=",
        "--mount", "type=bind,source=" + str(HERE / "inputs") + ",target=/inputs,readonly",
        "--mount", "type=bind,source=" + str(output) + ",target=/output",
        "--entrypoint", "/inputs/portable-assembler-v2", COMPILER,
        "/inputs", "/work/transaction", "/output/transaction",
    ]
    result = subprocess.run(args, capture_output=True, text=True, timeout=600)
    write(output / "container-output.txt", (result.stdout + result.stderr).encode())
    write(output / "ISOLATION_COMMAND.json", (json.dumps({
        "command": args, "exitCode": result.returncode,
        "dockerRole": "ISOLATION_ONLY_NOT_VISIBLE_OR_USED_INSIDE_TRANSACTION",
        "socketMounted": False, "compilerFromContainerImageVisible": False,
        "cloudGuestExecution": False, "registryMutations": 0,
    }, indent=2) + "\n").encode())
    if result.returncode:
        print(result.stdout + result.stderr)
        raise RuntimeError("CLEAN_ROOM_TRANSACTION_FAILED_STOP_INSPECT_EXACT_OUTPUT")
    print(result.stdout)


if __name__ == "__main__":
    main()
