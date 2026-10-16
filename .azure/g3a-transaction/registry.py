"""Private transport, exact OCI upload and probes; no retries or CLI dependencies."""

from dataclasses import dataclass
import hashlib
import http.client
import ipaddress
import json
from pathlib import Path
import re
import socket
import ssl
import urllib.parse

from sealed_reader import Reader, ReaderFailure, TENANT, bounded, acquire_imds, require

MANIFEST = "sha256:82b24793125bceae37828bb3c1adea26882a33cff5ca557fa49d370853db93b7"
INDEX = "sha256:a9b061637c76b7680ac5d1f682e0ab8abe507474ccc835eefcb5dee18a1f7a12"
MEDIA = "application/vnd.oci.image.manifest.v1+json"
TARGET = "g3-synthetic-runtime"


def digest(raw):
    return "sha256:" + hashlib.sha256(raw).hexdigest()


def private_factory(network):
    subnet = ipaddress.ip_network(network)
    require(subnet.is_private and subnet.prefixlen >= 24, "PRIVATE_PE_NETWORK_BINDING")

    class Connection(http.client.HTTPSConnection):
        def __init__(self, host, witness):
            super().__init__(host, timeout=20, context=ssl.create_default_context())
            self.witness = witness

        def connect(self):
            try:
                addresses = sorted({value[4][0] for value in socket.getaddrinfo(self.host, 443, type=socket.SOCK_STREAM)})
            except OSError as error:
                raise ReaderFailure("PRIVATE_DNS_FAILURE") from error
            require(addresses and all(ipaddress.ip_address(value) in subnet for value in addresses),
                    "DNS_OUTSIDE_BOUND_PE_SUBNET")
            raw = socket.create_connection((addresses[0], 443), self.timeout)
            try:
                self.sock = self._context.wrap_socket(raw, server_hostname=self.host)
            except (ssl.SSLError, OSError):
                raw.close()
                raise
            require(self.sock.getpeername()[0] == addresses[0], "PRIVATE_PEER_MISMATCH")
            self.witness.update({"hostname": self.host, "connectedPrivateIP": addresses[0],
                                 "resolvedPrivateIPs": addresses, "tls": "PASS"})

    return Connection


def redirect_path(location, host):
    require(isinstance(location, str) and location and "\\" not in location and
            not any(ord(char) <= 32 for char in location), "REDIRECT_INVALID")
    try:
        url = urllib.parse.urlsplit(location)
        port = url.port
    except ValueError as error:
        raise ReaderFailure("REDIRECT_INVALID") from error
    require(url.scheme == "https" and url.hostname == host and port in (None, 443) and
            not url.username and not url.password and not url.fragment and
            (not url.path or url.path.startswith("/") and not url.path.startswith("//")),
            "REDIRECT_HOST_OR_URI_INVALID")
    # HTTP origin-form requires "/" for an empty path; signed query bytes stay untouched.
    return (url.path or "/") + ("?" + url.query if url.query else "")


@dataclass(frozen=True)
class InputBinding:
    registry: str
    data_host: str
    client_id: str
    repository: str
    manifest_digest: str
    payload_sha256: str
    payload_bytes: int
    artifact_type: str
    payload_media: str

    def validate(self):
        validate_host(self.registry)
        require(self.registry != "nzilag2tzo75uuozprbo.azurecr.io", "G2_NOT_INPUT_REGISTRY")
        require(self.data_host == self.registry.removesuffix(".azurecr.io") +
                ".canadacentral.data.azurecr.io", "DATA_HOST_BINDING")
        require(re.fullmatch(r"[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}", self.client_id), "CLIENT_ID")
        allowed = {
            "g3-build-source": {("application/vnd.nzila.g3.build-source.v1", "application/vnd.nzila.g3.source.tar.v1")},
            "g3-build-tooling": {
                ("application/vnd.nzila.g3.build-tooling.v1", "application/vnd.nzila.g3.compiler.dockerarchive.tar.v1"),
                ("application/vnd.nzila.g3.portable-inputs.v1", "application/vnd.nzila.g3.portable-inputs.tar.v1"),
                ("application/vnd.nzila.g3.compressor.go1256.v1", "application/vnd.nzila.g3.compressor.linux-amd64.elf.v1"),
            },
        }
        require(self.repository in allowed and (self.artifact_type, self.payload_media) in allowed[self.repository],
                "INPUT_ARTIFACT_ALLOWLIST")
        require(re.fullmatch(r"sha256:[0-9a-f]{64}", self.manifest_digest) and
                re.fullmatch(r"[0-9a-f]{64}", self.payload_sha256) and
                type(self.payload_bytes) is int and self.payload_bytes > 0, "INPUT_IMMUTABILITY")


