import base64
import hashlib
import http.client
import json
import ssl
import subprocess
import urllib.parse
import urllib.request

HOST = "nzilacanadaacr.azurecr.io"
REPO = "g2-tooling"
TAG = "oras-1.3.4-linux-amd64"
EXPECTED = "f27adb935022d94df8dc77719c322dda592c78a0d57a6f7dcdd8d900b248c454"
CLIENT = "5c02d25b-cbdc-412f-8c2a-9ed43b73ac20"
SUB = "5d819f33-d16f-429c-a3c0-5b0e94740ba3"
TENANT = "5082b8be-b04d-4a13-b61c-b6397670177b"
MARKER = "NZILA_G2_SOURCE_ORAS_STAGING_RESULT="


def cli(*args):
    p = subprocess.run(["az", *args, "-o", "json"], capture_output=True, text=True, check=False)
    if p.returncode:
        raise RuntimeError("azure-cli-failed")
    return json.loads(p.stdout)


def request(method, path, data=None, headers=None):
    if not path.startswith(("/oauth2/", "/v2/g2-tooling/")):
        raise ValueError("source-path-not-authorized")
    connection = http.client.HTTPSConnection(HOST, timeout=90, context=ssl.create_default_context())
    try:
        connection.request(method, path, body=data, headers=headers or {})
        response = connection.getresponse()
        body = response.read(1024 * 1024 + 1)
        if len(body) > 1024 * 1024:
            raise ValueError("source-response-limit")
        return response.status, body, response.getheader("Location"), response.getheader("Docker-Content-Digest")
    finally:
        connection.close()


def authentication():
    account = cli("account", "show")
    if account["id"] != SUB or account["tenantId"] != TENANT or account["user"]["name"] != CLIENT:
        raise ValueError("source-identity-mismatch")
    refresh = cli("acr", "login", "--name", "nzilacanadaacr", "--expose-token")["accessToken"]
    form = urllib.parse.urlencode({"grant_type": "refresh_token", "service": HOST,
                                  "scope": "repository:g2-tooling:pull,push", "refresh_token": refresh})
    status, body, _, _ = request("POST", "/oauth2/token", form, {"Content-Type": "application/x-www-form-urlencoded"})
    if status != 200:
        raise ValueError("source-scope-failed")
    scoped = json.loads(body).get("access_token") or json.loads(body)["token"]
    part = scoped.split(".")[1]
    claims = json.loads(base64.urlsafe_b64decode(part + "=" * (-len(part) % 4)))
    if claims.get("access") != [{"type": "repository", "name": REPO, "actions": ["pull", "push"]}]:
        raise ValueError("source-grant-not-exact")
    return scoped


def download():
    release = json.load(urllib.request.urlopen("https://api.github.com/repos/oras-project/oras/releases/tags/v1.3.4", timeout=30))
    asset = next(v for v in release["assets"] if v["name"] == "oras_1.3.4_linux_amd64.tar.gz")
    if asset.get("digest") != "sha256:" + EXPECTED:
        raise ValueError("upstream-authority-mismatch")
    with urllib.request.urlopen(asset["browser_download_url"], timeout=90) as stream:
        archive = stream.read(64 * 1024 * 1024 + 1)
    if len(archive) > 64 * 1024 * 1024 or hashlib.sha256(archive).hexdigest() != EXPECTED:
        raise ValueError("upstream-archive-mismatch")
    return archive


def blob(content, scoped):
    digest = "sha256:" + hashlib.sha256(content).hexdigest()
    headers = {"Authorization": "Bearer " + scoped}
    status, _, _, _ = request("HEAD", "/v2/g2-tooling/blobs/" + digest, headers=headers)
    if status == 200:
        return digest
    if status != 404:
        raise ValueError("source-blob-precheck-failed")
    status, _, location, _ = request("POST", "/v2/g2-tooling/blobs/uploads/", b"", headers)
    if status != 202:
        raise ValueError("source-upload-start-failed")
    url = urllib.parse.urlsplit(location)
    if url.hostname not in (None, HOST) or url.scheme not in ("", "https") or not url.path.startswith("/v2/g2-tooling/blobs/uploads/"):
        raise ValueError("source-upload-location-invalid")
    path = url.path + "?" + (url.query + "&" if url.query else "") + urllib.parse.urlencode({"digest": digest})
    status, _, _, returned = request("PUT", path, content, {**headers, "Content-Type": "application/octet-stream"})
    if status != 201 or returned != digest:
        raise ValueError("source-upload-failed")
    return digest


def stage():
    scoped = authentication()
    headers = {"Authorization": "Bearer " + scoped, "Accept": "application/vnd.oci.image.manifest.v1+json"}
    status, body, _, _ = request("GET", "/v2/g2-tooling/manifests/" + TAG, headers=headers)
    if status != 404:
        raise ValueError("source-tag-exists-or-unresolved")
    errors = json.loads(body).get("errors", [])
    if not errors or not all(v.get("code") in ("NAME_UNKNOWN", "MANIFEST_UNKNOWN") for v in errors):
        raise ValueError("source-absence-unresolved")
    archive = download()
    config = b"{}"
    manifest = {"schemaVersion": 2, "mediaType": "application/vnd.oci.image.manifest.v1+json",
                "artifactType": "application/vnd.nzila.g2.tooling.oras.v1",
                "config": {"mediaType": "application/vnd.oci.empty.v1+json", "digest": "sha256:" + hashlib.sha256(config).hexdigest(), "size": len(config)},
                "layers": [{"mediaType": "application/gzip", "digest": "sha256:" + EXPECTED, "size": len(archive),
                            "annotations": {"org.opencontainers.image.title": "oras_1.3.4_linux_amd64.tar.gz"}}]}
    raw = json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode()
    expected_manifest = "sha256:" + hashlib.sha256(raw).hexdigest()
    blob(config, scoped)
    blob(archive, scoped)
    status, _, _, returned = request("PUT", "/v2/g2-tooling/manifests/" + TAG, raw,
                                    {**headers, "Content-Type": manifest["mediaType"], "If-None-Match": "*"})
    if status != 201 or returned != expected_manifest:
        raise ValueError("source-manifest-upload-failed")
    status, readback, _, returned = request("GET", "/v2/g2-tooling/manifests/" + TAG, headers=headers)
    if status != 200 or readback != raw or returned != expected_manifest:
        raise ValueError("source-manifest-readback-failed")
    status, immutable, _, returned = request("GET", "/v2/g2-tooling/manifests/" + expected_manifest, headers=headers)
    if status != 200 or immutable != raw or returned != expected_manifest:
        raise ValueError("source-digest-readback-failed")
    return {"status": "PASS", "repository": REPO, "tag": TAG, "archiveSha256": EXPECTED,
            "manifestDigest": expected_manifest, "manifest": manifest, "manifestBase64": base64.b64encode(raw).decode(),
            "artifactType": manifest["artifactType"], "payloadMediaType": "application/gzip",
            "archiveSize": len(archive), "clientId": CLIENT}


if __name__ == "__main__":
    try:
        result = stage()
    except (OSError, ValueError, KeyError, RuntimeError, http.client.HTTPException) as error:
        print(MARKER + json.dumps({"status": "FAIL", "errorType": type(error).__name__}), flush=True)
        raise SystemExit(78)
    print(MARKER + json.dumps(result, sort_keys=True, separators=(",", ":")), flush=True)
