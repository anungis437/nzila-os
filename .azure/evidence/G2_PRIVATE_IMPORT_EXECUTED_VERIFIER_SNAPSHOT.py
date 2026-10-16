import base64
import datetime
import hashlib
import http.client
import json
import pathlib
import re
import socket
import ssl
import tempfile
import time
import urllib.parse

REGISTRY = "nzilag2tzo75uuozprbo.azurecr.io"
DATA_HOST = "nzilag2tzo75uuozprbo.canadacentral.data.azurecr.io"
PRIVATE_IP = "10.90.2.5"
CLIENT = "d4775ade-6d53-419a-a80f-c17ffbaa125f"
PRINCIPAL = "c59571aa-66ea-47c5-83d5-59946b318ae2"
TENANT = "5082b8be-b04d-4a13-b61c-b6397670177b"
RESOURCE = "https://containerregistry.azure.net/"
REPOSITORY = "g2-tooling"
TAG = "oras-1.3.4-linux-amd64"
SCOPE = "repository:g2-tooling:pull"
ARCHIVE_SHA = "f27adb935022d94df8dc77719c322dda592c78a0d57a6f7dcdd8d900b248c454"
ARTIFACT_TYPE = "application/vnd.nzila.g2.tooling.oras.v1"
MANIFEST_TYPE = "application/vnd.oci.image.manifest.v1+json"
MARKER = "NZILA_G2_PRIVATE_IMPORT_VERIFIER_RESULT="
MAX_BLOB = 64 * 1024 * 1024


def configuration_digest():
    files = [pathlib.Path("/var/lib/dpkg/status"), pathlib.Path("/etc/resolv.conf")]
    files.extend(sorted(pathlib.Path("/etc/apt").rglob("*")))
    digest = hashlib.sha256()
    for path in files:
        if path.is_file():
            digest.update(str(path).encode() + b"\0" + path.read_bytes() + b"\0")
    return digest.hexdigest()


def claims(value):
    part = value.split(".")[1]
    return json.loads(base64.urlsafe_b64decode(part + "=" * (-len(part) % 4)))


def verify_pull_grant(value):
    grant = claims(value)
    access = grant.get("access")
    if access != [{"type": "repository", "name": REPOSITORY, "actions": ["pull"]}]:
        raise ValueError("read-grant-mismatch")
    if not isinstance(grant.get("exp"), int) or grant["exp"] <= time.time():
        raise ValueError("read-grant-expired")


class PrivateConnection(http.client.HTTPSConnection):
    def connect(self):
        if self.host not in (REGISTRY, DATA_HOST):
            raise ValueError("endpoint-not-authorized")
        addresses = sorted({v[4][0] for v in socket.getaddrinfo(self.host, 443, type=socket.SOCK_STREAM)})
        if addresses != [PRIVATE_IP]:
            raise ValueError("private-dns-mismatch")
        raw = socket.create_connection((PRIVATE_IP, 443), self.timeout)
        try:
            self.sock = self._context.wrap_socket(raw, server_hostname=self.host)
        except (OSError, ssl.SSLError):
            raw.close()
            raise
        if self.sock.getpeername()[0] != PRIVATE_IP:
            self.close()
            raise ValueError("private-peer-mismatch")


def request(method, path, data=None, headers=None, imds=False):
    if imds:
        if method != "GET" or not path.startswith("/metadata/identity/oauth2/token?"):
            raise ValueError("imds-request-not-authorized")
        connection = http.client.HTTPConnection("169.254.169.254", timeout=15)
    else:
        allowed = method == "GET" and path.startswith("/v2/g2-tooling/manifests/")
        allowed |= method == "POST" and path in ("/oauth2/exchange", "/oauth2/token")
        if not allowed:
            raise ValueError("registry-request-not-authorized")
        connection = PrivateConnection(REGISTRY, timeout=20, context=ssl.create_default_context())
    try:
        connection.request(method, path, body=data, headers=headers or {})
        response = connection.getresponse()
        body = response.read(1024 * 1024 + 1)
        if len(body) > 1024 * 1024:
            raise ValueError("response-limit")
        return response.status, body, response.getheader("Docker-Content-Digest")
    finally:
        connection.close()


