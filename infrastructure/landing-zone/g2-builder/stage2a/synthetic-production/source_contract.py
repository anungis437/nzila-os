import hashlib
import json
import pathlib
import sys

CONTRACT = {
    "schema": "nzila.g2.synthetic-health.source-contract.v1",
    "mission": "NZ-20261008-INFRA-001",
    "gate": "G2_PRIVATE_CONTROL_PLANE",
    "slice": "G2_STAGE2A_SYNTHETIC_ARTIFACT_PRODUCTION",
    "classification": "SYNTHETIC_ONLY",
    "logical_artifact_version": "1",
    "registry": "nzilag2tzo75uuozprbo.azurecr.io",
    "repository": "synthetic-health",
    "artifact_type": "application/vnd.nzila.g2.synthetic-health.v1",
    "payload_media_type": "application/vnd.nzila.g2.synthetic-health.v1+json",
    "payload_filename": "synthetic-health.json",
    "builder_client_id": "d4775ade-6d53-419a-a80f-c17ffbaa125f",
    "builder_principal_id": "c59571aa-66ea-47c5-83d5-59946b318ae2",
    "tenant_id": "5082b8be-b04d-4a13-b61c-b6397670177b",
    "authorization_matrix": {
        "builder": {"synthetic-health": ["pull", "push"], "g2-tooling": ["pull"]},
        "runtime": {"synthetic-health": ["pull"], "g2-tooling": []},
        "denied_control_repository": "synthetic-health-denied-control",
    },
    "oras_archive_sha256": "f27adb935022d94df8dc77719c322dda592c78a0d57a6f7dcdd8d900b248c454",
    "oras_version": "1.3.4",
}


def canonical(value):
    return (json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True) + "\n").encode("ascii")


def source_binding():
    contract_bytes = canonical(CONTRACT)
    contract_sha = hashlib.sha256(contract_bytes).hexdigest()
    payload = {
        key: CONTRACT[key]
        for key in ("mission", "gate", "slice", "classification", "logical_artifact_version")
    }
    payload.update({"schema": "nzila.g2.synthetic-health.v1", "source_authority_digest": "sha256:" + contract_sha})
    payload_bytes = canonical(payload)
    payload_sha = hashlib.sha256(payload_bytes).hexdigest()
    return contract_bytes, payload_bytes, {
        "SOURCE_CONTRACT_SHA256": contract_sha,
        "SYNTHETIC_SOURCE_SHA256": payload_sha,
        "LOCAL_PAYLOAD_SHA256": payload_sha,
        "LOCAL_PAYLOAD_OCI_DIGEST": "sha256:" + payload_sha,
        "TARGET_REPOSITORY": CONTRACT["repository"],
        "TARGET_TAG": "stage2a-" + payload_sha,
        "ARTIFACT_TYPE": CONTRACT["artifact_type"],
        "PAYLOAD_MEDIA_TYPE": CONTRACT["payload_media_type"],
        "PAYLOAD_SIZE": len(payload_bytes),
        "sourceRelationship": "Payload includes canonical source-contract digest; tag derives from payload hash. No self-referential hash.",
        "bindingOnly": True,
        "executionSourceAuthorityCreated": False,
        "executionAuthorityConsumed": False,
    }


def bind(directory):
    contract_bytes, payload_bytes, binding = source_binding()
    prefix = "G2_SYNTHETIC_PRODUCTION_"
    outputs = {
        prefix + "SOURCE_CONTRACT.json": contract_bytes,
        prefix + "PAYLOAD.json": payload_bytes,
        prefix + "PAYLOAD_BINDING.json": canonical(binding),
    }
    for name in outputs:
        if (directory / name).exists():
            raise FileExistsError(name)
    for name, body in outputs.items():
        with (directory / name).open("xb") as stream:
            stream.write(body)
    print(json.dumps(binding, indent=2))


if __name__ == "__main__":
    bind(pathlib.Path(sys.argv[1]))
