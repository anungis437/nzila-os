import os
import struct
import subprocess
import tarfile

PRODUCTION_MARKER = "NZILA_G2_SYNTHETIC_REVISED_RESULT="
TARGET_REPO = "synthetic-health"
CONTROL_REPO = "synthetic-health-denied-control"
SOURCE_SHA = "2457502e49df5a77cd6403052c37ad7dc8cce95f3947378aa5e3dcf2f12703db"
TARGET_TAG = "stage2a-" + SOURCE_SHA
PROOF_TYPE = "application/vnd.nzila.g2.synthetic-health.v1"
PAYLOAD_TYPE = PROOF_TYPE + "+json"
FIXED_CREATED = "2000-01-01T00:00:00Z"
PAYLOAD_NAME = "synthetic-health.json"
PAYLOAD_BYTES = base64.b64decode(BOUND_PAYLOAD_BASE64, validate=True)


def fail(stage):
    raise ReadbackFailure(stage)


def registry_call(method, path, scoped, body=None, headers=None):
    if method not in ("GET", "HEAD", "POST", "PUT"):
        fail("REGISTRY_METHOD_REJECTED")
    allowed_repos = (TARGET_REPO, CONTROL_REPO, REPOSITORY)
    allowed_path = path in ("/oauth2/exchange", "/oauth2/token")
    allowed_path |= any(path.startswith("/v2/" + repo + "/") for repo in allowed_repos)
    if not allowed_path:
        fail("REGISTRY_PATH_REJECTED")
    connection = ObservedConnection(REGISTRY, {}, "PRODUCTION_REGISTRY")
    try:
        request_headers = dict(headers or {})
        if scoped is not None:
            request_headers["Authorization"] = "Bearer " + scoped
        connection.request(method, path, body=body, headers=request_headers)
        response = connection.getresponse()
        content = response.read(1024 * 1024 + 1)
        if len(content) > 1024 * 1024:
            fail("REGISTRY_RESPONSE_LIMIT")
        return response.status, content, {
            "digest": response.getheader("Docker-Content-Digest"),
            "location": response.getheader("Location"),
            "contentType": response.getheader("Content-Type", "").split(";")[0],
        }
    finally:
        connection.close()


def managed_refresh():
    query = urllib.parse.urlencode({"api-version": "2018-02-01", "resource": RESOURCE, "client_id": CLIENT})
    status, body, _ = request("GET", "/metadata/identity/oauth2/token?" + query,
                              headers={"Metadata": "true"}, imds=True)
    if status != 200:
        fail("BUILDER_IMDS_HTTP_" + str(status))
    access = json.loads(body)["access_token"]
    identity = claims(access)
    if (identity.get("oid") != PRINCIPAL or identity.get("tid") != TENANT
            or identity.get("appid", identity.get("azp")) != CLIENT):
        fail("BUILDER_IDENTITY_MISMATCH")
    form = urllib.parse.urlencode({"grant_type": "access_token", "service": REGISTRY,
                                   "tenant": TENANT, "access_token": access})
    status, body, _ = registry_call("POST", "/oauth2/exchange", None, form,
                                    {"Content-Type": "application/x-www-form-urlencoded"})
    if status != 200:
        fail("BUILDER_EXCHANGE_HTTP_" + str(status))
    return json.loads(body)["refresh_token"]