def validate_host(host):
    require(isinstance(host, str) and re.fullmatch(r"[a-z0-9]{5,50}\.azurecr\.io", host), "REGISTRY_HOST")


class InputReader(Reader):
    def retrieve(self, aad_token, destination):
        from sealed_reader import stream_verified
        token = self.scoped_token(aad_token)
        raw, metadata = self.request_json("GET", "/v2/" + self.binding.repository +
                                         "/manifests/" + self.binding.manifest_digest, bearer=token)
        require(metadata[0].split(";")[0].strip() == MEDIA and metadata[1] == self.binding.manifest_digest and
                digest(raw) == self.binding.manifest_digest, "INPUT_MANIFEST_SHA_MEDIA")
        try:
            manifest = json.loads(raw)
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise ReaderFailure("INPUT_MANIFEST_JSON") from error
        require(isinstance(manifest, dict) and manifest.get("schemaVersion") == 2 and
                manifest.get("mediaType") == MEDIA and manifest.get("artifactType") == self.binding.artifact_type and
                manifest.get("config") == {"mediaType": "application/vnd.oci.empty.v1+json",
                                          "size": 2, "digest": digest(b"{}")} and
                manifest.get("layers") == [{"mediaType": self.binding.payload_media,
                                           "size": self.binding.payload_bytes,
                                           "digest": "sha256:" + self.binding.payload_sha256}] and
                "subject" not in manifest, "INPUT_ARTIFACT_DESCRIPTOR")
        trace = {}
        connection = self.factory(self.binding.registry, trace)
        try:
            connection.request("GET", "/v2/" + self.binding.repository + "/blobs/sha256:" +
                               self.binding.payload_sha256, headers={"Authorization": "Bearer " + token})
            response = connection.getresponse()
            require(response.status == 307, "INPUT_REDIRECT_EXPECT_307")
            path = redirect_path(response.getheader("Location"), self.binding.data_host)
            trace["httpStatus"] = response.status
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


class RegistrySession:
    def __init__(self, registry, repository, factory):
        validate_host(registry)
        require(re.fullmatch(r"[a-z0-9][a-z0-9-]{0,100}", repository), "REPOSITORY_NAME")
        self.registry, self.repository, self.factory = registry, repository, factory
        self.events = []
        self.token = None
        self.authenticated = False

    def request(self, method, path, body=None, headers=None, authenticated=True, maximum=65536):
        witness = {}
        connection = self.factory(self.registry, witness)
        outbound = {"Connection": "close", **(headers or {})}
        if authenticated:
            require(self.token is not None, "SCOPED_TOKEN_REQUIRED")
            outbound["Authorization"] = "Bearer " + self.token
        try:
            connection.request(method, path, body=body, headers=outbound)
            response = connection.getresponse()
            raw = bounded(response, maximum)
            fields = {name: response.getheader(name, "") for name in
                      ("Location", "Docker-Content-Digest", "Content-Length", "Content-Type", "WWW-Authenticate")}
            self.events.append({"method": method, "operation": path.split("?")[0],
                                "httpStatus": response.status, "privatePath": witness,
                                "authenticatedRequest": authenticated})
            return response.status, raw, fields
        finally:
            connection.close()

    def authenticate(self, aad_token, actions):
        require(actions in ("pull", "pull,push"), "EXACT_TOKEN_SCOPE")
        form = urllib.parse.urlencode({"grant_type": "access_token", "service": self.registry,
                                      "tenant": TENANT, "access_token": aad_token})
        status, raw, _ = self.request("POST", "/oauth2/exchange", form,
                                    {"Content-Type": "application/x-www-form-urlencoded"}, False)
        require(status == 200, "ACR_EXCHANGE_HTTP_" + str(status))
        refresh = token_field(raw, "refresh_token")
        form = urllib.parse.urlencode({"grant_type": "refresh_token", "service": self.registry,
                                      "scope": "repository:" + self.repository + ":" + actions,
                                      "refresh_token": refresh})
        status, raw, _ = self.request("POST", "/oauth2/token", form,
                                    {"Content-Type": "application/x-www-form-urlencoded"}, False)
        require(status == 200, "ACR_TOKEN_HTTP_" + str(status))
        self.token = token_field(raw, "access_token")
        self.authenticated = True

    def erase(self):
        self.token = None
        self.authenticated = False


def token_field(raw, field):
    try:
        value = json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ReaderFailure("AUTH_RESPONSE_JSON_INVALID") from error
    require(isinstance(value, dict) and isinstance(value.get(field), str) and
            0 < len(value[field]) < 32768 and
            not any(ord(char) < 32 or ord(char) == 127 for char in value[field]), "AUTH_TOKEN_INVALID")
    return value[field]


