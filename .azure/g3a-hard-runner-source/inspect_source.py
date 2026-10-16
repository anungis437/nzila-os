"""Read-only source qualification; persist only in this exclusive owned lane."""

from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess

HERE = Path(__file__).resolve().parent
OWNED = HERE.parent.parent
FOREIGN = Path(r"C:\APPS\nzila-os")
QUALIFIED = HERE.parent / "g3a-isolation-artifacts"
CAPACITY = HERE.parent / "g3a-hard-capacity"
AUTHORITY = Path(
    r"C:\Users\AubertNungisa\AppData\Roaming\Code\agentSessionData"
    r"\7496e6a0-5c9e-4c19-86cb-183af2c0f9c4\attachments"
    r"\3d123728-29e5-4f5e-9862-5ca634b7275f\Pasted text #1.txt"
)
GO = Path(r"C:\Program Files\Go\bin\go.exe")
EXPECTED_HEADS = {
    OWNED: "7bec20aad11d43eeae8099c14e021b3074154b27",
    FOREIGN: "1c337567635bb86ea0df7831557d8d2d22df1e6f",
}
SEAL = HERE.parent / "g3a-isolation-live" / "ISOLATION_VERIFICATION.json"
SEAL_SHA = "ef348fa762c5e62a73ace8a26a95cb4e5427fa36677ce437a0d0c6dcc4890bae"
observations = []


def require(ok, reason):
    if not ok:
        raise RuntimeError(reason)


