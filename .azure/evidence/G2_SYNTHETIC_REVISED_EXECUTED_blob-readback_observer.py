import ipaddress

EXPECTED_MANIFEST = "sha256:644f66c67367de24eeb3c5d921d7cd31c59afe3d3965e7e82c41e104fdcc2f0f"
READBACK_MARKER = "NZILA_G2_BLOB_READBACK_RESULT="


class ReadbackFailure(ValueError):
    def __init__(self, stage):
        super().__init__(stage)
        self.stage = stage


class ObservedConnection(http.client.HTTPSConnection):
    def __init__(self, host, evidence, prefix):
        super().__init__(host, timeout=30, context=ssl.create_default_context())
        self.evidence = evidence
        self.prefix = prefix

    def connect(self):
        prefix = self.prefix
        self.evidence.update({"HOST": self.host, "HTTP_HOST": self.host, "TLS_SNI_HOST": self.host})
        if self.host not in PRIVATE_ENDPOINTS:
            raise ReadbackFailure(prefix + "_HOST_UNEXPECTED")
        try:
            addresses = sorted({v[4][0] for v in socket.getaddrinfo(self.host, 443, type=socket.SOCK_STREAM)})
        except OSError as error:
            self.evidence["EXCEPTION_CLASS"] = type(error).__name__
            raise ReadbackFailure(prefix + "_DNS_FAILED") from None
        self.evidence["RESOLVED_IPS"] = addresses
        self.evidence["PRIVATE"] = bool(addresses) and all(ipaddress.ip_address(v).is_private for v in addresses)
        if addresses != [PRIVATE_ENDPOINTS[self.host]]:
            raise ReadbackFailure(prefix + "_PRIVATE_IP_MISMATCH")
        try:
            raw = socket.create_connection((addresses[0], 443), self.timeout)
        except OSError as error:
            self.evidence["EXCEPTION_CLASS"] = type(error).__name__
            raise ReadbackFailure(prefix + "_CONNECT_FAILED") from None
        try:
            self.sock = self._context.wrap_socket(raw, server_hostname=self.host)
        except ssl.SSLCertVerificationError as error:
            raw.close()
            self.evidence.update({"TLS": "FAIL", "TLS_ERROR_CATEGORY": "CERTIFICATE_VALIDATION",
                                  "EXCEPTION_CLASS": type(error).__name__})
            raise ReadbackFailure(prefix + "_TLS_FAILED") from None
        except ssl.SSLError as error:
            raw.close()
            self.evidence.update({"TLS": "FAIL", "TLS_ERROR_CATEGORY": "HANDSHAKE",
                                  "EXCEPTION_CLASS": type(error).__name__})
            raise ReadbackFailure(prefix + "_TLS_FAILED") from None
        except OSError as error:
            raw.close()
            self.evidence.update({"TLS": "FAIL", "TLS_ERROR_CATEGORY": "TRANSPORT",
                                  "EXCEPTION_CLASS": type(error).__name__})
            raise ReadbackFailure(prefix + "_TLS_FAILED") from None
        self.evidence.update({"TLS": "PASS", "CERTIFICATE_HOSTNAME_VALIDATED": True,
                              "REMOTE_IP": self.sock.getpeername()[0]})
        if self.evidence["REMOTE_IP"] != PRIVATE_ENDPOINTS[self.host]:
            self.close()
            raise ReadbackFailure(prefix + "_PRIVATE_PEER_MISMATCH")