def exact_scope(refresh, repo, actions, denied=False):
    form = urllib.parse.urlencode({"grant_type": "refresh_token", "service": REGISTRY,
                                   "scope": "repository:" + repo + ":" + ",".join(actions),
                                   "refresh_token": refresh})
    status, body, _ = registry_call("POST", "/oauth2/token", None, form,
                                    {"Content-Type": "application/x-www-form-urlencoded"})
    if status != 200:
        fail("SCOPED_EXCHANGE_HTTP_" + str(status))
    decoded = json.loads(body)
    scoped = decoded.get("access_token") or decoded["token"]
    grant = claims(scoped)
    if not isinstance(grant.get("exp"), int) or grant["exp"] <= time.time():
        fail("SCOPED_GRANT_EXPIRED")
    observed = grant.get("access")
    if not isinstance(observed, list):
        fail("SCOPED_GRANT_FORM_INVALID")
    expected = [] if denied else [{"type": "repository", "name": repo, "actions": list(actions)}]
    normalized = []
    for entry in observed:
        if set(entry) != {"type", "name", "actions"} or not isinstance(entry["actions"], list):
            fail("SCOPED_GRANT_FORM_INVALID")
        if entry["type"] != "repository" or entry["name"] != repo:
            fail("SCOPED_GRANT_BROADER_REPOSITORY")
        if entry["actions"]:
            normalized.append({**entry, "actions": sorted(entry["actions"])})
    if normalized != [{**entry, "actions": sorted(entry["actions"])} for entry in expected]:
        fail("SCOPED_WRITE_UNEXPECTEDLY_ALLOWED" if denied else "SCOPED_GRANT_MISMATCH")
    return scoped


def deny_write(refresh, repo):
    scoped = exact_scope(refresh, repo, ["push"], denied=True)
    status, _, _ = registry_call("POST", "/v2/" + repo + "/blobs/uploads/", scoped, b"",
                                 {"Content-Length": "0"})
    if status not in (401, 403):
        fail("DENIAL_PROBE_WRITE_ALLOWED_" + repo if status == 202 else "DENIAL_PROBE_HTTP_" + str(status))
    return "DENIED"


def retrieve_archive(scoped, archive, result):
    body, descriptor = read_manifest(scoped, EXPECTED_MANIFEST, {})
    if hashlib.sha256(body).hexdigest() != EXPECTED_MANIFEST.split(":")[1]:
        fail("TOOLING_MANIFEST_MISMATCH")
    status, _, headers = registry_call("GET", "/v2/g2-tooling/blobs/" + descriptor["digest"], scoped)
    if status != 307:
        fail("TOOLING_INITIAL_HTTP_" + str(status))
    uri = validate_download_uri(headers["location"] or "", {})
    trace = {}
    with download_response(uri, trace) as response:
        if response.status != 200:
            fail("TOOLING_DATA_HTTP_" + str(response.status))
        count, digest = 0, hashlib.sha256()
        with archive.open("xb") as stream:
            while True:
                chunk = response.read(65536)
                if not chunk:
                    break
                count += len(chunk)
                if count > 4679642:
                    fail("ORAS_ARCHIVE_SIZE_OVERFLOW")
                digest.update(chunk)
                stream.write(chunk)
    if count != 4679642 or digest.hexdigest() != ARCHIVE_SHA:
        fail("ORAS_ARCHIVE_SHA_MISMATCH")
    result["orasArchiveSha256"] = digest.hexdigest()
    result["toolingRead"] = "ALLOWED"
    result["privateDownload"] = {"ip": trace["REMOTE_IP"], "TLS": trace["TLS"], "bytes": count}


def extract_oras(archive, directory):
    with tarfile.open(archive, "r:gz") as release:
        members = release.getmembers()
        if not members or len(members) > 3:
            fail("ORAS_ARCHIVE_MEMBERS_UNEXPECTED")
        names = set()
        for member in members:
            if member.name not in ("oras", "LICENSE", "README.md") or not member.isfile() or member.name in names:
                fail("ORAS_ARCHIVE_MEMBER_UNSAFE")
            if not 0 < member.size <= 64 * 1024 * 1024:
                fail("ORAS_ARCHIVE_MEMBER_SIZE_INVALID")
            names.add(member.name)
        if "oras" not in names:
            fail("ORAS_EXECUTABLE_ABSENT")
        member = release.getmember("oras")
        source = release.extractfile(member)
        if source is None:
            fail("ORAS_EXECUTABLE_READ_FAILED")
        with source, (directory / "oras").open("xb") as destination:
            while True:
                chunk = source.read(65536)
                if not chunk:
                    break
                destination.write(chunk)
    executable = directory / "oras"
    with executable.open("rb") as stream:
        elf = stream.read(20)
    if len(elf) != 20 or elf[:6] != b"\x7fELF\x02\x01" or struct.unpack("<H", elf[18:20])[0] != 62:
        fail("ORAS_EXECUTABLE_PLATFORM_MISMATCH")
    executable.chmod(0o700)
    return executable