def sha(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode()


def rebaseline(reason):
    record = {"utc": datetime.now(timezone.utc).isoformat(), "beforeOperation": reason}
    for name, path in (("owned", OWNED), ("foreign", FOREIGN)):
        def git(*args):
            return subprocess.check_output(["git", "-C", str(path), *args])
        head = git("rev-parse", "HEAD").decode().strip()
        require(head == EXPECTED_HEADS[path], name.upper() + "_HEAD_CHANGED")
        collapsed = git("status", "--porcelain=v1", "-z")
        expanded = git("status", "--porcelain=v1", "-uall", "-z")
        # These worktrees have no renames; capture raw bytes as well as the census.
        require(b"R " not in collapsed and b"R " not in expanded, "REBASELINE_RENAME_REQUIRES_REVIEW")
        record[name] = {
            "path": str(path), "head": head,
            "collapsedStatusCount": collapsed.count(b"\0"),
            "expandedStatusCount": expanded.count(b"\0"),
            "collapsedStatusSha256": hashlib.sha256(collapsed).hexdigest(),
            "expandedStatusSha256": hashlib.sha256(expanded).hexdigest(),
            "disposition": "OWNED_EXCLUSIVE_LANE_ONLY" if name == "owned" else "OBSERVE_ONLY",
        }
    require(sha(SEAL) == SEAL_SHA, "HISTORICAL_LIVE_SEAL_CHANGED")
    observations.append(record)
    return record


def fresh(name, value):
    require(Path(name).name == name, "EVIDENCE_PATH_MUST_BE_LANE_CHILD")
    rebaseline("exclusive evidence write " + name)
    with (HERE / name).open("x", encoding="utf-8", newline="\n") as stream:
        json.dump(value, stream, indent=2, sort_keys=True)
        stream.write("\n")


def execute(command, *, cwd=HERE, env=None):
    result = subprocess.run(command, cwd=cwd, env=env, capture_output=True,
                            text=True, encoding="utf-8", errors="strict", timeout=180)
    return {"command": list(map(str, command)), "cwd": str(cwd),
            "exitCode": result.returncode, "stdout": result.stdout, "stderr": result.stderr}


def authority_rejections():
    spec = importlib.util.spec_from_file_location("historical_capacity_policy", CAPACITY / "policy.py")
    policy = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(policy)
    authority = {
        "schema": "g3a-execution-authority/v1", "mission": "NZ-20261008-INFRA-001",
        "transaction": "SOURCE_ONLY_NEGATIVE_FIXTURE", "payloadSha256": "a" * 64,
        "capacity": dict(policy.MAXIMA), "consumed": False,
    }
    defaults = {
        "expected_digest": policy.digest(authority), "transaction": authority["transaction"],
        "payload_digest": authority["payloadSha256"], "config": dict(policy.MAXIMA), "consumed": False,
    }
    cases = [
        ("missing", None, {}),
        ("malformed", {"extra": True}, {}),
        ("wrongdigest", authority, {"expected_digest": "0" * 64}),
        ("consumed-document", dict(authority, consumed=True), {}),
        ("consumed-state", authority, {"consumed": True}),
        ("wrongtransaction", dict(authority, transaction="WRONG"), {}),
        ("wrongpayload", dict(authority, payloadSha256="b" * 64), {}),
        ("wrongcapacity", dict(authority, capacity=dict(policy.MAXIMA, tmpInodes=1)), {}),
        ("missing-future-digest", authority, {"expected_digest": None}),
        ("malformed-future-digest", authority, {"expected_digest": "bad"}),
    ]
    outcomes = []
    for name, body, overrides in cases:
        try:
            policy.authorize(body, **dict(defaults, **overrides))
        except RuntimeError as error:
            validation_error = str(error)
        else:
            raise RuntimeError("AUTHORITY_NEGATIVE_ACCEPTED_" + name)
        try:
            policy.production_entrypoint(body, **dict(defaults, **overrides))
        except RuntimeError as error:
            require(str(error) == "G3A_PRODUCTION_AUTHORITY_NOT_ISSUED_NO_RUNNER_DISPATCH",
                    "HISTORICAL_PRODUCTION_DENIAL_CHANGED")
        else:
            raise RuntimeError("HISTORICAL_STUB_DISPATCHED_" + name)
        outcomes.append({"case": name, "status": "PASS_HELPER_REJECTION_ONLY",
                         "validationError": validation_error,
                         "productionStubError": str("G3A_PRODUCTION_AUTHORITY_NOT_ISSUED_NO_RUNNER_DISPATCH"),
                         "productionIntegrationTest": False})
    require(policy.authorize(authority, **defaults) == policy.MAXIMA, "VALID_HELPER_FIXTURE_REJECTED")
    return outcomes


def main():
    require(HERE == OWNED / ".azure" / "g3a-hard-runner-source", "WRONG_EXCLUSIVE_LANE")
    require(not (HERE / "PARENT_INTEGRATION_REPORT.json").exists(), "REPORT_ALREADY_EXISTS")
    initial = rebaseline("source-only investigation start")
    binding = json.loads((QUALIFIED / "SOURCE_BINDING.json").read_text())
    references = {}
    for name, expected in binding["sourceFileHashes"].items():
        path = QUALIFIED / name
        actual = sha(path)
        require(actual == expected, "QUALIFIED_SOURCE_CHANGED_" + name)
        references[str(path)] = actual
    require(hashlib.sha256(canonical(binding["sourceFileHashes"])).hexdigest() ==
            binding["candidateSourceSha256"], "QUALIFIED_SOURCE_MAP_DIGEST_CHANGED")
    for path in (
        AUTHORITY, SEAL, QUALIFIED / "SOURCE_BINDING.json", QUALIFIED / "PARENT_INTEGRATION_REPORT.json",
        CAPACITY / "policy.py", CAPACITY / "test_policy.py", CAPACITY / "fixture.py",
        CAPACITY / "EFFECTIVE_LIMITS.json", CAPACITY / "HARD_BOUND_ACCEPTANCE.json",
        CAPACITY / "rehearsal-resume" / "GUEST_OFFLINE_RAW.json",
    ):
        references[str(path)] = sha(path)
    env = dict(os.environ)
    env.update(GOENV="off", GOTOOLCHAIN="local", GO111MODULE="off",
               GOCACHE=str(HERE / "go-cache"), GOPATH=str(HERE / "go-path"),
               GOTMPDIR=str(HERE / "go-work"), TEMP=str(HERE / "go-work"), TMP=str(HERE / "go-work"))
    rebaseline("create owned Go analyzer work directory")
    (HERE / "go-work").mkdir(exist_ok=True)
    rebaseline("Go standard-library AST analyzer compilation/cache writes only; no runner build")
    command = [str(GO), "run", str(HERE / "binding_tool.go"), "--",
               str(QUALIFIED / "proof_linux.go"), str(QUALIFIED / "launcher.go")]
    ast_run = execute(command, env=env)
    require(ast_run["exitCode"] == 0, "AST_ANALYZER_FAILED: " + ast_run["stderr"])
    ast_data = json.loads(ast_run["stdout"])
    fresh("AST_BINDINGS.json", ast_data)
    ast_run["stdout"] = "JSON persisted in AST_BINDINGS.json"
    ast_run["outputSha256"] = sha(HERE / "AST_BINDINGS.json")
    tests = execute(["python", "-B", "-m", "unittest", "-v", "test_policy"], cwd=CAPACITY)
    require(tests["exitCode"] == 0, "HISTORICAL_POLICY_TESTS_FAILED")
    negatives = authority_rejections()
    fresh("TEST_RESULTS.json", {
        "schema": "g3a-hard-runner-source-tests/v1",
        "astAnalysis": ast_run, "historicalHelperSuite": tests,
        "explicitAuthorityNegatives": negatives,
        "productionDispatchIntegration": "NOT_RUN_BLOCKED_BEFORE_IMPLEMENTATION",
        "offlineRuntimeQualification": "NOT_RUN_SOURCE_ONLY",
        "noCandidateNoCore": True,
    })
    for path, expected in references.items():
        require(sha(path) == expected, "HISTORICAL_REFERENCE_MODIFIED_" + path)
    for directory in ("go-work", "go-cache", "go-path"):
        path = HERE / directory
        if path.exists():
            rebaseline("remove exclusive analyzer intermediates " + directory)
            shutil.rmtree(path)
    final = rebaseline("source-only final protected-reference verification")
    require(initial["foreign"] == {**final["foreign"]}, "FOREIGN_STATUS_CHANGED_DURING_SOURCE_INSPECTION")
    source_hashes = {name: sha(HERE / name) for name in (
        "binding_tool.go", "inspect_source.py", "README.md")}
    report = {
        "schema": "g3a-hard-runner-source-parent-report/v1",
        "mission": "NZ-20261008-INFRA-001", "gate": "G3_PRIVATE_APPLICATION_SUBSTRATE",
        "lane": str(HERE), "authorityPath": str(AUTHORITY), "authoritySha256": sha(AUTHORITY),
        "status": "STOP_QUALIFIED_CONSTRUCTOR_BINDING_REQUIRES_CHANGE",
        "integration": "FAIL", "offlinePASS": False,
        "productionDispatch": "NOT_IMPLEMENTED_BLOCKED_NO_FUTURE_AUTHORITY_CONSUMED",
        "blocker": {
            "code": "QUALIFIED_CHILD_NO_PRE_SEAL_MOUNT_OR_POST_ISOLATION_DISPATCH_EXTENSION_POINT",
            "function": "proof_linux.go::isolatedProofChild",
            "qualifiedIdentity": next(value for value in ast_data["functions"]
                                      if value["function"] == "isolatedProofChild"),
            "reason": "Exact qualified constructor has no parameters/callbacks, stages work/output only, "
                      "seals root read-only before chroot/dropPrivileges, then runs import-only Python. "
                      "Neither hard-bounded build/tmp/null mounts nor authorized frozen-core dispatch can "
                      "be wired into this implementation while keeping its normalized function AST unchanged.",
            "necessaryChanges": [
                {"location": "isolatedProofChild before remount-root-readonly",
                 "change": "Add bounded executable build/tmp tmpfs and exact null-only device delta plus effective kernel checks."},
                {"location": "isolatedProofChild after disconnected-tcp-negatives",
                 "change": "Add authority-bound frozen-core dispatch and output/cleanup protocol instead of import-only completion."},
                {"location": "guestProof fixed command/proof-plan; launcher main/run",
                 "change": "Add one-shot authority validation/consumption and route authenticated production plans."},
            ],
            "unchangedSeparatelyReusableHelpers": [
                "namespaceBoundary", "disconnectedRoutes", "prctl", "capabilities",
                "dropPrivileges", "networkNegative"],
            "notClaimed": "Adding a hook changes the bound constructor AST, not necessarily the syscall "
                          "semantics of the smaller helpers. Keeping those helpers or copying primitive "
                          "statements does not establish exact whole-function constructor equivalence. "
                          "No new combined constructor is qualified or supplied.",
            "workaroundAttempted": False,
        },
        "normalizedFunctionIdentities": [
            {key: value for key, value in item.items() if key != "normalizedSource"}
            for item in ast_data["functions"]],
        "equivalence": {
            "allQualifiedSourceFilesMatchHistoricalBinding": True,
            "historicalFunctionsChanged": [],
            "qualifiedCurrentNormalizedIdentitiesBoundByExactHistoricalFileSHA": True,
            "newProductionConstructorWholeFunctionEquivalent": False,
            "normalizedSourcesAndPrimitiveStatementBindings": "AST_BINDINGS.json",
            "normalization": ast_data["normalization"],
        },
        "sourceChanges": {
            "productionSourceChanges": [],
            "newInvestigationSources": source_hashes,
            "changedHistoricalSources": [], "changedProductSources": [], "changedForeignSources": [],
            "commitsCreated": 0,
        },
        "tests": {
            "sourceControlFlowAndIdentityChecks": ast_data["sourceOnlyChecks"],
            "historicalHelperSuite": tests,
            "explicitAuthorityNegatives": negatives,
            "productionIntegration": "NOT_RUN_NO_IMPLEMENTATION_STOP_RULE",
            "requestedNegativeIntegrationCoverage": "NOT_SATISFIED; helper negatives are not integration",
            "runnerOrKernelTestInvocations": 0,
        },
        "capacityContext": {
            "qualificationModel": "ENFORCED_HARD_LIMIT",
            "buildBytes": 1073741824, "buildInodes": 32768,
            "tmpBytes": 268435456, "tmpInodes": 4096,
            "historicalActualLimitsEvidence": str(CAPACITY / "EFFECTIVE_LIMITS.json"),
            "historicalActualRawEvidence": str(CAPACITY / "rehearsal-resume" / "GUEST_OFFLINE_RAW.json"),
            "newKernelOrCoreQualification": False,
        },
        "protectedReferenceHashes": references,
        "liveSealSha256": SEAL_SHA,
        "evidenceHashes": {name: sha(HERE / name) for name in ("AST_BINDINGS.json", "TEST_RESULTS.json")},
        "contextMapSelfReviewedBeforeWrites": {
            "authority": str(AUTHORITY),
            "dispatch": ["launcher.go::main", "launcher.go::run", "proof_linux.go::guestProof"],
            "boundary": ["proof_linux.go::isolatedProofChild", "proof_linux.go::namespaceBoundary"],
            "privilegeAndNetwork": ["dropPrivileges", "capabilities", "prctl", "networkNegative", "disconnectedRoutes"],
            "historicalHardLimits": ["g3a-hard-capacity/fixture.py", "g3a-hard-capacity/policy.py"],
            "tests": ["Go standard-library AST inspection", "g3a-hard-capacity/test_policy.py"],
            "risk": "No change to bound constructor permitted; no new constructor/runtime proof attempted",
        },
        "operationCounters": {
            "candidateBuilds": 0, "frozenCoreRuns": 0, "AzureReads": 0, "AzureMutations": 0,
            "registryCalls": 0, "runnerExecutions": 0,
            "localReadOnlyDockerImageListsDuringToolDiscovery": 1,
            "standardLibraryASTAnalyzerCompilations": 1,
        },
        "rebaselineObservations": observations,
    }
    fresh("PARENT_INTEGRATION_REPORT.json", report)
    # fresh() rebaselines before writing; the observation list contains that last baseline.
    print("INTEGRATION=FAIL")
    print("BLOCKER=" + report["blocker"]["code"])
    print("SOURCE_BINDINGS=PASS; HELPERS=PASS; PRODUCTION_INTEGRATION=NOT_RUN; OFFLINE_PASS=NOT_CLAIMED")
    print("REPORT=" + str(HERE / "PARENT_INTEGRATION_REPORT.json"))


if __name__ == "__main__":
    main()
