import hashlib
import io
import json
from pathlib import Path
import socket
import ssl
import tempfile
import unittest
from unittest.mock import patch
import urllib.parse

from registry import (
    InputBinding, InputReader, MANIFEST, MEDIA, RegistrySession, Uploader, ReaderFailure,
    classify_probe, digest, private_factory, probe, redirect_path, upload_location, validate_layout,
)

CORE = Path(__file__).resolve().parent.parent / "g3a-controller-repair"
LAYOUT = CORE / "clean-room" / "transaction" / "oci"
HOST = "nzilag2tzo75uuozprbo.azurecr.io"
INPUT = "nzilag3inputs001.azurecr.io"
DATA = "nzilag3inputs001.canadacentral.data.azurecr.io"
CLIENT = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"


class Response:
    def __init__(self, status, raw=b"", headers=None):
        self.status, self.data, self.headers = status, io.BytesIO(raw), headers or {}

    def read(self, maximum):
        return self.data.read(maximum)

    def getheader(self, name, default=None):
        return self.headers.get(name, default)


class Fixture:
    def __init__(self, handler):
        self.handler, self.calls = handler, []
        outer = self

        class Connection:
            def __init__(self, host, witness):
                self.host, self.response = host, None
                witness.update({"hostname": host, "connectedPrivateIP": "10.91.3.8", "tls": "PASS",
                                "resolvedPrivateIPs": ["10.91.3.8"]})

            def request(self, method, path, body=None, headers=None):
                call = (self.host, method, path, body, headers or {})
                outer.calls.append(call)
                self.response = outer.handler(*call)

            def getresponse(self):
                return self.response

            def close(self):
                pass

        self.factory = Connection


def auth_response(method, path, body):
    if path == "/oauth2/exchange":
        assert method == "POST"
        assert urllib.parse.parse_qs(body)["access_token"] == ["TEST_AAD_EPHEMERAL"]
        return Response(200, b'{"refresh_token":"TEST_REFRESH_EPHEMERAL"}')
    if path == "/oauth2/token":
        assert urllib.parse.parse_qs(body)["refresh_token"] == ["TEST_REFRESH_EPHEMERAL"]
        return Response(200, b'{"access_token":"TEST_SCOPED_EPHEMERAL"}')
    return None


class UploadFixture(Fixture):
    def __init__(self, collision=None, fail=None, existing=False, foreign_location=False, bad_readback=False):
        raw, payloads = validate_layout(LAYOUT)
        self.raw, self.blobs, self.committed = raw, {entry["digest"]: data for entry, data in payloads}, set()
        self.next_digest, self.manifest_body = None, None

        def handler(host, method, path, body, headers):
            auth = auth_response(method, path, body)
            if auth:
                return auth
            assert headers["Authorization"] == "Bearer TEST_SCOPED_EPHEMERAL"
            base = "/v2/g3-synthetic-runtime"
            if method == "HEAD" and "/manifests/" in path:
                if collision:
                    return Response(200, headers={"Docker-Content-Digest": MANIFEST if collision == "same" else digest(b"other")})
                return Response(404)
            if method == "HEAD" and "/blobs/" in path:
                key = path.split("/blobs/")[1]
                self.next_digest = key
                if existing or key in self.committed:
                    return Response(200, headers={"Docker-Content-Digest": key,
                                                 "Content-Length": str(len(self.blobs[key]))})
                return Response(404)
            if method == "POST" and path.endswith("/blobs/uploads/"):
                if fail == "init":
                    return Response(503, b"UNPERSISTED_RESPONSE_BODY")
                location = "https://foreign.invalid/upload" if foreign_location else base + "/blobs/uploads/one?state=a%2Bb"
                return Response(202, headers={"Location": location})
            if method == "PUT" and "/blobs/uploads/" in path:
                key = urllib.parse.parse_qs(urllib.parse.urlsplit(path).query)["digest"][0]
                assert body == self.blobs[key]
                if fail == "commit":
                    raise TimeoutError("FIXTURE_COMMIT_AMBIGUOUS")
                self.committed.add(key)
                return Response(201, headers={"Docker-Content-Digest": key})
            if method == "PUT" and "/manifests/" in path:
                assert body == self.raw
                self.manifest_body = body
                if fail == "manifest":
                    return Response(503)
                return Response(201, headers={"Docker-Content-Digest": MANIFEST})
            if method == "GET" and path == base + "/manifests/" + MANIFEST:
                return Response(200, self.raw + b" " if bad_readback else self.raw,
                                {"Docker-Content-Digest": MANIFEST, "Content-Type": MEDIA})
            raise AssertionError("UNEXPECTED_FIXTURE_REQUEST", method, path)

        super().__init__(handler)


