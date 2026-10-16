"""Stdlib private OCI reader. Tokens remain in memory; guest not qualified yet."""

from dataclasses import dataclass
import hashlib
import http.client
import ipaddress
import json
from pathlib import Path
import re
import socket
import ssl
import tarfile
import urllib.parse

MANIFEST_TYPE = "application/vnd.oci.image.manifest.v1+json"
TENANT = "5082b8be-b04d-4a13-b61c-b6397670177b"
PRIVATE_SUBNET = ipaddress.ip_network("10.91.3.0/24")
CONTRACTS = {
    "g3-build-source": ("application/vnd.nzila.g3.build-source.v1", "application/vnd.nzila.g3.source.tar.v1"),
    "g3-build-tooling": ("application/vnd.nzila.g3.build-tooling.v1",
                        "application/vnd.nzila.g3.compiler.dockerarchive.tar.v1"),
}


class ReaderFailure(RuntimeError):
    pass


def require(value, code):
    if not value:
        raise ReaderFailure(code)


@dataclass(frozen=True)
class Binding:
    registry: str
    data_host: str
    client_id: str
    repository: str
    manifest_digest: str
    payload_sha256: str
    payload_bytes: int

    def validate(self):
        require(re.fullmatch(r"[a-z0-9]{5,50}\.azurecr\.io", self.registry) and
                self.registry != "nzilag2tzo75uuozprbo.azurecr.io", "INPUT_REGISTRY_BINDING")
        require(self.data_host == self.registry.removesuffix(".azurecr.io") +
                ".canadacentral.data.azurecr.io", "DATA_HOST_BINDING")
        require(re.fullmatch(r"[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}", self.client_id), "CLIENT_BINDING")
        require(self.repository in CONTRACTS and
                re.fullmatch(r"sha256:[0-9a-f]{64}", self.manifest_digest) and
                re.fullmatch(r"[0-9a-f]{64}", self.payload_sha256), "IMMUTABLE_INPUT_BINDING")
        require(type(self.payload_bytes) is int and self.payload_bytes > 0, "PAYLOAD_SIZE_BINDING")


class PrivateConnection(http.client.HTTPSConnection):
    def __init__(self, host, witness):
        super().__init__(host, timeout=20, context=ssl.create_default_context())
        self.witness = witness

    def connect(self):
        try:
            addresses = sorted({item[4][0] for item in socket.getaddrinfo(self.host, 443, type=socket.SOCK_STREAM)})
        except OSError as error:
            raise ReaderFailure("PRIVATE_DNS_FAILURE") from error
        require(addresses and all(ipaddress.ip_address(address) in PRIVATE_SUBNET for address in addresses),
                "DNS_OUTSIDE_G3_PE_SUBNET")
        raw = socket.create_connection((addresses[0], 443), self.timeout)
        try:
            self.sock = self._context.wrap_socket(raw, server_hostname=self.host)
        except (ssl.SSLError, OSError):
            raw.close()
            raise
        require(self.sock.getpeername()[0] == addresses[0], "PRIVATE_PEER_MISMATCH")
        self.witness.update({"hostname": self.host, "resolvedPrivateIPs": addresses,
                             "connectedPrivateIP": addresses[0], "tls": "PASS"})


def bounded(response, maximum=65536):
    raw = response.read(maximum + 1)
    require(len(raw) <= maximum, "RESPONSE_SIZE_EXCEEDED")
    return raw


def safe_redirect(location, data_host):
    require(isinstance(location, str) and location and
            not any(ord(char) <= 32 for char in location) and "\\" not in location, "REDIRECT_INVALID")
    try:
        url = urllib.parse.urlsplit(location)
        port = url.port
    except ValueError as error:
        raise ReaderFailure("REDIRECT_INVALID") from error
    require(url.scheme == "https" and url.hostname == data_host and port in (None, 443) and
            not url.username and not url.password and not url.fragment and
            url.path.startswith("/") and not url.path.startswith("//"), "REDIRECT_HOST_OR_URI_INVALID")
    return url.path + ("?" + url.query if url.query else "")


