"""One-use producer authority state machine, offline only."""

import hashlib
import json
from pathlib import Path
import uuid

SUB = "5d819f33-d16f-429c-a3c0-5b0e94740ba3"
NAMESPACE = uuid.UUID("af5b3bfd-4808-4de7-b875-e302bc9aa3b2")
WRITER = "2a1e307c-b015-4ebd-883e-5b7698a07328"
READER = "b93aa761-3e63-49ed-ac28-beffa264f7ac"


class StagingFailure(RuntimeError):
    pass


def assignment_id(scope, principal, role, repository, transaction):
    authority = "\n".join((scope.lower(), principal.lower(), role.lower(), repository, transaction))
    return str(uuid.uuid5(NAMESPACE, authority))


class Staging:
    def __init__(self, source_digest, tooling_digest):
        self.expected = {"g3-build-source": source_digest, "g3-build-tooling": tooling_digest}
        self.phase, self.attempted, self.completed = "BASELINE", set(), {}

    def begin(self, executor_verified, two_exact_writer_grants, collisions_absent, maximum_hours):
        if self.phase != "BASELINE" or not executor_verified or not two_exact_writer_grants or not collisions_absent or maximum_hours != 1:
            raise StagingFailure("STAGING_BASELINE_NOT_BOUND")
        self.phase = "SOURCE"

    def push_once(self, repository, push_operation, immutable_readback):
        required = "g3-build-source" if self.phase == "SOURCE" else "g3-build-tooling" if self.phase == "TOOLING" else None
        if repository != required or repository in self.attempted:
            raise StagingFailure("STAGING_SEQUENCE_OR_REUSE")
        self.attempted.add(repository)
        try:
            push_operation()
            digest = immutable_readback()
            if digest != self.expected[repository]:
                raise StagingFailure("STAGING_IMMUTABLE_READBACK_MISMATCH")
        except BaseException:
            self.phase = "FAILED"
            raise
        self.completed[repository] = digest
        self.phase = "TOOLING" if repository == "g3-build-source" else "CLOSE_AUTHORITY"

    def close(self, authority_consumed, writer_assignments_absent, public_disabled, private_endpoint_active, dns_active):
        if self.phase != "CLOSE_AUTHORITY" or not all((
            authority_consumed, writer_assignments_absent, public_disabled, private_endpoint_active, dns_active,
        )):
            raise StagingFailure("LOCKDOWN_NOT_PROVEN")
        self.phase = "TERMINAL_PASS"

    def build_allowed(self):
        return self.phase == "TERMINAL_PASS"


def grants(input_registry_id, producer_id, input_reader_id, transaction_id):
    if input_registry_id.endswith("/nzilag2tzo75uuozprbo") or producer_id == input_reader_id:
        raise StagingFailure("INPUT_GRANT_BOUNDARY_INVALID")
    entries = []
    for principal, role in ((producer_id, WRITER), (input_reader_id, READER)):
        for repository in ("g3-build-source", "g3-build-tooling"):
            entries.append({
                "scope": input_registry_id, "principalId": principal, "roleDefinitionId": role,
                "repository": repository, "conditionVersion": "2.0",
                "condition": "@Request[Microsoft.ContainerRegistry/registries/repositories:name] "
                             "StringEqualsIgnoreCase '" + repository + "'",
                "assignmentId": assignment_id(input_registry_id, principal, role, repository, transaction_id),
            })
    return entries
