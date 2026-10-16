import urllib.request

READBACK_MARKER = "NZILA_G2_EMPTY_PATH_RESULT="


class PinnedDownloadHandler(urllib.request.HTTPSHandler):
    def __init__(self, evidence):
        super().__init__(context=ssl.create_default_context())
        self.evidence = evidence

    def https_open(self, request):
        if request.host != DATA_HOST or request.type != "https":
            raise ReadbackFailure("DATA_ENDPOINT_HOST_UNEXPECTED")
        if request.has_header("Authorization") or request.has_header("Proxy-Authorization"):
            raise ReadbackFailure("DATA_ENDPOINT_CREDENTIAL_FORWARDING_REJECTED")

        def connection(host, **kwargs):
            if host != DATA_HOST:
                raise ReadbackFailure("DATA_ENDPOINT_HOST_UNEXPECTED")
            return ObservedConnection(host, self.evidence, "DATA_ENDPOINT")

        return self.do_open(connection, request)


class ExactResponseProcessor(urllib.request.HTTPErrorProcessor):
    def http_response(self, request, response):
        return response

    https_response = http_response


def download_response(location, evidence):
    opener = urllib.request.build_opener(
        urllib.request.ProxyHandler({}), PinnedDownloadHandler(evidence), ExactResponseProcessor())
    request = urllib.request.Request(location, headers={}, method="GET")
    return opener.open(request, timeout=30)


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
            raise ReadbackFailure("INITIAL_BLOB_HTTP_" + str(response.status))
        result["ACTIVE_STAGE"] = "REDIRECT_VALIDATION_FAILED"
        try:
            location = validate_download_uri(response.getheader("Location", ""), result["REDIRECT"])
        except ReadbackFailure as error:
            result["REDIRECT"].update({"CURRENT_REDIRECT_VALIDATION": "FAIL",
                                       "CURRENT_REDIRECT_FAILURE_PREDICATE": error.stage})
            raise
    finally:
        connection.close()
    result["ACTIVE_STAGE"] = "DATA_ENDPOINT_REQUEST_FAILED"
    result["REDIRECT_COUNT"] = 1
    result["REGISTRY_AUTH_HEADER_FORWARDED_TO_DATA_ENDPOINT"] = "NO"
    data = result["DATA_ENDPOINT"]
    with download_response(location, data) as response:
        data["HTTP_STATUS"] = response.status
        if response.status != 200:
            raise ReadbackFailure("DATA_ENDPOINT_HTTP_" + str(response.status))
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
            raise ReadbackFailure("TARGET_ARCHIVE_SHA_MISMATCH")
        result.update({"SOURCE_TARGET_ARTIFACT_EQUIVALENCE": "PASS", "status": "PASS",
                       "ACTIVE_STAGE": "READBACK_PROVEN"})
