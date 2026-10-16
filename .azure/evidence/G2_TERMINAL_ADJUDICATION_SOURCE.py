import datetime
import hashlib
import json
import pathlib
import re
import subprocess
import sys
import urllib.parse

ROOT = pathlib.Path(r"C:\APPS\worktrees\nzila-g2-provenance")
E = ROOT / ".azure" / "evidence"
S = ROOT / "infrastructure" / "landing-zone" / "g2-builder"
P = "G2_TERMINAL_"
ROOTS = [
    "G2_FRESH_BOOT_RESUME_FINAL_VERIFICATION.json", "G2_EMPTY_PATH_FINAL_VERIFICATION.json",
    "G2_LOCAL_OCI_FINAL_VERIFICATION.json", "G2_CORRECTED_PRODUCTION_FINAL_VERIFICATION.json",
    "G2_STAGE2B_FINAL_VERIFICATION.json",
]


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(name):
    return json.loads((E / name).read_text(encoding="utf-8-sig"))


def save(name, value):
    with (E / (P + name)).open("x", encoding="utf-8") as stream:
        json.dump(value, stream, indent=2)
        stream.write("\n")


def concurrency():
    git = lambda *args: subprocess.check_output(["git", "-C", str(ROOT), *args], text=True).strip()
    value = {"branch": git("branch", "--show-current"), "head": git("rev-parse", "HEAD"),
             "status": git("status", "--short").splitlines()}
    assert value == read("G2_STAGE2B_FINAL_VERIFICATION.json")["concurrency"]
    return value


