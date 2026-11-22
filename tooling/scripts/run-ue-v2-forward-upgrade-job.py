"""Run and remove one owned staging job. No database URL/password is printed."""
import json
import os
import pathlib
import re
import subprocess
import sys
import tempfile
import time

SUBSCRIPTION = "d562ba7f-d891-4504-a489-10917c0ebaaf"
GROUP = "nzila-canada-staging-rg"
ENVIRONMENT = "nzila-ue-v2-staging-env"
IDENTITY = f"/subscriptions/{SUBSCRIPTION}/resourceGroups/{GROUP}/providers/Microsoft.ManagedIdentity/userAssignedIdentities/nzila-ue-v2-staging-id"
APPLICATION_SOURCE = "57728a2a750b28ee3dfd4b9eb82c54e03ad0bed3"
STAGING_LOG_WORKSPACE = "ce2ff61f-0059-46eb-b18b-a9be8162d009"
ADMIN_SECRET_NAME = "operator-password"


class AzureFailure(RuntimeError):
    pass


def azure(*args, timeout=75):
    try:
        result = subprocess.run(
            ["az", *args, "--subscription", SUBSCRIPTION, "--only-show-errors"],
            capture_output=True, text=True, timeout=timeout, check=False,
        )
    except subprocess.TimeoutExpired:
        raise AzureFailure(f"Azure {args[0]} operation timed out") from None
    if result.returncode:
        # Never serialize argv: job creation carries the protected environment
        # secret. Provider errors are retained only as a bounded error code.
        code = re.search(r"\(([A-Za-z][A-Za-z0-9]+)\)", result.stderr)
        raise AzureFailure(f"Azure {args[0]} operation failed: {code.group(1) if code else 'COMMAND_FAILED'}")
    return result.stdout.strip()


def extract_receipts(raw):
    receipts = []
    try:
        document = json.loads(raw)
        if isinstance(document, list):
            raw = "\n".join(json.dumps(row) for row in document)
    except ValueError:
        pass
    for line in raw.splitlines():
        try:
            decoded = json.loads(line)
            if isinstance(decoded, dict):
                line = str(decoded.get("Log", decoded.get("Log_s", line)))
        except ValueError:
            pass
        if "UE_UPGRADE_RECEIPT " not in line:
            continue
        try:
            value, _ = json.JSONDecoder().raw_decode(line.split("UE_UPGRADE_RECEIPT ", 1)[1])
            if isinstance(value, dict):
                receipts.append(value)
        except ValueError:
            continue
    return receipts


def job_spec(image, password, source, operation, run_id, name):
    """Native secretRef fields keep secret values out of command-line arguments."""
    values = {
        "UE_ENVIRONMENT": "staging",
        "PGHOST": "nzila-ue-v2-staging-db-d562ba7f.postgres.database.azure.com",
        "PGDATABASE": "ue_v2_staging", "PGUSER": "uev2admin",
        "UE_UPGRADE_OPERATOR_SOURCE_SHA": source, "UE_UPGRADE_OPERATION": operation,
        "UE_UPGRADE_RUN_ID": run_id, "UE_UPGRADE_JOB_NAME": name,
        "UE_UPGRADE_CONFIRM": f"UPGRADE ue_v2_staging PRESERVING ROWS FOR {APPLICATION_SOURCE}",
        "UE_UPGRADE_EXPECTED_PLAN_DIGEST": os.environ.get("EXPECTED_PLAN", ""),
        "UE_UPGRADE_EXPECTED_BEFORE_DIGEST": os.environ.get("EXPECTED_BEFORE", ""),
    }
    return {
        "location": "canadacentral",
        "identity": {"type": "UserAssigned", "userAssignedIdentities": {IDENTITY: {}}},
        "tags": {"change": "CHG-2026-0114", "scope": "staging-forward-upgrade", "runId": run_id, "source": source},
        "properties": {
            "environmentId": f"/subscriptions/{SUBSCRIPTION}/resourceGroups/{GROUP}/providers/Microsoft.App/managedEnvironments/{ENVIRONMENT}",
            "workloadProfileName": "Consumption",
            "configuration": {
                "triggerType": "Manual", "replicaTimeout": 1200, "replicaRetryLimit": 0,
                "manualTriggerConfig": {"parallelism": 1, "replicaCompletionCount": 1},
                "registries": [{"server": "nzilaventuresacr.azurecr.io", "identity": IDENTITY}],
                "secrets": [
                    {"name": ADMIN_SECRET_NAME, "value": password},
                    {"name": "runtime-url", "keyVaultUrl": "https://nzila-ue-v2-staging-kv.vault.azure.net/secrets/database-url", "identity": IDENTITY},
                ],
            },
            "template": {"containers": [{
                "name": "forward-operator", "image": image, "resources": {"cpu": 1, "memory": "2Gi"},
                "env": [{"name": key, "value": value} for key, value in values.items()] + [
                    {"name": "PGPASSWORD", "secretRef": ADMIN_SECRET_NAME},
                    {"name": "UE_UPGRADE_READ_DATABASE_URL", "secretRef": "runtime-url"},
                ],
            }]},
        },
    }