def validate_layout(layout):
    require(layout.is_dir() and not layout.is_symlink(), "OCI_LAYOUT_ROOT")
    require((layout / "oci-layout").read_bytes() == b'{"imageLayoutVersion":"1.0.0"}' and
            digest((layout / "index.json").read_bytes()) == INDEX, "OCI_LAYOUT_INDEX")
    manifest_path = layout / "blobs" / "sha256" / MANIFEST.split(":")[1]
    raw = manifest_path.read_bytes()
    require(digest(raw) == MANIFEST, "QUALIFIED_MANIFEST_EXACT")
    manifest = json.loads(raw)
    require(manifest["schemaVersion"] == 2 and manifest["mediaType"] == MEDIA and
            len(manifest["layers"]) == 2, "MANIFEST_STRUCTURE")
    descriptors = [manifest["config"], *manifest["layers"]]
    expected = {"index.json", "oci-layout", "blobs/sha256/" + MANIFEST.split(":")[1]}
    payloads = []
    for descriptor in descriptors:
        require(re.fullmatch(r"sha256:[0-9a-f]{64}", descriptor["digest"]) and
                type(descriptor["size"]) is int and descriptor["size"] > 0, "BLOB_DESCRIPTOR")
        path = layout / "blobs" / "sha256" / descriptor["digest"].split(":")[1]
        data = path.read_bytes()
        require(len(data) == descriptor["size"] and digest(data) == descriptor["digest"], "LOCAL_BLOB_INTEGRITY")
        expected.add("blobs/sha256/" + descriptor["digest"].split(":")[1])
        payloads.append((descriptor, data))
    require(not any(path.is_symlink() for path in layout.rglob("*")) and
            {str(path.relative_to(layout)).replace("\\", "/") for path in layout.rglob("*") if path.is_file()} ==
            expected and len(expected) == 6, "OCI_LAYOUT_EXACT_CENSUS")
    return raw, payloads


def upload_location(location, registry, repository):
    require(isinstance(location, str) and location and "\\" not in location and
            not any(ord(char) <= 32 for char in location), "UPLOAD_LOCATION_INVALID")
    try:
        url = urllib.parse.urlsplit(location)
        port = url.port
    except ValueError as error:
        raise ReaderFailure("UPLOAD_LOCATION_INVALID") from error
    require((not url.netloc and not url.scheme or url.scheme == "https" and url.hostname == registry and
             port in (None, 443)) and not url.username and not url.password and not url.fragment and
            url.path.startswith("/v2/" + repository + "/blobs/uploads/") and
            not any(part in (".", "..") for part in url.path.split("/")), "UPLOAD_LOCATION_SCOPE")
    return url.path + ("?" + url.query if url.query else "")