def local_command(arguments, directory):
    environment = {"PATH": "/usr/bin:/bin", "HOME": str(directory), "TMPDIR": str(directory),
                   "LANG": "C", "LC_ALL": "C"}
    process = subprocess.run(arguments, cwd=directory, env=environment, capture_output=True, timeout=60)
    if process.returncode != 0:
        fail("ORAS_LOCAL_COMMAND_EXIT_" + str(process.returncode))
    return process.stdout


def create_local_artifact(executable, directory, result):
    version = local_command([str(executable), "version"], directory).decode("utf-8")
    if re.search(r"(?m)^Version:\s+1\.3\.4\s*$", version) is None:
        fail("ORAS_VERSION_MISMATCH")
    result["orasVersion"] = "1.3.4"
    if hashlib.sha256(PAYLOAD_BYTES).hexdigest() != SOURCE_SHA:
        fail("BOUND_PAYLOAD_MISMATCH")
    (directory / PAYLOAD_NAME).write_bytes(PAYLOAD_BYTES)
    layout = directory / "layout"
    local_command([str(executable), "push", "--oci-layout", str(layout) + ":" + TARGET_TAG,
                   "--artifact-type", PROOF_TYPE, "--image-spec", "v1.1",
                   "--annotation", "org.opencontainers.image.created=" + FIXED_CREATED,
                   "--export-manifest", str(directory / "manifest.json"),
                   PAYLOAD_NAME + ":" + PAYLOAD_TYPE], directory)
    body = (directory / "manifest.json").read_bytes()
    value = json.loads(body)
    if value.get("schemaVersion") != 2 or value.get("mediaType") != MANIFEST_TYPE or value.get("artifactType") != PROOF_TYPE:
        fail("LOCAL_MANIFEST_FORM_MISMATCH")
    expected_layer = {"mediaType": PAYLOAD_TYPE, "digest": "sha256:" + SOURCE_SHA,
                      "size": len(PAYLOAD_BYTES), "annotations": {"org.opencontainers.image.title": PAYLOAD_NAME}}
    expected_config = {"mediaType": "application/vnd.oci.empty.v1+json",
                       "digest": "sha256:" + hashlib.sha256(b"{}").hexdigest(), "size": 2}
    if value.get("layers") != [expected_layer] or value.get("config") != expected_config:
        fail("LOCAL_MANIFEST_DESCRIPTOR_MISMATCH")
    if value.get("annotations") != {"org.opencontainers.image.created": FIXED_CREATED}:
        fail("LOCAL_MANIFEST_NONDETERMINISTIC")
    if set(value) != {"schemaVersion", "mediaType", "artifactType", "config", "layers", "annotations"}:
        fail("LOCAL_MANIFEST_EXTRA_FIELDS")
    for descriptor, expected in ((expected_layer, PAYLOAD_BYTES), (expected_config, b"{}")):
        if (layout / "blobs" / "sha256" / descriptor["digest"].split(":")[1]).read_bytes() != expected:
            fail("LOCAL_OCI_BLOB_MISMATCH")
    result["localPayloadSha256"] = SOURCE_SHA
    result["localManifestDigest"] = "sha256:" + hashlib.sha256(body).hexdigest()
    return body


