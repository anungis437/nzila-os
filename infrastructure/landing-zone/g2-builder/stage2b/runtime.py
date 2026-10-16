CLIENT = "ccea7b0f-a4ec-4665-ba9d-ab5071e165aa"
PRINCIPAL = "b150b19a-645d-493f-9bb4-0aa81cb0c449"
RUNTIME_MARKER = "NZILA_G2_STAGE2B_RESULT="
SOURCE_SHA = "2457502e49df5a77cd6403052c37ad7dc8cce95f3947378aa5e3dcf2f12703db"
SYNTHETIC_REPO = "synthetic-health"
SYNTHETIC_TAG = "stage2a-" + SOURCE_SHA
PAYLOAD_BYTES = base64.b64decode(BOUND_PAYLOAD_BASE64, validate=True)
MANIFEST_DIGEST = LOCAL_MANIFEST_DIGEST
TOOLING_DIGEST = EXPECTED_MANIFEST


class RuntimeProofFailure(ReadbackFailure):
    pass


def stop(stage):
    raise RuntimeProofFailure(stage)


def runtime_call(method, path, scoped=None, body=None):
    allowed = method == "POST" and path in ("/oauth2/exchange", "/oauth2/token")
    allowed |= method == "GET" and path in (
        "/v2/synthetic-health/manifests/" + SYNTHETIC_TAG,
        "/v2/synthetic-health/manifests/" + MANIFEST_DIGEST,
        "/v2/synthetic-health/blobs/sha256:" + SOURCE_SHA,
        "/v2/g2-tooling/manifests/" + TOOLING_DIGEST,
    )
    allowed |= method == "POST" and path in (
        "/v2/synthetic-health/blobs/uploads/", "/v2/g2-tooling/blobs/uploads/")
    if not allowed:
        stop("RUNTIME_REQUEST_NOT_AUTHORIZED")
    if path.endswith("/blobs/uploads/") and body != b"":
        stop("RUNTIME_DENIAL_CONTENT_REJECTED")
    headers = {}
    if path in ("/oauth2/exchange", "/oauth2/token"):
        if scoped is not None:
            stop("RUNTIME_EXCHANGE_HEADER_REJECTED")
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    elif scoped is None:
        stop("RUNTIME_AUTHENTICATED_REQUEST_REQUIRED")
    else:
        headers["Authorization"] = "Bearer " + scoped
    if method == "GET":
        headers["Accept"] = MANIFEST_TYPE
    connection = ObservedConnection(REGISTRY, {}, "RUNTIME_REGISTRY")
    try:
        connection.request(method, path, body=body, headers=headers)
        response = connection.getresponse()
        content = response.read(1024 * 1024 + 1)
        if len(content) > 1024 * 1024:
            stop("RUNTIME_RESPONSE_LIMIT")
        return response.status, content, {
            "digest": response.getheader("Docker-Content-Digest"),
            "location": response.getheader("Location"),
            "contentType": response.getheader("Content-Type", "").split(";")[0].strip(),
        }
    finally:
        connection.close()


def runtime_refresh(result):
    query = urllib.parse.urlencode({"api-version": "2018-02-01", "resource": RESOURCE, "client_id": CLIENT})
    status, body, _ = request("GET", "/metadata/identity/oauth2/token?" + query,
                              headers={"Metadata": "true"}, imds=True)
    if status != 200:
        stop("RUNTIME_IMDS_HTTP_" + str(status))
    access = json.loads(body)["access_token"]
    identity = claims(access)
    if (identity.get("oid") != PRINCIPAL or identity.get("tid") != TENANT
            or identity.get("appid", identity.get("azp")) != CLIENT
            or identity.get("aud") not in (RESOURCE, RESOURCE.rstrip("/"))
            or type(identity.get("exp")) is not int or identity["exp"] <= time.time()):
        stop("RUNTIME_IDENTITY_MISMATCH")
    result["identityAssertion"] = "PASS"
    form = urllib.parse.urlencode({"grant_type": "access_token", "service": REGISTRY,
                                   "tenant": TENANT, "access_token": access})
    status, body, _ = runtime_call("POST", "/oauth2/exchange", body=form)
    if status != 200:
        stop("RUNTIME_EXCHANGE_HTTP_" + str(status))
    return json.loads(body)["refresh_token"]


