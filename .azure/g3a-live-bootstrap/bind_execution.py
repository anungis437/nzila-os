"""Bind validated local proof code before single-use Azure authority dispatch."""

import io
import json
import subprocess
import unittest

from preflight import AUTHORITY, AZ, ENV, HERE, SUB, baseline, ensure, fresh, sha


def main():
    fresh("CONCURRENCY_EXECUTION_BINDING.json", baseline())
    stream = io.StringIO()
    result = unittest.TextTestRunner(stream=stream, verbosity=2).run(
        unittest.defaultTestLoader.loadTestsFromName("test_live"))
    fresh("PROOF_LOCAL_TESTS.json", {"status": "PASS" if result.wasSuccessful() else "FAIL",
          "testCount": result.testsRun, "output": stream.getvalue(),
          "command": "python -B -m unittest discover -s . -p test_live.py -v"})
    ensure(result.wasSuccessful() and result.testsRun == 5, "PROOF_CLASSIFICATION_TESTS_FAILED")
    resources = []
    for name, args in (
        ("STORAGE_QUOTA_CLI.json", ["quota", "list", "--scope", "/subscriptions/" + SUB +
                                  "/providers/Microsoft.Storage/locations/canadacentral"]),
        ("STORAGE_ACCOUNT_USAGE.json", ["storage", "account", "list", "--subscription", SUB,
                                       "--query", "[?location=='canadacentral'].{id:id,name:name}"]),
        ("STORAGE_NAME_AVAILABILITY.json", ["storage", "account", "check-name", "--name", "nzilag3fb" +
                                          json.loads((HERE / "AUTHORITY_BINDING.json").read_text())["suffix"]]),
    ):
        run = subprocess.run([AZ, *args, "--output", "json", "--only-show-errors"],
                             capture_output=True, text=True, env=ENV, timeout=180)
        value = json.loads(run.stdout) if run.stdout.strip() else None
        fresh(name, {"exitCode": run.returncode, "command": ["az", *args], "value": value, "stderr": run.stderr.strip()})
        ensure(run.returncode == 0 or name == "STORAGE_QUOTA_CLI.json", "STORAGE_PREFLIGHT_FAILED_" + name)
        if name == "STORAGE_ACCOUNT_USAGE.json":
            ensure(len(value) + 1 <= 250, "STORAGE_ACCOUNT_CAPACITY_UNPROVEN")
            resources = value
        if name == "STORAGE_NAME_AVAILABILITY.json":
            ensure(value["nameAvailable"], "STORAGE_GLOBAL_NAME_COLLISION")
    fresh("PROOF_QUOTA_SUMMARY.json", {
        "compute": "2_EXISTING_PLUS_2_REQUESTED_WITHIN_10_FAMILY_AND_REGIONAL",
        "network": "LIVE_VNET_NSG_NIC_PE_COUNTS_WITHIN_LIMITS",
        "storageCurrentRegional": len(resources), "storageRequested": 1,
        "storageConservativeDocumentedLimit": 250,
        "DNS": "ONE_NEW_ZONE_AND_LINK_WITHIN_DOCUMENTED_SUBSCRIPTION_AND_ZONE_LIMITS",
        "requiredProviders": "ALL_REGISTERED", "quotaIncreaseOrProviderRegistration": "NOT_PERFORMED"})
    files = [path for path in HERE.glob("*.py")] + list((HERE / "infra").glob("*")) + [
        HERE / "PROOF_PARAMETERS.json", HERE / "CURRENT_COST_GATE.json", HERE / "PROBE_BINARIES.json",
        HERE / "INTERACTIVE_ACCESS_CONTRACT.json", HERE / "g3a-bootstrap-proof-V1",
        HERE / "g3a-bootstrap-proof-V2", HERE / "PUBLISHED_HANDLER_BINDING.json"]
    hashes = {str(path.relative_to(HERE)): sha(path) for path in files if path.is_file()}
    fresh("EXECUTION_BINDING.json", {
        "authoritySha256": sha(AUTHORITY), "fileHashes": hashes, "scope": "SINGLE_BOOTSTRAP_PROOF_ONLY",
        "registryWork": "PROHIBITED", "allCloudMutationPreconditions": "PASS",
        "remaining": "FINISH_VALIDATION_WORKFLOW_INVOKE_AZURE_DEPLOY"})
    print("PROOF_EXECUTION_BYTES_BOUND_CURRENT_COST_AND_QUOTAS_PASS", flush=True)


if __name__ == "__main__":
    main()