def absent(scoped, result):
    status, body, headers = registry_call("GET", "/v2/" + TARGET_REPO + "/manifests/" + TARGET_TAG,
                                         scoped, headers={"Accept": MANIFEST_TYPE})
    if status == 200:
        result["targetTagState"] = "PRESENT"
        result["collisionDigest"] = headers["digest"]
        fail("TARGET_TAG_PRESENT")
    if status != 404:
        fail("TARGET_TAG_CHECK_HTTP_" + str(status))
    errors = json.loads(body).get("errors", [])
    if not errors or any(v.get("code") not in ("MANIFEST_UNKNOWN", "NAME_UNKNOWN") for v in errors):
        fail("TARGET_TAG_ABSENCE_UNPROVEN")
    result["targetTagState"] = "ABSENT"


def upload_path(location):
    if not location or any(ord(v) <= 32 or ord(v) == 127 for v in location) or "\\" in location:
        fail("UPLOAD_LOCATION_INVALID")
    parsed = urllib.parse.urlsplit(location)
    if parsed.scheme or parsed.netloc:
        if parsed.scheme != "https" or parsed.netloc != REGISTRY:
            fail("UPLOAD_LOCATION_HOST_INVALID")
    if parsed.fragment or "#" in location or not parsed.path.startswith("/v2/" + TARGET_REPO + "/blobs/uploads/"):
        fail("UPLOAD_LOCATION_PATH_INVALID")
    return parsed.path + ("?" + parsed.query if parsed.query else "")


def push_blob(scoped, content, result):
    digest = "sha256:" + hashlib.sha256(content).hexdigest()
    path = "/v2/" + TARGET_REPO + "/blobs/" + digest
    status, _, headers = registry_call("HEAD", path, scoped)
    if status == 200:
        if headers["digest"] != digest:
            fail("EXISTING_BLOB_DIGEST_MISMATCH")
        return
    if status != 404:
        fail("BLOB_PREFLIGHT_HTTP_" + str(status))
    result["pushAttemptConsumed"] = True
    status, _, headers = registry_call("POST", "/v2/" + TARGET_REPO + "/blobs/uploads/", scoped,
                                      b"", {"Content-Length": "0"})
    if status != 202:
        fail("BLOB_UPLOAD_START_HTTP_" + str(status))
    path = upload_path(headers["location"])
    path += ("&" if "?" in path else "?") + urllib.parse.urlencode({"digest": digest})
    status, _, headers = registry_call("PUT", path, scoped, content, {
        "Content-Type": "application/octet-stream", "Content-Length": str(len(content))})
    if status != 201 or headers["digest"] != digest:
        fail("BLOB_UPLOAD_COMMIT_HTTP_" + str(status))


def push_artifact(scoped, body, result):
    absent(scoped, result)
    push_blob(scoped, b"{}", result)
    push_blob(scoped, PAYLOAD_BYTES, result)
    absent(scoped, result)
    result["pushAttemptConsumed"] = True
    result["manifestCommitAttempts"] = 1
    status, _, headers = registry_call("PUT", "/v2/" + TARGET_REPO + "/manifests/" + TARGET_TAG,
                                      scoped, body, {"Content-Type": MANIFEST_TYPE})
    if status != 201 or headers["digest"] != result["localManifestDigest"]:
        fail("ARTIFACT_MANIFEST_COMMIT_HTTP_" + str(status))
    result["authorizedPush"] = "PASS"
    result["remoteManifestDigest"] = headers["digest"]


def readback(scoped, body, result):
    for reference in (TARGET_TAG, result["remoteManifestDigest"]):
        status, actual, headers = registry_call("GET", "/v2/" + TARGET_REPO + "/manifests/" + reference,
                                                scoped, headers={"Accept": MANIFEST_TYPE})
        if status != 200 or actual != body or headers["digest"] != result["remoteManifestDigest"]:
            fail("MANIFEST_IMMUTABLE_ROUNDTRIP_FAILED")
    result["manifestRoundtrip"] = "PASS"
    digest = "sha256:" + SOURCE_SHA
    status, content, headers = registry_call("GET", "/v2/" + TARGET_REPO + "/blobs/" + digest, scoped)
    if status == 307:
        uri = validate_download_uri(headers["location"] or "", {})
        with download_response(uri, {}) as response:
            if response.status != 200:
                fail("PAYLOAD_REDIRECT_HTTP_" + str(response.status))
            content = response.read(len(PAYLOAD_BYTES) + 1)
    elif status != 200:
        fail("PAYLOAD_READBACK_HTTP_" + str(status))
    if content != PAYLOAD_BYTES or hashlib.sha256(content).hexdigest() != SOURCE_SHA:
        fail("PAYLOAD_READBACK_MISMATCH")
    result.update({"remoteBlobDigest": digest, "blobDigestMatch": "PASS", "artifactReadback": "PASS"})


