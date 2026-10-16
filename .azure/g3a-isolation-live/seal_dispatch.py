"""Final local binding and fresh read-only safety gate before single dispatch."""

from datetime import datetime, timezone
import io
import ipaddress
from pathlib import Path
import unittest
from urllib.request import urlopen

import isolation_live as live


def main():
    live.ca.refresh.fresh("CONCURRENCY_DISPATCH_BIND.json", live.baseline())
    live.historical()
    evidence = live.verify_artifacts()
    artifacts = live.load(live.ARTIFACTS / "ARTIFACT_BINDING.json")
    live.ensure(artifacts["offlineQualification"] == "PASS", "PROOF_ARTIFACTS_NOT_QUALIFIED")
    live.ensure(not (live.HERE / "AUTHORITY_CONSUMED.json").exists() and
                not list(live.HERE.glob("EVENT_*.json")), "UNEXPECTED_PRIOR_EXECUTION")
    live.ensure(live.read(".azure\\validate-status.json")["completedStep"] == "UpdateStatus",
                "VALIDATION_WORKFLOW_INCOMPLETE")
    stream = io.StringIO()
    result = unittest.TextTestRunner(stream=stream, verbosity=2).run(
        unittest.defaultTestLoader.loadTestsFromNames([
            "test_isolation_live", "test_evidence_transport", "test_evidence_reader"]))
    live.ca.refresh.fresh("LOCAL_TESTS.json", {"status": "PASS" if result.wasSuccessful() else "FAIL",
               "testCount": result.testsRun, "output": stream.getvalue(), "azureCallsUnderTest": 0})
    live.ensure(result.wasSuccessful() and result.testsRun == 16, "LOCAL_CONTROLLER_FIXTURES_FAILED")
    live.ca.refresh.safety()
    image = live.ca.refresh.read("IMMEDIATE_IMAGE", ["vm", "image", "show",
        "--urn", live.ca.retry.p.IMAGE, "--location", "canadacentral", "--subscription", live.ca.retry.p.SUB])
    live.ensure(image["architecture"].lower() == "x64", "PINNED_IMAGE_CHANGED")
    storage = live.ca.refresh.read("IMMEDIATE_STORAGE_NAME", ["storage", "account", "check-name",
        "--name", "nzilag3fb" + live.read("AUTHORITY_BINDING.json")["suffix"]])
    live.ensure(storage["nameAvailable"], "STORAGE_NAME_COLLISION")
    accounts = live.ca.refresh.read("IMMEDIATE_STORAGE_CAPACITY", ["storage", "account", "list",
        "--subscription", live.ca.retry.p.SUB, "--query", "[?location=='canadacentral'].id"])
    live.ensure(len(accounts) + 1 <= 250, "STORAGE_CAPACITY_BOUND")
    with urlopen("https://api.ipify.org", timeout=30) as response:
        ip = response.read().decode().strip()
    live.ensure(ip == live.read("PROOF_PARAMETERS.json")["parameters"]["producerIPv4"]["value"],
                "STAGING_IPV4_CHANGED")
    live.ensure(not Path(live.read("INTERACTIVE_ACCESS_CONTRACT.json")["privateKeyPath"]).exists(),
                "PROVISIONING_PRIVATE_KEY_PRESENT")
    live.ca.refresh.PACKAGE = live.BASE / "g3a-bootstrap-retry"
    live.ca.refresh.cost()
    live.ca.refresh.PACKAGE = live.HERE
    files = [*live.HERE.glob("*.py"), *(live.HERE / "infra").glob("*")]
    for name in ("PROOF_PARAMETERS.json", "CURRENT_COST_GATE.json", "PROOF_ARTIFACTS.json",
                 "AUTHORITY_AMENDMENT.json", "INTERACTIVE_ACCESS_CONTRACT.json", "PUBLISHED_HANDLER_BINDING.json"):
        files.append(live.HERE / name)
    artifact_hashes = {str(path): live.sha(path) for path in live.ARTIFACTS.rglob("*") if path.is_file()}
    live.fresh("EXECUTION_BINDING.json", {
        "authoritySha256": live.sha(live.AUTHORITY),
        "fileHashes": {str(path.relative_to(live.HERE)): live.sha(path) for path in files},
    })
    binding = live.read("AUTHORITY_BINDING.json")
    live.fresh("PINNED_GUEST_PROOF_BINDING.json", {
        "status": "SEALED", "sameUnconsumedAuthority": True,
        "originalAuthoritySha256": live.sha(live.ORIGINAL_AUTHORITY),
        "amendedAuthoritySha256": live.sha(live.AUTHORITY),
        "candidateSha256": artifacts["candidateSha256"], "candidateBytes": artifacts["candidateBytes"],
        "candidateSourceSha256": artifacts["candidateSourceSha256"],
        "shimSha256": artifacts["shimSha256"], "shimBytes": artifacts["shimBytes"],
        "objects": evidence["objects"],
        "image": live.ca.retry.p.IMAGE, "resourceGroup": binding["resourceGroupCandidate"],
        "costCeilingCAD": "3.00", "expectedCAD": live.read("CURRENT_COST_GATE.json")["conservativeExpectedCAD"],
        "combinedArtifactBytes": sum(x["bytes"] for x in evidence["objects"]),
        "maxAttempts": 1, "authorityConsumed": False,
        "artifactFileHashes": artifact_hashes,
        "executionBindingSha256": live.sha(live.HERE / "EXECUTION_BINDING.json"),
        "UTC": datetime.now(timezone.utc).isoformat(),
        "noG3AOrControlPlaneAuthorization": True,
    })
    print("PINNED_GUEST_PROOF_BINDING=SEALED_SHA256=" +
          live.sha(live.HERE / "PINNED_GUEST_PROOF_BINDING.json"))


if __name__ == "__main__":
    main()
