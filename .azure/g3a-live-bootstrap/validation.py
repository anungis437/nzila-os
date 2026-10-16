"""Exact preparation gates and read-only provider validation for a new proof RG."""

from decimal import Decimal
import ipaddress
import json
import subprocess
from urllib.request import urlopen

from preflight import AUTHORITY, AZ, ENV, HERE, ROOT, SUB, baseline, ensure, fresh, sha

BICEP = r"C:\Users\AubertNungisa\.azure\bin\bicep.exe"


def load(name):
    return json.loads((HERE / name).read_text(encoding="utf-8-sig"))


def cli(name, args, timeout=300):
    result = subprocess.run([AZ, *args, "--output", "json", "--only-show-errors"],
                            capture_output=True, text=True, env=ENV, timeout=timeout)
    fresh(name, {"command": ["az", *args], "exitCode": result.returncode,
                "value": json.loads(result.stdout) if result.stdout.strip() else None,
                "stderr": result.stderr.strip()})
    ensure(result.returncode == 0, "VALIDATION_READ_FAILED_" + name)
    return json.loads(result.stdout)


def main():
    fresh("CONCURRENCY_VALIDATION_PREPARE.json", baseline())
    binding = load("AUTHORITY_BINDING.json")
    ensure(binding["sha256"] == sha(AUTHORITY) and not binding["consumed"], "AUTHORITY_CHANGED_OR_CONSUMED")
    ensure(not (HERE / "AUTHORITY_CONSUMED.json").exists(), "AUTHORITY_ALREADY_CONSUMED")
    cost = load("CURRENT_COST_GATE.json")
    ensure(Decimal(cost["conservativeExpectedCAD"]) <= Decimal("3") and
           Decimal(cost["conservativeExpectedCAD"]) * Decimal("1.5") <= Decimal("3"), "CAD3_COST_GATE")
    private = HERE / "ephemeral-provisioning-key"
    ensure(not private.exists() and not private.with_suffix(".pub").exists(), "EPHEMERAL_KEY_COLLISION")
    result = subprocess.run([r"C:\Windows\System32\OpenSSH\ssh-keygen.exe", "-t", "rsa", "-b", "3072",
                             "-N", "", "-C", "G3A-FIRST-BYTE-PROOF-UNUSABLE", "-f", str(private)],
                            capture_output=True, text=True, timeout=60)
    ensure(result.returncode == 0, "EPHEMERAL_KEY_GENERATION_FAILED")
    private.unlink()
    ensure(not private.exists(), "PRIVATE_KEY_NOT_DESTROYED")
    public = private.with_suffix(".pub").read_text().strip()
    fresh("INTERACTIVE_ACCESS_CONTRACT.json", {
        "privateKeyPath": str(private), "privateKeyDestroyed": True, "publicKeySha256": sha(private.with_suffix(".pub")),
        "publicKey": public, "publicIP": "PROHIBITED", "inboundNSG": "DENY_ALL",
        "passwordAuthentication": "DISABLED", "BOOTSTRAP_PROOF_INTERACTIVE_ACCESS": "IMPOSSIBLE_BY_DESIGN"})
    with urlopen("https://api.ipify.org", timeout=30) as response:
        producer_ip = response.read().decode().strip()
    ensure(isinstance(ipaddress.ip_address(producer_ip), ipaddress.IPv4Address) and
           ipaddress.ip_address(producer_ip).is_global, "PRODUCER_PUBLIC_IPV4_INVALID")
    tags = {"product": "shared", "environment": "integration-test", "service": "g3-firstbyte-proof",
            "owner": "nzila-platform", "cost_center": "NZ-20261008-INFRA-001",
            "data_classification": "synthetic", "authority_sha256": binding["sha256"],
            "ownership": "G3A_FIRST_BYTE_BOOTSTRAP_PROOF_TRANSACTION_OWNED"}
    params = {"resourceGroupName": binding["resourceGroupCandidate"], "suffix": binding["suffix"],
              "cidr": load("CIDR_SELECTION.json")["chosen"], "producerPrincipalId": load("PRINCIPAL.json")["value"]["id"],
              "producerIPv4": producer_ip, "tags": tags}
    fresh("PROOF_PARAMETERS.json", {"$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
          "contentVersion": "1.0.0.0", "parameters": {key: {"value": value} for key, value in params.items()}})
    fresh("PROOF_PUBLIC_STAGING_CONTRACT.json", {
        "producerIPv4": producer_ip, "window": "TEMPORARY", "firewallDefaultAction": "Deny",
        "authMode": "MICROSOFT_ENTRA_LOGIN", "storageKeysSASAnonymous": "PROHIBITED",
        "producerPrincipalId": params["producerPrincipalId"], "scope": "EXACT_BOOTSTRAP_PROOF_CONTAINER",
        "closeBeforeVMCreation": True, "privateProducerDeliveryClaimed": False})
    checks = []
    for name in ("main", "vm", "cse"):
        path = HERE / "infra" / (name + ".bicep")
        result = subprocess.run([BICEP, "build", str(path)], capture_output=True, text=True, timeout=120)
        ensure(result.returncode == 0 and not result.stderr.strip(), "BICEP_BUILD_OR_LINT_" + name + "_" + result.stderr)
        checks.append({"file": str(path), "build": "PASS", "lint": "PASS", "templateSha256": sha(path.with_suffix(".json"))})
    fresh("BICEP_LOCAL_VALIDATION.json", {"status": "PASS", "checks": checks})
    policies = cli("POLICY_ASSIGNMENTS.json", ["policy", "assignment", "list", "--scope",
                   "/subscriptions/" + SUB, "--disable-scope-strict-match", "true"])
    finish_policy_and_reads(binding, policies, private)


