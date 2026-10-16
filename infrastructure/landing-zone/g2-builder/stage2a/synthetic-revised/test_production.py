import base64
import importlib.util
import io
import json
import pathlib
import struct
import tarfile
import tempfile
import unittest
from unittest.mock import Mock, patch

D = pathlib.Path(__file__).parent
spec = importlib.util.spec_from_file_location("production", D.parent / "private-import" / "verifier.py")
v = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v)
v.BOUND_PAYLOAD_BASE64 = base64.b64encode(
    (D.parents[4] / ".azure" / "evidence" / "G2_SYNTHETIC_PRODUCTION_PAYLOAD.json").read_bytes()).decode()
for path in (D.parent / "blob-readback" / "observer.py", D.parent / "empty-path" / "validator.py",
             D.parent / "empty-path" / "observer.py", D / "production.py"):
    exec(compile(path.read_bytes(), str(path), "exec"), v.__dict__)


def scoped(grants):
    payload = base64.urlsafe_b64encode(json.dumps({"access": grants, "exp": 9999999999}).encode()).rstrip(b"=").decode()
    return "local." + payload + ".fixture"


def manifest_bytes():
    return json.dumps({
        "schemaVersion": 2, "mediaType": v.MANIFEST_TYPE, "artifactType": v.PROOF_TYPE,
        "config": {"mediaType": "application/vnd.oci.empty.v1+json",
                   "digest": "sha256:" + v.hashlib.sha256(b"{}").hexdigest(), "size": 2},
        "layers": [{"mediaType": v.PAYLOAD_TYPE, "digest": "sha256:" + v.SOURCE_SHA,
                    "size": len(v.PAYLOAD_BYTES), "annotations": {"org.opencontainers.image.title": v.PAYLOAD_NAME}}],
        "annotations": {"org.opencontainers.image.created": v.FIXED_CREATED},
    }, separators=(",", ":")).encode()


