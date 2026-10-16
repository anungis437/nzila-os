"""Continue the canonical USTAR fixture correction without rebuilding either artifact."""
import json
import os
from delivery_guard import GO, HERE, execute, fresh, guard, sha


def main():
    guard()
    failed = json.loads((HERE / "HANDOFF_VALIDATION_ATTEMPT_1.json").read_text())
    env = dict(os.environ, GOENV="off", GOTOOLCHAIN="local", GO111MODULE="off",
               CGO_ENABLED="0", GOOS="linux", GOARCH="amd64",
               GOCACHE=str(HERE / ".checks" / "go-cache"))
    results = [
        execute([GO.with_name("gofmt.exe"), "-w", "handoff_linux_test.go"], env=env),
        execute([GO, "test", "-c", "-trimpath", "-buildvcs=false",
                 "-o", ".checks\\handoff-tests-v2", "handoff_linux.go",
                 "bundle_binding.go", "handoff_linux_test.go"], env=env),
    ]
    if any(r["exitCode"] for r in results):
        fresh("CONTINUATION_BUILD_FAILURE.json", {"results": results})
        raise RuntimeError("TEST_BUILD_FAILURE")
    command = failed["results"][-1]["command"]
    driver = command[-1].replace("/delivery/.checks/handoff-tests", "/delivery/.checks/handoff-tests-v2")
    driver = driver.replace('os.mkdir(".checks",0o700)',
                            'if os.path.exists(".checks"): os.rmdir(".checks")\nos.mkdir(".checks",0o700)')
    command[-1] = driver
    result = execute(command)
    results.append(result)
    fresh("HANDOFF_VALIDATION_CONTINUATION.json", {
        "reason": "Test-only Go USTAR device fields normalized to published Python USTAR; shim unchanged",
        "shimSha256": sha(HERE / "g3a-handoff"), "results": results,
    })
    if result["exitCode"]:
        raise RuntimeError("LOCAL_HANDOFF_FAILED_OWNED_VOLUME_RETAINED")
    print("ACTUAL_LOCAL_HANDOFF_PASS; shim/candidate unchanged; no frozen core")


if __name__ == "__main__":
    main()
