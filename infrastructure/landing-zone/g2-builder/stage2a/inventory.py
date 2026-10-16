import base64
import datetime
import hashlib
import http.client
import json
import os
import pathlib
import platform
import re
import shutil
import socket
import ssl
import subprocess
import urllib.parse

REGISTRY = "nzilag2tzo75uuozprbo.azurecr.io"
PRIVATE_IP = "10.90.2.5"
CLIENT = "d4775ade-6d53-419a-a80f-c17ffbaa125f"
PRINCIPAL = "c59571aa-66ea-47c5-83d5-59946b318ae2"
TENANT = "5082b8be-b04d-4a13-b61c-b6397670177b"
RESOURCE = "https://containerregistry.azure.net/"
MARKER = "NZILA_G2_STAGE2A_INVENTORY_RESULT="
TOOLS = ("sh", "python3", "curl", "az", "go", "docker", "podman", "buildah", "skopeo", "oras")


def configuration_digest():
    files = [pathlib.Path("/var/lib/dpkg/status"), pathlib.Path("/etc/resolv.conf")]
    files.extend(sorted(pathlib.Path("/etc/apt").rglob("*")))
    digest = hashlib.sha256()
    for path in files:
        if path.is_file():
            digest.update(str(path).encode() + b"\0" + path.read_bytes() + b"\0")
    return digest.hexdigest()


def probe_tool(name):
    path = shutil.which(name)
    if not path:
        return {"path": None, "status": "MISSING"}
    result = {"path": path, "status": "PRESENT"}
    args = [path, "version"] if name == "go" else [path, "--version"]
    if name == "sh":
        result["version"] = "POSIX-shell-path-observed"
        return result
    try:
        process = subprocess.run(args, capture_output=True, timeout=12, text=True, check=False)
    except (OSError, subprocess.TimeoutExpired) as error:
        return {**result, "status": "UNRESOLVED", "errorType": type(error).__name__}
    text = process.stdout + process.stderr
    version = re.search(r"\b\d+\.\d+(?:\.\d+)*(?:[-+][a-zA-Z0-9.]+)?", text)
    result.update({"exitCode": process.returncode, "version": version.group() if version else None})
    if process.returncode or not version:
        result["status"] = "UNRESOLVED"
    return result


class PrivateConnection(http.client.HTTPSConnection):
    def connect(self):
        raw = socket.create_connection((PRIVATE_IP, 443), self.timeout)
        self.sock = self._context.wrap_socket(raw, server_hostname=REGISTRY)
        if self.sock.getpeername()[0] != PRIVATE_IP:
            raise OSError("private-peer-mismatch")


def request(connection, method, path, data=None, headers=None):
    connection.request(method, path, body=data, headers=headers or {})
    response = connection.getresponse()
    body = response.read(65537)
    status = response.status
    connection.close()
    if len(body) > 65536:
        raise ValueError("response-size-limit")
    return status, body


def private_request():
    return request(PrivateConnection(REGISTRY, timeout=12, context=ssl.create_default_context()),
                   "GET", "/v2/")


def authentication():
    query = urllib.parse.urlencode({"api-version": "2018-02-01", "resource": RESOURCE, "client_id": CLIENT})
    status, body = request(http.client.HTTPConnection("169.254.169.254", timeout=12),
                           "GET", "/metadata/identity/oauth2/token?" + query, headers={"Metadata": "true"})
    result = {"requestedResource": RESOURCE, "requestedClientId": CLIENT, "imdsHttpStatus": status,
              "status": "FAIL"}
    if status != 200:
        return result
    token = json.loads(body)["access_token"]
    claims_part = token.split(".")[1]
    claims = json.loads(base64.urlsafe_b64decode(claims_part + "=" * (-len(claims_part) % 4)))
    matches = (claims.get("oid") == PRINCIPAL and claims.get("tid") == TENANT
               and claims.get("appid", claims.get("azp")) == CLIENT)
    result["identityClaimsMatch"] = matches
    if matches:
        result["status"] = "PASS"
    return result


def classify_toolchain(tools):
    if any(tools.get(name, {}).get("status") == "PRESENT" for name in ("buildah", "podman", "docker")):
        return "STAGE2_BUILD_TOOLCHAIN_UNRESOLVED"
    if any(tools.get(name, {}).get("status") == "UNRESOLVED" for name in ("buildah", "podman", "docker")):
        return "STAGE2_BUILD_TOOLCHAIN_UNRESOLVED"
    return "STAGE2_BUILD_TOOLCHAIN_MISSING"


def collect():
    before = configuration_digest()
    tools = {name: probe_tool(name) for name in TOOLS}
    result = {
        "status": "FAIL", "os": platform.system(), "release": platform.release(),
        "architecture": platform.machine(), "executionUid": os.geteuid(), "tools": tools,
        "temporaryWorkspaceWritable": os.access("/tmp", os.W_OK | os.X_OK),
        "temporaryDiskFreeBytes": shutil.disk_usage("/tmp").free,
        "toolchain": classify_toolchain(tools),
        "packageAndConfigurationBeforeSha256": before,
        "privateAcrPath": "FAIL", "authentication": {"status": "NOT_RUN"},
        "privateAcrDns": "FAIL", "privateAcrHttps": "NOT_RUN",
        "packageInstall": "NOT_ATTEMPTED", "imagePush": "NOT_ATTEMPTED",
    }
    addresses = sorted({item[4][0] for item in socket.getaddrinfo(REGISTRY, 443, type=socket.SOCK_STREAM)})
    result["acrAddresses"] = addresses
    if addresses == [PRIVATE_IP]:
        result["privateAcrDns"] = "PASS"
        status, _ = private_request()
        result["acrHttpsHttpStatus"] = status
        result["privateAcrHttps"] = "FAIL"
        if status in (200, 401):
            result["privateAcrHttps"] = "PASS"
            result["privateAcrPath"] = "PASS"
            result["authentication"] = authentication()
    after = configuration_digest()
    result["packageAndConfigurationAfterSha256"] = after
    result["packageAndConfigurationUnchanged"] = before == after
    if before == after and result["privateAcrPath"] == "PASS" and result["authentication"]["status"] == "PASS":
        result["status"] = "PASS"
    result["capturedAtUtc"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    return result


def encode_result(result):
    def inspect(value):
        if isinstance(value, dict):
            for key, child in value.items():
                normalized = re.sub(r"[^a-z]", "", key.lower())
                if any(word in normalized for word in ("token", "authorization", "password", "credential", "secret")):
                    raise ValueError("sensitive-output-key")
                inspect(child)
        elif isinstance(value, list):
            for child in value:
                inspect(child)
    inspect(result)
    encoded = json.dumps(result, sort_keys=True, separators=(",", ":"))
    if len((MARKER + encoded).encode()) > 3900:
        encoded = '{"status":"FAIL","error":"result-size-limit","toolchain":"STAGE2_BUILD_TOOLCHAIN_UNRESOLVED"}'
    return MARKER + encoded


def main():
    try:
        result = collect()
    except (OSError, ValueError, KeyError, IndexError, http.client.HTTPException, subprocess.SubprocessError) as error:
        result = {"status": "FAIL", "errorType": type(error).__name__,
                  "toolchain": "STAGE2_BUILD_TOOLCHAIN_UNRESOLVED"}
    print(encode_result(result), flush=True)
    return 0 if result["status"] == "PASS" else 78


if __name__ == "__main__":
    raise SystemExit(main())
