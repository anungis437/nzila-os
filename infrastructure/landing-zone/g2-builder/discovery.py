#!/usr/bin/env python3
import glob
import ipaddress
import json
import os
import re
import socket
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

MARKER = "NZILA_G2_STAGE1_DISCOVERY_V1"
START_MARKER = "NZILA_G2_DISCOVERY_STARTED"
RESULT_MARKER = "NZILA_G2_DISCOVERY_RESULT="
MAX_RESULT_BYTES = 8192
SENSITIVE_KEYS = {
    "access_token", "refresh_token", "authorization", "password",
    "registry_credential", "cloud_init_secret", "imds_token_body",
}
SOURCE_COMMIT = "__SOURCE_COMMIT__"
SOURCE_ARCHIVE_SHA256 = "__SOURCE_ARCHIVE_SHA256__"
REGISTRY = "__REGISTRY_LOGIN_SERVER__"
BUILDER_CLIENT_ID = "__BUILDER_CLIENT_ID__"
IMDS = "http://169.254.169.254"
OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def http_json(url, data=None):
    request = urllib.request.Request(
        url,
        data=data,
        headers={"Metadata": "true"} if url.startswith(IMDS) else {},
        method="POST" if data is not None else "GET",
    )
    try:
        with OPENER.open(request, timeout=5) as response:
            body = response.read(1024 * 1024)
            return response.status, json.loads(body), None
    except urllib.error.HTTPError as error:
        return error.code, None, f"HTTP_{error.code}"
    except (OSError, ValueError, TimeoutError) as error:
        return None, None, type(error).__name__


def apt_uri(raw_uri):
    try:
        parsed = urllib.parse.urlsplit(raw_uri)
        port = parsed.port
    except ValueError:
        return {"uri": None, "parseError": "invalid-uri"}
    host = parsed.hostname or ""
    if parsed.scheme not in {"http", "https"} or not host:
        return {"uri": None, "parseError": "invalid-uri"}
    safe_netloc = f"[{host}]" if ":" in host else host
    port = port if port != {"http": 80, "https": 443}.get(parsed.scheme) else None
    if port:
        safe_netloc = f"{safe_netloc}:{port}"
    return {
        "uri": urllib.parse.urlunsplit(
            (parsed.scheme, safe_netloc, parsed.path, "", "")
        ),
        "host": host.lower(),
        "scheme": parsed.scheme,
        "port": port,
        "credentialsRedacted": parsed.username is not None or parsed.password is not None,
        "queryRedacted": bool(parsed.query),
    }


