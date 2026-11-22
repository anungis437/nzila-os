"""Run and remove one owned staging job. No database URL/password is printed."""
import json
import os
import pathlib
import re
import subprocess
import sys
import time

SUBSCRIPTION = "d562ba7f-d891-4504-a489-10917c0ebaaf"
GROUP = "nzila-canada-staging-rg"
ENVIRONMENT = "nzila-ue-v2-staging-env"
IDENTITY = f"/subscriptions/{SUBSCRIPTION}/resourceGroups/{GROUP}/providers/Microsoft.ManagedIdentity/userAssignedIdentities/nzila-ue-v2-staging-id"
APPLICATION_SOURCE = "57728a2a750b28ee3dfd4b9eb82c54e03ad0bed3"
STAGING_LOG_WORKSPACE = "ce2ff61f-0059-46eb-b18b-a9be8162d009"


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
    assert azure("account", "show", "--query", "id", "-o", "tsv") == SUBSCRIPTION
    name = f"ue-v2-forward-{run_id}"
    assert len(name) < 32
    out = pathlib.Path("artifacts/ue-v2-forward-upgrade")
    out.mkdir(parents=True, exist_ok=True)
    record = {"status": "FAIL", "runId": run_id, "operatorSourceSha": source, "applicationSourceSha": APPLICATION_SOURCE,
              "operation": operation, "image": image, "job": name, "productionDeployment": False}
    receipt = None
    try:
        azure(
            "containerapp", "job", "create", "-g", GROUP, "-n", name, "--environment", ENVIRONMENT,
            "--trigger-type", "Manual", "--replica-timeout", "1200", "--replica-retry-limit", "0",
            "--replica-completion-count", "1", "--parallelism", "1", "--cpu", "1", "--memory", "2Gi",
            "--image", image, "--container-name", "forward-operator", "--mi-user-assigned", IDENTITY,
            "--registry-server", "nzilaventuresacr.azurecr.io", "--registry-identity", IDENTITY,
            "--secrets", f"admin-password={password}",
            f"runtime-url=keyvaultref:https://nzila-ue-v2-staging-kv.vault.azure.net/secrets/database-url,identityref:{IDENTITY}",
            "--env-vars", "UE_ENVIRONMENT=staging", "PGHOST=nzila-ue-v2-staging-db-d562ba7f.postgres.database.azure.com",
            "PGDATABASE=ue_v2_staging", "PGUSER=uev2admin", "PGPASSWORD=secretref:admin-password",
            "UE_UPGRADE_READ_DATABASE_URL=secretref:runtime-url", f"UE_UPGRADE_OPERATOR_SOURCE_SHA={source}",
            f"UE_UPGRADE_OPERATION={operation}", f"UE_UPGRADE_RUN_ID={run_id}", f"UE_UPGRADE_JOB_NAME={name}",
            f"UE_UPGRADE_CONFIRM=UPGRADE ue_v2_staging PRESERVING ROWS FOR {APPLICATION_SOURCE}",
            f"UE_UPGRADE_EXPECTED_PLAN_DIGEST={os.environ.get('EXPECTED_PLAN', '')}",
            f"UE_UPGRADE_EXPECTED_BEFORE_DIGEST={os.environ.get('EXPECTED_BEFORE', '')}",
            "--tags", "change=CHG-2026-0114", "scope=staging-forward-upgrade", f"runId={run_id}", f"source={source}",
            "-o", "none", timeout=180,
        )
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