def authenticate():
    query = urllib.parse.urlencode({"api-version": "2018-02-01", "resource": RESOURCE, "client_id": CLIENT})
    status, body, _ = request("GET", "/metadata/identity/oauth2/token?" + query,
                              headers={"Metadata": "true"}, imds=True)
    if status != 200:
        raise ValueError("imds-http-failure")
    access = json.loads(body)["access_token"]
    identity = claims(access)
    if (identity.get("oid") != PRINCIPAL or identity.get("tid") != TENANT
            or identity.get("appid", identity.get("azp")) != CLIENT):
        raise ValueError("identity-mismatch")
    form = urllib.parse.urlencode({"grant_type": "access_token", "service": REGISTRY,
                                   "tenant": TENANT, "access_token": access})
    status, body, _ = request("POST", "/oauth2/exchange", form,
                              {"Content-Type": "application/x-www-form-urlencoded"})
    if status != 200:
        raise ValueError("exchange-http-failure")
    refresh = json.loads(body)["refresh_token"]
    form = urllib.parse.urlencode({"grant_type": "refresh_token", "service": REGISTRY,
                                   "scope": SCOPE, "refresh_token": refresh})
    status, body, _ = request("POST", "/oauth2/token", form,
                              {"Content-Type": "application/x-www-form-urlencoded"})
    if status != 200:
        raise ValueError("scope-http-failure")
    scoped = json.loads(body).get("access_token") or json.loads(body)["token"]
    verify_pull_grant(scoped)
    return scoped


def manifest(reference, scoped):
    if reference != TAG and not re.fullmatch(r"sha256:[a-f0-9]{64}", reference):
        raise ValueError("reference-not-authorized")
    return request("GET", "/v2/" + REPOSITORY + "/manifests/" + reference,
                   headers={"Authorization": "Bearer " + scoped, "Accept": MANIFEST_TYPE})


def classify_collision(status, body):
    if status == 200:
        return "TARGET_TOOLING_TAG_PRESENT"
    if status == 404:
        errors = json.loads(body).get("errors", [])
        if errors and all(v.get("code") in ("MANIFEST_UNKNOWN", "NAME_UNKNOWN") for v in errors):
            return "TARGET_TOOLING_TAG_ABSENT"
    return "TARGET_COLLISION_CHECK_UNRESOLVED"


def check_manifest(body, header, expected):
    observed = "sha256:" + hashlib.sha256(body).hexdigest()
    if observed != expected or header != expected:
        raise ValueError("manifest-digest-mismatch")
    value = json.loads(body)
    if value.get("schemaVersion") != 2 or value.get("mediaType") != MANIFEST_TYPE:
        raise ValueError("manifest-form-mismatch")
    if value.get("artifactType") != ARTIFACT_TYPE:
        raise ValueError("artifact-type-mismatch")
    layers = value.get("layers")
    if not isinstance(layers, list) or len(layers) != 1:
        raise ValueError("payload-count-mismatch")
    payload = layers[0]
    if payload.get("mediaType") != "application/gzip" or payload.get("digest") != "sha256:" + ARCHIVE_SHA:
        raise ValueError("payload-descriptor-mismatch")
    if not isinstance(payload.get("size"), int) or not 0 < payload["size"] <= MAX_BLOB:
        raise ValueError("payload-size-invalid")
    return payload


