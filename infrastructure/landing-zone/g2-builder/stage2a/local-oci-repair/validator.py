import base64
import hashlib
import json

LOCAL_MANIFEST_DIGEST = "sha256:13fbd3f9de68376f8e55af8ce64172eec3ae65a73b9ce70f9d26e73271bef690"
EXPECTED_PAYLOAD_BLOB_DIGEST = "sha256:2457502e49df5a77cd6403052c37ad7dc8cce95f3947378aa5e3dcf2f12703db"
EXPECTED_CONFIG = {
    "mediaType": "application/vnd.oci.empty.v1+json",
    "digest": "sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a",
    "size": 2,
    "data": "e30=",
}
EXPECTED_LAYER = {
    "mediaType": "application/vnd.nzila.g2.synthetic-health.v1+json",
    "digest": EXPECTED_PAYLOAD_BLOB_DIGEST,
    "size": 326,
    "annotations": {"org.opencontainers.image.title": "synthetic-health.json"},
}
EXPECTED_ANNOTATIONS = {"org.opencontainers.image.created": "2000-01-01T00:00:00Z"}


class ManifestContractError(ValueError):
    pass


def unique_object(pairs):
    value = {}
    for key, child in pairs:
        if key in value:
            raise ManifestContractError("LOCAL_MANIFEST_DUPLICATE_FIELD")
        value[key] = child
    return value


def validate_local_manifest(body, payload, config):
    if hashlib.sha256(payload).hexdigest() != EXPECTED_PAYLOAD_BLOB_DIGEST.split(":")[1] or len(payload) != 326:
        raise ManifestContractError("LOCAL_PAYLOAD_BYTES_MISMATCH")
    if config != b"{}":
        raise ManifestContractError("LOCAL_CONFIG_BYTES_MISMATCH")
    try:
        value = json.loads(body, object_pairs_hook=unique_object)
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise ManifestContractError("LOCAL_MANIFEST_JSON_INVALID") from None
    if not isinstance(value, dict):
        raise ManifestContractError("LOCAL_MANIFEST_OBJECT_REQUIRED")
    if set(value) != {"schemaVersion", "mediaType", "artifactType", "config", "layers", "annotations"}:
        raise ManifestContractError("LOCAL_MANIFEST_TOP_LEVEL_FIELDS")
    if type(value["schemaVersion"]) is not int or value["schemaVersion"] != 2:
        raise ManifestContractError("LOCAL_MANIFEST_SCHEMA_VERSION")
    if value["mediaType"] != "application/vnd.oci.image.manifest.v1+json":
        raise ManifestContractError("LOCAL_MANIFEST_MEDIA_TYPE")
    if value["artifactType"] != "application/vnd.nzila.g2.synthetic-health.v1":
        raise ManifestContractError("LOCAL_MANIFEST_ARTIFACT_TYPE")
    if value["config"] != EXPECTED_CONFIG or type(value["config"].get("size")) is not int:
        raise ManifestContractError("LOCAL_CONFIG_DESCRIPTOR_MISMATCH")
    embedded = base64.b64decode(value["config"]["data"], validate=True)
    if embedded != config or "sha256:" + hashlib.sha256(config).hexdigest() != value["config"]["digest"]:
        raise ManifestContractError("LOCAL_CONFIG_EMBEDDED_BYTES_MISMATCH")
    if value["layers"] != [EXPECTED_LAYER] or type(value["layers"][0].get("size")) is not int:
        raise ManifestContractError("LOCAL_LAYER_DESCRIPTOR_MISMATCH")
    if value["annotations"] != EXPECTED_ANNOTATIONS:
        raise ManifestContractError("LOCAL_MANIFEST_ANNOTATIONS_MISMATCH")
    if "sha256:" + hashlib.sha256(body).hexdigest() != LOCAL_MANIFEST_DIGEST:
        raise ManifestContractError("LOCAL_MANIFEST_BYTE_DIGEST_MISMATCH")
    return value