def read_apt_sources(source_paths=None):
    if source_paths is None:
        source_paths = [
            Path("/etc/apt/sources.list"),
            *(Path(name) for name in sorted(glob.glob("/etc/apt/sources.list.d/*.list"))),
            *(Path(name) for name in sorted(glob.glob("/etc/apt/sources.list.d/*.sources"))),
        ]
    else:
        source_paths = [Path(name) for name in source_paths]
    found_files = []
    entries = []
    parse_errors = []
    for path in source_paths:
        if not path.is_file():
            continue
        found_files.append(str(path))
        try:
            lines = path.read_text(encoding="utf-8").splitlines()
        except (OSError, UnicodeError) as error:
            parse_errors.append({"file": str(path), "error": type(error).__name__})
            continue
        if path.suffix == ".sources":
            blocks = []
            current = {}
            invalid = False
            last_key = None
            block_errors = []
            for line_number, line in enumerate([*lines, ""], 1):
                if line.lstrip().startswith("#"):
                    continue
                if not line.strip():
                    enabled = current.get("enabled", "yes").lower() not in {"no", "false", "0"}
                    for error in block_errors:
                        error["enabled"] = enabled
                    if current:
                        blocks.append((current, invalid))
                        current = {}
                    parse_errors.extend(block_errors)
                    block_errors = []
                    invalid = False
                    last_key = None
                    continue
                if line[:1].isspace() and last_key:
                    current[last_key] += " " + line.strip()
                    continue
                match = re.match(r"^([A-Za-z][A-Za-z0-9-]*):\s*(.*)$", line)
                if not match:
                    invalid = True
                    block_errors.append({"file": str(path), "line": line_number, "error": "unparsed-deb822-line"})
                    continue
                key, value = match.groups()
                last_key = key.lower()
                if last_key in current:
                    invalid = True
                current[last_key] = value.strip()
            for block, invalid in blocks:
                enabled = block.get("enabled", "yes").lower() not in {"no", "false", "0"}
                uris = block.get("uris", "").split()
                types = block.get("types", "").split()
                suites = block.get("suites", "").split()
                if invalid or not uris or not suites or not types or not set(types) <= {"deb", "deb-src"}:
                    parse_errors.append({"file": str(path), "error": "malformed-deb822-record", "enabled": enabled})
                    continue
                observed = [apt_uri(uri) for uri in uris]
                if any(uri.get("parseError") for uri in observed):
                    parse_errors.append({"file": str(path), "error": "invalid-uri", "enabled": enabled})
                    continue
                entries.append({
                    "file": str(path),
                    "format": "deb822",
                    "types": types,
                    "uris": observed,
                    "suites": suites,
                    "components": block.get("components", "").split(),
                    "enabled": enabled,
                })
            continue
        for line_number, line in enumerate(lines, 1):
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            stripped = stripped.split("#", 1)[0].rstrip()
            match = re.match(r"^(deb(?:-src)?)\s+(?:\[[^\]]*\]\s+)?(\S+)\s+(\S+)(.*)$", stripped)
            if not match:
                parse_errors.append({
                    "file": str(path),
                    "line": line_number,
                    "error": "unparsed-list-entry",
                })
                continue
            source_type, uri, suite, remainder = match.groups()
            observed = apt_uri(uri)
            if observed.get("parseError"):
                parse_errors.append({"file": str(path), "line": line_number, "error": "invalid-uri"})
                continue
            entries.append({
                "file": str(path),
                "format": "legacy-list",
                "types": [source_type],
                "uris": [observed],
                "suites": [suite],
                "components": remainder.split(),
                "enabled": True,
            })
    return {
        "files": found_files,
        "entries": entries,
        "parseErrors": parse_errors,
        "complete": any(entry["enabled"] for entry in entries) and not any(
            error.get("enabled", True) for error in parse_errors
        ),
    }


def image_metadata():
    status, data, error = http_json(
        f"{IMDS}/metadata/instance/compute?api-version=2021-02-01"
    )
    if not data:
        return {"httpStatus": status, "error": error}
    wanted = (
        "publisher", "offer", "sku", "version", "vmSize", "location",
        "resourceId", "subscriptionId",
    )
    return {
        "httpStatus": status,
        "fields": {key: data[key] for key in wanted if key in data},
    }


def managed_identity():
    status, data, error = http_json(
        f"{IMDS}/metadata/identity/info?api-version=2019-08-01"
    )
    if not data:
        return {"httpStatus": status, "error": error}, None
    result = {
        "httpStatus": status,
        "tenantId": data.get("tenant_id", data.get("tenantId")),
    }
    return result, result.get("tenantId")


def managed_identity_access_token():
    resource = "https://containerregistry.azure.net/"
    token_query = urllib.parse.urlencode({
        "api-version": "2018-02-01",
        "resource": resource,
        "client_id": BUILDER_CLIENT_ID,
    })
    result = {
        "requestedResource": resource,
        "requestedClientId": BUILDER_CLIENT_ID,
        "httpStatus": None,
    }
    status, token_response, error = http_json(
        f"{IMDS}/metadata/identity/oauth2/token?{token_query}"
    )
    result["httpStatus"] = status
    if status != 200 or not token_response or not token_response.get("access_token"):
        result.update({"status": "FAIL", "error": error or "aad-token-unavailable"})
        return result, None
    result["status"] = "PASS"
    if token_response.get("expires_on"):
        result["expiresOn"] = token_response["expires_on"]
    return result, token_response["access_token"]