def parse_manifest(raw, content_type, returned_digest, binding):
    binding.validate()
    require(content_type.split(";")[0].strip() == MANIFEST_TYPE, "MANIFEST_CONTENT_TYPE")
    require("sha256:" + hashlib.sha256(raw).hexdigest() == binding.manifest_digest and
            returned_digest == binding.manifest_digest, "MANIFEST_DIGEST_MISMATCH")
    try:
        manifest = json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ReaderFailure("MANIFEST_JSON_INVALID") from error
    artifact_type, payload_media = CONTRACTS[binding.repository]
    require(isinstance(manifest, dict) and manifest.get("schemaVersion") == 2 and
            manifest.get("mediaType") == MANIFEST_TYPE and manifest.get("artifactType") == artifact_type,
            "ARTIFACT_CONTRACT_MISMATCH")
    require(manifest.get("config") == {
        "mediaType": "application/vnd.oci.empty.v1+json", "size": 2,
        "digest": "sha256:" + hashlib.sha256(b"{}").hexdigest(),
    }, "EMPTY_CONFIG_CONTRACT")
    require(manifest.get("layers") == [{
        "mediaType": payload_media, "digest": "sha256:" + binding.payload_sha256, "size": binding.payload_bytes,
    }], "PAYLOAD_DESCRIPTOR_MISMATCH")
    require("subject" not in manifest, "UNEXPECTED_ARTIFACT_SUBJECT")
    return manifest["layers"][0]


def stream_verified(response, destination, binding):
    require(response.status == 200, "DATA_HTTP_" + str(response.status))
    length = response.getheader("Content-Length")
    if length is not None:
        require(length.isdecimal() and int(length) == binding.payload_bytes, "DATA_LENGTH_MISMATCH")
    digest, count = hashlib.sha256(), 0
    created = False
    try:
        with destination.open("xb") as output:
            created = True
            while True:
                chunk = response.read(65536)
                if not chunk:
                    break
                count += len(chunk)
                require(count <= binding.payload_bytes, "PAYLOAD_OVERFLOW")
                digest.update(chunk)
                output.write(chunk)
        require(count == binding.payload_bytes and digest.hexdigest() == binding.payload_sha256,
                "PAYLOAD_SHA_OR_SIZE_MISMATCH")
        return {"sha256": digest.hexdigest(), "bytes": count, "status": "PASS"}
    except BaseException:
        if created:
            destination.unlink()
        raise


def safe_extract_source(archive_path, destination, expected_members):
    require(not destination.exists() and isinstance(expected_members, dict) and expected_members,
            "EXTRACTION_DESTINATION_OR_MEMBER_CONTRACT")
    payloads = {}
    with tarfile.open(archive_path) as archive:
        members = archive.getmembers()
        require(len(members) == len(expected_members) and len({item.name for item in members}) == len(members),
                "ARCHIVE_MEMBER_CENSUS")
        for member in members:
            require(member.name in expected_members and member.isfile() and not member.issym() and
                    not member.islnk() and "/" not in member.name and "\\" not in member.name and
                    member.size == expected_members[member.name]["bytes"], "ARCHIVE_MEMBER_INVALID")
            raw = archive.extractfile(member).read(member.size + 1)
            require(len(raw) == member.size and hashlib.sha256(raw).hexdigest() ==
                    expected_members[member.name]["sha256"], "ARCHIVE_MEMBER_HASH")
            payloads[member.name] = raw
    destination.mkdir()
    for name, raw in payloads.items():
        with (destination / name).open("xb") as output:
            output.write(raw)
    return {"status": "PASS", "members": sorted(payloads)}