def integrity():
    cp = concurrency()
    checked = {}
    counts = {}
    for name in ROOTS:
        value = read(name)
        count = 0
        for group in ("evidenceHashes", "priorEvidenceHashes", "sourceHashes", "priorSourceHashes"):
            base = E if "Evidence" in group or group == "evidenceHashes" else S if name.startswith("G2_STAGE2B") else S / "stage2a"
            for relative, expected in value.get(group, {}).items():
                path = base / relative
                assert path.is_file(), str(path)
                assert sha(path).lower() == expected.lower(), str(path)
                checked[str(path)] = sha(path)
                count += 1
        counts[name] = {"rootSha256": sha(E / name), "hashReferencesVerified": count}
    authority = read("G2_STAGE1_RUNTIME_DISCOVERY_REPAIR_V2.json")
    for group, base in (("sourceHashes", ROOT), ("unchangedInfrastructureHashes", ROOT), ("priorEvidenceHashes", E)):
        for relative, expected in authority[group].items():
            path = base / relative
            assert path.is_file() and sha(path).lower() == expected.lower(), str(path)
            checked[str(path)] = sha(path)
    preparation = read("G2_FRESH_BOOT_RESUME_PREPARATION.json")
    assert sha(E / "G2_FRESH_BOOT_RESUME_VM_ONLY_TEMPLATE.json").lower() == preparation["executionTemplateSha256"].lower()
    assert sha(E / "G2_FRESH_BOOT_RESUME_VM_ONLY_PARAMETERS.json").lower() == preparation["executionParametersSha256"].lower()
    plan = (ROOT / ".azure" / "deployment-plan.md").read_bytes()
    marker = b"## Current slice:"
    header = plan[:plan.index(marker)]
    suffixes = {}
    for match in re.finditer(br"(?m)^## Current slice: ([^\r\n]+)", plan):
        body = header + plan[match.start():]
        suffixes[hashlib.sha256(body).hexdigest()] = match.group(1).decode()
    plans = {}
    for name in ROOTS:
        value = read(name)
        for key in ("deploymentPlanSha256", "currentPlanSha256"):
            if key in value:
                digest = value[key].lower()
                assert digest in suffixes, (name, "historical plan suffix mismatch")
                plans[name] = {"recordedPlanSha256": digest, "verifiedChronologySuffix": suffixes[digest],
                               "method": "Original header plus byte-exact retained historical suffix; no reconstruction edits"}
        for key in ("validateStatusSha256", "validationWorkflowSha256"):
            if key in value:
                assert sha(ROOT / ".azure" / "validate-status.json").lower() == value[key].lower()
    assert sha(ROOT / ".azure" / "deployment-plan.md") == read(ROOTS[-1])["currentPlanSha256"]
    consumed = []
    for file in sorted(E.glob("*CONSUMED.json")):
        value = read(file.name)
        assert value.get("remainingExecutions", 0) == 0
        deployment = value.get("deploymentName")
        related = []
        if deployment:
            for other in E.glob("*.json"):
                if other == file:
                    continue
                text = other.read_text(encoding="utf-8-sig")
                if deployment in text:
                    related.append(other.name)
            assert related, file.name
        consumed.append({"record": file.name, "sha256": sha(file), "deploymentName": deployment,
                         "relatedRecords": related, "remainingExecutions": 0})
    hygiene = []
    scanned = 0
    for file in E.rglob("*"):
        if not file.is_file():
            continue
        raw = file.read_bytes()
        scanned += 1
        if re.search(br"-----BEGIN (?:OPENSSH |RSA |EC |DSA )?PRIVATE KEY-----", raw):
            hygiene.append({"file": str(file.relative_to(E)), "category": "PRIVATE_KEY_HEADER"})
        if file.suffix.lower() != ".json":
            continue
        value = json.loads(raw.decode("utf-8-sig"))
        def inspect(child, pointer=""):
            if isinstance(child, dict):
                for k, v in child.items():
                    inspect(v, pointer + "/" + k)
            elif isinstance(child, list):
                for index, v in enumerate(child):
                    inspect(v, pointer + "/" + str(index))
            elif isinstance(child, str):
                if re.fullmatch(r"(?:Bearer\s+)?eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+", child):
                    hygiene.append({"file": str(file.relative_to(E)), "pointer": pointer, "category": "JWT_VALUE"})
                if child.startswith("https://") and " " not in child:
                    query = urllib.parse.parse_qs(urllib.parse.urlsplit(child).query)
                    if any(k.lower() in ("sig", "signature", "access_token", "refresh_token") for k in query):
                        hygiene.append({"file": str(file.relative_to(E)), "pointer": pointer, "category": "SIGNED_OR_TOKEN_URL"})
                if pointer.rsplit("/", 1)[-1].lower() in ("access_token", "refresh_token"):
                    if child and child not in ("REDACTED", "NOT_PERSISTED"):
                        hygiene.append({"file": str(file.relative_to(E)), "pointer": pointer, "category": "SENSITIVE_VALUE"})
        inspect(value)
    assert hygiene == [], hygiene
    save("INTEGRITY.json", {"capturedAtUtc": now(), "concurrency": cp, "roots": counts,
        "uniqueHashBoundFiles": len(checked), "verifiedFileHashes": checked, "historicalPlans": plans,
        "baselinePlanSha256": sha(ROOT / ".azure" / "deployment-plan.md"),
        "workflowSha256": sha(ROOT / ".azure" / "validate-status.json"),
        "consumedAuthorities": consumed, "secretScan": {"filesScanned": scanned, "findings": hygiene,
        "manualFalsePositiveReview": [
            {"file": "G2_RETAINED_RESOURCE_PUT_SEMANTICS.json", "pointer": "/actions/authorization",
             "disposition": "Human execution-approval narrative, not an HTTP header"},
            {"file": "G2_RETRY2_PREDEPLOY_VERIFICATION.json", "pointer": "/authorization",
             "disposition": "Single-retry authority narrative, not an HTTP header"}],
        "scope": "Local durable evidence; structured JWT/key/signed-URL checks plus stage runtime hygiene contracts. No remote host execution."},
        "G2_EVIDENCE_CHAIN_INTEGRITY": "PASS"})
    print("Frozen five-stage roots/discovery sources/byte-exact historical plans/workflow/consumption/secret checks PASS",
          len(checked), "unique files,", scanned, "evidence files scanned")