def archive_hash(scoped, size):
    host = REGISTRY
    path = "/v2/g2-tooling/blobs/sha256:" + ARCHIVE_SHA
    headers = {"Authorization": "Bearer " + scoped}
    with tempfile.TemporaryDirectory(prefix="nzila-g2-readback-") as directory:
        file = pathlib.Path(directory) / "archive.gz"
        for attempt in range(2):
            connection = PrivateConnection(host, timeout=30, context=ssl.create_default_context())
            try:
                connection.request("GET", path, headers=headers)
                response = connection.getresponse()
                if response.status in (302, 307) and attempt == 0:
                    url = urllib.parse.urlsplit(response.getheader("Location", ""))
                    if url.scheme != "https" or url.hostname != DATA_HOST or url.port not in (None, 443):
                        raise ValueError("blob-redirect-not-authorized")
                    if url.username or url.password or url.fragment:
                        raise ValueError("blob-redirect-invalid")
                    host, path = DATA_HOST, url.path + ("?" + url.query if url.query else "")
                    headers = {}
                    continue
                if response.status != 200:
                    raise ValueError("blob-http-failure")
                digest, count = hashlib.sha256(), 0
                with file.open("xb") as stream:
                    while True:
                        chunk = response.read(65536)
                        if not chunk:
                            break
                        count += len(chunk)
                        if count > size:
                            raise ValueError("blob-size-overflow")
                        digest.update(chunk)
                        stream.write(chunk)
                if count != size or digest.hexdigest() != ARCHIVE_SHA:
                    raise ValueError("archive-proof-mismatch")
                return digest.hexdigest()
            finally:
                connection.close()
        raise ValueError("blob-response-unresolved")


def collect(mode, expected):
    if mode not in ("pre", "post") or (mode == "post" and not re.fullmatch(r"sha256:[a-f0-9]{64}", expected)):
        raise ValueError("verifier-mode-invalid")
    result = {"status": "FAIL", "mode": mode, "repository": REPOSITORY, "tag": TAG,
              "scope": SCOPE, "clientId": CLIENT, "principalId": PRINCIPAL,
              "collision": "TARGET_COLLISION_CHECK_UNRESOLVED", "equivalence": "NOT_RUN",
              "archiveExecuted": False, "temporaryWorkspaceRetired": True}
    scoped = authenticate()
    result["identityAndPullGrant"] = "PASS"
    status, body, header = manifest(TAG, scoped)
    result["manifestHttpStatus"] = status
    result["collision"] = classify_collision(status, body)
    if mode == "pre":
        if status == 200:
            result["manifestDigest"] = "sha256:" + hashlib.sha256(body).hexdigest()
        if result["collision"] == "TARGET_TOOLING_TAG_ABSENT":
            result["status"] = "PASS"
        return result
    if status != 200:
        return result
    payload = check_manifest(body, header, expected)
    status, by_digest, digest_header = manifest(expected, scoped)
    if status != 200 or by_digest != body:
        raise ValueError("immutable-roundtrip-mismatch")
    check_manifest(by_digest, digest_header, expected)
    result["archiveSha256"] = archive_hash(scoped, payload["size"])
    result.update({"manifestDigest": expected, "artifactType": ARTIFACT_TYPE, "payloadMediaType": "application/gzip",
                   "payloadSize": payload["size"], "equivalence": "PASS", "status": "PASS"})
    return result


def encode_result(value):
    def inspect(child):
        if isinstance(child, dict):
            for key, nested in child.items():
                normalized = re.sub(r"[^a-z]", "", key.lower())
                if any(word in normalized for word in ("token", "authorization", "password", "credential", "secret")):
                    raise ValueError("sensitive-output-key")
                inspect(nested)
        elif isinstance(child, list):
            for nested in child:
                inspect(nested)
        elif isinstance(child, str) and re.search(r"(?:Bearer\s|eyJ[a-zA-Z0-9_-]+\.)", child):
            raise ValueError("sensitive-output-value")
    inspect(value)
    encoded = MARKER + json.dumps(value, sort_keys=True, separators=(",", ":"))
    if len(encoded.encode()) > 3900:
        raise ValueError("result-limit")
    return encoded


def main(mode, expected=""):
    before = configuration_digest()
    try:
        result = collect(mode, expected)
    except (OSError, ValueError, KeyError, IndexError, http.client.HTTPException) as error:
        result = {"status": "FAIL", "mode": mode, "errorType": type(error).__name__,
                  "collision": "TARGET_COLLISION_CHECK_UNRESOLVED", "equivalence": "UNRESOLVED"}
    after = configuration_digest()
    result.update({"configurationBeforeSha256": before, "configurationAfterSha256": after,
                   "configurationUnchanged": before == after,
                   "capturedAtUtc": datetime.datetime.now(datetime.timezone.utc).isoformat()})
    if before != after:
        result["status"] = "FAIL"
    print(encode_result(result), flush=True)
    return 0 if result["status"] == "PASS" else 78
