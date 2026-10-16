"""Strict capacity and future-authority validation; no permissive execution default."""

import hashlib
import json

MAXIMA = {
    "buildRootBytes": 1073741824,
    "buildRootInodes": 32768,
    "tmpBytes": 268435456,
    "tmpInodes": 4096,
}


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def digest(value):
    raw = json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(raw).hexdigest()


def capacity(config):
    require(isinstance(config, dict) and set(config) == set(MAXIMA), "EXACT_CAPACITY_FIELDS_REQUIRED")
    for name, maximum in MAXIMA.items():
        value = config[name]
        require(type(value) is int and 0 < value <= maximum, "INVALID_CAPACITY_" + name)
    require(config["buildRootBytes"] % 4096 == config["tmpBytes"] % 4096 == 0,
            "EXACT_PAGE_ALIGNED_BYTE_CAPACITY_REQUIRED")
    return dict(config)


def effective(config, observed):
    config = capacity(config)
    require(isinstance(observed, dict) and set(observed) == {"build", "tmp"}, "EFFECTIVE_CAPACITY_CENSUS")
    for resource, prefix in (("build", "buildRoot"), ("tmp", "tmp")):
        value = observed[resource]
        require(value["filesystemType"] == "TMPFS" and
                value["totalBytes"] == config[prefix + "Bytes"] and
                value["totalInodes"] == config[prefix + "Inodes"], "EFFECTIVE_LIMIT_MISMATCH_" + resource)
        require(value["rw"] and value["exec"] and value["nosuid"] and value["nodev"],
                "EFFECTIVE_MOUNT_FLAGS_MISMATCH_" + resource)
    return config


def authorize(authority, *, expected_digest, transaction, payload_digest, config, consumed):
    config = capacity(config)
    require(isinstance(expected_digest, str) and len(expected_digest) == 64 and
            all(char in "0123456789abcdef" for char in expected_digest), "FUTURE_AUTHORITY_DIGEST_REQUIRED")
    require(isinstance(authority, dict) and set(authority) ==
            {"schema", "mission", "transaction", "payloadSha256", "capacity", "consumed"},
            "MALFORMED_AUTHORITY")
    require(authority["schema"] == "g3a-execution-authority/v1" and
            authority["mission"] == "NZ-20261008-INFRA-001", "WRONG_AUTHORITY_IDENTITY")
    require(authority["consumed"] is False and consumed is False, "AUTHORITY_CONSUMED")
    require(authority["transaction"] == transaction, "WRONG_TRANSACTION_IDENTITY")
    require(isinstance(payload_digest, str) and len(payload_digest) == 64 and
            all(char in "0123456789abcdef" for char in payload_digest) and
            authority["payloadSha256"] == payload_digest, "PAYLOAD_DIGEST_MISMATCH")
    require(capacity(authority["capacity"]) == config, "CAPACITY_CONTRACT_MISMATCH")
    require(digest(authority) == expected_digest, "AUTHORITY_DIGEST_MISMATCH")
    return config


def production_entrypoint(*_args, **_kwargs):
    raise RuntimeError("G3A_PRODUCTION_AUTHORITY_NOT_ISSUED_NO_RUNNER_DISPATCH")