def validate_rehearsal(run, receipt, control, source, rehearsal_id, plan, before):
    assert str(run.get("id")) == rehearsal_id, "REHEARSAL_RUN_ID_REFUSED"
    assert run.get("path") == ".github/workflows/ue-v2-staging-forward-upgrade.yml", "REHEARSAL_WORKFLOW_REFUSED"
    assert run.get("head_branch") == "main" and run.get("head_sha") == source, "REHEARSAL_SOURCE_REFUSED"
    assert run.get("event") == "workflow_dispatch" and run.get("status") == "completed" and run.get("conclusion") == "success", "REHEARSAL_RUN_NOT_SUCCESSFUL"
    assert run.get("repository", {}).get("full_name") == "anungis437/nzila-os", "REHEARSAL_REPOSITORY_REFUSED"
    for record in [receipt, control]:
        assert record.get("operatorSourceSha") == source and record.get("applicationSourceSha") == APPLICATION_SOURCE, "REHEARSAL_ARTIFACT_SOURCE_REFUSED"
        assert record.get("operation") == "rehearse", "REHEARSAL_OPERATION_REFUSED"
    assert receipt.get("executionRunId") == rehearsal_id and control.get("runId") == rehearsal_id, "REHEARSAL_ID_REFUSED"
    assert receipt.get("status") == "PASS_STAGING_TRANSACTIONAL_REHEARSAL", "REHEARSAL_RECEIPT_NOT_SUCCESSFUL"
    assert receipt.get("changesCommitted") is False and receipt.get("fullRollbackVerified") is True, "REHEARSAL_ROLLBACK_NOT_PROVEN"
    assert receipt.get("temporaryPrivilegesRemoved") is True and receipt.get("productionDeployment") is False
    assert control.get("status") == "PASS" and control.get("executionStatus") == "Succeeded" and control.get("ownedJobAndSecretRemoved") is True, "REHEARSAL_CLEANUP_NOT_PROVEN"
    assert receipt.get("planDigest") == plan and receipt.get("beforeDigest") == before, "REHEARSAL_DIGEST_BINDING_REFUSED"