def finish_policy_and_reads(binding, policies, private):
    ensure(len(policies) == 1 and policies[0]["name"] == "SecurityCenterBuiltIn" and
           not policies[0]["parameters"], "POLICY_ASSIGNMENTS_REQUIRE_EXACT_REVIEW")
    definition = cli("SECURITY_CENTER_POLICY_SET.json", ["policy", "set-definition", "show", "--name",
                     "1f3afdf9-d0c9-4c3d-847f-89da613e70a8"])
    effects = {name: value["defaultValue"] for name, value in definition["parameters"].items()
               if name.lower().endswith("effect")}
    ensure(effects and all(value.lower() in ("audit", "auditifnotexists", "disabled")
                           for value in effects.values()), "POLICY_HAS_MUTATING_OR_DENY_DEFAULT")
    fresh("POLICY_EFFECT_REVIEW.json", {
        "status": "PASS_DEFAULT_AUDIT_ONLY", "assignment": policies[0]["id"],
        "effectParameters": effects, "userEffectOverrides": "NONE",
        "providerValidationRequired": True, "policyWrites": 0})
    old_g2 = ROOT / ".azure" / "evidence" / "G2_TERMINAL_FINAL_VERIFICATION.json"
    ensure(sha(old_g2) == "ed29f65fc52a89a707d76bf553a24f579e1542ddf439245edcf0cde3ccc0f499",
           "G2_TERMINAL_ROOT_CHANGED")
    fresh("PROTECTED_ROOT_BINDING.json", {
        "G2_TERMINAL_ROOT_UNCHANGED": "YES", "g2Path": str(old_g2), "g2Sha256": sha(old_g2),
        "priorFirstByteRoot": sha(HERE.parent / "g3a-firstbyte" / "FIRST_BYTE_VERIFICATION.json"),
        "priorTransactionRoot": sha(HERE.parent / "g3a-transaction" / "TRANSACTION_VERIFICATION.json"),
        "qualifiedCoreRoot": sha(HERE.parent / "g3a-controller-repair" / "REPAIR_VERIFICATION.json"),
        "historicPlan": str(ROOT / ".azure" / "deployment-plan.md"),
        "historicPlanSha256": sha(ROOT / ".azure" / "deployment-plan.md")})
    cli("G2_RESOURCE_BASELINE.json", ["resource", "list", "--resource-group", "nzila-g2-proof-xre47vggs5uhw",
                                     "--subscription", SUB])
    finish_role_and_whatif(binding, private)


def finish_role_and_whatif(binding, private):
    cli("G2_ROLE_BASELINE_CORRECTED.json", ["role", "assignment", "list", "--all", "--include-inherited",
        "--fill-principal-name", "false", "--query",
        "[?starts_with(scope, '/subscriptions/" + SUB + "/resourceGroups/nzila-g2-proof-xre47vggs5uhw') "
        "|| scope=='/subscriptions/" + SUB + "' || scope=='/']"])
    raw = cli("PREFLIGHT_WHATIF_RAW.json", ["deployment", "sub", "what-if", "--location", "canadacentral",
              "--subscription", SUB, "--template-file", str(HERE / "infra" / "main.json"),
              "--parameters", "@" + str(HERE / "PROOF_PARAMETERS.json"), "--no-pretty-print"], timeout=600)
    ensure(raw["status"] == "Succeeded", "WHATIF_FAILED")
    changes = raw["changes"]
    rgid = "/subscriptions/" + SUB + "/resourceGroups/" + binding["resourceGroupCandidate"]
    ensure(changes and all(item["changeType"] == "Create" and
                           (item["resourceId"].lower() == rgid.lower() or
                            item["resourceId"].lower().startswith(rgid.lower() + "/"))
                           for item in changes), "WHATIF_NOT_EXACT_NEW_PROOF_SCOPE")
    fresh("PREFLIGHT_VALIDATION_GATE.json", {
        "status": "PASS", "allChanges": "CREATE_WITHIN_NEW_PROOF_RG_ONLY", "changeCount": len(changes),
        "authorityConsumed": False, "privateKeyAbsent": not private.exists(), "costWithinCAD3": True,
        "handler": "2.1.10", "image": "Canonical:ubuntu-24_04-lts:server:24.04.202609040",
        "staticRoles": "PRODUCER_CONTRIBUTOR_AND_BUILDER_READER_EXACT_CONTAINER_ONLY",
        "noG2OrProductMutation": True, "policyAssignments": "SECURITY_CENTER_DEFAULT_AUDIT_ONLY",
        "remaining": "OFFICIAL_VALIDATE_WORKFLOW_AND_PROVIDER_VALIDATION"})
    print("PROOF_SOURCE_PARAMETERS_WHATIF_SCOPE_PASS", flush=True)


if __name__ == "__main__":
    main()