def runtime_scope(refresh, repo, actions, denied=False):
    if (repo, tuple(actions)) not in (
            (SYNTHETIC_REPO, ("pull",)), (SYNTHETIC_REPO, ("push",)),
            ("g2-tooling", ("pull",)), ("g2-tooling", ("push",))):
        stop("RUNTIME_SCOPE_NOT_AUTHORIZED")
    form = urllib.parse.urlencode({"grant_type": "refresh_token", "service": REGISTRY,
                                   "scope": "repository:" + repo + ":" + ",".join(actions),
                                   "refresh_token": refresh})
    status, body, _ = runtime_call("POST", "/oauth2/token", body=form)
    if status != 200:
        stop("RUNTIME_SCOPED_EXCHANGE_HTTP_" + str(status))
    decoded = json.loads(body)
    scoped = decoded.get("access_token") or decoded["token"]
    grant = claims(scoped)
    if type(grant.get("exp")) is not int or grant["exp"] <= time.time():
        stop("RUNTIME_SCOPED_GRANT_EXPIRED")
    access = grant.get("access")
    if not isinstance(access, list):
        stop("RUNTIME_SCOPED_GRANT_FORM_INVALID")
    normalized = []
    for entry in access:
        if (not isinstance(entry, dict) or set(entry) != {"type", "name", "actions"}
                or not isinstance(entry["actions"], list)
                or any(not isinstance(v, str) for v in entry["actions"])):
            stop("RUNTIME_SCOPED_GRANT_FORM_INVALID")
        if entry["type"] != "repository" or entry["name"] != repo:
            stop("STAGE2B_SECURITY_FAILURE_BROADER_REPOSITORY")
        if entry["actions"]:
            normalized.append({**entry, "actions": sorted(entry["actions"])})
    expected = [] if denied else [{"type": "repository", "name": repo, "actions": sorted(actions)}]
    if normalized != expected:
        stop("STAGE2B_SECURITY_FAILURE_UNEXPECTED_GRANT" if denied else "RUNTIME_READ_GRANT_MISMATCH")
    return scoped


def assert_denial(status, body, operation):
    if status in (200, 201, 202, 204, 307):
        stop("STAGE2B_SECURITY_FAILURE_" + operation)
    if status not in (401, 403):
        stop(operation + "_HTTP_" + str(status))
    try:
        errors = json.loads(body)["errors"]
    except (ValueError, KeyError, TypeError):
        stop(operation + "_DENIAL_RESPONSE_INVALID")
    if (not isinstance(errors, list) or not errors
            or any(not isinstance(v, dict) or v.get("code") not in ("UNAUTHORIZED", "DENIED") for v in errors)):
        stop(operation + "_DENIAL_NOT_AUTHORIZATION")
    return "DENIED"


def runtime_write_denial(refresh, repo):
    scoped = runtime_scope(refresh, repo, ["push"], denied=True)
    status, body, _ = runtime_call("POST", "/v2/" + repo + "/blobs/uploads/", scoped, b"")
    return assert_denial(status, body, "WRITE_" + repo.replace("-", "_").upper())