class Reader:
    def __init__(self, binding, connection_factory=PrivateConnection):
        binding.validate()
        self.binding, self.factory = binding, connection_factory
        self.witnesses = []

    def request_json(self, method, path, body=None, bearer=None):
        trace = {}
        connection = self.factory(self.binding.registry, trace)
        headers = {"Connection": "close"}
        if method == "GET":
            headers["Accept"] = MANIFEST_TYPE
        if body is not None:
            headers["Content-Type"] = "application/x-www-form-urlencoded"
        if bearer:
            headers["Authorization"] = "Bearer " + bearer
        try:
            connection.request(method, path, body=body, headers=headers)
            response = connection.getresponse()
            trace["httpStatus"] = response.status
            require(response.status == 200, "ACR_AUTH_OR_MANIFEST_HTTP_" + str(response.status))
            raw = bounded(response)
            metadata = (response.getheader("Content-Type", ""), response.getheader("Docker-Content-Digest", ""))
            self.witnesses.append(trace)
            return raw, metadata
        finally:
            connection.close()

    def scoped_token(self, aad_token):
        body = urllib.parse.urlencode({"grant_type": "access_token", "service": self.binding.registry,
                                      "tenant": TENANT, "access_token": aad_token})
        raw, _ = self.request_json("POST", "/oauth2/exchange", body)
        try:
            refresh = json.loads(raw).get("refresh_token")
        except (json.JSONDecodeError, AttributeError) as error:
            raise ReaderFailure("ACR_REFRESH_RESPONSE_INVALID") from error
        require(isinstance(refresh, str) and refresh and len(refresh) < 32768, "ACR_REFRESH_INVALID")
        body = urllib.parse.urlencode({
            "grant_type": "refresh_token", "service": self.binding.registry,
            "scope": "repository:" + self.binding.repository + ":pull", "refresh_token": refresh,
        })
        raw, _ = self.request_json("POST", "/oauth2/token", body)
        try:
            token = json.loads(raw).get("access_token")
        except (json.JSONDecodeError, AttributeError) as error:
            raise ReaderFailure("ACR_TOKEN_RESPONSE_INVALID") from error
        require(isinstance(token, str) and token and len(token) < 32768, "ACR_SCOPED_TOKEN_INVALID")
        return token

    def retrieve(self, aad_token, destination):
        token = self.scoped_token(aad_token)
        raw, metadata = self.request_json("GET", "/v2/" + self.binding.repository +
                                         "/manifests/" + self.binding.manifest_digest, bearer=token)
        parse_manifest(raw, *metadata, self.binding)
        trace = {}
        connection = self.factory(self.binding.registry, trace)
        try:
            connection.request("GET", "/v2/" + self.binding.repository + "/blobs/sha256:" +
                               self.binding.payload_sha256, headers={"Authorization": "Bearer " + token})
            response = connection.getresponse()
            trace["httpStatus"] = response.status
            require(response.status == 307, "BLOB_INITIAL_EXPECT_307")
            path = safe_redirect(response.getheader("Location"), self.binding.data_host)
            self.witnesses.append(trace)
        finally:
            connection.close()
        trace = {}
        connection = self.factory(self.binding.data_host, trace)
        try:
            connection.request("GET", path, headers={"Connection": "close"})
            response = connection.getresponse()
            trace["httpStatus"] = response.status
            result = stream_verified(response, destination, self.binding)
            self.witnesses.append(trace)
            return {**result, "manifestDigest": self.binding.manifest_digest, "privatePath": self.witnesses}
        finally:
            connection.close()


def acquire_imds(client_id, connection_factory=http.client.HTTPConnection):
    require(re.fullmatch(r"[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}", client_id), "IMDS_CLIENT_ID_INVALID")
    connection = connection_factory("169.254.169.254", timeout=10)
    try:
        query = urllib.parse.urlencode({"api-version": "2018-02-01",
                                       "resource": "https://containerregistry.azure.net", "client_id": client_id})
        connection.request("GET", "/metadata/identity/oauth2/token?" + query, headers={"Metadata": "true"})
        response = connection.getresponse()
        require(response.status == 200, "IMDS_HTTP_" + str(response.status))
        try:
            value = json.loads(bounded(response))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise ReaderFailure("IMDS_JSON_INVALID") from error
        require(isinstance(value, dict) and value.get("client_id") == client_id and
                isinstance(value.get("access_token"), str) and value["access_token"] and
                len(value["access_token"]) < 32768, "IMDS_SELECTED_IDENTITY_INVALID")
        return value["access_token"]
    finally:
        connection.close()
