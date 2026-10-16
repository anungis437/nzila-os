"""Validate the exact minimal repair and freeze its legitimate input deltas."""

import ast
import difflib
import json

from common import HERE, IMAGE, PRIOR, baseline, boundary, ensure, fresh, load, run, sha, write


def minimal_patch():
    before = (PRIOR / "assembler" / "main.go").read_text()
    old = """\t\tif err := exclusive(filepath.Join(output, "manifest.json"), []byte(manifest), 0600); err != nil {
\t\t\treturn err
\t\t}
\t\tif b.Frozen != "sha256:82b24793125bceae37828bb3c1adea26882a33cff5ca557fa49d370853db93b7" ||
\t\t\t"sha256:"+hash([]byte(manifest)) != b.Frozen {
\t\t\treturn errors.New("EXACT_FROZEN_MANIFEST_MISMATCH_STOP")
\t\t}
\t}
"""
    repaired = "\t}\n" + "\n".join(line[1:] for line in old.splitlines()[:-1]) + "\n"
    ensure(before.count(old) == 1, "EXACT_PATCH_ANCHOR")
    after = (HERE / "assembler" / "main.go").read_text()
    ensure(after == before.replace(old, repaired, 1), "UNRELATED_MAIN_SOURCE_CHANGE_STOP")
    for name in ("compressor.go", "main_test.go", "go.mod"):
        ensure((HERE / "assembler" / name).read_bytes() == (PRIOR / "assembler" / name).read_bytes(),
               "UNRELATED_SOURCE_CHANGE_" + name)
    return before, after


def main():
    fresh("CONCURRENCY_VALIDATION.json", baseline())
    ensure(load(HERE / "REGRESSION_PRIOR_EXPECTED_FAIL.json")["exitCode"] == 1, "PRIOR_REGRESSION_REQUIRED")
    before, after = minimal_patch()
    write(HERE / "CONTROLLER_PATCH.diff", "".join(difflib.unified_diff(
        before.splitlines(keepends=True), after.splitlines(keepends=True),
        fromfile="prior/assembler/main.go", tofile="repair/assembler/main.go")).encode())
    command = boundary() + [
        "--env", "GOROOT=/compiler", "--env", "GOTOOLCHAIN=local", "--env", "GOPROXY=off",
        "--env", "GOSUMDB=off", "--env", "CGO_ENABLED=0", "--env", "GOOS=linux", "--env", "GOARCH=amd64",
        "--env", "GOCACHE=/work/cache", "--env", "GOPATH=/work/gopath",
        "--mount", "type=bind,source=" + str(PRIOR / "preparation-toolchain") + ",target=/compiler,readonly",
        "--mount", "type=bind,source=" + str(HERE / "assembler") + ",target=/src",
        "--mount", "type=bind,source=" + str(HERE / "inputs") + ",target=/inputs",
        "--workdir", "/src", "--entrypoint", "/bin/sh", IMAGE, "-c",
        "set -eu; /compiler/bin/gofmt -w manifest_regression_test.go; "
        'test -z "$(/compiler/bin/gofmt -l main.go compressor.go main_test.go manifest_regression_test.go)"; '
        "/compiler/bin/go test -v ./...; /compiler/bin/go vet ./...; "
        '/compiler/bin/go build -trimpath -buildvcs=false -ldflags="-buildid= -s -w" '
        "-o /inputs/portable-assembler .",
    ]
    result = run("CONTROLLER_LOCAL_VALIDATION", command, 300)
    ensure(result.returncode == 0 and result.stdout.count("--- PASS: Test") == 6 and
           "--- PASS: TestManifestSingleWriteControlFlow" in result.stdout, "LOCAL_VALIDATION_STOP")
    minimal_patch()
    inputs = HERE / "inputs"
    write(inputs / "controller-main.go", (HERE / "assembler" / "main.go").read_bytes())
    binding = load(PRIOR / "inputs" / "binding.json")
    for name in ("portable-assembler", "controller-main.go"):
        binding["inputs"][name] = {"sha256": sha(inputs / name), "bytes": (inputs / name).stat().st_size}
    write(inputs / "binding.json", (json.dumps(binding, indent=2) + "\n").encode())
    prior = load(PRIOR / "STAGED_INPUT_CENSUS.json")
    entries = {path.name: {"sha256": sha(path), "bytes": path.stat().st_size} for path in sorted(inputs.iterdir())}
    changed = [name for name in entries if entries[name] != prior["entries"][name]]
    ensure(set(entries) == set(prior["entries"]) and set(changed) ==
           {"portable-assembler", "controller-main.go", "binding.json"}, "UNEXPECTED_STAGED_INPUT_CHANGE_STOP")
    deltas = [{
        "file": name, "prior": prior["entries"][name], "new": entries[name],
        "deltaBytes": entries[name]["bytes"] - prior["entries"][name]["bytes"],
        "reason": {"portable-assembler": "REPAIRED_CONTROLLER_BINARY",
                   "controller-main.go": "EXACT_MINIMUM_CONTROLLER_SOURCE_PATCH",
                   "binding.json": "HASH_SIZE_BINDING_OF_THOSE_TWO_REPAIRED_FILES_ONLY"}[name],
    } for name in changed]
    total = sum(entry["bytes"] for entry in entries.values())
    fresh("STAGED_INPUT_CENSUS.json", {
        "status": "PASS", "entries": entries, "totalStagedBytes": total,
        "priorTotalBytes": prior["totalStagedBytes"], "deltaBytes": total - prior["totalStagedBytes"],
        "changes": deltas, "unchangedFileCount": len(entries) - len(changed),
        "regressionTestStaged": False, "regressionScope": "LOCAL_CONTROLLER_VALIDATION_ONLY",
        "readerGuestBootstrapRuntime": "UNQUALIFIED_SEPARATE_AUTHORITY",
    })
    for path in HERE.glob("*.py"):
        ast.parse(path.read_text(), filename=str(path))
    for path in (HERE / "assembler").iterdir():
        if path.suffix in {".go", ".mod"}:
            ensure(all(line.rstrip() == line for line in path.read_text().splitlines()), "SOURCE_WHITESPACE")
    fresh("CONTROLLER_PATCH_REVIEW.json", {
        "CONTROLLER_PATCH_SCOPE": "MANIFEST_WRITE_CONTROL_FLOW_ONLY",
        "CONTROLLER_CHANGED_FILES": ["assembler/main.go", "assembler/manifest_regression_test.go"],
        "productionSourceChangedFiles": ["assembler/main.go"],
        "testOnlyAddedFiles": ["assembler/manifest_regression_test.go"],
        "UNRELATED_SOURCE_CHANGES": 0, "exactPatchComparedToPrior": "PASS",
        "sourceDiff": "CONTROLLER_PATCH.diff", "whitespaceAndGofmt": "PASS",
        "MANIFEST_SINGLE_WRITE_REGRESSION": "PASS", "regressionPrior": "FAIL_EXPECTED",
        "regressionRepaired": "PASS", "unitTests": "PASS_6", "vet": "PASS", "staticBuild": "PASS",
        "CONTROLLER_LOCAL_VALIDATION": "PASS",
        "binarySha256": sha(inputs / "portable-assembler"), "binaryBytes": (inputs / "portable-assembler").stat().st_size,
        "sourceHashes": {path.name: sha(path) for path in (HERE / "assembler").iterdir() if path.is_file()},
        "fullTransactions": 0,
    })
    print(json.dumps({"tests": 6, "totalBytes": total, "deltaBytes": total - prior["totalStagedBytes"],
                      "changes": deltas}, indent=2))


if __name__ == "__main__":
    main()