def acr_token_flow(tenant_id, aad_token, private_https):
    result = {
        "status": "NOT_RUN",
        "attempted": False,
        "exchangeHttpStatus": None,
        "repositoryTokenHttpStatus": None,
        "tokenValuesEmitted": False,
        "imagePush": "NOT_ATTEMPTED",
    }
    if not tenant_id or not aad_token or not private_https:
        result["reason"] = "tenant-or-private-registry-unavailable"
        return result
    result["attempted"] = True
    exchange_data = urllib.parse.urlencode({
        "grant_type": "access_token",
        "service": REGISTRY,
        "tenant": tenant_id,
        "access_token": aad_token,
    }).encode()
    status, exchange_response, error = http_json(
        f"https://{REGISTRY}/oauth2/exchange", exchange_data
    )
    result["exchangeHttpStatus"] = status
    if not exchange_response or not exchange_response.get("refresh_token"):
        result["reason"] = error or "acr-exchange-token-unavailable"
        result["status"] = "BLOCKED" if status is None else "FAIL"
        return result
    token_data = urllib.parse.urlencode({
        "grant_type": "refresh_token",
        "service": REGISTRY,
        "scope": "repository:synthetic-health:pull,push",
        "refresh_token": exchange_response["refresh_token"],
    }).encode()
    status, repository_response, error = http_json(
        f"https://{REGISTRY}/oauth2/token", token_data
    )
    result["repositoryTokenHttpStatus"] = status
    if not repository_response or not repository_response.get("access_token"):
        result["reason"] = error or "repository-token-unavailable"
        result["status"] = "BLOCKED" if status is None else "FAIL"
    else:
        result["reason"] = "repository-scoped-token-issued-no-push-requested"
        result["status"] = "PASS"
    return result


def registry_reachability():
    try:
        records = socket.getaddrinfo(REGISTRY, 443, type=socket.SOCK_STREAM)
        addresses = sorted({record[4][0] for record in records})
    except OSError as error:
        return {"dnsAddresses": [], "dnsPrivate": False, "tcp443": False, "error": type(error).__name__}
    private_addresses = []
    for address in addresses:
        try:
            if ipaddress.ip_address(address).is_private:
                private_addresses.append(address)
        except ValueError:
            continue
    tcp_ok = False
    tcp_errors = []
    for address in private_addresses:
        try:
            with socket.create_connection((address, 443), timeout=5):
                tcp_ok = True
                break
        except OSError as error:
            tcp_errors.append(type(error).__name__)
    https_status, _, https_error = http_json(f"https://{REGISTRY}/v2/")
    return {
        "dnsAddresses": addresses,
        "dnsPrivate": bool(addresses) and len(private_addresses) == len(addresses),
        "tcp443": tcp_ok,
        "tcpErrors": tcp_errors,
        "httpsStatus": https_status,
        "httpsReachable": https_status in {200, 401},
        "httpsError": https_error,
    }


def discovery_status(required_checks, serial_console_write_attempted):
    return (
        "DISCOVERY_COMPLETE"
        if required_checks and all(value is True for value in required_checks.values()) and serial_console_write_attempted
        else "DISCOVERY_INCOMPLETE"
    )


def identity_proofs(vm, uami, token, exchange):
    identity = vm.get("identity", {})
    attached = {key.lower(): value for key, value in identity.get("userAssignedIdentities", {}).items()}
    attachment = (
        "UserAssigned" in {value.strip() for value in identity.get("type", "").split(",")}
        and bool(uami.get("id")) and uami["id"].lower() in attached
        and attached[uami["id"].lower()].get("clientId") == uami.get("clientId")
        and attached[uami["id"].lower()].get("principalId") == uami.get("principalId")
        and bool(uami.get("clientId")) and bool(uami.get("principalId"))
    )
    targeted = (
        token.get("status") == "PASS" and token.get("httpStatus") == 200
        and token.get("requestedClientId") == uami.get("clientId")
        and token.get("requestedResource") == "https://containerregistry.azure.net/"
    )
    return {
        "VM_UAMI_ATTACHMENT_PROOF": "PASS" if attachment else "FAIL",
        "IMDS_TARGETED_TOKEN_REQUEST_PROOF": "PASS" if targeted else "FAIL",
        "TOKEN_IDENTITY_CORRELATION_PROOF": (
            "PASS" if attachment and targeted and exchange.get("status") == "PASS"
            else "BLOCKED" if attachment and targeted and exchange.get("status") in {"BLOCKED", "NOT_RUN"}
            else "FAIL"
        ),
    }