class RegistryTests(unittest.TestCase):
    def push(self, fixture):
        session = RegistrySession(HOST, "g3-synthetic-runtime", fixture.factory)
        uploader = Uploader(session, "g3-proof-82b24793125b")
        return uploader, session

    def test_full_upload_exact_bytes_and_one_attempt(self):
        fixture = UploadFixture()
        uploader, session = self.push(fixture)
        result = uploader.push(LAYOUT, "TEST_AAD_EPHEMERAL")
        self.assertEqual(digest(fixture.manifest_body), MANIFEST)
        self.assertEqual(uploader.manifest_attempts, 1)
        self.assertEqual(len(uploader.commit_attempts), 3)
        self.assertTrue(all(value == 1 for value in uploader.commit_attempts.values()))
        self.assertEqual(len([call for call in fixture.calls if call[1] == "PUT" and "/manifests/" in call[2]]), 1)
        self.assertIsNone(session.token)
        evidence = json.dumps(result)
        for forbidden in ("TEST_AAD_EPHEMERAL", "TEST_REFRESH_EPHEMERAL", "TEST_SCOPED_EPHEMERAL", "Authorization"):
            self.assertNotIn(forbidden, evidence)
        with self.assertRaises(ReaderFailure):
            uploader.push(LAYOUT, "TEST_AAD_EPHEMERAL")

    def test_existing_blobs_skip_uploads(self):
        fixture = UploadFixture(existing=True)
        self.push(fixture)[0].push(LAYOUT, "TEST_AAD_EPHEMERAL")
        self.assertFalse(any(call[1] == "POST" and "/blobs/" in call[2] for call in fixture.calls))

    def test_same_and_different_collision_stop_before_mutation(self):
        for collision in ("same", "different"):
            fixture = UploadFixture(collision=collision)
            uploader, session = self.push(fixture)
            with self.assertRaisesRegex(ReaderFailure, "PREEXISTING|COLLISION"):
                uploader.push(LAYOUT, "TEST_AAD_EPHEMERAL")
            self.assertFalse(any(call[1] == "PUT" or "/uploads/" in call[2] for call in fixture.calls))
            self.assertIsNone(session.token)

    def test_ambiguous_mutations_never_retry(self):
        for fail in ("init", "commit", "manifest"):
            fixture = UploadFixture(fail=fail)
            uploader, session = self.push(fixture)
            with self.assertRaises((ReaderFailure, TimeoutError)):
                uploader.push(LAYOUT, "TEST_AAD_EPHEMERAL")
            commits = [(call[1], call[2]) for call in fixture.calls if call[1] == "PUT"]
            self.assertEqual(len(commits), len(set(commits)))
            starts = [call for call in fixture.calls if call[1] == "POST" and "/v2/" in call[2]]
            self.assertEqual(len(starts), 1 if fail in ("init", "commit") else 3)
            self.assertIsNone(session.token)
            with self.assertRaises(ReaderFailure):
                uploader.push(LAYOUT, "TEST_AAD_EPHEMERAL")

    def test_unexpected_upload_host_and_bad_readback_stop(self):
        for fixture in (UploadFixture(foreign_location=True), UploadFixture(bad_readback=True)):
            with self.assertRaises(ReaderFailure):
                self.push(fixture)[0].push(LAYOUT, "TEST_AAD_EPHEMERAL")

    def test_upload_location_scope_and_query_preservation(self):
        good = "/v2/g3-synthetic-runtime/blobs/uploads/x?state=a%2Bb"
        self.assertEqual(upload_location("https://" + HOST + good, HOST, "g3-synthetic-runtime"), good)
        for bad in ("//evil/x", "http://" + HOST + good, "/v2/other/blobs/uploads/x",
                    good + "#fragment", good + "\r\n", "/v2/g3-synthetic-runtime/blobs/uploads/../x"):
            with self.assertRaises(ReaderFailure):
                upload_location(bad, HOST, "g3-synthetic-runtime")

    def test_local_digest_corruption_stops_before_network(self):
        import shutil
        with tempfile.TemporaryDirectory() as folder:
            layout = Path(folder) / "oci"
            shutil.copytree(LAYOUT, layout)
            blob = next((layout / "blobs" / "sha256").iterdir())
            blob.write_bytes(blob.read_bytes() + b"foreign")
            fixture = UploadFixture()
            with self.assertRaises(ReaderFailure):
                self.push(fixture)[0].push(layout, "TEST_AAD_EPHEMERAL")
            self.assertEqual(fixture.calls, [])

    def input_fixture(self, kind="source", mutate=None, signed_empty=False, bad_host=False, bad_blob=False):
        payload = b"local-only-streamed-payload"
        artifact, media, repository = (
            ("application/vnd.nzila.g3.build-source.v1", "application/vnd.nzila.g3.source.tar.v1", "g3-build-source")
            if kind == "source" else
            ("application/vnd.nzila.g3.portable-inputs.v1", "application/vnd.nzila.g3.portable-inputs.tar.v1", "g3-build-tooling"))
        manifest = {"schemaVersion": 2, "mediaType": MEDIA, "artifactType": artifact,
                    "config": {"mediaType": "application/vnd.oci.empty.v1+json", "size": 2, "digest": digest(b"{}")},
                    "layers": [{"mediaType": media, "digest": digest(payload), "size": len(payload)}]}
        if mutate == "artifact":
            manifest["artifactType"] = "foreign"
        if mutate == "payloadmedia":
            manifest["layers"][0]["mediaType"] = "foreign"
        raw = json.dumps(manifest, separators=(",", ":")).encode()
        binding = InputBinding(INPUT, DATA, CLIENT, repository, digest(raw),
                               hashlib.sha256(payload).hexdigest(), len(payload), artifact, media)
        signed = "?sig=x%2By&sp=r" if signed_empty else "/opaque?sig=x%2By&sp=r"

        def handler(host, method, path, body, headers):
            auth = auth_response(method, path, body)
            if auth:
                return auth
            if "/manifests/" in path:
                return Response(200, raw + b" " if mutate == "digest" else raw,
                                {"Content-Type": "foreign" if mutate == "media" else MEDIA,
                                 "Docker-Content-Digest": binding.manifest_digest})
            if "/blobs/" in path:
                return Response(307, headers={"Location": "https://" + ("evil.invalid" if bad_host else DATA) + signed})
            self.assertEqual(host, DATA)
            self.assertEqual(path, "/" + signed if signed_empty else signed)
            self.assertNotIn("Authorization", headers)
            return Response(200, payload + b"x" if bad_blob else payload,
                            {"Content-Length": str(len(payload))})

        return binding, Fixture(handler), payload

    def test_reader_both_repositories_stream_and_empty_signed_path(self):
        for kind in ("source", "tools"):
            for empty in (False, True):
                binding, fixture, payload = self.input_fixture(kind, signed_empty=empty)
                with tempfile.TemporaryDirectory() as folder:
                    path = Path(folder) / "payload"
                    evidence = InputReader(binding, fixture.factory).retrieve("TEST_AAD_EPHEMERAL", path)
                    self.assertEqual(path.read_bytes(), payload)
                    self.assertNotIn("EPHEMERAL", json.dumps(evidence))
                    self.assertNotIn("sig=", json.dumps(evidence))
                    self.assertEqual(len(fixture.calls), 5)

    def test_reader_wrong_media_artifact_digest_host_or_blob(self):
        for mutate in ("artifact", "payloadmedia", "digest", "media", None):
            binding, fixture, _ = self.input_fixture(mutate=mutate, bad_host=mutate is None)
            with tempfile.TemporaryDirectory() as folder, self.assertRaises(ReaderFailure):
                InputReader(binding, fixture.factory).retrieve("TEST_AAD_EPHEMERAL", Path(folder) / "payload")
        binding, fixture, _ = self.input_fixture(bad_blob=True)
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "payload"
            with self.assertRaises(ReaderFailure):
                InputReader(binding, fixture.factory).retrieve("TEST_AAD_EPHEMERAL", path)
            self.assertFalse(path.exists())

    def test_private_dns_mixed_public_fails_before_tcp(self):
        factory = private_factory("10.91.3.0/24")
        with patch.object(socket, "getaddrinfo", return_value=[
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("8.8.8.8", 443)),
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("10.91.3.8", 443)),
        ]), patch.object(socket, "create_connection") as connect:
            with self.assertRaises(ReaderFailure):
                factory(INPUT, {}).connect()
            connect.assert_not_called()

    def test_tls_hostname_validation_and_private_peer(self):
        factory = private_factory("10.91.3.0/24")
        with patch.object(socket, "getaddrinfo", return_value=[
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("10.91.3.8", 443)),
        ]), patch.object(socket, "create_connection"), patch("registry.ssl.create_default_context") as context:
            context.return_value.wrap_socket.return_value.getpeername.return_value = ("10.91.3.8", 443)
            factory(DATA, {}).connect()
            self.assertEqual(context.return_value.wrap_socket.call_args.kwargs["server_hostname"], DATA)

    def test_tls_failure_cannot_be_authorization_and_closes_socket(self):
        factory = private_factory("10.91.3.0/24")
        connection = factory(INPUT, {})
        self.assertTrue(connection._context.check_hostname)
        self.assertEqual(connection._context.verify_mode, ssl.CERT_REQUIRED)
        with patch.object(socket, "getaddrinfo", return_value=[
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("10.91.3.8", 443)),
        ]), patch.object(socket, "create_connection") as tcp, patch.object(
            connection._context, "wrap_socket", side_effect=ssl.SSLCertVerificationError("FIXTURE_CERT_MISMATCH")
        ):
            with self.assertRaises(ssl.SSLCertVerificationError):
                connection.connect()
            tcp.return_value.close.assert_called_once()

    def test_negative_denial_classifier_refuses_network_404_or_unauthenticated(self):
        for status, auth, network, error, exchanged in (
            (404, True, "PRIVATE_DNS_TLS_PASS", "DENIED", True),
            (403, False, "PRIVATE_DNS_TLS_PASS", "DENIED", True),
            (403, True, "DNS_FAIL", "DENIED", True),
            (401, True, "PRIVATE_DNS_TLS_PASS", "", True),
            (403, True, "PRIVATE_DNS_TLS_PASS", "DENIED", False),
        ):
            result = classify_probe(CLIENT, HOST, "other", "READ", status, auth, network, error, exchanged)
            self.assertNotEqual(result["classification"], "AUTHENTICATED_DENIAL")
        for status in (401, 403):
            result = classify_probe(CLIENT, HOST, "other", "WRITE", status, True,
                                    "PRIVATE_DNS_TLS_PASS", "DENIED", True)
            self.assertEqual(result["classification"], "AUTHENTICATED_DENIAL")

    def test_executable_negative_matrix_hits_authenticated_boundary(self):
        matrix = [
            (HOST, "g3-synthetic-runtime", "READ", 200, "ALLOWED"),
            (HOST, "g3-synthetic-runtime", "WRITE", 202, "ALLOWED"),
            (HOST, "g3-negative-only", "READ", 403, "AUTHENTICATED_DENIAL"),
            (HOST, "g3-negative-only", "WRITE", 403, "AUTHENTICATED_DENIAL"),
            (INPUT, "g3-build-source", "WRITE", 403, "AUTHENTICATED_DENIAL"),
            (INPUT, "g3-build-tooling", "WRITE", 401, "AUTHENTICATED_DENIAL"),
        ]
        for host, repo, operation, status, classification in matrix:
            def handler(host, method, path, body, headers):
                auth = auth_response(method, path, body)
                if auth:
                    return auth
                self.assertEqual(headers["Authorization"], "Bearer TEST_SCOPED_EPHEMERAL")
                if method == "DELETE":
                    return Response(204)
                return Response(status, b'{"errors":[{"code":"DENIED"}]}' if status in (401, 403) else b"{}",
                                {"Location": "/v2/" + repo + "/blobs/uploads/owned"})
            fixture = Fixture(handler)
            session = RegistrySession(host, repo, fixture.factory)
            result = probe(session, CLIENT, operation, "TEST_AAD_EPHEMERAL", MANIFEST)
            self.assertEqual(result["classification"], classification)
            self.assertEqual(len(fixture.calls), 4 if operation == "WRITE" and status == 202 else 3)
            self.assertIsNone(session.token)
            self.assertNotIn("EPHEMERAL", json.dumps(result))


if __name__ == "__main__":
    unittest.main()