def read_manifest(scoped, reference, evidence):
    connection = ObservedConnection(REGISTRY, evidence, "MANIFEST_ENDPOINT")
    try:
        connection.request("GET", "/v2/g2-tooling/manifests/" + reference,
                           headers={"Authorization": "Bearer " + scoped, "Accept": MANIFEST_TYPE})
        response = connection.getresponse()
        evidence["HTTP_STATUS"] = response.status
        content_type = response.getheader("Content-Type", "").split(";")[0].strip()
        evidence["CONTENT_TYPE"] = MANIFEST_TYPE if content_type == MANIFEST_TYPE else "UNEXPECTED"
        if response.status != 200 or content_type != MANIFEST_TYPE:
            raise ReadbackFailure("MANIFEST_READ_FAILED")
        body = response.read(1024 * 1024 + 1)
        if len(body) > 1024 * 1024:
            raise ReadbackFailure("MANIFEST_RESPONSE_LIMIT")
        evidence["MANIFEST_DIGEST"] = "sha256:" + hashlib.sha256(body).hexdigest()
        payload = check_manifest(body, response.getheader("Docker-Content-Digest"), EXPECTED_MANIFEST)
        value = json.loads(body)
        if value.get("config") != {"mediaType": "application/vnd.oci.empty.v1+json",
                                   "digest": "sha256:" + hashlib.sha256(b"{}").hexdigest(),
                                   "size": 2}:
            raise ReadbackFailure("MANIFEST_CONFIG_MISMATCH")
        evidence.update({"ARTIFACT_TYPE": ARTIFACT_TYPE, "BLOB_DIGEST": payload["digest"],
                         "BLOB_SIZE": payload["size"], "BLOB_MEDIA_TYPE": payload["mediaType"]})
        return body, payload
    finally:
        connection.close()


def approved_redirect(location, evidence):
    evidence["PRESENT"] = bool(location)
    if not location:
        raise ReadbackFailure("BLOB_REDIRECT_MISSING")
    if any(ord(v) <= 32 for v in location) or "\\" in location:
        raise ReadbackFailure("BLOB_REDIRECT_INVALID")
    try:
        url = urllib.parse.urlsplit(location)
        port = url.port
    except ValueError:
        raise ReadbackFailure("BLOB_REDIRECT_INVALID") from None
    evidence.update({"SCHEME": "https" if url.scheme == "https" else "UNAPPROVED",
                     "HOST": DATA_HOST if url.hostname == DATA_HOST else "UNAPPROVED",
                     "PORT": port, "QUERY_PRESENT": bool(url.query), "PATH_CATEGORY": "OPAQUE_BLOB_DOWNLOAD"})
    if url.scheme != "https" or url.hostname != DATA_HOST or port not in (None, 443):
        raise ReadbackFailure("BLOB_REDIRECT_HOST_UNEXPECTED")
    if url.username or url.password or url.fragment or not url.path.startswith("/") or url.path.startswith("//"):
        raise ReadbackFailure("BLOB_REDIRECT_INVALID")
    return url.path + ("?" + url.query if url.query else "")


def stream_blob(scoped, payload, result):
    initial = result["BLOB_REGISTRY"]
    connection = ObservedConnection(REGISTRY, initial, "BLOB_REGISTRY")
    try:
        result["ACTIVE_STAGE"] = "BLOB_REGISTRY_REQUEST_FAILED"
        connection.request("GET", "/v2/g2-tooling/blobs/" + payload["digest"],
                           headers={"Authorization": "Bearer " + scoped})
        response = connection.getresponse()
        initial["HTTP_STATUS"] = response.status
        if response.status != 307:
            raise ReadbackFailure("BLOB_REGISTRY_HTTP_" + str(response.status))
        result["ACTIVE_STAGE"] = "BLOB_REDIRECT_INVALID"
        path = approved_redirect(response.getheader("Location", ""), result["REDIRECT"])
    finally:
        connection.close()
    data = result["DATA_ENDPOINT"]
    connection = ObservedConnection(DATA_HOST, data, "DATA_ENDPOINT")
    try:
        result["ACTIVE_STAGE"] = "DATA_ENDPOINT_REQUEST_FAILED"
        result["REDIRECT_COUNT"] = 1
        connection.request("GET", path, headers={})
        response = connection.getresponse()
        data["HTTP_STATUS"] = response.status
        if response.status != 200:
            stage = "DATA_ENDPOINT_HTTP_5XX" if 500 <= response.status < 600 else "DATA_ENDPOINT_HTTP_" + str(response.status)
            raise ReadbackFailure(stage)
        result["ACTIVE_STAGE"] = "DATA_ENDPOINT_BODY_READ_FAILED"
        length = response.getheader("Content-Length")
        data["CONTENT_LENGTH"] = int(length) if length is not None else None
        if length is not None and data["CONTENT_LENGTH"] != payload["size"]:
            raise ReadbackFailure("DATA_ENDPOINT_CONTENT_LENGTH_MISMATCH")
        digest, count = hashlib.sha256(), 0
        data["BYTES_READ"] = 0
        while True:
            chunk = response.read(65536)
            if not chunk:
                break
            count += len(chunk)
            data["BYTES_READ"] = count
            if count > payload["size"]:
                raise ReadbackFailure("DATA_ENDPOINT_BODY_SIZE_OVERFLOW")
            digest.update(chunk)
        result["TARGET_ARCHIVE_SHA256"] = digest.hexdigest()
        if count != payload["size"] or digest.hexdigest() != ARCHIVE_SHA:
            raise ReadbackFailure("DATA_ENDPOINT_ARCHIVE_HASH_MISMATCH")
        result.update({"SOURCE_TARGET_ARTIFACT_EQUIVALENCE": "PASS", "status": "PASS",
                       "ACTIVE_STAGE": "READBACK_PROVEN"})
    finally:
        connection.close()