class ProductionTests(unittest.TestCase):
    def test_bound_payload_unchanged(self):
        self.assertEqual(v.hashlib.sha256(v.PAYLOAD_BYTES).hexdigest(), v.SOURCE_SHA)
        self.assertEqual(v.TARGET_TAG, "stage2a-" + v.SOURCE_SHA)

    def test_exact_scope_rejects_extra_repository_or_action(self):
        for grants in (
            [{"type": "repository", "name": "*", "actions": ["push", "pull"]}],
            [{"type": "repository", "name": v.TARGET_REPO, "actions": ["delete", "pull", "push"]}],
            [{"type": "repository", "name": v.TARGET_REPO, "actions": ["pull"]}],
        ):
            response = (200, json.dumps({"access_token": scoped(grants)}).encode(), {})
            with patch.object(v, "registry_call", return_value=response):
                with self.assertRaises(v.ReadbackFailure):
                    v.exact_scope("memory-only", v.TARGET_REPO, ["pull", "push"])

    def test_exact_scope_allows_order_and_no_wildcard_request(self):
        grants = [{"type": "repository", "name": v.TARGET_REPO, "actions": ["push", "pull"]}]
        response = (200, json.dumps({"access_token": scoped(grants)}).encode(), {})
        with patch.object(v, "registry_call", return_value=response) as call:
            v.exact_scope("memory-only", v.TARGET_REPO, ["pull", "push"])
        self.assertIn("repository%3Asynthetic-health%3Apull%2Cpush", call.call_args.args[3])

    def test_write_denial_requires_server_denial_and_zero_grant(self):
        for status in (401, 403, 202, 500):
            with patch.object(v, "exact_scope", return_value="memory-only"), patch.object(v, "registry_call", return_value=(status, b"", {})) as call:
                if status in (401, 403):
                    self.assertEqual(v.deny_write("memory-only", v.CONTROL_REPO), "DENIED")
                else:
                    with self.assertRaises(v.ReadbackFailure):
                        v.deny_write("memory-only", v.CONTROL_REPO)
                self.assertEqual(call.call_count, 1)
                self.assertEqual(call.call_args.args[:2], ("POST", "/v2/" + v.CONTROL_REPO + "/blobs/uploads/"))

    def test_allowed_write_token_fails_before_negative_request(self):
        grants = [{"type": "repository", "name": v.REPOSITORY, "actions": ["push"]}]
        with patch.object(v, "registry_call", return_value=(200, json.dumps({"token": scoped(grants)}).encode(), {})) as call:
            with self.assertRaises(v.ReadbackFailure):
                v.deny_write("memory-only", v.REPOSITORY)
            self.assertEqual(call.call_count, 1)
            self.assertEqual(call.call_args.args[1], "/oauth2/token")

    def test_safe_extraction_rejects_paths_links_duplicates_platform(self):
        for name, member_type in (("../oras", tarfile.REGTYPE), ("/oras", tarfile.REGTYPE),
                                  ("oras", tarfile.SYMTYPE), ("substitute", tarfile.REGTYPE)):
            with tempfile.TemporaryDirectory() as temporary:
                directory = pathlib.Path(temporary)
                archive = directory / "release.tar.gz"
                with tarfile.open(archive, "w:gz") as tar:
                    info = tarfile.TarInfo(name)
                    info.type = member_type
                    info.size = 3 if member_type == tarfile.REGTYPE else 0
                    tar.addfile(info, io.BytesIO(b"bad") if info.size else None)
                with self.assertRaises(v.ReadbackFailure):
                    v.extract_oras(archive, directory)
                self.assertFalse((directory / "oras").exists())

    def test_safe_extraction_only_executable_and_linux_amd64(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = pathlib.Path(temporary)
            elf = b"\x7fELF\x02\x01" + b"\0" * 12 + struct.pack("<H", 62) + b"fixture"
            archive = directory / "release.tar.gz"
            with tarfile.open(archive, "w:gz") as tar:
                for name, content in (("oras", elf), ("LICENSE", b"fixture")):
                    info = tarfile.TarInfo(name)
                    info.size = len(content)
                    tar.addfile(info, io.BytesIO(content))
            executable = v.extract_oras(archive, directory)
            self.assertEqual(executable.read_bytes(), elf)
            self.assertFalse((directory / "LICENSE").exists())

    def test_archive_hash_gate_prevents_extraction(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = pathlib.Path(temporary)
            result = {}
            response = Mock()
            response.status = 200
            response.read.side_effect = [b"wrong", b""]
            response.__enter__ = Mock(return_value=response)
            response.__exit__ = Mock(return_value=False)
            with patch.object(v, "read_manifest", return_value=(b"wrong", {"digest": "sha256:" + v.ARCHIVE_SHA})), patch.object(v, "EXPECTED_MANIFEST", "sha256:" + v.hashlib.sha256(b"wrong").hexdigest()), patch.object(v, "registry_call", return_value=(307, b"", {"location": "https://" + v.DATA_HOST + "?x=fixture"})), patch.object(v, "download_response", return_value=response):
                with self.assertRaises(v.ReadbackFailure) as caught:
                    v.retrieve_archive("memory-only", directory / "oras.tar.gz", result)
            self.assertEqual(caught.exception.stage, "ORAS_ARCHIVE_SHA_MISMATCH")
            self.assertNotIn("orasArchiveSha256", result)

    def test_local_oras_uses_only_oci_layout_fixed_annotations(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = pathlib.Path(temporary)
            commands = []
            def command(arguments, cwd):
                commands.append(arguments)
                if arguments[1] == "version":
                    return b"Version:    1.3.4\n"
                (cwd / "manifest.json").write_bytes(manifest_bytes())
                blobs = cwd / "layout" / "blobs" / "sha256"
                blobs.mkdir(parents=True)
                for body in (v.PAYLOAD_BYTES, b"{}"):
                    (blobs / v.hashlib.sha256(body).hexdigest()).write_bytes(body)
                return b""
            result = {}
            with patch.object(v, "local_command", side_effect=command):
                body = v.create_local_artifact(directory / "oras", directory, result)
            self.assertEqual(body, manifest_bytes())
            self.assertIn("--oci-layout", commands[1])
            self.assertIn("org.opencontainers.image.created=" + v.FIXED_CREATED, commands[1])
            self.assertNotIn(v.REGISTRY, " ".join(commands[1]))
            self.assertEqual(result["orasVersion"], "1.3.4")

    def test_local_command_environment_has_no_proxy_or_credentials(self):
        with patch.object(v.subprocess, "run", return_value=Mock(returncode=0, stdout=b"")) as run:
            v.local_command(["oras", "version"], pathlib.Path("/tmp/fixed-fixture"))
        self.assertEqual(set(run.call_args.kwargs["env"]), {"PATH", "HOME", "TMPDIR", "LANG", "LC_ALL"})
        self.assertTrue(run.call_args.kwargs["capture_output"])

    def test_collision_and_denial_block_push(self):
        result = {}
        with patch.object(v, "registry_call", return_value=(200, b"{}", {"digest": "sha256:" + "1" * 64})) as call:
            with self.assertRaises(v.ReadbackFailure):
                v.push_artifact("memory-only", manifest_bytes(), result)
        self.assertEqual(call.call_count, 1)
        self.assertEqual(result["targetTagState"], "PRESENT")

    def test_failed_blob_start_is_not_retried(self):
        result = {}
        with patch.object(v, "registry_call", side_effect=[(404, b"", {}), (500, b"private-error", {})]) as call:
            with self.assertRaises(v.ReadbackFailure) as caught:
                v.push_blob("memory-only", v.PAYLOAD_BYTES, result)
        self.assertEqual(call.call_count, 2)
        self.assertEqual(caught.exception.stage, "BLOB_UPLOAD_START_HTTP_500")
        self.assertTrue(result["pushAttemptConsumed"])

    def test_upload_location_exact_host_and_repo_only(self):
        self.assertEqual(v.upload_path("https://" + v.REGISTRY + "/v2/synthetic-health/blobs/uploads/id?_state=fixture"),
                         "/v2/synthetic-health/blobs/uploads/id?_state=fixture")
        for location in ("https://evil.invalid/v2/synthetic-health/blobs/uploads/id",
                         "/v2/g2-tooling/blobs/uploads/id", "//evil.invalid/path",
                         "/v2/synthetic-health/blobs/uploads/id#fragment"):
            with self.assertRaises(v.ReadbackFailure):
                v.upload_path(location)

    def test_one_manifest_commit_and_exact_blobs(self):
        result = {"localManifestDigest": "sha256:" + v.hashlib.sha256(manifest_bytes()).hexdigest()}
        with patch.object(v, "absent") as absent, patch.object(v, "push_blob") as blob, patch.object(v, "registry_call", return_value=(201, b"", {"digest": result["localManifestDigest"]})) as call:
            v.push_artifact("memory-only", manifest_bytes(), result)
        self.assertEqual(absent.call_count, 2)
        self.assertEqual([c.args[1] for c in blob.call_args_list], [b"{}", v.PAYLOAD_BYTES])
        self.assertEqual(call.call_count, 1)
        self.assertEqual(call.call_args.args[1], "/v2/synthetic-health/manifests/" + v.TARGET_TAG)
        self.assertEqual(result["manifestCommitAttempts"], 1)

    def test_readback_checks_raw_manifest_and_payload(self):
        body = manifest_bytes()
        digest = "sha256:" + v.hashlib.sha256(body).hexdigest()
        result = {"remoteManifestDigest": digest}
        responses = [(200, body, {"digest": digest}), (200, body, {"digest": digest}),
                     (200, v.PAYLOAD_BYTES, {})]
        with patch.object(v, "registry_call", side_effect=responses):
            v.readback("memory-only", body, result)
        self.assertEqual(result["artifactReadback"], "PASS")
        self.assertEqual(result["remoteBlobDigest"], "sha256:" + v.SOURCE_SHA)

    def test_effective_gate_failure_never_reaches_push(self):
        with tempfile.TemporaryDirectory() as temporary:
            with patch.object(v, "managed_refresh", return_value="memory-only"), patch.object(v, "exact_scope", return_value="memory-only"), patch.object(v, "retrieve_archive"), patch.object(v, "extract_oras"), patch.object(v, "create_local_artifact"), patch.object(v, "read_manifest"), patch.object(v, "deny_write", side_effect=v.ReadbackFailure("DENIED_GATE_FAILED")), patch.object(v, "push_artifact") as push:
                with self.assertRaises(v.ReadbackFailure):
                    v.production({}, pathlib.Path(temporary))
                push.assert_not_called()

    def test_failure_cleanup_and_marker_do_not_leak_exception_text(self):
        def failed(result, directory):
            (directory / "oras.tar.gz").write_bytes(b"fixture")
            raise OSError("https://private.invalid?secret=fixture")
        with patch.object(v, "configuration_digest", return_value="1" * 64), patch.object(v, "production", side_effect=failed), patch("builtins.print") as output:
            self.assertEqual(v.production_main(), 78)
        line = output.call_args.args[0]
        result = json.loads(line[len(v.PRODUCTION_MARKER):])
        self.assertNotIn("private.invalid", line)
        self.assertFalse(result["workspacePresent"])
        self.assertLessEqual(len(line.encode()), 3900)


if __name__ == "__main__":
    unittest.main()
