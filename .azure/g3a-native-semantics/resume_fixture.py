"""Resume only the local constructor after retaining its explicit pre-probe failure."""

import json
import subprocess

from prepare import HERE, fresh, prior, read, require, sha


def main():
    fresh("CONCURRENCY_CONSTRUCTOR_RESUME.json", prior.baseline())
    prior_result = read(HERE / "SEMANTIC_FIXTURE_COMMAND_RESULT.json")
    require(prior_result["exitCode"] == 1 and "preexec_fn" in prior_result["stderr"],
            "NOT_CONSTRUCTOR_ONLY_INTERRUPTION")
    require('"entropy":' not in prior_result["stdout"], "EMBEDDED_PROBE_ALREADY_RAN")
    original = read(HERE / "SEMANTIC_FIXTURE_DISPATCH.json")
    command = list(original["command"])
    command[-1] = (HERE / "fixture.py").read_text()
    for path, expected in original["inputHashes"].items():
        require(sha(path) == expected, "BOUND_SEMANTIC_INPUT_CHANGED")
    fresh("SEMANTIC_FIXTURE_RESUME_DISPATCH.json", {
        "command": command, "originalDispatchSha256": sha(HERE / "SEMANTIC_FIXTURE_DISPATCH.json"),
        "originalResultSha256": sha(HERE / "SEMANTIC_FIXTURE_COMMAND_RESULT.json"),
        "change": "Explicit constructor diagnostics; metadata child exits before unmount to release NODELETE library mappings",
        "inputHashes": original["inputHashes"], "frozenCoreInvocations": 0, "azureCalls": 0,
    })
    result = subprocess.run(command, capture_output=True, text=True, timeout=240)
    fresh("SEMANTIC_FIXTURE_RESUME_RESULT.json", {"exitCode": result.returncode,
               "stdout": result.stdout, "stderr": result.stderr, "automaticRetry": False})
    require(result.returncode == 0, "SEMANTIC_CONSTRUCTOR_RESUME_FAILED")
    report = json.loads(result.stdout)
    fresh("EXACT_RUNTIME_SEMANTIC_FIXTURE.json", report)
    print(json.dumps({name: report[name] for name in ("opensslBuildInfo", "entropy", "descriptor", "cleanup")}))


if __name__ == "__main__":
    main()
