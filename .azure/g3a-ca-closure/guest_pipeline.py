"""Source-wired pipeline candidate; guest runtime delivery is NOT qualified."""

from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
from typing import Callable

from frozen import BINDING_SHA, CORE_SHA, PROOF_SHA, checked


@dataclass(frozen=True)
class PipelineBinding:
    input_bindings: tuple
    members: dict
    source_payload: str
    tooling_payload: str
    reader_client_id: str
    push_client_id: str
    target_registry: str
    target_tag: str
    private_subnet: str
    denied_repository: str

    def validate(self, registry) -> None:
        if self.reader_client_id == self.push_client_id:
            raise RuntimeError("IDENTITY_BOUNDARY_REQUIRED")
        if len(self.input_bindings) != 2 or {b.repository for b in self.input_bindings} != {
                "g3-build-source", "g3-build-tooling"}:
            raise RuntimeError("EXACT_TWO_INPUT_ARTIFACTS_REQUIRED")
        for item in self.input_bindings:
            item.validate()
            if item.client_id != self.reader_client_id:
                raise RuntimeError("INPUT_IDENTITY_MISMATCH")
        by_repo = {item.repository: item for item in self.input_bindings}
        if len({(b.registry, b.data_host) for b in self.input_bindings}) != 1:
            raise RuntimeError("SINGLE_PRIVATE_INPUT_REGISTRY_REQUIRED")
        if (by_repo["g3-build-source"].payload_sha256 != self.source_payload or
                by_repo["g3-build-tooling"].payload_sha256 != self.tooling_payload or
                by_repo["g3-build-tooling"].artifact_type != "application/vnd.nzila.g3.portable-inputs.v1"):
            raise RuntimeError("PORTABLE_INPUT_ARTIFACT_BINDING")
        if set(self.members) != {self.tooling_payload}:
            raise RuntimeError("EXACT_PORTABLE_ARCHIVE_CENSUS_REQUIRED")
        registry.validate_host(self.target_registry)
        if (self.private_subnet != "10.91.3.0/24" or
                self.denied_repository in {"g3-synthetic-runtime", "g3-build-source", "g3-build-tooling"}):
            raise RuntimeError("PRIVATE_ROUTE_OR_NEGATIVE_SCOPE_BINDING")