class Uploader:
    def __init__(self, session, approved_tag):
        require(session.repository == TARGET and re.fullmatch(r"g3-proof-[0-9a-f]{12,64}", approved_tag),
                "TARGET_IMMUTABLE_TAG_CONTRACT")
        self.session, self.tag = session, approved_tag
        self.started = False
        self.manifest_attempts = 0
        self.commit_attempts = {}

    def push(self, layout, aad_token):
        require(not self.started, "UPLOADER_SINGLE_USE")
        self.started = True
        raw, payloads = validate_layout(layout)
        s = self.session
        try:
            s.authenticate(aad_token, "pull,push")
            base = "/v2/" + TARGET
            for reference in (self.tag, MANIFEST):
                status, _, headers = s.request("HEAD", base + "/manifests/" + reference, headers={"Accept": MEDIA})
                if status == 200:
                    raise ReaderFailure("PREEXISTING_GOVERNANCE_STOP" if headers["Docker-Content-Digest"] == MANIFEST
                                        else "MANIFEST_COLLISION_STOP")
                require(status == 404, "COLLISION_CHECK_HTTP_" + str(status))
            for descriptor, data in payloads:
                blob = descriptor["digest"]
                status, _, fields = s.request("HEAD", base + "/blobs/" + blob)
                if status == 200:
                    require(fields["Docker-Content-Digest"] == blob and
                            fields["Content-Length"] == str(len(data)), "EXISTING_BLOB_DESCRIPTOR")
                    continue
                require(status == 404, "BLOB_EXISTENCE_HTTP_" + str(status))
                status, _, fields = s.request("POST", base + "/blobs/uploads/", b"",
                                             {"Content-Length": "0"})
                require(status == 202, "BLOB_INIT_HTTP_" + str(status))
                location = upload_location(fields["Location"], s.registry, TARGET)
                require("digest" not in urllib.parse.parse_qs(urllib.parse.urlsplit(location).query),
                        "UPLOAD_LOCATION_ALREADY_HAS_DIGEST")
                require(digest(data) == blob, "PRE_COMMIT_LOCAL_DIGEST")
                location += ("&" if "?" in location else "?") + urllib.parse.urlencode({"digest": blob})
                self.commit_attempts[blob] = 1
                status, _, fields = s.request("PUT", location, data,
                                             {"Content-Type": "application/octet-stream", "Content-Length": str(len(data))})
                require(status == 201 and fields["Docker-Content-Digest"] == blob, "BLOB_COMMIT_AMBIGUOUS_STOP")
                status, _, fields = s.request("HEAD", base + "/blobs/" + blob)
                require(status == 200 and fields["Docker-Content-Digest"] == blob and
                        fields["Content-Length"] == str(len(data)), "BLOB_READBACK_DESCRIPTOR")
            self.manifest_attempts = 1
            status, _, fields = s.request("PUT", base + "/manifests/" + self.tag, raw,
                                         {"Content-Type": MEDIA, "Content-Length": str(len(raw))})
            require(status == 201 and fields["Docker-Content-Digest"] == MANIFEST, "MANIFEST_PUT_AMBIGUOUS_STOP")
            status, returned, fields = s.request("GET", base + "/manifests/" + MANIFEST,
                                                headers={"Accept": MEDIA})
            require(status == 200 and returned == raw and fields["Docker-Content-Digest"] == MANIFEST and
                    fields["Content-Type"].split(";")[0].strip() == MEDIA, "MANIFEST_READBACK_EXACT")
            return {"manifestDigest": MANIFEST, "manifestPutBytes": len(raw), "manifestAttempts": 1,
                    "blobCommitAttempts": self.commit_attempts.copy(), "events": s.events.copy(),
                    "authorityTerminated": True}
        finally:
            s.erase()


def classify_probe(identity, registry, repository, operation, status, authenticated,
                   network, auth_error="", token_exchange=False):
    require(operation in ("READ", "WRITE") and bool(identity), "PROBE_BINDING")
    if network != "PRIVATE_DNS_TLS_PASS":
        classification = "NETWORK_FAILURE_NOT_AUTHORIZATION"
    elif status in (401, 403) and authenticated and token_exchange and auth_error in ("DENIED", "insufficient_scope"):
        classification = "AUTHENTICATED_DENIAL"
    elif 200 <= status < 300 and authenticated and token_exchange:
        classification = "ALLOWED"
    else:
        classification = "INCONCLUSIVE_NOT_AUTHORIZATION"
    return {"callerIdentity": identity, "registry": registry, "repository": repository,
            "operation": operation, "httpStatus": status, "authResult": auth_error,
            "authenticatedRequest": authenticated, "successfulTokenExchange": token_exchange,
            "networkStatus": network, "classification": classification}


def probe(session, identity, operation, aad_token, reference):
    require(re.fullmatch(r"sha256:[0-9a-f]{64}", reference), "PROBE_REFERENCE")
    try:
        session.authenticate(aad_token, "pull" if operation == "READ" else "pull,push")
        base = "/v2/" + session.repository
        if operation == "READ":
            status, raw, fields = session.request("GET", base + "/manifests/" + reference, headers={"Accept": MEDIA})
        else:
            status, raw, fields = session.request("POST", base + "/blobs/uploads/", b"", {"Content-Length": "0"})
        error = ""
        if status in (401, 403):
            try:
                errors = json.loads(raw).get("errors", [])
            except (UnicodeDecodeError, json.JSONDecodeError, AttributeError):
                errors = []
            if any(isinstance(item, dict) and item.get("code") == "DENIED" for item in errors):
                error = "DENIED"
        private = bool(session.events) and all(event["privatePath"].get("tls") == "PASS" and
                       event["privatePath"].get("connectedPrivateIP") for event in session.events)
        result = classify_probe(identity, session.registry, session.repository, operation, status,
                                session.authenticated, "PRIVATE_DNS_TLS_PASS" if private else "UNPROVEN",
                                error, session.authenticated)
        if operation == "WRITE" and status == 202:
            location = upload_location(fields["Location"], session.registry, session.repository)
            cancel, _, _ = session.request("DELETE", location)
            require(cancel == 204, "PROBE_OWNED_UPLOAD_CANCEL_FAILED_NO_RETRY")
            result["ownedEmptyUploadCancellation"] = "PASS_ONE_ATTEMPT"
        return result
    finally:
        session.erase()