def runtime_read(refresh, result):
    scoped = runtime_scope(refresh, SYNTHETIC_REPO, ["pull"])
    bodies = []
    for reference in (SYNTHETIC_TAG, MANIFEST_DIGEST):
        status, body, headers = runtime_call("GET", "/v2/synthetic-health/manifests/" + reference, scoped)
        if status != 200:
            stop("RUNTIME_MANIFEST_HTTP_" + str(status))
        if headers["contentType"] != MANIFEST_TYPE or headers["digest"] != MANIFEST_DIGEST:
            stop("RUNTIME_MANIFEST_HEADERS_MISMATCH")
        validate_local_manifest(body, PAYLOAD_BYTES, b"{}")
        bodies.append(body)
    if bodies[0] != bodies[1]:
        stop("RUNTIME_MANIFEST_ROUNDTRIP_MISMATCH")
    result.update({"syntheticRead": "ALLOWED", "remoteManifestDigest": MANIFEST_DIGEST,
                   "remotePayloadDigest": "sha256:" + SOURCE_SHA})
    status, content, headers = runtime_call("GET", "/v2/synthetic-health/blobs/sha256:" + SOURCE_SHA, scoped)
    if status == 307:
        uri = validate_download_uri(headers["location"] or "", {})
        with download_response(uri, {}) as response:
            if response.status != 200:
                stop("RUNTIME_DATA_HTTP_" + str(response.status))
            content = response.read(327)
    elif status != 200:
        stop("RUNTIME_PAYLOAD_HTTP_" + str(status))
    if content != PAYLOAD_BYTES or len(content) != 326 or hashlib.sha256(content).hexdigest() != SOURCE_SHA:
        stop("RUNTIME_PAYLOAD_BYTES_MISMATCH")
    result.update({"payloadSha256": SOURCE_SHA, "payloadSize": 326, "artifactIntegrity": "PASS"})


def private_connectivity(result):
    for host, name in ((REGISTRY, "login"), (DATA_HOST, "data")):
        trace = {}
        connection = ObservedConnection(host, trace, "RUNTIME_" + name.upper())
        try:
            connection.connect()
        finally:
            connection.close()
        result[name + "Endpoint"] = {"ip": trace["REMOTE_IP"], "TLS": trace["TLS"]}
    result.update({"privateDns": "PASS", "privateHttps": "PASS"})


def runtime_proof(result):
    result["stage"] = "PRIVATE_CONNECTIVITY"
    private_connectivity(result)
    result["stage"] = "RUNTIME_IDENTITY"
    refresh = runtime_refresh(result)
    result["stage"] = "SYNTHETIC_HEALTH_READ"
    runtime_read(refresh, result)
    result["stage"] = "SYNTHETIC_HEALTH_WRITE_DENIAL"
    result["syntheticWrite"] = runtime_write_denial(refresh, SYNTHETIC_REPO)
    result["stage"] = "TOOLING_READ_DENIAL"
    scoped = runtime_scope(refresh, "g2-tooling", ["pull"], denied=True)
    status, body, _ = runtime_call("GET", "/v2/g2-tooling/manifests/" + TOOLING_DIGEST, scoped)
    result["toolingRead"] = assert_denial(status, body, "TOOLING_READ")
    result["stage"] = "TOOLING_WRITE_DENIAL"
    result["toolingWrite"] = runtime_write_denial(refresh, "g2-tooling")
    result.update({"status": "PASS", "stage": "RUNTIME_IDENTITY_PROVEN"})


def runtime_main():
    result = {"status": "FAIL", "stage": "CONFIGURATION_PRECHECK",
              "identityAssertion": "NOT_RUN", "privateDns": "NOT_RUN", "privateHttps": "NOT_RUN",
              "syntheticRead": "NOT_RUN", "syntheticWrite": "NOT_RUN", "artifactIntegrity": "NOT_RUN",
              "toolingRead": "NOT_RUN", "toolingWrite": "NOT_RUN", "noSensitiveMaterialPersisted": True}
    before = None
    try:
        before = configuration_digest()
        runtime_proof(result)
    except (OSError, ValueError, KeyError, TypeError, IndexError, http.client.HTTPException) as error:
        result.update({"status": "FAIL",
                       "failureStage": error.stage if isinstance(error, ReadbackFailure) else result["stage"],
                       "exceptionClass": type(error).__name__})
    try:
        after = configuration_digest()
        result["configurationUnchanged"] = before is not None and before == after
        if not result["configurationUnchanged"]:
            result.update({"status": "FAIL", "failureStage": "RUNTIME_CONFIGURATION_CHANGED"})
    except OSError as error:
        result.update({"status": "FAIL", "failureStage": "RUNTIME_CONFIGURATION_POSTCHECK",
                       "exceptionClass": type(error).__name__})
    result["capturedAtUtc"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    encoded = encode_result(result)
    print(RUNTIME_MARKER + encoded[len(MARKER):], flush=True)
    return 0 if result["status"] == "PASS" else 78
