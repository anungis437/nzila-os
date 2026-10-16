"""Bind immutable production inputs and the exact embedded import graph."""

import ast
import hashlib
import json
from pathlib import Path
import sys
import tarfile

HERE = Path(__file__).resolve().parent
BASE = HERE.parent
CORE = BASE / "g3a-controller-repair"
AUTHORITY = Path(r"C:\Users\AubertNungisa\AppData\Roaming\Code\agentSessionData\7496e6a0-5c9e-4c19-86cb-183af2c0f9c4\attachments\bdbd3729-3354-4fad-bd3d-8e4d76fbaf8b\Pasted text #1.txt")
sys.path.insert(0, str(BASE / "g3a-isolation-live"))
import isolation_live as prior


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def sha(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def read(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def fresh(name, value):
    with (HERE / name).open("x", encoding="utf-8") as stream:
        json.dump(value, stream, indent=2)
        stream.write("\n")


def inspect_python(raw):
    tree = ast.parse(raw.decode("utf-8"))
    imports, dynamic = [], []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imports.extend(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            imports.append(node.module or "")
        elif isinstance(node, ast.Call):
            func = ast.unparse(node.func)
            if func in ("__import__", "importlib.import_module", "importlib.util.spec_from_file_location",
                        "exec", "eval"):
                dynamic.append({"line": node.lineno, "expression": ast.unparse(node)})
    return {"sha256": hashlib.sha256(raw).hexdigest(), "imports": sorted(set(imports)),
            "dynamic": dynamic, "secretsImports": [name for name in imports if name.split(".")[0] == "secrets"]}


def main():
    fresh("CONCURRENCY_PREPARE.json", prior.baseline())
    old_path = BASE / "g3a-native-semantics/SEMANTIC_VERIFICATION.json"
    require(sha(old_path) == "f99d574e3d1e707b191da63ee7be6c0991c2ec095621feb8175e1512a9684727",
            "PRIOR_SEMANTIC_ROOT_CHANGED")
    old = read(old_path)
    protected = {**old["protectedFileHashes"],
                 **{str(old_path.parent / name): digest for name, digest in old["fileHashes"].items()},
                 str(old_path): sha(old_path),
                 str(old_path.parent / "INDEPENDENT_VERIFICATION.json"):
                     sha(old_path.parent / "INDEPENDENT_VERIFICATION.json")}
    for path, digest in protected.items():
        require(sha(path) == digest, "PROTECTED_HISTORY_CHANGED")
    binding = read(CORE / "inputs/binding.json")
    for name, value in binding["inputs"].items():
        require(sha(CORE / "inputs" / name) == value["sha256"] and
                (CORE / "inputs" / name).stat().st_size == value["bytes"], "FROZEN_INPUT_CHANGED_" + name)
    archive_census = read(BASE / "g3a-device-census/BINARY_AND_RUNTIME_DEVICE_REFERENCES.json")
    python = {}
    with tarfile.open(BASE / "g3a-capsule-offline/payload.tar") as archive:
        for member in archive:
            if not member.isfile():
                continue
            raw = archive.extractfile(member).read()
            require(hashlib.sha256(raw).hexdigest() == archive_census["embeddedFileHashes"][member.name]["sha256"],
                    "SEALED_EMBEDDED_BYTES_CHANGED")
            if member.name.endswith(".py"):
                python[member.name] = inspect_python(raw)
    production_names = [name for name in python if name.startswith("app/")]
    app_secrets = {name: python[name]["secretsImports"] for name in production_names
                   if python[name]["secretsImports"]}
    require(not app_secrets, "PRODUCTION_SECRETS_DEPENDENCY_STOP")
    frozen_dynamic = python["app/frozen.py"]["dynamic"]
    require(len(frozen_dynamic) == 2 and all("name" in item["expression"] for item in frozen_dynamic),
            "FROZEN_DYNAMIC_MODULE_CONTRACT_CHANGED")
    dynamic_targets = {"sealed_reader", "registry", "controller"}
    require(all("app/" + name + ".py" in python for name in dynamic_targets),
            "FROZEN_DYNAMIC_TARGET_NOT_EMBEDDED")
    unexpected_dynamic = {name: python[name]["dynamic"] for name in production_names
                          if name != "app/frozen.py" and python[name]["dynamic"]}
    require(not unexpected_dynamic, "UNRESOLVED_PRODUCTION_DYNAMIC_LOAD")
    staged = {}
    with tarfile.open(CORE / "inputs/source.tar") as archive:
        for member in archive:
            require(member.isfile(), "SOURCE_MEMBER_NOT_REGULAR")
            raw = archive.extractfile(member).read()
            require(hashlib.sha256(raw).hexdigest() == binding["sourceMembers"][member.name]["sha256"],
                    "STAGED_SOURCE_CHANGED")
            staged[member.name] = {"sha256": hashlib.sha256(raw).hexdigest(),
                                   "bytes": len(raw), "language": "GO_OR_DECLARATIVE_NO_PYTHON_EXECUTION"}
    embedded_imports_secrets = {name: value["secretsImports"] for name, value in python.items()
                               if value["secretsImports"]}
    require(not embedded_imports_secrets, "EMBEDDED_PYTHON_SECRETS_IMPORT_FOUND")
    semantic = read(BASE / "g3a-native-semantics/EXACT_RUNTIME_SEMANTIC_FIXTURE.json")
    for name in ("os.getrandom", "os.urandom", "ssl.RAND_bytes", "ssl.contextWithBoundCA"):
        require(semantic["entropy"]["report"]["operations"][name]["status"] == "PASS",
                "RETAINED_PRODUCTION_ENTROPY_PRIMITIVE_NOT_PASS")
    require(semantic["descriptor"]["report"]["status"] == "PASS", "RETAINED_NO_PROC_FIXTURE_NOT_PASS")
    fresh("PRODUCTION_IMPORT_GRAPH.json", {
        "PRODUCTION_SECRETS_DEPENDENCY": "NO", "SECRETS_PROBE_DISPOSITION": "NOT_PRODUCTION_REACHABLE",
        "embeddedPythonSources": python, "productionModules": production_names,
        "hashGatedDynamicTargets": sorted(dynamic_targets),
        "dynamicTargetBasis": "app/frozen.py literal SOURCES dictionary; bytes checked before exec; no caller-supplied module names",
        "stagedSource": staged, "embeddedSecretsImports": embedded_imports_secrets,
        "nativeBackendScope": "Native stdlib backends; prior exact native/runtime census retained; no secrets.py import dependency",
        "semanticEvidencePath": str(BASE / "g3a-native-semantics/EXACT_RUNTIME_SEMANTIC_FIXTURE.json"),
        "semanticEvidenceSha256": sha(BASE / "g3a-native-semantics/EXACT_RUNTIME_SEMANTIC_FIXTURE.json"),
        "semanticProbesReplayed": False,
    })
    fresh("AUTHORITY_BINDING.json", {
        "mission": "NZ-20261008-INFRA-001", "authorityPath": str(AUTHORITY),
        "authoritySha256": sha(AUTHORITY), "localMaximumCoreInvocations": 1,
        "deviceCandidate": ["/dev/null"], "liveAuthorityConsumed": False,
        "protectedFileHashes": protected, "bindingSha256": sha(CORE / "inputs/binding.json"),
        "inputs": binding["inputs"], "cloudReads": 0, "cloudMutations": 0,
    })
    print("PRODUCTION_SECRETS_DEPENDENCY=NO")
    print("SECRETS_PROBE_DISPOSITION=NOT_PRODUCTION_REACHABLE")


if __name__ == "__main__":
    main()