def require_rehearsal(source):
    rehearsal_id = os.environ.get("REHEARSAL_RUN_ID", "")
    assert re.fullmatch(r"[0-9]+", rehearsal_id), "SUCCESSFUL_REHEARSAL_RUN_ID_REQUIRED"
    for key in ["EXPECTED_PLAN", "EXPECTED_BEFORE"]:
        assert re.fullmatch(r"[a-f0-9]{64}", os.environ.get(key, "")), "REHEARSAL_DIGEST_REQUIRED"
    def gh(*args):
        try:
            result = subprocess.run(["gh", *args], capture_output=True, text=True, timeout=60)
        except subprocess.TimeoutExpired:
            raise AzureFailure("Rehearsal evidence retrieval timed out") from None
        if result.returncode:
            raise AzureFailure("Rehearsal GitHub evidence retrieval failed")
        return result.stdout
    try:
        run = json.loads(gh("api", f"repos/anungis437/nzila-os/actions/runs/{rehearsal_id}"))
        with tempfile.TemporaryDirectory(prefix="ue-rehearsal-receipt-") as private:
            gh("run", "download", rehearsal_id, "--repo", "anungis437/nzila-os",
               "--name", f"ue-staging-forward-upgrade-{rehearsal_id}", "--dir", private)
            receipt = json.loads((pathlib.Path(private) / "operation-receipt.json").read_text())
            control = json.loads((pathlib.Path(private) / "job-control.json").read_text())
            validate_rehearsal(run, receipt, control, source, rehearsal_id,
                               os.environ["EXPECTED_PLAN"], os.environ["EXPECTED_BEFORE"])
    except (ValueError, TypeError, AttributeError, OSError):
        raise AzureFailure("Rehearsal evidence is unreadable") from None
    return rehearsal_id


