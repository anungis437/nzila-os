"""Compile only the controller with verified staged Go; no image transaction."""

import ast
import hashlib
import json
import subprocess

from prepare import HERE, IMAGE, baseline, boundary, ensure, fresh, load, sha, static, write


def main():
    fresh("CONCURRENCY_COMPILE.json", baseline())
    ensure(load(HERE / "HOST_ENGINE_ISOLATION.json")["exitCode"] == 0, "ISOLATION_FIRST")
    tools = load(HERE / "inputs" / "toolchain-members.json")
    tree = HERE / "preparation-toolchain"
    ensure({str(path.relative_to(tree)).replace("\\", "/"): sha(path)
            for path in tree.rglob("*") if path.is_file()} ==
           {name: entry["sha256"] for name, entry in tools.items()}, "PREPARATION_TOOLCHAIN_CENSUS")
    command = boundary() + [
        "--env", "GOROOT=/compiler", "--env", "GOTOOLCHAIN=local", "--env", "GOPROXY=off",
        "--env", "GOSUMDB=off", "--env", "CGO_ENABLED=0", "--env", "GOOS=linux",
        "--env", "GOARCH=amd64", "--env", "GOCACHE=/tmp/cache", "--env", "GOPATH=/tmp/gopath",
        "--mount", "type=bind,source=" + str(tree) + ",target=/compiler",
        "--mount", "type=bind,source=" + str(HERE / "assembler") + ",target=/src",
        "--mount", "type=bind,source=" + str(HERE / "inputs") + ",target=/inputs",
        "--workdir", "/src", "--entrypoint", "/bin/sh", IMAGE, "-c",
        "set -eu; /bin/chmod +x /compiler/bin/* /compiler/pkg/tool/linux_amd64/* /inputs/compressor-go1256; "
        "/compiler/bin/go version; /compiler/bin/gofmt -w main.go compressor.go main_test.go; "
        "/compiler/bin/go test -v ./...; /compiler/bin/go vet ./...; "
        '/compiler/bin/go build -trimpath -buildvcs=false -ldflags="-buildid= -s -w" '
        "-o /inputs/portable-assembler .",
    ]
    result = subprocess.run(command, capture_output=True, text=True, timeout=240)
    write(HERE / "ASSEMBLER_BUILD.txt", (result.stdout + result.stderr).encode())
    ensure(result.returncode == 0 and "go version go1.27.2 linux/amd64" in result.stdout and
           result.stdout.count("--- PASS: Test") == 5, "CONTROLLER_QUALIFICATION_STOP")
    inputs = HERE / "inputs"
    static(inputs / "portable-assembler")
    for name in ("main.go", "compressor.go", "main_test.go", "go.mod"):
        write(inputs / ("controller-" + name), (HERE / "assembler" / name).read_bytes())
    binding = load(inputs / "binding.json")
    for path in inputs.iterdir():
        if path.name not in binding["inputs"] and path.name != "binding.json":
            binding["inputs"][path.name] = {"sha256": sha(path), "bytes": path.stat().st_size}
    # Preserve the earlier proposed binding rather than overwriting it.
    (inputs / "binding.json").rename(HERE / "PRE_CONTROLLER_BINDING.json")
    write(inputs / "binding.json", (json.dumps(binding, indent=2) + "\n").encode())
    entries = {path.name: {"sha256": sha(path), "bytes": path.stat().st_size}
               for path in sorted(inputs.iterdir())}
    fresh("STAGED_INPUT_CENSUS.json", {
        "status": "PASS", "entries": entries, "totalStagedBytes": sum(item["bytes"] for item in entries.values()),
        "deliveryBasis": "SINGLE_COPY_ALL_INPUT_DIRECTORY_FILES_INCLUDING_CONTROLLER_AND_READER_SOURCE",
        "toolchainDelivery": "NORMALIZED_VERIFIED_ARCHIVE_NOT_DOUBLE_COUNTED_AS_EXTRACTED_TREE",
        "readerSourceIncluded": True, "readerRuntimeAndGuestBootstrap": "NOT_QUALIFIED_SEPARATE_NEXT_AUTHORITY",
        "stagedInputCount": len(entries),
    })
    for path in HERE.glob("*.py"):
        ast.parse(path.read_text(), filename=str(path))
    fresh("ASSEMBLER_BUILD.json", {
        "command": command, "exitCode": result.returncode, "tests": "PASS_5", "vet": "PASS", "build": "PASS",
        "sourceHashes": {name: sha(HERE / "assembler" / name)
                         for name in ("main.go", "compressor.go", "main_test.go", "go.mod")},
        "binaryBytes": (inputs / "portable-assembler").stat().st_size,
        "binarySha256": sha(inputs / "portable-assembler"), "applicationTransactions": 0,
        "compiler": "STAGED_GO1272_VERIFIED_TREE", "hostCompilerUsed": False,
        "shellAndChmodRole": "OUTER_PREPARATION_ONLY_NOT_FULL_BUILD_TRANSACTION",
    })
    ensure(sha(inputs / "compressor-go1256") ==
           "378bacae9bd14e6d2c428fb52ea537ae06bedae01392849293ba9863eb62f95c", "COMPRESSOR_CHANGED")
    print(json.dumps({"controllerTests": 5, "compiler": "go1.27.2",
                      "stagedBytes": sum(item["bytes"] for item in entries.values()),
                      "controllerSha256": sha(inputs / "portable-assembler")}, indent=2))


if __name__ == "__main__":
    main()
