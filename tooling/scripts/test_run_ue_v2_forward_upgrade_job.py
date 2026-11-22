import importlib.util
import json
import pathlib
import subprocess
import tempfile
import unittest
from unittest.mock import patch

path = pathlib.Path(__file__).with_name("run-ue-v2-forward-upgrade-job.py")
spec = importlib.util.spec_from_file_location("ue_forward_runner", path)
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class ForwardJobControls(unittest.TestCase):
    def test_native_job_schema_uses_secret_references_and_pinned_staging_boundaries(self):
        spec = runner.job_spec("qualified-image", "synthetic-private-value", "a" * 40, "rehearse", "123", "ue-v2-forward-123")
        props = spec["properties"]
        self.assertEqual(spec["location"], "canadacentral")
        self.assertIn(runner.GROUP, props["environmentId"])
        self.assertEqual(props["configuration"]["replicaRetryLimit"], 0)
        env = {x["name"]: x for x in props["template"]["containers"][0]["env"]}
        self.assertEqual(env["PGPASSWORD"], {"name": "PGPASSWORD", "secretRef": runner.ADMIN_SECRET_NAME})
        self.assertEqual(env["PGDATABASE"]["value"], "ue_v2_staging")
        self.assertNotIn("synthetic-private-value", json.dumps(props["template"]))

    def test_receipts_are_structured_and_incomplete_output_is_not_a_receipt(self):
        receipt = {"status": "PASS_READ_ONLY_PREFLIGHT", "executionRunId": "123"}
        raw = json.dumps({"Log": "UE_UPGRADE_RECEIPT " + json.dumps(receipt)})
        self.assertEqual(runner.extract_receipts(raw), [receipt])
        self.assertEqual(runner.extract_receipts(json.dumps([{"Log_s": "UE_UPGRADE_RECEIPT " + json.dumps(receipt)}])), [receipt])
        self.assertEqual(runner.extract_receipts('UE_UPGRADE_RECEIPT {"status":"PASS"'), [])
        self.assertEqual(runner.extract_receipts('UE_UPGRADE_RECEIPT "PASS"'), [])

    def test_wrong_repository_branch_image_and_operation_never_contact_azure(self):
        base = {"GITHUB_REF": "refs/heads/main", "GITHUB_REPOSITORY": "anungis437/nzila-os", "GITHUB_RUN_ID": "123",
                "GITHUB_SHA": "a" * 40, "OPERATION": "rehearse", "PG_ADMIN_PASSWORD": "synthetic-not-a-real-secret",
                "OPERATOR_IMAGE": "nzilaventuresacr.azurecr.io/nzila-os-union-eyes-v2@sha256:" + "b" * 64}
        for key, value in [("GITHUB_REF", "refs/heads/production"), ("GITHUB_REPOSITORY", "another/repo"),
                           ("OPERATOR_IMAGE", "production.azurecr.io/app:latest"), ("OPERATION", "rebuild")]:
            with self.subTest(key=key), patch.dict(runner.os.environ, {**base, key: value}, clear=True), patch.object(runner, "azure") as azure:
                with self.assertRaises(AssertionError):
                    runner.main()
                azure.assert_not_called()

    def test_provider_errors_never_serialize_secret_arguments(self):
        secret = "synthetic-protected-value"
        completed = subprocess.CompletedProcess([], 1, "", "ERROR: (Forbidden) denied")
        with patch.object(runner.subprocess, "run", return_value=completed):
            with self.assertRaises(runner.AzureFailure) as raised:
                runner.azure("containerapp", "job", "create", "--secrets", "password=" + secret)
        self.assertNotIn(secret, str(raised.exception))
        self.assertIn("Forbidden", str(raised.exception))

    def test_timeouts_never_serialize_secret_arguments(self):
        secret = "synthetic-protected-value"
        timeout = subprocess.TimeoutExpired(["az", "--secrets", "password=" + secret], 5)
        with patch.object(runner.subprocess, "run", side_effect=timeout):
            with self.assertRaises(runner.AzureFailure) as raised:
                runner.azure("containerapp", "job", "create", "--secrets", "password=" + secret)
        self.assertNotIn(secret, str(raised.exception))

    def test_cleanup_refuses_unowned_job_and_persists_failure_without_secret(self):
        env = {"GITHUB_REF": "refs/heads/main", "GITHUB_REPOSITORY": "anungis437/nzila-os", "GITHUB_RUN_ID": "123",
               "GITHUB_SHA": "a" * 40, "OPERATION": "rehearse", "PG_ADMIN_PASSWORD": "synthetic-protected-value",
               "OPERATOR_IMAGE": "nzilaventuresacr.azurecr.io/nzila-os-union-eyes-v2@sha256:" + "b" * 64}
        for tags in ['{"runId":"another-run","scope":"staging-forward-upgrade"}', 'null', 'malformed']:
            with self.subTest(tags=tags), tempfile.TemporaryDirectory() as tmp:
                calls = []
                def azure(*args, **kwargs):
                    calls.append(args)
                    if args[0] == "account":
                        return runner.SUBSCRIPTION
                    if "create" in args:
                        raise runner.AzureFailure("Synthetic creation failure")
                    if "show" in args:
                        return tags
                    self.fail("An unowned job must never be deleted")
                cwd = runner.os.getcwd()
                try:
                    runner.os.chdir(tmp)
                    with patch.dict(runner.os.environ, env, clear=True), patch.object(runner, "azure", side_effect=azure):
                        with self.assertRaises(runner.AzureFailure):
                            runner.main()
                    raw = pathlib.Path("artifacts/ue-v2-forward-upgrade/job-control.json").read_text()
                    self.assertEqual(json.loads(raw)["status"], "FAIL_OWNED_JOB_CLEANUP_UNCONFIRMED")
                    self.assertNotIn(env["PG_ADMIN_PASSWORD"], raw)
                    self.assertFalse(any("delete" in args for args in calls))
                finally:
                    runner.os.chdir(cwd)


if __name__ == "__main__":
    unittest.main()