class GuestPipeline:
    """Uses real qualified HTTP reader/uploader; tests inject only transports/build."""

    def __init__(self, modules: dict, binding: PipelineBinding, build_runner: Callable,
                 connection_factory=None, imds_factory=None):
        self.registry = modules["registry"]
        self.core = modules["controller"]
        self.reader = modules["sealed_reader"]
        binding.validate(self.registry)
        self.binding = binding
        self.factory = connection_factory or self.registry.private_factory(binding.private_subnet)
        self.imds_factory = imds_factory
        self.build_runner = build_runner
        self.started = False

    def token(self, client_id: str) -> str:
        return (self.registry.acquire_imds(client_id, self.imds_factory) if self.imds_factory
                else self.registry.acquire_imds(client_id))

    def retrieve(self, workspace: Path) -> dict:
        b = self.binding
        reader = self.core.GuestPipeline(b.input_bindings, self.factory, self.imds_factory)
        # The qualified helper explicitly needs a factory; use the standard one when omitted.
        if self.imds_factory is None:
            import http.client
            reader.imds_factory = http.client.HTTPConnection
        evidence = reader.retrieve_inputs(workspace, b.members)
        inputs = workspace / b.tooling_payload
        frozen_binding = json.loads(checked(inputs / "binding.json", BINDING_SHA))
        expected = frozen_binding["inputs"]
        if set(b.members[b.tooling_payload]) != {*expected, "binding.json"}:
            raise RuntimeError("PORTABLE_CORE_INPUT_CENSUS")
        for name, entry in expected.items():
            raw = checked(inputs / name, entry["sha256"])
            if len(raw) != entry["bytes"]:
                raise RuntimeError("PORTABLE_CORE_INPUT_BYTES")
        source = workspace / (b.source_payload + ".payload")
        if hashlib.sha256(source.read_bytes()).hexdigest() != expected["source.tar"]["sha256"]:
            raise RuntimeError("SOURCE_AND_CORE_BINDING_MISMATCH")
        checked(inputs / "portable-assembler", CORE_SHA)
        return {"inputs": inputs, "evidence": evidence}

    def build(self, inputs: Path, work: Path, output: Path) -> dict:
        # The core rejects /etc/ssl/certs and host compiler paths. This runner must
        # provide a new root/mount namespace, not merely clear PATH on Ubuntu.
        if not getattr(self.build_runner, "isolated_root", False):
            raise RuntimeError("QUALIFIED_ISOLATED_BUILD_RUNNER_REQUIRED")
        output.mkdir(mode=0o700)
        builder = self.core.GuestPipeline((), self.factory, self.imds_factory, self.build_runner)
        result = builder.build(inputs / "portable-assembler", inputs, work, output, CORE_SHA)
        self.registry.validate_layout(output / "oci")
        return result

    def push(self, layout: Path) -> dict:
        b = self.binding
        session = self.registry.RegistrySession(b.target_registry, self.registry.TARGET, self.factory)
        uploader = self.registry.Uploader(session, b.target_tag)
        token = self.token(b.push_client_id)
        try:
            return uploader.push(layout, token)
        finally:
            token = None
            session.erase()

    def negatives(self) -> list:
        b = self.binding
        cases = [
            (b.reader_client_id, b.input_bindings[0].registry, "g3-build-source", "WRITE"),
            (b.push_client_id, b.input_bindings[0].registry, "g3-build-source", "READ"),
            (b.push_client_id, b.target_registry, b.denied_repository, "READ"),
            (b.push_client_id, b.target_registry, b.denied_repository, "WRITE"),
        ]
        results = []
        for identity, host, repository, operation in cases:
            session = self.registry.RegistrySession(host, repository, self.factory)
            token = self.token(identity)
            try:
                result = self.registry.probe(session, identity, operation, token, self.registry.MANIFEST)
            finally:
                token = None
                session.erase()
            if result["classification"] != "AUTHENTICATED_DENIAL":
                raise RuntimeError("NEGATIVE_ABAC_NOT_PROVEN")
            results.append(result)
        return results

    def run_candidate(self, workspace: Path) -> dict:
        if self.started:
            raise RuntimeError("PIPELINE_SINGLE_USE")
        self.started = True
        retrieved = self.retrieve(workspace)
        output = workspace / "output"
        build = self.build(retrieved["inputs"], workspace / "work", output)
        push = self.push(output / "oci")
        negatives = self.negatives()
        return {"retrieval": retrieved["evidence"], "build": build, "push": push,
                "negativeAuthorization": negatives,
                "qualification": "SOURCE_CANDIDATE_NOT_GUEST_EXECUTION_PROOF"}


def validate_delivery(binding: dict) -> None:
    if binding.get("bootstrapSha256") == PROOF_SHA:
        raise RuntimeError("MARKER_ONLY_PROOF_IS_NOT_RUNTIME_PIPELINE")
    if binding.get("qualified") is not True or binding.get("isolatedBuildQualified") is not True:
        raise RuntimeError("SEPARATE_GUEST_DELIVERY_QUALIFICATION_REQUIRED")
    required = ("bootstrapSha256", "runtimeCapsuleSha256", "sourcePackageSha256", "tlsCaSha256")
    if any(not isinstance(binding.get(k), str) or len(binding[k]) != 64 or
           any(c not in "0123456789abcdef" for c in binding[k]) for k in required):
        raise RuntimeError("EXACT_GUEST_DELIVERY_HASH_BINDINGS_REQUIRED")


def live_entrypoint(*_args, **_kwargs):
    raise RuntimeError("G3A_AUTHORITY_CONSUMED_LIVE_EXECUTION_DISABLED")
