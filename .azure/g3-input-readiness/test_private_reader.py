import hashlib
import io
import json
from pathlib import Path
import socket
import tarfile
import tempfile
import unittest
from unittest.mock import patch
import urllib.parse

from freeze_inputs import canonical, envelope
from private_reader import (
    Binding, PrivateConnection, Reader, ReaderFailure, acquire_imds, parse_manifest,
    safe_extract_source, safe_redirect, stream_verified,
)


class Response:
    def __init__(self, status, raw, headers=None):
        self.status, self.raw, self.headers = status, io.BytesIO(raw), headers or {}

    def read(self, maximum):
        return self.raw.read(maximum)

    def getheader(self, name, default=None):
        return self.headers.get(name, default)


class ReaderTests(unittest.TestCase):
    def fixture(self, folder):
        payload = folder / "source.tar"
        payload.write_bytes(b"synthetic-only-payload")
        manifest = envelope(payload, "application/vnd.nzila.g3.build-source.v1",
                            "application/vnd.nzila.g3.source.tar.v1")
        binding = Binding(
            "nzilag3inputs001.azurecr.io", "nzilag3inputs001.canadacentral.data.azurecr.io",
            "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "g3-build-source",
            "sha256:" + hashlib.sha256(manifest).hexdigest(),
            hashlib.sha256(payload.read_bytes()).hexdigest(), payload.stat().st_size,
        )
        return payload, manifest, binding

    def test_complete_protocol_no_token_on_redirect(self):
        with tempfile.TemporaryDirectory() as folder:
            folder = Path(folder)
            payload, manifest, binding = self.fixture(folder)
            calls = []
            responses = [
                Response(200, b'{"refresh_token":"EPHEMERAL_REFRESH"}'),
                Response(200, b'{"access_token":"EPHEMERAL_SCOPED"}'),
                Response(200, manifest, {"Content-Type": "application/vnd.oci.image.manifest.v1+json",
                                        "Docker-Content-Digest": binding.manifest_digest}),
                Response(307, b"", {"Location": "https://" + binding.data_host + "/opaque?sig=EPHEMERAL_SAS"}),
                Response(200, payload.read_bytes(), {"Content-Length": str(binding.payload_bytes)}),
            ]

            class Connection:
                def __init__(self, host, trace):
                    self.host = host
                    trace.update({"hostname": host, "resolvedPrivateIPs": ["10.91.3.8"],
                                  "connectedPrivateIP": "10.91.3.8", "tls": "PASS"})

                def request(self, method, path, body=None, headers=None):
                    calls.append((self.host, method, path, body, headers))

                def getresponse(self):
                    return responses.pop(0)

                def close(self):
                    pass

            result = Reader(binding, Connection).retrieve("EPHEMERAL_AAD", folder / "retrieved.tar")
            self.assertEqual((folder / "retrieved.tar").read_bytes(), payload.read_bytes())
            self.assertEqual(len(calls), 5)
            self.assertEqual(urllib.parse.parse_qs(calls[1][3])["scope"], ["repository:g3-build-source:pull"])
            self.assertNotIn("Authorization", calls[-1][4])
            self.assertIn(binding.manifest_digest, calls[2][2])
            body = json.dumps(result)
            self.assertNotIn("EPHEMERAL", body)
            self.assertNotIn("opaque", body)

    def test_media_digest_and_repository_fail_closed(self):
        with tempfile.TemporaryDirectory() as folder:
            _, manifest, binding = self.fixture(Path(folder))
            parse_manifest(manifest, "application/vnd.oci.image.manifest.v1+json", binding.manifest_digest, binding)
            for raw, media, digest in [
                (manifest + b" ", "application/vnd.oci.image.manifest.v1+json", binding.manifest_digest),
                (manifest, "application/json", binding.manifest_digest), (manifest, "", binding.manifest_digest),
                (manifest, "application/vnd.oci.image.manifest.v1+json", "sha256:" + "a" * 64),
            ]:
                with self.assertRaises(ReaderFailure):
                    parse_manifest(raw, media, digest, binding)
            mutated = json.loads(manifest)
            mutated["artifactType"] = "foreign"
            raw = canonical(mutated)
            other = Binding(**{**binding.__dict__, "manifest_digest": "sha256:" + hashlib.sha256(raw).hexdigest()})
            with self.assertRaises(ReaderFailure):
                parse_manifest(raw, "application/vnd.oci.image.manifest.v1+json", other.manifest_digest, other)
            for key, value in [("registry", "nzilag2tzo75uuozprbo.azurecr.io"),
                               ("repository", "g2-tooling"), ("payload_bytes", True)]:
                with self.assertRaises(ReaderFailure):
                    Binding(**{**binding.__dict__, key: value}).validate()

    def test_redirect_exact_host_no_downgrade_or_credentials(self):
        host = "nzilag3inputs001.canadacentral.data.azurecr.io"
        self.assertEqual(safe_redirect("https://" + host + "/blob?opaque=x", host), "/blob?opaque=x")
        for location in [None, "http://" + host + "/blob", "https://foreign/blob",
                         "https://u:p@" + host + "/blob", "https://" + host + ":444/blob",
                         "https://" + host + "//foreign", "https://" + host + "/blob#fragment",
                         "https://" + host + "/a\r\nheader:bad", "https://" + host + "\\evil"]:
            with self.assertRaises(ReaderFailure):
                safe_redirect(location, host)

    def test_stream_failure_deletes_only_created_file(self):
        with tempfile.TemporaryDirectory() as folder:
            folder = Path(folder)
            payload, _, binding = self.fixture(folder)
            for raw, status, length in [(b"short", 200, None), (payload.read_bytes()+b"x", 200, None),
                                        (payload.read_bytes(), 403, None), (payload.read_bytes(), 200, "wrong")]:
                target = folder / "new.tar"
                with self.assertRaises(ReaderFailure):
                    stream_verified(Response(status, raw, {"Content-Length": length}), target, binding)
                self.assertFalse(target.exists())
            with self.assertRaises(FileExistsError):
                stream_verified(Response(200, payload.read_bytes()), payload, binding)
            self.assertEqual(payload.read_bytes(), b"synthetic-only-payload")

    def test_public_dns_rejected_before_connect(self):
        with patch.object(socket, "getaddrinfo", return_value=[
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("8.8.8.8", 443)),
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("10.91.3.8", 443)),
        ]), patch.object(socket, "create_connection") as connect:
            with self.assertRaises(ReaderFailure):
                PrivateConnection("nzilag3inputs001.azurecr.io", {}).connect()
            connect.assert_not_called()

    def test_tls_uses_hostname_and_pinned_private_peer(self):
        with patch.object(socket, "getaddrinfo", return_value=[
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("10.91.3.8", 443)),
        ]), patch.object(socket, "create_connection") as connect, patch("private_reader.ssl.create_default_context") as context:
            context.return_value.wrap_socket.return_value.getpeername.return_value = ("10.91.3.8", 443)
            connection = PrivateConnection("nzilag3inputs001.azurecr.io", {})
            connection.connect()
            self.assertEqual(connect.call_args.args[0], ("10.91.3.8", 443))
            self.assertEqual(context.return_value.wrap_socket.call_args.kwargs["server_hostname"],
                             "nzilag3inputs001.azurecr.io")

    def test_imds_exact_identity_no_proxy_or_redirect(self):
        calls = []

        class Connection:
            def __init__(self, host, timeout):
                calls.append((host, timeout))

            def request(self, method, path, headers):
                calls.append((method, path, headers))

            def getresponse(self):
                return Response(200, b'{"client_id":"aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee","access_token":"EPHEMERAL"}')

            def close(self):
                pass

        self.assertEqual(acquire_imds("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", Connection), "EPHEMERAL")
        self.assertEqual(calls[0][0], "169.254.169.254")
        self.assertEqual(calls[1][2], {"Metadata": "true"})
        self.assertIn("client_id=aaaaaaaa", calls[1][1])

    def test_safe_extraction_rejects_links_traversal_duplicates(self):
        with tempfile.TemporaryDirectory() as folder:
            folder = Path(folder)
            archive = folder / "source.tar"
            raw = b"source"
            expected = {"main.go": {"bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}}
            for bad in ("../main.go", "link", "duplicate"):
                with tarfile.open(archive, "w") as output:
                    item = tarfile.TarInfo("main.go" if bad == "duplicate" else bad)
                    item.size = len(raw)
                    if bad == "link":
                        item.type, item.linkname, item.size = tarfile.SYMTYPE, "/foreign", 0
                    output.addfile(item, io.BytesIO(raw))
                    if bad == "duplicate":
                        output.addfile(item, io.BytesIO(raw))
                with self.assertRaises(ReaderFailure):
                    safe_extract_source(archive, folder / "out", expected)
                self.assertFalse((folder / "out").exists())


if __name__ == "__main__":
    unittest.main()