def production(result, directory):
    result["stage"] = "BUILDER_AUTHENTICATION"
    refresh = managed_refresh()
    tooling = exact_scope(refresh, REPOSITORY, ["pull"])
    result["stage"] = "ORAS_PRIVATE_RETRIEVAL"
    archive = directory / "oras.tar.gz"
    retrieve_archive(tooling, archive, result)
    result["stage"] = "ORAS_SAFE_EXTRACTION"
    executable = extract_oras(archive, directory)
    result["stage"] = "ORAS_LOCAL_ARTIFACT"
    body = create_local_artifact(executable, directory, result)
    result["stage"] = "EFFECTIVE_DATA_PLANE_GATE"
    read_manifest(tooling, EXPECTED_MANIFEST, {})
    result["toolingRead"] = "ALLOWED"
    result["toolingWrite"] = deny_write(refresh, REPOSITORY)
    result["controlWrite"] = deny_write(refresh, CONTROL_REPO)
    writer = exact_scope(refresh, TARGET_REPO, ["pull", "push"])
    result["writeGrant"] = "ALLOWED"
    result["stage"] = "AUTHORIZED_SINGLE_PUSH"
    push_artifact(writer, body, result)
    result["stage"] = "IMMUTABLE_READBACK"
    readback(writer, body, result)
    result["stage"] = "FINAL_TOOLING_DENIAL"
    result["toolingWrite"] = deny_write(refresh, REPOSITORY)
    result["status"] = "PASS"
    result["stage"] = "ARTIFACT_PROVEN"


def production_main():
    result = {"status": "FAIL", "stage": "CONFIGURATION_PRECHECK", "repository": TARGET_REPO,
              "tag": TARGET_TAG, "sourceSha256": SOURCE_SHA, "pushAttemptConsumed": False,
              "manifestCommitAttempts": 0, "authorizedPush": "NOT_RUN", "toolingRead": "NOT_RUN",
              "toolingWrite": "NOT_RUN", "controlWrite": "NOT_RUN", "writeGrant": "NOT_RUN",
              "noSensitiveMaterialPersisted": True, "persistentInstall": False}
    before = None
    directory = None
    try:
        before = configuration_digest()
        with tempfile.TemporaryDirectory(prefix="nzila-g2-synthetic-") as name:
            directory = pathlib.Path(name)
            production(result, directory)
    except (OSError, ValueError, KeyError, TypeError, IndexError, http.client.HTTPException,
            tarfile.TarError, subprocess.TimeoutExpired) as error:
        result.update({"status": "FAIL", "failureStage": error.stage if isinstance(error, ReadbackFailure) else result["stage"],
                       "exceptionClass": type(error).__name__})
    result["workspacePresent"] = directory is not None and directory.exists()
    try:
        after = configuration_digest()
        result["configurationUnchanged"] = before is not None and before == after
        result["configurationAfterSha256"] = after
        if result["workspacePresent"] or not result["configurationUnchanged"]:
            result.update({"status": "FAIL", "failureStage": "CLEANUP_OR_CONFIGURATION_UNPROVEN"})
    except OSError as error:
        result.update({"status": "FAIL", "failureStage": "CONFIGURATION_POSTCHECK",
                       "exceptionClass": type(error).__name__})
    result["capturedAtUtc"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    encoded = encode_result(result)
    print(PRODUCTION_MARKER + encoded[len(MARKER):], flush=True)
    return 0 if result["status"] == "PASS" else 78
