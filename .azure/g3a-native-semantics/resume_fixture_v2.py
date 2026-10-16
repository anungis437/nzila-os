"""Correct a cached-harness seccomp assumption; preserve both pre-probe failures."""

import json
import subprocess

from prepare import HERE, fresh, prior, read, require, sha


def main():
    fresh("CONCURRENCY_CONSTRUCTOR_V2.json", prior.baseline())
    for name in ("SEMANTIC_FIXTURE_COMMAND_RESULT.json", "SEMANTIC_FIXTURE_RESUME_RESULT.json"):
        previous = read(HERE / name)
        require(previous["exitCode"] == 1 and "preexec_fn" in previous["stderr"] and
                '"entropy":' not in previous["stdout"], "NOT_PRE_PROBE_FAILURE")
    original = read(HERE / "SEMANTIC_FIXTURE_DISPATCH.json")
    command = list(original["command"])
    command[-1] = (HERE / "fixture.py").read_text()
    for path, expected in original["inputHashes"].items():
        require(sha(path) == expected, "BOUND_SEMANTIC_INPUT_CHANGED")
    fresh("SEMANTIC_FIXTURE_V2_DISPATCH.json", {
        "command": command,
        "priorFailures": {name: sha(HERE / name) for name in
                         ("SEMANTIC_FIXTURE_COMMAND_RESULT.json", "SEMANTIC_FIXTURE_RESUME_RESULT.json")},
        "constructorCorrection": "Actual cached-harness seccomp2 retained, not falsely required to be pinned-live seccomp0; track new mounts separately from inherited Docker tmpfs",
        "inputHashes": original["inputHashes"], "frozenCoreInvocations": 0, "azureCalls": 0,
    })
    result = subprocess.run(command, capture_output=True, text=True, timeout=240)
    fresh("SEMANTIC_FIXTURE_V2_RESULT.json", {"exitCode": result.returncode,
                                          "stdout": result.stdout, "stderr": result.stderr})
    require(result.returncode == 0, "SEMANTIC_FIXTURE_V2_CONSTRUCTOR_OR_CLEANUP_FAILED")
    report = json.loads(result.stdout)
    fresh("EXACT_RUNTIME_SEMANTIC_FIXTURE.json", report)
    print(json.dumps(report))


if __name__ == "__main__":
    main()