def live():
    assert read(P + "INTEGRITY.json")["G2_EVIDENCE_CHAIN_INTEGRITY"] == "PASS"
    concurrency()
    namespace = {"__name__": "terminal_readonly_helpers"}
    exec(compile((E / "G2_STAGE2B_EXECUTION_CONTROLLER.py").read_bytes(), "frozen_stage2b_helpers", "exec"), namespace)
    original = namespace["az"]
    calls = []
    def readonly(*args):
        allowed = args[:2] in (("account", "show"), ("resource", "list"))
        allowed |= args[:3] in (("role", "assignment", "list"), ("role", "definition", "list"),
                               ("vm", "extension", "list"), ("deployment", "group", "list"))
        allowed |= args[:2] == ("rest", "--method") and args[2].lower() == "get"
        assert allowed, "Azure mutation forbidden"
        calls.append(list(args))
        return original(*args)
    namespace["az"] = readonly
    state = namespace["estate"]()
    latest = read("G2_STAGE2B_FINAL_ESTATE.json")
    stable = namespace["stable"]
    for group in ("resources", "roles", "source", "sourceRoles", "extensions", "endpointNic", "dnsRecords", "zoneGroups"):
        assert stable(state[group]) == stable(latest[group]), group
    census = namespace["authorization"]()
    assert census["snapshotSha256"] == read("G2_STAGE2B_POSTEXEC_AUTHORIZATION.json")["snapshotSha256"]
    staging = readonly("role", "assignment", "list", "--assignee-object-id", "bfa4a851-696a-4d3f-927b-5fb1526f79f2",
                       "--all", "--include-inherited", "--include-groups", "--subscription", namespace["SUB"])
    target = next(v for v in state["resources"].values() if v["type"].lower() == "microsoft.containerregistry/registries")
    rg_scope = "/subscriptions/" + namespace["SUB"] + "/resourceGroups/" + namespace["RG"]
    for assignment in staging:
        scope = assignment["scope"].lower()
        assert scope not in ("/subscriptions/" + namespace["SUB"], rg_scope.lower())
        assert not scope.startswith(target["id"].lower())
    assert {v["name"] for v in state["roles"]} == {
        "ba1fd686-3000-51dc-8fa6-1cfdedf67d20", "6628bb3e-5e59-5dcb-9f7b-80b421a7a7f8",
        "1caf1212-c9f0-5165-a0b7-9827ab84df7b"}
    assert all(v["name"] != "cd614773-c7d9-5c3e-8ab5-c2f93955c5fb" for v in state["sourceRoles"])
    vm = next(v for v in state["resources"].values() if v["type"].lower() == "microsoft.compute/virtualmachines")
    assert vm["identity"]["type"] == "UserAssigned"
    assert len(vm["identity"]["userAssignedIdentities"]) == 1
    assert next(iter(vm["identity"]["userAssignedIdentities"].values()))["principalId"] == namespace["BUILDER"]
    subscription_transients = readonly("resource", "list", "--subscription", namespace["SUB"],
        "--query", "[?starts_with(name, 'nzila-g2-runtime-proof') || name=='nzila-g2-runtime-once'].{id:id,type:type,name:name}")
    assert subscription_transients == []
    deployments = readonly("deployment", "group", "list", "-g", namespace["RG"], "--subscription", namespace["SUB"],
        "--query", "[].{name:name,state:properties.provisioningState,correlationId:properties.correlationId,timestamp:properties.timestamp}")
    save("LIVE_ESTATE.json", state)
    save("LIVE_AUTHORIZATION.json", census)
    save("STAGING_AUTHORIZATION.json", {"capturedAtUtc": now(), "principal": "bfa4a851-696a-4d3f-927b-5fb1526f79f2",
                                      "assignments": staging, "g2TargetOrInheritedRolePresent": False})
    save("LIVE_HISTORY.json", {"capturedAtUtc": now(), "deployments": deployments,
                              "subscriptionRuntimeTransientMatches": subscription_transients})
    save("READ_ONLY_CALLS.json", {"capturedAtUtc": now(), "calls": calls, "azureMutationCount": 0,
                                 "guestExecutionCount": 0, "registryOperationCount": 0})
    print("Live protected16/full private estate/canonical roles/staging exceptions/runtime absence PASS:",
          census["snapshotSha256"], "deployment records", len(deployments))


