"""Copy sealed inputs unchanged; exercise regression against the failed source first."""

from common import AUTHORITY, HERE, IMAGE, PRIOR, baseline, boundary, ensure, fresh, load, run, sha, write


def main():
    fresh("CONCURRENCY_PREPARE.json", baseline())
    ensure(sha(PRIOR / "FULL_REHEARSAL_VERIFICATION.json") ==
           "bd5be23c49e92d95efe25ab21eb46a5a57af6279d7965d835b2cdd243b07b461", "FAILED_ROOT_CHANGED")
    root = load(PRIOR / "FULL_REHEARSAL_VERIFICATION.json")
    excluded = {"FULL_REHEARSAL_VERIFICATION.json", "FULL_REHEARSAL_INDEPENDENT_VERIFICATION.json"}
    actual = {str(path.relative_to(PRIOR)): sha(path) for path in PRIOR.rglob("*")
              if path.is_file() and path.name not in excluded}
    ensure(actual == root["rehearsalFileHashes"], "FAILED_ATTEMPT_CENSUS_CHANGED")
    fresh("AUTHORITY_BINDING.json", {"path": str(AUTHORITY), "sha256": sha(AUTHORITY),
                                  "fullRetriesAuthorized": 1, "scope": "MANIFEST_WRITE_CONTROL_FLOW_ONLY"})
    workspace = HERE / "clean-room"
    workspace.mkdir()
    (workspace / "transaction").mkdir()
    command = boundary() + ["--entrypoint", "/bin/sh", IMAGE, "-c", """
set -eu
test "$PATH" = /unavailable
test -z "$DOCKER_HOST"
for name in docker buildx buildkitd buildctl go apt apt-get apk yum dnf; do
  if command -v "$name" >/dev/null 2>&1; then exit 91; fi
done
for path in /var/run/docker.sock /run/docker.sock /usr/local/go/bin/go /go/bin/go /usr/bin/go /usr/bin/docker /usr/bin/buildctl /root/.docker /root/.cache/go-build /etc/ssl/certs/ca-certificates.crt /var/lib/docker /var/lib/buildkit /frozen; do
  test ! -e "$path"
done
printf 'FRESH_ISOLATION_PASS_BEFORE_COMPILER\\n'
"""]
    result = run("HOST_ENGINE_ISOLATION", command, 90)
    ensure(result.returncode == 0 and result.stdout.strip() == "FRESH_ISOLATION_PASS_BEFORE_COMPILER",
           "ISOLATION_PRECHECK_STOP")
    source, inputs = HERE / "assembler", HERE / "inputs"
    source.mkdir()
    inputs.mkdir()
    for name in ("main.go", "compressor.go", "main_test.go", "go.mod"):
        write(source / name, (PRIOR / "assembler" / name).read_bytes())
    write(source / "manifest_regression_test.go", (HERE / "manifest_regression_test.go").read_bytes())
    prior_census = load(PRIOR / "STAGED_INPUT_CENSUS.json")
    for name, entry in prior_census["entries"].items():
        path = PRIOR / "inputs" / name
        ensure(sha(path) == entry["sha256"] and path.stat().st_size == entry["bytes"], "INPUT_CHANGED_" + name)
        if name not in ("portable-assembler", "controller-main.go", "binding.json"):
            write(inputs / name, path.read_bytes())
    tree = PRIOR / "preparation-toolchain"
    tools = load(inputs / "toolchain-members.json")
    ensure({str(path.relative_to(tree)).replace("\\", "/"): sha(path)
            for path in tree.rglob("*") if path.is_file()} ==
           {name: entry["sha256"] for name, entry in tools.items()}, "STAGED_PREPARATION_COMPILER_CHANGED")
    command = boundary() + [
        "--env", "GOROOT=/compiler", "--env", "GOTOOLCHAIN=local", "--env", "GOPROXY=off",
        "--env", "GOSUMDB=off", "--env", "CGO_ENABLED=0", "--env", "GOOS=linux", "--env", "GOARCH=amd64",
        "--env", "GOCACHE=/work/cache", "--env", "GOPATH=/work/gopath",
        "--mount", "type=bind,source=" + str(tree) + ",target=/compiler,readonly",
        "--mount", "type=bind,source=" + str(source) + ",target=/src,readonly",
        "--workdir", "/src", "--entrypoint", "/compiler/bin/go", IMAGE,
        "test", "-v", "-run", "^TestManifestSingleWriteControlFlow$", "./...",
    ]
    result = run("REGRESSION_PRIOR_EXPECTED_FAIL", command, 240)
    ensure(result.returncode == 1 and "MANIFEST_WRITE_INSIDE_DESCRIPTOR_LOOP" in result.stdout,
           "REGRESSION_MUST_REJECT_PRIOR_BUG_BEFORE_PATCH")
    fresh("PRIOR_PRESERVATION.json", {
        "rootSha256": sha(PRIOR / "FULL_REHEARSAL_VERIFICATION.json"),
        "failedAttemptExactCensus": "PASS", "stagedInputsVerifiedUnchanged": "PASS",
        "priorTotalBytes": prior_census["totalStagedBytes"], "compiler": "SEALED_STAGED_GO1272_TREE",
        "regression": "EXPECTED_FAIL_AGAINST_PRIOR_SOURCE_BEFORE_PATCH", "fullTransactions": 0,
    })
    print("PRIOR_REGRESSION_FAILED_AS_REQUIRED_READY_FOR_MINIMUM_CONTROL_FLOW_PATCH")


if __name__ == "__main__":
    main()
