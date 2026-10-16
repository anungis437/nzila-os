import importlib.util
import io
import json
import pathlib
import unittest
from unittest.mock import Mock, patch

D = pathlib.Path(__file__).parent
spec = importlib.util.spec_from_file_location("empty_path", D.parent / "private-import" / "verifier.py")
v = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v)
for path in (D.parent / "blob-readback" / "observer.py", D / "validator.py", D / "observer.py"):
    exec(compile(path.read_bytes(), str(path), "exec"), v.__dict__)


class EmptyPathTests(unittest.TestCase):
    def test_exact_uri_preserved_for_empty_root_and_absolute_paths(self):
        for path, classification in (("", "EMPTY"), ("/", "ABSOLUTE"), ("/blob", "ABSOLUTE"), ("//blob", "ABSOLUTE")):
            uri = "https://" + v.DATA_HOST + path + "?sig=placeholder%2Fvalue"
            evidence = {}
            self.assertEqual(v.validate_download_uri(uri, evidence), uri)
            self.assertEqual(evidence["REDIRECT_PATH_CLASS"], classification)
            self.assertEqual(evidence["CURRENT_REDIRECT_VALIDATION"], "PASS")
            self.assertNotIn("placeholder", json.dumps(evidence))
            self.assertNotIn("sig", json.dumps(evidence))

    def test_exact_host_scheme_default_port_and_uri_restrictions(self):
        failures = (
            ("http://" + v.DATA_HOST + "?x=placeholder", "REDIRECT_SCHEME_INVALID"),
            ("https://evil.invalid?x=placeholder", "REDIRECT_HOST_INVALID"),
            ("https://sibling.canadacentral.data.azurecr.io?x=placeholder", "REDIRECT_HOST_INVALID"),
            ("https://data.azurecr.io?x=placeholder", "REDIRECT_HOST_INVALID"),
            ("https://10.90.2.4?x=placeholder", "REDIRECT_HOST_INVALID"),
            ("https://localhost?x=placeholder", "REDIRECT_HOST_INVALID"),
            ("//" + v.DATA_HOST + "/blob", "REDIRECT_SCHEME_INVALID"),
            ("relative/blob", "REDIRECT_SCHEME_INVALID"),
            ("https://" + v.DATA_HOST + ":443?x=placeholder", "REDIRECT_PORT_INVALID"),
            ("https://" + v.DATA_HOST + ":444?x=placeholder", "REDIRECT_PORT_INVALID"),
            ("https://" + v.DATA_HOST + ":invalid?x=placeholder", "REDIRECT_PARSE_FAILED"),
            ("https://[bad", "REDIRECT_PARSE_FAILED"),
            ("https://user@" + v.DATA_HOST + "?x=placeholder", "REDIRECT_USERINFO_PRESENT"),
            ("https://@" + v.DATA_HOST + "?x=placeholder", "REDIRECT_USERINFO_PRESENT"),
            ("https://" + v.DATA_HOST + "?x=placeholder#fragment", "REDIRECT_FRAGMENT_PRESENT"),
            ("https://" + v.DATA_HOST + "/x\n", "REDIRECT_CONTROL_CHARACTER_PRESENT"),
            ("https://" + v.DATA_HOST + "/x\\y", "REDIRECT_BACKSLASH_PRESENT"),
        )
        for uri, stage in failures:
            with self.subTest(stage=stage, uri=uri):
                with self.assertRaises(v.ReadbackFailure) as caught:
                    v.validate_download_uri(uri, {})
                self.assertEqual(caught.exception.stage, stage)
                self.assertNotIn("placeholder", str(caught.exception))

    def test_http_library_constructs_root_query_on_wire_without_uri_edit(self):
        for path in ("", "/", "/blob", "//blob"):
            uri = "https://" + v.DATA_HOST + path + "?sig=placeholder%2Fvalue"
            trace = {}
            sock = Mock()
            sock.getpeername.return_value = ("10.90.2.4", 443)
            sock.makefile.return_value = io.BytesIO(b"HTTP/1.1 200 OK\r\nContent-Length: 3\r\n\r\nabc")
            context = Mock()
            context.wrap_socket.return_value = sock
            with patch.object(v.ssl, "create_default_context", return_value=context), patch.object(v.socket, "getaddrinfo", return_value=[(None, None, None, None, ("10.90.2.4", 443))]), patch.object(v.socket, "create_connection"), patch.object(v.urllib.request, "Request", wraps=v.urllib.request.Request) as request:
                with v.download_response(uri, trace) as response:
                    self.assertEqual(response.read(), b"abc")
            self.assertEqual(request.call_args.args[0], uri)
            wire = b"".join(call.args[0] for call in sock.sendall.call_args_list)
            expected_path = path if path else "/"
            self.assertTrue(wire.startswith(("GET " + expected_path + "?sig=placeholder%2Fvalue HTTP/1.1\r\n").encode()))
            self.assertIn(("Host: " + v.DATA_HOST + "\r\n").encode(), wire)
            self.assertNotIn(b"Authorization:", wire)
            self.assertEqual(context.wrap_socket.call_args.kwargs["server_hostname"], v.DATA_HOST)
            self.assertEqual(trace["TLS"], "PASS")
            self.assertEqual(trace["REMOTE_IP"], "10.90.2.4")

    def test_no_automatic_second_redirect_or_error_body_logging(self):
        sock = Mock()
        sock.getpeername.return_value = ("10.90.2.4", 443)
        sock.makefile.return_value = io.BytesIO(b"HTTP/1.1 307 Temporary Redirect\r\nLocation: https://evil.invalid?secret=x\r\nContent-Length: 0\r\n\r\n")
        context = Mock()
        context.wrap_socket.return_value = sock
        with patch.object(v.ssl, "create_default_context", return_value=context), patch.object(v.socket, "getaddrinfo", return_value=[(None, None, None, None, ("10.90.2.4", 443))]), patch.object(v.socket, "create_connection") as connect:
            with v.download_response("https://" + v.DATA_HOST + "?sig=placeholder", {}) as response:
                self.assertEqual(response.status, 307)
            self.assertEqual(connect.call_count, 1)

    def test_handler_rejects_registry_header_and_unapproved_host(self):
        for host, headers in ((v.DATA_HOST, {"Authorization": "memory-only"}), ("evil.invalid", {})):
            request = v.urllib.request.Request("https://" + host + "?sig=placeholder", headers=headers)
            with self.assertRaises(v.ReadbackFailure):
                v.PinnedDownloadHandler({}).https_open(request)

    def test_success_stream_no_durable_file(self):
        digest = v.hashlib.sha256(b"abc").hexdigest()
        registry = Mock()
        registry.getresponse.return_value.status = 307
        uri = "https://" + v.DATA_HOST + "?sig=placeholder"
        registry.getresponse.return_value.getheader.return_value = uri
        response = Mock()
        response.status = 200
        response.getheader.return_value = "3"
        response.read.side_effect = io.BytesIO(b"abc").read
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        result = {"BLOB_REGISTRY": {}, "REDIRECT": {}, "DATA_ENDPOINT": {}, "REDIRECT_COUNT": 0}
        with patch.object(v, "ObservedConnection", return_value=registry), patch.object(v, "download_response", return_value=response) as download, patch.object(v, "ARCHIVE_SHA", digest):
            v.stream_blob("memory-only", {"digest": "sha256:" + digest, "size": 3}, result)
        self.assertEqual(download.call_args.args[0], uri)
        self.assertEqual(result["TARGET_ARCHIVE_SHA256"], digest)
        self.assertEqual(result["REGISTRY_AUTH_HEADER_FORWARDED_TO_DATA_ENDPOINT"], "NO")
        self.assertEqual(result["SOURCE_TARGET_ARTIFACT_EQUIVALENCE"], "PASS")
        self.assertNotIn("placeholder", json.dumps(result))

    def test_exact_failure_stage_no_secret_exception_emission(self):
        def failed(result):
            result["ACTIVE_STAGE"] = "REDIRECT_VALIDATION_FAILED"
            raise v.ReadbackFailure("DATA_ENDPOINT_HTTP_403")

        with patch.object(v, "collect_readback", side_effect=failed), patch.object(v, "configuration_digest", return_value="unchanged"), patch("builtins.print") as output:
            self.assertEqual(v.run_readback(), 78)
        self.assertTrue(output.call_args.args[0].startswith(v.READBACK_MARKER))
        self.assertIn("DATA_ENDPOINT_HTTP_403", output.call_args.args[0])
        self.assertNotIn("BLOB_REDIRECT_INVALID", output.call_args.args[0])

    def test_library_preserves_precise_dns_and_tls_failures(self):
        for stage in ("DATA_ENDPOINT_DNS_FAILED", "DATA_ENDPOINT_TLS_FAILED"):
            with patch.object(v.ObservedConnection, "connect", side_effect=v.ReadbackFailure(stage)):
                with self.assertRaises(v.ReadbackFailure) as caught:
                    v.download_response("https://" + v.DATA_HOST + "?sig=placeholder", {})
            self.assertEqual(caught.exception.stage, stage)

    def test_body_http_size_and_hash_failures_do_not_retry(self):
        for status, length, body, stage in (
            (403, "3", b"abc", "DATA_ENDPOINT_HTTP_403"),
            (307, "3", b"abc", "DATA_ENDPOINT_HTTP_307"),
            (200, "4", b"abc", "DATA_ENDPOINT_CONTENT_LENGTH_MISMATCH"),
            (200, None, b"abcd", "DATA_ENDPOINT_BODY_SIZE_OVERFLOW"),
            (200, None, b"ab", "TARGET_ARCHIVE_SHA_MISMATCH"),
            (200, "3", b"xyz", "TARGET_ARCHIVE_SHA_MISMATCH"),
        ):
            registry = Mock()
            registry.getresponse.return_value.status = 307
            registry.getresponse.return_value.getheader.return_value = "https://" + v.DATA_HOST + "?sig=placeholder"
            response = Mock()
            response.status = status
            response.getheader.return_value = length
            response.read.side_effect = io.BytesIO(body).read
            response.__enter__ = Mock(return_value=response)
            response.__exit__ = Mock(return_value=False)
            result = {"BLOB_REGISTRY": {}, "REDIRECT": {}, "DATA_ENDPOINT": {}, "REDIRECT_COUNT": 0}
            with patch.object(v, "ObservedConnection", return_value=registry), patch.object(v, "download_response", return_value=response) as download, patch.object(v, "ARCHIVE_SHA", v.hashlib.sha256(b"abc").hexdigest()):
                with self.assertRaises(v.ReadbackFailure) as caught:
                    v.stream_blob("memory-only", {"digest": "sha256:" + v.ARCHIVE_SHA, "size": 3}, result)
            self.assertEqual(caught.exception.stage, stage)
            self.assertEqual(download.call_count, 1)
            if status != 200:
                response.read.assert_not_called()

    def test_complete_success_result_fits_sanitized_marker_contract(self):
        def complete(result):
            for key, host in (("MANIFEST", v.REGISTRY), ("DIGEST_MANIFEST", v.REGISTRY),
                              ("BLOB_REGISTRY", v.REGISTRY), ("DATA_ENDPOINT", v.DATA_HOST)):
                result[key].update({
                    "HOST": host, "HTTP_HOST": host, "TLS_SNI_HOST": host,
                    "RESOLVED_IPS": [v.PRIVATE_ENDPOINTS[host]], "PRIVATE": True,
                    "TLS": "PASS", "CERTIFICATE_HOSTNAME_VALIDATED": True,
                    "REMOTE_IP": v.PRIVATE_ENDPOINTS[host], "HTTP_STATUS": 200,
                })
            for key in ("MANIFEST", "DIGEST_MANIFEST"):
                result[key].update({
                    "CONTENT_TYPE": v.MANIFEST_TYPE, "MANIFEST_DIGEST": v.EXPECTED_MANIFEST,
                    "ARTIFACT_TYPE": v.ARTIFACT_TYPE, "BLOB_DIGEST": "sha256:" + v.ARCHIVE_SHA,
                    "BLOB_SIZE": 4679642, "BLOB_MEDIA_TYPE": "application/gzip",
                })
            result["BLOB_REGISTRY"]["HTTP_STATUS"] = 307
            v.validate_download_uri("https://" + v.DATA_HOST + "?sig=placeholder", result["REDIRECT"])
            result["DATA_ENDPOINT"].update({"CONTENT_LENGTH": 4679642, "BYTES_READ": 4679642})
            result.update({
                "status": "PASS", "ACTIVE_STAGE": "READBACK_PROVEN",
                "IDENTITY_AND_EXACT_PULL_GRANT": "PASS", "REDIRECT_COUNT": 1,
                "REGISTRY_AUTH_HEADER_FORWARDED_TO_DATA_ENDPOINT": "NO",
                "TARGET_ARCHIVE_SHA256": v.ARCHIVE_SHA, "SOURCE_TARGET_ARTIFACT_EQUIVALENCE": "PASS",
            })

        with patch.object(v, "collect_readback", side_effect=complete), patch.object(v, "configuration_digest", return_value="1" * 64), patch("builtins.print") as output:
            self.assertEqual(v.run_readback(), 0)
        marker = output.call_args.args[0]
        self.assertLessEqual(len(marker.encode()), 3900)
        self.assertNotIn("placeholder", marker)
        result = json.loads(marker[len(v.READBACK_MARKER):])
        self.assertEqual(result["SOURCE_TARGET_ARTIFACT_EQUIVALENCE"], "PASS")
        self.assertTrue(result["configurationUnchanged"])


if __name__ == "__main__":
    unittest.main()