def main():
    assert os.environ.get("GITHUB_REF") == "refs/heads/main", "MAIN_ONLY"
    assert os.environ.get("GITHUB_REPOSITORY") == "anungis437/nzila-os", "REPOSITORY_REFUSED"
    run_id = os.environ["GITHUB_RUN_ID"]
    source = os.environ["GITHUB_SHA"]
    operation = os.environ["OPERATION"]
    image = os.environ["OPERATOR_IMAGE"]
    password = os.environ["PG_ADMIN_PASSWORD"]
    assert run_id.isdigit() and re.fullmatch(r"[a-f0-9]{40}", source)
    assert operation in ("preflight", "rehearse", "apply")
    assert re.fullmatch(r"nzilaventuresacr\.azurecr\.io/nzila-os-union-eyes-v2@sha256:[a-f0-9]{64}", image)
    assert password, "PROTECTED_STAGING_SECRET_MISSING"
    rehearsal_id = require_rehearsal(source) if operation == "apply" else None
    assert azure("account", "show", "--query", "id", "-o", "tsv") == SUBSCRIPTION
    name = f"ue-v2-forward-{run_id}"
    assert len(name) < 32
    out = pathlib.Path("artifacts/ue-v2-forward-upgrade")
    out.mkdir(parents=True, exist_ok=True)
    record = {"status": "FAIL", "runId": run_id, "operatorSourceSha": source, "applicationSourceSha": APPLICATION_SOURCE,
              "operation": operation, "image": image, "job": name, "productionDeployment": False}
    if rehearsal_id:
        record["rehearsalRunId"] = rehearsal_id
    receipt = None
    try:
        # JSON is a YAML subset accepted by the existing Azure CLI. The private
        # file is removed even when creation fails; it is never an artifact.
        with tempfile.TemporaryDirectory(prefix="ue-forward-private-") as private:
            manifest = pathlib.Path(private) / "job.yaml"
            fd = os.open(manifest, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, "w") as handle:
                json.dump(job_spec(image, password, source, operation, run_id, name), handle)
            azure("containerapp", "job", "create", "-g", GROUP, "-n", name,
                  "--yaml", str(manifest), "-o", "none", timeout=180)
        execution = azure("containerapp", "job", "start", "-g", GROUP, "-n", name, "--query", "name", "-o", "tsv")
        assert re.fullmatch(re.escape(name) + r"-[a-z0-9-]+", execution), "EXECUTION_ID_REFUSED"
        record["execution"] = execution
        deadline = time.monotonic() + 1250
        status = "Unknown"
        poll = 0
        while time.monotonic() < deadline:
            poll += 1
            status = azure("containerapp", "job", "execution", "show", "-g", GROUP, "-n", name,
                           "--job-execution-name", execution, "--query", "properties.status", "-o", "tsv")
            try:
                logs = azure("containerapp", "job", "logs", "show", "-g", GROUP, "-n", name,
                             "--execution", execution, "--container", "forward-operator", "--tail", "100", "--format", "json", timeout=25)
                for candidate in extract_receipts(logs):
                    if candidate.get("executionRunId") == run_id and candidate.get("operatorSourceSha") == source:
                        receipt = candidate
            except (AzureFailure, subprocess.TimeoutExpired):
                pass
            # Finished job pods can disappear before the log-stream endpoint
            # returns. Query only this owned execution's structured receipts;
            # never collect unrelated application logs or business payloads.
            if not receipt and (poll % 4 == 0 or status in ("Succeeded", "Failed", "Stopped")):
                try:
                    query = ("ContainerAppConsoleLogs_CL | where TimeGenerated > ago(2h) "
                             f"| where ContainerJobName_s == '{name}' and ContainerGroupName_s startswith '{execution}' "
                             "| where Log_s startswith 'UE_UPGRADE_RECEIPT ' | project Log_s")
                    logs = azure("monitor", "log-analytics", "query", "--workspace", STAGING_LOG_WORKSPACE,
                                 "--analytics-query", query, "-o", "json", timeout=30)
                    for candidate in extract_receipts(logs):
                        if candidate.get("executionRunId") == run_id and candidate.get("operatorSourceSha") == source:
                            receipt = candidate
                except (AzureFailure, subprocess.TimeoutExpired):
                    pass
            if status in ("Succeeded", "Failed", "Stopped") and receipt:
                break
            if status in ("Failed", "Stopped"):
                break
            time.sleep(8)
        record["executionStatus"] = status
        if receipt:
            (out / "operation-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
        assert status == "Succeeded", "AZURE_JOB_DID_NOT_SUCCEED"
        assert receipt, "AUTHORITATIVE_OPERATION_RECEIPT_MISSING"
        expected = {"preflight": "PASS_READ_ONLY_PREFLIGHT", "rehearse": "PASS_STAGING_TRANSACTIONAL_REHEARSAL", "apply": "PASS_STAGING_FORWARD_UPGRADE"}
        assert receipt.get("status") == expected[operation], "DATABASE_OPERATION_DID_NOT_QUALIFY"
        assert receipt.get("applicationSourceSha") == APPLICATION_SOURCE and receipt.get("operation") == operation
        record["status"] = "PASS"
        print(json.dumps({"job": name, "execution": execution, "operation": operation, "status": receipt["status"],
                          "planDigest": receipt["planDigest"], "beforeDigest": receipt["beforeDigest"]}))
    finally:
        try:
            tags = json.loads(azure("containerapp", "job", "show", "-g", GROUP, "-n", name, "--query", "tags", "-o", "json"))
            assert tags.get("runId") == run_id and tags.get("scope") == "staging-forward-upgrade", "JOB_CUSTODY_MISMATCH"
            azure("containerapp", "job", "delete", "-g", GROUP, "-n", name, "--yes", "-o", "none", timeout=120)
            record["ownedJobAndSecretRemoved"] = True
        except (AssertionError, AzureFailure, subprocess.TimeoutExpired, ValueError, TypeError, AttributeError):
            record["ownedJobAndSecretRemoved"] = False
            record["status"] = "FAIL_OWNED_JOB_CLEANUP_UNCONFIRMED"
        (out / "job-control.json").write_text(json.dumps(record, indent=2) + "\n")
        if record.get("ownedJobAndSecretRemoved") is not True:
            raise AzureFailure("Owned staging job and secret removal could not be confirmed")


if __name__ == "__main__":
    try:
        main()
    except (AssertionError, AzureFailure, subprocess.TimeoutExpired) as error:
        # TimeoutExpired's default message contains argv and could reveal secrets.
        print("Staging forward upgrade refused: " + ("AZURE_TIMEOUT" if isinstance(error, subprocess.TimeoutExpired) else str(error)), file=sys.stderr)
        sys.exit(1)