def collect_result():
    image = image_metadata()
    apt = read_apt_sources()
    identity, tenant_id = managed_identity()
    aad_token, aad_access_token = managed_identity_access_token()
    registry = registry_reachability()
    token_flow = acr_token_flow(tenant_id, aad_access_token, registry["httpsReachable"])
    required_checks = {
        "imageMetadata": image.get("httpStatus") == 200,
        "aptConfiguration": apt["complete"],
        "managedIdentityMetadata": identity.get("httpStatus") == 200,
        "managedIdentityToken": aad_token["status"] == "PASS",
        "privateRegistryDns": registry["dnsPrivate"],
        "privateRegistryHttps": registry["httpsReachable"],
        "privateRegistryTcp": registry["tcp443"],
    }
    result = {
        "marker": MARKER,
        "status": "DISCOVERY_INCOMPLETE",
        "sourceCommit": SOURCE_COMMIT,
        "sourceArchiveSha256": SOURCE_ARCHIVE_SHA256,
        "sourceArchiveDelivered": False,
        "marketplaceImage": image,
        "aptSources": apt,
        "managedIdentity": identity,
        "managedIdentityToken": aad_token,
        "registryLoginServer": REGISTRY,
        "registryReachability": registry,
        "acrTokenFlow": token_flow,
        "requiredChecks": required_checks,
        "componentStatuses": {
            "aptSourceObservation": "PASS" if apt["complete"] else "FAIL",
            "imdsIdentity": "PASS" if required_checks["managedIdentityMetadata"] else "FAIL",
            "vmIdentityAttachment": "BLOCKED",
            "tokenIdentityCorrelation": "BLOCKED",
            "serialMarkers": "PASS",
            "imdsAccessToken": aad_token["status"],
            "privateAcrDns": "PASS" if registry["dnsPrivate"] else "FAIL",
            "privateAcrHttps": "PASS" if registry["httpsReachable"] else "FAIL",
            "acrTokenExchange": token_flow["status"],
        },
        "aptUpdate": "NOT_ATTEMPTED",
        "packageInstall": "NOT_ATTEMPTED",
        "imageBuild": "NOT_ATTEMPTED",
        "imagePush": "NOT_ATTEMPTED",
        "runCommand": "NOT_USED",
        "serialConsoleWriteAttempted": True,
        "externalIdentityEvidenceRequired": True,
    }
    result["status"] = discovery_status(required_checks, True)
    return result


def reconcile_identity_evidence(result, vm, uami, serial_markers_verified=False):
    proofs = identity_proofs(vm, uami, result["managedIdentityToken"], result["acrTokenFlow"])
    required = {
        **result["requiredChecks"],
        "vmIdentityAttachment": proofs["VM_UAMI_ATTACHMENT_PROOF"] == "PASS",
        "targetedIdentityToken": proofs["IMDS_TARGETED_TOKEN_REQUEST_PROOF"] == "PASS",
        "literalSerialMarkers": serial_markers_verified is True,
    }
    return {
        "identityProofs": proofs,
        "requiredChecks": required,
        "status": discovery_status(required, result.get("serialConsoleWriteAttempted") is True),
        "requiredLiteralMarkersStillRequireSerialVerification": not serial_markers_verified,
    }


def validate_public_result(value):
    if isinstance(value, dict):
        for key, nested in value.items():
            if key.lower() in SENSITIVE_KEYS:
                raise ValueError("sensitive-output-key")
            validate_public_result(nested)
    elif isinstance(value, list):
        for nested in value:
            validate_public_result(nested)
    elif isinstance(value, str) and re.search(
        r"(?i)\bbearer\s+\S+|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+", value
    ):
        raise ValueError("sensitive-output-value")


def result_line(result):
    validate_public_result(result)
    line = RESULT_MARKER + json.dumps(result, separators=(",", ":"), sort_keys=True) + "\n"
    if len(line.encode("utf-8")) > MAX_RESULT_BYTES:
        result = {
            "marker": MARKER,
            "status": "DISCOVERY_INCOMPLETE",
            "requiredChecks": {"boundedResult": False},
            "componentStatuses": {"serialMarkers": "FAIL"},
            "error": "result-exceeds-serial-budget",
        }
        line = RESULT_MARKER + json.dumps(result, separators=(",", ":"), sort_keys=True) + "\n"
    return line.encode("utf-8")


def main():
    descriptor = os.open("/dev/ttyS0", os.O_WRONLY | os.O_APPEND)
    try:
        start = (START_MARKER + "\n").encode()
        if os.write(descriptor, start) != len(start):
            raise OSError("short-serial-write")
        line = result_line(collect_result())
        if os.write(descriptor, line) != len(line):
            raise OSError("short-serial-write")
    finally:
        os.close(descriptor)


if __name__ == "__main__":
    main()