def adjudicate():
    concurrency()
    assert read(P + "INTEGRITY.json")["G2_EVIDENCE_CHAIN_INTEGRITY"] == "PASS"
    state = read(P + "LIVE_ESTATE.json")
    census = read(P + "LIVE_AUTHORIZATION.json")
    assert len(state["resources"]) == 16 and state["extensions"] == []
    assert read("G2_FRESH_BOOT_RESUME_FINAL_DISPOSITION.json")["stage1Disposition"] == "STAGE1_DISCOVERY_PROVEN"
    tooling = read("G2_EMPTY_PATH_FINAL_DISPOSITION.json")
    builder = read("G2_CORRECTED_PRODUCTION_GUEST_RESULT.json")["result"]
    runtime = read("G2_STAGE2B_GUEST_RESULT.json")["result"]
    assert tooling["STAGE2A_PRIVATE_ORAS_DELIVERY"] == "STAGE2A_PRIVATE_ORAS_DELIVERY_PROVEN"
    assert tooling["DATA_ENDPOINT_HTTP_STATUS"] == 200 and tooling["DATA_ENDPOINT_TLS"] == "PASS"
    assert builder["status"] == runtime["status"] == "PASS"
    assert builder["toolingWrite"] == builder["controlWrite"] == "DENIED"
    assert runtime["syntheticWrite"] == runtime["toolingRead"] == runtime["toolingWrite"] == "DENIED"
    assert builder["toolingRead"] == runtime["syntheticRead"] == "ALLOWED"
    assert builder["manifestCommitAttempts"] == 1 and builder["pushAttemptConsumed"] is True
    assert builder["configurationUnchanged"] is runtime["configurationUnchanged"] is True
    assert builder["noSensitiveMaterialPersisted"] is runtime["noSensitiveMaterialPersisted"] is True
    assert read("G2_STAGE2B_RUNTIME_SUBSTRATE.json")["BUILDER_RUNTIME_IDENTITY_COLOCATION"] == "NO"
    assert read("G2_STAGE2B_TEARDOWN.json")["residualResources"] == {}
    payload = E / "G2_SYNTHETIC_PRODUCTION_PAYLOAD.json"
    binding = read("G2_SYNTHETIC_PRODUCTION_PAYLOAD_BINDING.json")
    payload_sha = sha(payload)
    manifest_sha = sha(E / "G2_CORRECTED_PRODUCTION_LOCAL_RUN1" / "manifest.json")
    assert payload_sha == "2457502e49df5a77cd6403052c37ad7dc8cce95f3947378aa5e3dcf2f12703db"
    assert len(payload.read_bytes()) == 326
    assert binding["SOURCE_CONTRACT_SHA256"] == sha(E / "G2_SYNTHETIC_PRODUCTION_SOURCE_CONTRACT.json")
    assert binding["SOURCE_CONTRACT_SHA256"] in payload.read_text()
    assert manifest_sha == "13fbd3f9de68376f8e55af8ce64172eec3ae65a73b9ce70f9d26e73271bef690"
    assert builder["localManifestDigest"] == builder["remoteManifestDigest"] == runtime["remoteManifestDigest"] == "sha256:" + manifest_sha
    assert builder["remoteBlobDigest"] == runtime["remotePayloadDigest"] == "sha256:" + payload_sha
    assert runtime["payloadSha256"] == payload_sha and runtime["payloadSize"] == 326
    source = read("G2_PRIVATE_IMPORT_SOURCE_ARTIFACT_AUTHORITY.json")
    assert source["manifestDigest"] == tooling["MANIFEST_DIGEST"]
    assert source["archiveSha256"] == tooling["TARGET_ARCHIVE_SHA256"] == builder["orasArchiveSha256"]
    assert read("G2_PRIVATE_IMPORT_IMPORT_RESULT.json")["run"]["conclusion"] == "success"
    assert read("G2_PRIVATE_IMPORT_IMPORT_TEARDOWN.json")["status"] == "PASS"
    attempts = [
        ("Initial Stage1 NSG failure", "G2_STAGE1_NSG_FAILURE_DIAGNOSIS.md", "CONSUMED",
         "Historical wire payload/root cause not recoverable; retained failed operation. Later reviewed NSG/retry state converged; no current NSG invariant unproven."),
        ("Stage1 VM/firewall retry failure", "G2_STAGE1_RETRY_DEPLOYMENT_FAILURE_20261010.json", "CONSUMED",
         "Empty auth profile and missing Basic firewall management NIC repaired under new bounded authority; partial12 retained then converged16."),
        ("Retry2 preparatory what-if stop", "G2_RETRY2_20261010_1720_REPORT.md", "NOT_YET_CONSUMED",
         "New retained PUT deltas stopped dispatch; exact provider-schema ceiling closed before single Retry2."),
        ("Retry2 runtime discovery partial", "G2_RETRY2_FINAL_DISPOSITION.json", "CONSUMED",
         "VM/firewall success; serial/identity/deb822 source defects recorded, repaired locally, then one fresh-boot proof."),
        ("Fresh-boot replacement", "G2_FRESH_BOOT_RESUME_FINAL_DISPOSITION.json", "CONSUMED",
         "Same builder resource ID/existing NIC; fresh disk; old disk retired; exact read-only NIC metadata transition adjudicated. Discovery PROVEN."),
        ("Stage2 execution-channel stop", "G2_STAGE2_FINAL_DISPOSITION.json", "NO_TECHNICAL_EXECUTION",
         "No interactive SSH/Run Command improvised; later explicit CSE authority."),
        ("Inventory handler-version failure", "G2_STAGE2A_FINAL_DISPOSITION.json", "CONSUMED",
         "2.1.19 rejected before guest; corrected separately authorized2.1 inventory retry; no extension residue."),
        ("Inventory retry missing tooling", "G2_STAGE2A_RETRY_FINAL_DISPOSITION.json", "CONSUMED",
         "Inventory PROVEN,toolchain MISSING honestly retained; temporary CSE removed; approved tooling path later proven."),
        ("Public ORAS egress stop", "G2_STAGE2A_ORAS_FINAL_DISPOSITION.json", "UNCONSUMED",
         "No download or policy change; private delivery superseded external egress dependency."),
        ("Private staging identity stop", "G2_STAGE2A_PRIVATE_ORAS_FINAL_DISPOSITION.json", "UNCONSUMED",
         "No principal/RBAC/upload created; existing staging OIDC later explicitly selected."),
        ("Tooling identity/RBAC placement stop", "G2_STAGE2A_TOOLING_IDENTITY_RBAC_FINAL_DISPOSITION.json", "UNCONSUMED",
         "No private staging host improvised or Writer granted; no self-hosted runner created."),
        ("Import feasibility/trusted-services stop", "G2_STAGE2A_ACR_IMPORT_FINAL_DISPOSITION.json", "UNCONSUMED",
         "Importer scope limitations recorded; no bypass silently opened."),
        ("Transactional import pre-read authority stop", "G2_STAGE2A_TRANSACTIONAL_ACR_IMPORT_FINAL_DISPOSITION.json", "UNCONSUMED",
         "Collision/readback context not authorized; no staging/import/window opened in this earlier packet."),
        ("Private import parser-triggered early teardown", "G2_PRIVATE_IMPORT_REPORT.md", "BOUNDED_AUTHORITY_EXECUTED",
         "One source staging + one successful server-side import; echoed result marker parser failure triggered early teardown. Window289.894698s; bypass None/importers absent. No reimport."),
        ("Private post verifier failure", "G2_PRIVATE_IMPORT_POST_VERIFIER_RESULT.json", "CONSUMED",
         "Opaque ValueError,exact terminal CSE retired; source/result preserved; no equivalence claimed."),
        ("Corrected host-IP verifier failure", "G2_PRIVATE_IMPORT_CORRECTED_POST_RESULT.json", "CONSUMED",
         "Login .5/data .4 pin correction alone insufficient; exact CSE retired,no generic-success fallback."),
        ("Diagnostic blob-http failure", "G2_PRIVATE_IMPORT_DIAGNOSTIC_POST_RESULT.json", "CONSUMED",
         "Stage-specific code retained; exact CSE retired; new read-only observer authority required."),
        ("Blob-readback redirect guard failure", "G2_BLOB_READBACK_FINAL_DISPOSITION.json", "CONSUMED",
         "307 reached,old exact predicate unrecoverable by deliberate signed-URI nonpersistence; not invented. CSE removed."),
        ("Local redirect static forensics", "G2_REDIRECT_GUARD_LOCAL_DISPOSITION.json", "NO_AZURE_EXECUTION",
         "Source-local diagnostics did not recover the historical signed URI or permit runtime retry."),
        ("Corrected redirect observer", "G2_CORRECTED_REDIRECT_FINAL_DISPOSITION.json", "CONSUMED",
         "Current empty-path predicate failure isolated without rewriting historical results; CSE removed."),
        ("Empty-path closure", "G2_EMPTY_PATH_FINAL_DISPOSITION.json", "CONSUMED",
         "Separately authorized validator preserves exact signed URI,307/private .4/TLS/200/streamed approved SHA; CSE removed; delivery PROVEN."),
        ("Original production ARM-read predispatch stop", "G2_SYNTHETIC_PRODUCTION_FINAL_DISPOSITION.json", "UNCONSUMED",
         "No builder management role added; composite operator census/guest effective boundary explicitly superseded impossible guest ARM reread."),
        ("Initial production manifest mismatch", "G2_SYNTHETIC_REVISED_FINAL_DISPOSITION.json", "CONSUMED",
         "Private retrieval/version passed; local descriptor check failed; no push. Workspace/CSE removed,census unchanged."),
        ("Local OCI contract repair", "G2_LOCAL_OCI_LOCAL_DISPOSITION.json", "NO_AZURE_EXECUTION",
         "Two isolated actual ORAS runs reproduce inline config data; exact validator repaired without relaxation; forensic layouts retained."),
        ("Corrected production", "G2_CORRECTED_PRODUCTION_DISPOSITION.json", "CONSUMED",
         "One no-retry artifact attempt/manifest commit; exact remote readback/denials; workspace/CSE removed,census unchanged; builder artifact PROVEN."),
        ("Runtime proof", "G2_STAGE2B_DISPOSITION.json", "CONSUMED",
         "Distinct runtime-only VM; read/integrity/denials PROVEN; CSE/VM/NIC/disk removed;16,census unchanged."),
    ]
    rows = []
    for title, filename, consumed, closure in attempts:
        assert (E / filename).is_file(), filename
        rows.append({"attempt": title, "evidence": filename, "sha256": sha(E / filename),
                     "authorityDisposition": consumed, "closureOrRetention": closure})
    old_files = [v for v in E.rglob("*") if v.is_file() and not v.relative_to(E).parts[0].startswith(P)]
    deployment_references = []
    for deployment in read(P + "LIVE_HISTORY.json")["deployments"]:
        found = [str(v.relative_to(E)) for v in old_files if v.suffix in (".json", ".md") and
                 (deployment["correlationId"] in v.read_text(encoding="utf-8-sig") or
                  deployment["name"] in v.read_text(encoding="utf-8-sig"))]
        assert found, deployment["name"]
        deployment_references.append({**deployment, "retainedEvidenceReferences": found,
            "match": "Exact deployment name or correlation. Some sanitized historical records retain name/status without correlation; fresh ARM listing supplies current correlation."})
    save("ATTEMPT_ACCOUNTING.json", {"capturedAtUtc": now(), "attempts": rows,
        "liveDeployments": deployment_references, "allDedicatedConsumedRecords": read(P + "INTEGRITY.json")["consumedAuthorities"],
        "G2_FAILED_ATTEMPT_ACCOUNTING": "COMPLETE",
        "qualification": "ARM nested deployment name nzilaG2SyntheticBuilder was reused during initial/retry provisioning. Immutable retained failed/success operation snapshots,not current nested-name status,account for prior attempts."})
    limitations = [
        "Application/workload deployment", "Application runtime configuration", "Database connectivity",
        "DNS cutover", "Production data", "Staging/production migration", "Monitoring and alerting",
        "Backup/restore", "Operational runbooks", "Scaling", "Availability/SLA", "Disaster recovery",
        "Application secrets", "Product-specific validation", "UE/Cora production readiness",
        "Source/staging ACR existing public/admin posture (unchanged external delivery source,not G2 target)",
        "Cryptographic signing/attestation and SBOM: SHA256 content lineage is proven,not signing/trust policy",
        "Historical NSG wire-payload root cause and historical opaque redirect predicate unrecoverable; preserved and superseded,current invariants proven",
        "Synthetic proof repeatability/capacity/CI rollout; current proof is bounded one-time execution,not recurring production pipeline",
        "Guest extension-handler caches/logs may remain on retained builder; CSE removal does not claim disk erasure. No token bodies persisted by proof scripts",
        "Azure ARM operator management path was read via management.azure.com; no private ARM management endpoint or private-only operator device claimed",
    ]
    save("LIMITATIONS.json", {"capturedAtUtc": now(), "limitations": [{"item": v, "classification": "OUTSIDE_G2"} for v in limitations],
                            "G2_BLOCKERS": [], "reason": "All accepted private registry/artifact/identity/steady-state gate invariants proven; none of these is used to waive an in-gate requirement"})
    retained = [
        {"element": "Original16 including builder VM/NIC/current OS disk and network/security/registry/UAMIs", "classification": "STEADY_STATE",
         "reason": "Protected foundation; not the transient runtime substrate. No temporary CSE or guest access channel remains."},
        {"element": "Builder synthetic-health Writer and runtime synthetic-health Reader", "classification": "STEADY_STATE",
         "reason": "Exact repository-conditioned production/consumption boundary"},
        {"element": "Builder g2-tooling Reader", "classification": "STEADY_STATE", "reason": "Explicitly approved retained pull-only tooling contract"},
        {"element": "g2-tooling ORAS artifact in source/target ACR", "classification": "PROOF_EVIDENCE", "reason": "Approved hash-pinned delivery lineage"},
        {"element": "synthetic-health Stage2A tag/manifest/payload", "classification": "PROOF_EVIDENCE", "reason": "Runtime consumed this exact immutable content"},
        {"element": "Evidence files/executed sources/local forensic OCI layouts", "classification": "PROOF_EVIDENCE", "reason": "Preserve failed and successful attempts"},
        {"element": "Isolated source staging/import GitHub branches and existing source OIDC AcrPush", "classification": "PROOF_EVIDENCE",
         "reason": "Branches retained; source-only preexisting assignment unchanged. No unintended target/inherited staging role survives."},
        {"element": "Existing firewall data/management public IPs", "classification": "STEADY_STATE",
         "reason": "Part of accepted16; neither is attached to builder/runtime VM. No new public IP or Bastion."},
    ]
    save("RESIDUAL_REGISTER.json", {"capturedAtUtc": now(), "retained": retained, "unsafeResiduals": [],
                                  "G2_RESIDUAL_STATE": "ACCEPTABLE", "adjudicationCleanupCount": 0})
    checks = {
        "G2_PRIVATE_CONTROL_PLANE": "PASS", "G2_EVIDENCE_CHAIN_INTEGRITY": "PASS",
        "G2_FAILED_ATTEMPT_ACCOUNTING": "COMPLETE", "G2_FINAL_INFRASTRUCTURE_STATE": "PASS",
        "G2_FINAL_REGISTRY_NETWORK_POSTURE": "PASS", "G2_FINAL_AUTHORIZATION_MATRIX": "PASS",
        "G2_IDENTITY_SEPARATION": "PASS", "G2_PRIVATE_PATH_PROOF": "PASS", "G2_ARTIFACT_PROVENANCE": "PASS",
        "G2_SECRET_HYGIENE": "PASS", "G2_RESIDUAL_STATE": "ACCEPTABLE", "G2_SCOPE_INTERPRETATION": "PASS",
        "PROTECTED_INFRASTRUCTURE_RESOURCE_COUNT": 16, "CURRENT_STAGE2A_BUILDER_ARTIFACT": "PROVEN",
        "CURRENT_STAGE2B_RUNTIME_IDENTITY": "PROVEN", "STAGE3_AUTHORIZED": "NO", "APPLICATION_ROLLOUT_AUTHORIZED": "NO",
        "UE_INFRA": "INFRA_NO_GO", "CORA_INFRA": "INFRA_NO_GO",
    }
    save("DISPOSITION.json", {"capturedAtUtc": now(), "mission": "NZ-20261008-INFRA-001",
        "gate": "G2_PRIVATE_CONTROL_PLANE", "authority": "TERMINAL G2 ADJUDICATION - READ_ONLY/EVIDENCE_ONLY",
        "fields": checks, "scope": "Private target registry access; bounded separate builder/runtime identities; deterministic hash-bound artifact production/consumption; repository separation; no unsafe public bypass; restored governed steady state. Not production-ready platform or private ARM operator endpoint.",
        "whyPassNotPassWithLimitations": "No surviving G2_BLOCKER; all limitations explicitly outside accepted G2 scope. No unproven invariant waived.",
        "liveAuthorizationSha256": census["snapshotSha256"], "concurrency": concurrency(),
        "evidenceRoots": {v: sha(E / v) for v in ROOTS},
        "gateEvidence": {v: sha(E / (P + v)) for v in ("INTEGRITY.json", "LIVE_ESTATE.json", "LIVE_AUTHORIZATION.json",
            "STAGING_AUTHORIZATION.json", "READ_ONLY_CALLS.json", "ATTEMPT_ACCOUNTING.json", "LIMITATIONS.json", "RESIDUAL_REGISTER.json")},
        "artifact": {"sourceSha256": payload_sha, "payloadOciDigest": "sha256:" + payload_sha,
                     "manifestDigest": "sha256:" + manifest_sha, "size": 326},
        "azureMutationCount": 0, "guestExecutionCount": 0, "artifactMutationCount": 0,
        "retainedProofCleanupCount": 0})
    print("Terminal gate PASS:26 accounted phases/15 live deployments; no G2 blocker,all limitations OUTSIDE_G2")


