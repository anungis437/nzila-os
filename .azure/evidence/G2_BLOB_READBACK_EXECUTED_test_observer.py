import ast
import hashlib
import importlib.util
import io
import json
import pathlib
import ssl
import unittest
from unittest.mock import Mock, patch

D = pathlib.Path(__file__).parent
spec = importlib.util.spec_from_file_location("readback", D.parent / "private-import" / "verifier.py")
v = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v)
exec(compile((D / "observer.py").read_bytes(), str(D / "observer.py"), "exec"), v.__dict__)


def response(status, headers=None, body=b""):
    result = Mock()
    result.status = status
    result.getheader.side_effect = lambda name, default=None: (headers or {}).get(name, default)
    result.read.side_effect = io.BytesIO(body).read
    return result


def result():
    return {"BLOB_REGISTRY": {}, "REDIRECT": {}, "DATA_ENDPOINT": {}, "REDIRECT_COUNT": 0}


class ObserverTests(unittest.TestCase):
    def blob(self, initial, final, payload=None, state=None):
        state = state if state is not None else result()
        registry, data = Mock(), Mock()
        registry.getresponse.return_value = initial
        data.getresponse.return_value = final
        with patch.object(v, "ObservedConnection", side_effect=[registry, data]):
            v.stream_blob("memory-only", payload or {"digest": "sha256:" + v.ARCHIVE_SHA, "size": 3}, state)
        return state, registry, data

    def test_redirect_and_stream_success_no_header_forwarding(self):
        body = b"abc"
        digest = hashlib.sha256(body).hexdigest()
        with patch.object(v, "ARCHIVE_SHA", digest):
            state, registry, data = self.blob(response(307, {"Location": "https://" + v.DATA_HOST + "/opaque?sig=never-persist"}),
                                            response(200, {"Content-Length": "3"}, body), {"digest": "sha256:" + digest, "size": 3})
        self.assertEqual(state["TARGET_ARCHIVE_SHA256"], digest)
        self.assertEqual(state["SOURCE_TARGET_ARTIFACT_EQUIVALENCE"], "PASS")
        self.assertEqual(data.request.call_args.args, ("GET", "/opaque?sig=never-persist"))
        self.assertEqual(data.request.call_args.kwargs["headers"], {})
        self.assertIn("Authorization", registry.request.call_args.kwargs["headers"])
        self.assertNotIn("sig", json.dumps(state))
        registry.close.assert_called_once()
        data.close.assert_called_once()

    def test_initial_non_307_stops_without_second_request(self):
        for status in (200, 206, 302, 401, 403, 404, 500):
            registry = Mock()
            registry.getresponse.return_value = response(status)
            state = result()
            with patch.object(v, "ObservedConnection", return_value=registry) as constructor:
                with self.assertRaisesRegex(v.ReadbackFailure, "BLOB_REGISTRY_HTTP_" + str(status)):
                    v.stream_blob("memory-only", {"digest": "sha256:" + v.ARCHIVE_SHA, "size": 3}, state)
            self.assertEqual(state["BLOB_REGISTRY"]["HTTP_STATUS"], status)
            self.assertEqual(constructor.call_count, 1)
            registry.close.assert_called_once()

    def test_redirect_missing(self):
        with self.assertRaisesRegex(v.ReadbackFailure, "BLOB_REDIRECT_MISSING"):
            v.approved_redirect("", {})

    def test_redirect_unapproved_never_followed_or_logged(self):
        for url in ("https://evil.invalid/path?sig=hidden", "http://" + v.DATA_HOST + "/x",
                    "https://" + v.DATA_HOST + ":444/x", "https://user:password@" + v.DATA_HOST + "/x",
                    "https://" + v.DATA_HOST + "/x#fragment", "https://" + v.DATA_HOST + "/x\nignored",
                    "https://" + v.DATA_HOST + ":invalid/x"):
            registry = Mock()
            registry.getresponse.return_value = response(307, {"Location": url})
            state = result()
            with patch.object(v, "ObservedConnection", return_value=registry) as constructor:
                with self.assertRaises(v.ReadbackFailure):
                    v.stream_blob("memory-only", {"digest": "sha256:" + v.ARCHIVE_SHA, "size": 3}, state)
            self.assertEqual(constructor.call_count, 1)
            for forbidden in ("hidden", "password", "fragment", "invalid/x"):
                self.assertNotIn(forbidden, json.dumps(state))

    def test_second_hop_exact_http_classifications(self):
        for status in (307, 401, 403, 404, 500, 503):
            stage = "5XX" if status >= 500 else str(status)
            with self.assertRaisesRegex(v.ReadbackFailure, "DATA_ENDPOINT_HTTP_" + stage):
                self.blob(response(307, {"Location": "https://" + v.DATA_HOST + "/x"}), response(status))

    def test_content_length_size_and_hash_failures(self):
        for final, stage in ((response(200, {"Content-Length": "4"}, b"abc"), "CONTENT_LENGTH_MISMATCH"),
                             (response(200, {}, b"abcd"), "BODY_SIZE_OVERFLOW"),
                             (response(200, {}, b"ab"), "ARCHIVE_HASH_MISMATCH"),
                             (response(200, {}, b"abc"), "ARCHIVE_HASH_MISMATCH")):
            with self.assertRaisesRegex(v.ReadbackFailure, "DATA_ENDPOINT_" + stage):
                self.blob(response(307, {"Location": "https://" + v.DATA_HOST + "/x"}), final)

    def test_body_read_failure_preserves_stage_bytes_and_closes(self):
        final = response(200, {}, b"")
        final.read.side_effect = [b"a", v.http.client.IncompleteRead(b"private-body")]
        state = result()
        with self.assertRaises(v.http.client.IncompleteRead):
            self.blob(response(307, {"Location": "https://" + v.DATA_HOST + "/x"}), final, state=state)
        self.assertEqual(state["ACTIVE_STAGE"], "DATA_ENDPOINT_BODY_READ_FAILED")
        self.assertEqual(state["DATA_ENDPOINT"]["BYTES_READ"], 1)
        self.assertNotIn("private-body", json.dumps(state))

    def test_each_host_dns_and_sni_identity(self):
        for host, ip in v.PRIVATE_ENDPOINTS.items():
            trace = {}
            connection = v.ObservedConnection(host, trace, "DATA_ENDPOINT")
            context = Mock()
            context.wrap_socket.return_value.getpeername.return_value = (ip, 443)
            connection._context = context
            with patch.object(v.socket, "getaddrinfo", return_value=[(None, None, None, None, (ip, 443))]), patch.object(v.socket, "create_connection") as connect:
                connection.connect()
            self.assertEqual(connect.call_args.args[0], (ip, 443))
            self.assertEqual(context.wrap_socket.call_args.kwargs["server_hostname"], host)
            self.assertEqual(trace["TLS"], "PASS")
            self.assertTrue(trace["PRIVATE"])

    def test_wrong_data_ip_stops_before_connect(self):
        with patch.object(v.socket, "getaddrinfo", return_value=[(None, None, None, None, ("10.90.2.5", 443))]), patch.object(v.socket, "create_connection") as connect:
            with self.assertRaisesRegex(v.ReadbackFailure, "DATA_ENDPOINT_PRIVATE_IP_MISMATCH"):
                v.ObservedConnection(v.DATA_HOST, {}, "DATA_ENDPOINT").connect()
        connect.assert_not_called()

    def test_tls_failure_sanitized(self):
        trace = {}
        connection = v.ObservedConnection(v.DATA_HOST, trace, "DATA_ENDPOINT")
        connection._context = Mock()
        connection._context.wrap_socket.side_effect = ssl.SSLCertVerificationError("secret-query")
        with patch.object(v.socket, "getaddrinfo", return_value=[(None, None, None, None, ("10.90.2.4", 443))]), patch.object(v.socket, "create_connection") as raw:
            with self.assertRaisesRegex(v.ReadbackFailure, "DATA_ENDPOINT_TLS_FAILED"):
                connection.connect()
        self.assertEqual(trace["TLS_ERROR_CATEGORY"], "CERTIFICATE_VALIDATION")
        self.assertNotIn("secret-query", json.dumps(trace))
        raw.return_value.close.assert_called_once()

    def test_manifest_exact_source_authority(self):
        authority = json.loads((D.parents[4] / ".azure" / "evidence" / "G2_PRIVATE_IMPORT_SOURCE_ARTIFACT_AUTHORITY.json").read_text())
        body = v.base64.b64decode(authority["manifestBase64"])
        connection = Mock()
        connection.getresponse.return_value = response(200, {"Content-Type": v.MANIFEST_TYPE, "Docker-Content-Digest": v.EXPECTED_MANIFEST}, body)
        with patch.object(v, "ObservedConnection", return_value=connection):
            raw, payload = v.read_manifest("memory-only", v.TAG, {})
        self.assertEqual(raw, body)
        self.assertEqual(payload["digest"], "sha256:" + v.ARCHIVE_SHA)

    def test_manifest_failure_prevents_blob(self):
        connection = Mock()
        connection.getresponse.return_value = response(403)
        with patch.object(v, "authenticate", return_value="memory-only"), patch.object(v, "ObservedConnection", return_value=connection), patch.object(v, "stream_blob") as blob:
            with self.assertRaisesRegex(v.ReadbackFailure, "MANIFEST_READ_FAILED"):
                v.collect_readback({"MANIFEST": {}})
        blob.assert_not_called()

    def test_safe_failure_emission(self):
        with patch.object(v, "configuration_digest", return_value="unchanged"), patch.object(v, "collect_readback", side_effect=v.ReadbackFailure("DATA_ENDPOINT_HTTP_403")), patch("builtins.print") as output:
            self.assertEqual(v.run_readback(), 78)
        self.assertIn('"FAILURE_STAGE":"DATA_ENDPOINT_HTTP_403"', output.call_args.args[0])
        self.assertLess(len(output.call_args.args[0].encode()), 3900)

    def test_arbitrary_exception_text_is_not_emitted(self):
        with patch.object(v, "configuration_digest", return_value="unchanged"), patch.object(v, "collect_readback", side_effect=OSError("Bearer hidden query")), patch("builtins.print") as output:
            self.assertEqual(v.run_readback(), 78)
        self.assertNotIn("hidden", output.call_args.args[0])

    def test_complete_success_shape_fits_cse_output_limit(self):
        authority = json.loads((D.parents[4] / ".azure" / "evidence" / "G2_PRIVATE_IMPORT_SOURCE_ARTIFACT_AUTHORITY.json").read_text())
        body = v.base64.b64decode(authority["manifestBase64"])
        connections = [Mock() for _ in range(4)]
        for connection in connections[:2]:
            connection.getresponse.return_value = response(200, {"Content-Type": v.MANIFEST_TYPE,
                                                                 "Docker-Content-Digest": v.EXPECTED_MANIFEST}, body)
        connections[2].getresponse.return_value = response(307, {"Location": "https://" + v.DATA_HOST + "/opaque?sig=hidden"})
        connections[3].getresponse.return_value = response(200, {"Content-Length": str(authority["archiveSize"])}, b"a" * authority["archiveSize"])

        def connection_factory(host, evidence, prefix):
            evidence.update({"HOST": host, "HTTP_HOST": host, "TLS_SNI_HOST": host, "PRIVATE": True,
                             "RESOLVED_IPS": [v.PRIVATE_ENDPOINTS[host]], "REMOTE_IP": v.PRIVATE_ENDPOINTS[host],
                             "TLS": "PASS", "CERTIFICATE_HOSTNAME_VALIDATED": True})
            return connections.pop(0)

        original = v.hashlib.sha256

        def hasher(data=b""):
            if data:
                return original(data)
            digest = Mock()
            digest.hexdigest.return_value = v.ARCHIVE_SHA
            return digest

        with patch.object(v, "authenticate", return_value="memory-only"), patch.object(v, "configuration_digest", return_value="a" * 64), patch.object(v, "ObservedConnection", side_effect=connection_factory), patch.object(v.hashlib, "sha256", side_effect=hasher), patch("builtins.print") as output:
            self.assertEqual(v.run_readback(), 0)
        marker = output.call_args.args[0]
        observed = json.loads(marker[len(v.READBACK_MARKER):])
        self.assertEqual(observed["DATA_ENDPOINT"]["HTTP_STATUS"], 200)
        self.assertEqual(observed["TARGET_ARCHIVE_SHA256"], v.ARCHIVE_SHA)
        self.assertEqual(observed["REDIRECT_COUNT"], 1)
        self.assertNotIn("hidden", marker)
        self.assertLess(len(marker.encode()), 3900)

    def test_no_durable_download_or_execution(self):
        tree = ast.parse((D / "observer.py").read_text())
        calls = [n for n in ast.walk(tree) if isinstance(n, ast.Call)]
        self.assertFalse(any(isinstance(n.func, ast.Name) and n.func.id in ("open", "exec", "eval") for n in calls))
        source = (D / "observer-extension.bicep").read_text()
        self.assertIn("loadTextContent('../private-import/verifier.py')", source)
        self.assertIn("run_readback()", source)
        for forbidden in ("fileUris", "protectedSettings", "insecure"):
            self.assertNotIn(forbidden, source)


if __name__ == "__main__":
    unittest.main()