def collect_readback(result):
    result["ACTIVE_STAGE"] = "AUTHENTICATION_FAILED"
    scoped = authenticate()
    result["IDENTITY_AND_EXACT_PULL_GRANT"] = "PASS"
    result["ACTIVE_STAGE"] = "MANIFEST_READ_FAILED"
    body, payload = read_manifest(scoped, TAG, result["MANIFEST"])
    result["ACTIVE_STAGE"] = "MANIFEST_DIGEST_READ_FAILED"
    by_digest, _ = read_manifest(scoped, EXPECTED_MANIFEST, result["DIGEST_MANIFEST"])
    if by_digest != body:
        raise ReadbackFailure("MANIFEST_IMMUTABLE_ROUNDTRIP_MISMATCH")
    stream_blob(scoped, payload, result)


def run_readback():
    result = {"status": "FAIL", "repository": REPOSITORY, "tag": TAG, "scope": SCOPE,
              "SOURCE_TARGET_ARTIFACT_EQUIVALENCE": "UNRESOLVED", "MANIFEST": {}, "DIGEST_MANIFEST": {},
              "BLOB_REGISTRY": {}, "REDIRECT": {}, "DATA_ENDPOINT": {}, "REDIRECT_COUNT": 0,
              "ARCHIVE_DURABLE_FILE_CREATED": False, "ARCHIVE_EXTRACTED": False, "ARCHIVE_EXECUTED": False}
    result["ACTIVE_STAGE"] = "CONFIGURATION_READ_FAILED"
    before = None
    try:
        before = configuration_digest()
        result["configurationBeforeSha256"] = before
        collect_readback(result)
    except (OSError, ValueError, KeyError, IndexError, TypeError, http.client.HTTPException) as error:
        result["FAILURE_STAGE"] = error.stage if isinstance(error, ReadbackFailure) else result["ACTIVE_STAGE"]
        result["EXCEPTION_CLASS"] = type(error).__name__
    try:
        after = configuration_digest()
        result.update({"configurationAfterSha256": after, "configurationUnchanged": before is not None and before == after})
        if before is None or before != after:
            result.update({"status": "FAIL", "FAILURE_STAGE": "CONFIGURATION_CHANGED_OR_UNPROVEN"})
    except OSError as error:
        result.update({"status": "FAIL", "FAILURE_STAGE": "CONFIGURATION_READ_FAILED",
                       "EXCEPTION_CLASS": type(error).__name__})
    result["capturedAtUtc"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    encoded = encode_result(result)
    print(READBACK_MARKER + encoded[len(MARKER):], flush=True)
    return 0 if result["status"] == "PASS" else 78