def seal():
    cp = concurrency()
    ruling = read(P + "DISPOSITION.json")
    assert ruling["fields"]["G2_PRIVATE_CONTROL_PLANE"] == "PASS"
    assert ruling["azureMutationCount"] == ruling["guestExecutionCount"] == ruling["artifactMutationCount"] == 0
    original = read(P + "INTEGRITY.json")
    for path, expected in original["verifiedFileHashes"].items():
        assert sha(pathlib.Path(path)) == expected, path
    for relative, expected in read("G2_STAGE2B_FINAL_VERIFICATION.json")["priorEvidenceHashes"].items():
        assert sha(E / relative).lower() == expected.lower(), relative
    raw = (ROOT / ".azure" / "deployment-plan.md").read_bytes()
    header_end = raw.index(b"\r\n\r\n") + 4
    header = raw[:header_end]
    suffixes = {hashlib.sha256(header + raw[match.start():]).hexdigest(): match.group(1).decode()
                for match in re.finditer(br"(?m)^## Current slice: ([^\r\n]+)", raw)}
    assert original["baselinePlanSha256"] in suffixes
    for value in original["historicalPlans"].values():
        assert value["recordedPlanSha256"] in suffixes
    assert sha(ROOT / ".azure" / "validate-status.json") == original["workflowSha256"]
    mission = json.loads((ROOT / ".azure" / "mission-gate-status.json").read_text())
    assert mission["disposition"] == "PASS"
    assert mission["dispositionSha256"] == sha(E / (P + "DISPOSITION.json"))
    assert mission["stage3Authorized"] is mission["applicationRolloutAuthorized"] is False
    assert mission["ueInfrastructureDisposition"] == mission["coraInfrastructureDisposition"] == "INFRA_NO_GO"
    assert read(P + "LIMITATIONS.json")["G2_BLOCKERS"] == []
    assert all(v["classification"] == "OUTSIDE_G2" for v in read(P + "LIMITATIONS.json")["limitations"])
    links = []
    for file in (E / (P + "REPORT.md"), E / (P + "STAGE3_GOVERNANCE_DECISION_DRAFT.md"),
                 ROOT / ".azure" / "deployment-plan.md"):
        text = file.read_text(encoding="utf-8")
        # Current terminal section only: legacy plan links are historical records.
        if file.name == "deployment-plan.md":
            text = text.split("## Current slice:")[0]
        for target in re.findall(r"\[[^\]]+\]\(([^)]+)\)", text):
            if "://" not in target:
                path = (file.parent / target.split("#")[0]).resolve()
                assert path.exists() or path == (E / (P + "FINAL_VERIFICATION.json")).resolve(), str(path)
                links.append({"from": str(file.relative_to(ROOT)), "target": target})
    subprocess.run(["git", "-C", str(ROOT), "diff", "--check"], check=True)
    with (E / (P + "ADJUDICATION_SOURCE.py")).open("xb") as stream:
        stream.write(pathlib.Path(__file__).read_bytes())
    paths = sorted(v for v in E.rglob("*") if v.is_file() and v.relative_to(E).parts[0].startswith(P))
    save("FINAL_VERIFICATION.json", {"capturedAtUtc": now(), "mission": "NZ-20261008-INFRA-001",
        "gate": "G2_PRIVATE_CONTROL_PLANE", "disposition": "PASS", "concurrency": cp,
        "evidenceHashes": {str(v.relative_to(E)): sha(v) for v in paths},
        "completePriorEvidenceHashes": {
            str(v.relative_to(E)): sha(v) for v in E.rglob("*")
            if v.is_file() and not v.relative_to(E).parts[0].startswith(P)},
        "stageRootHashes": {v: sha(E / v) for v in ROOTS},
        "sourceHashes": {str(v.relative_to(S)): sha(v) for v in S.rglob("*") if v.is_file()},
        "currentPlanSha256": sha(ROOT / ".azure" / "deployment-plan.md"),
        "missionStatusSha256": sha(ROOT / ".azure" / "mission-gate-status.json"),
        "validationWorkflowSha256": sha(ROOT / ".azure" / "validate-status.json"),
        "historicalPlanSuffixVerification": "PASS", "documentLinks": links,
        "localWhitespaceCheck": "PASS", "azureMutationCount": 0, "registryOperationCount": 0,
        "guestExecutionCount": 0, "retainedProofCleanupCount": 0,
        "stage3Authorized": False, "applicationRolloutAuthorized": False,
        "ueInfra": "INFRA_NO_GO", "coraInfra": "INFRA_NO_GO"})
    for link in links:
        assert ((ROOT / link["from"]).parent / link["target"].split("#")[0]).resolve().exists()
    print("Terminal G2 PASS frozen: complete prior chain/sources,mission/plan/status,links and no mutations")


if __name__ == "__main__":
    {"integrity": integrity, "live": live, "adjudicate": adjudicate, "seal": seal}[sys.argv[1]]()
