"""Generate the authorized candidate, without changing the verified production sources."""
import hashlib
import json
from candidate_guard import CORE, HERE, QUALIFIED, ROOT, SOURCE, baseline, fresh, sha


def main():
    initial = baseline()
    paths = list((ROOT / ".azure" / "g3a-hard-runner-source").rglob("*"))
    paths += [QUALIFIED / n for n in ("proof_linux.go", "launcher.go", "census.go", "payload.tar", "SOURCE_BINDING.json")]
    paths += [ROOT / ".azure" / "g3a-isolation-live" / "ISOLATION_VERIFICATION.json",
              ROOT / ".azure" / "g3a-hard-capacity" / "HARD_BOUND_ACCEPTANCE.json",
              ROOT / ".azure" / "g3a-hard-capacity" / "EFFECTIVE_LIMITS.json",
              ROOT / ".azure" / "g3a-hard-runner-source" / "FINAL_READONLY_INPUT_PARENT_INTEGRATION_REPORT.json"]
    fresh("PRESERVED_BYTES.json", {"initialBaseline": initial,
                                  "hashes": {str(p): sha(p) for p in paths if p.is_file()}})
    for name in CORE + ("dispatch_test.go", "transaction_roots_test.go", "production_linux_test.go",
                        "verify_primitives.go"):
        text = (SOURCE / name).read_bytes()
        if name == "launcher.go":
            text = text.replace(b"func main() {\n", b"""func main() {
    if len(os.Args) >= 2 && (os.Args[1] == "--hard-bound-static-proof" ||
        os.Args[1] == "--_hard-bound-static-proof-child") {
        os.Exit(hardBoundProofCLI(os.Args[1:]))
    }
""", 1)
        fresh(name, text)
    fresh("payload.tar", (QUALIFIED / "payload.tar").read_bytes())
    original = (SOURCE / "proof_linux.go").read_text()
    child = "func productionChild()" + original.split("func productionChild()", 1)[1]
    child = child.replace("func productionChild()", "func hardBoundStaticProofChild()", 1)
    child = child.replace('r.Mode = "--production"', 'r.Schema, r.Mode = hardProofSchema, "--hard-bound-static-proof"', 1)
    child = child.replace("validatedChildPlan(plan)", "validatedHardProofPlan(plan)", 1)
    child = child.replace("invokeProductionCore(productionPlan, &r, evidenceFD)",
                          "invokeHardProofWitness(productionPlan, &r, evidenceFD)", 1)
    prefix = """//go:build linux && amd64

package main

import (
    "bytes"
    "encoding/json"
    "errors"
    "fmt"
    "io"
    "net"
    "os"
    "os/exec"
    "path/filepath"
    "runtime"
    "strings"
    "syscall"
)

"""
    fresh("hardproof_child_linux.go", prefix + child)
    base = {name: sha(SOURCE / name) for name in CORE}
    contract = {"schema": "g3a-governed-static-proof-contract/v1",
                "scope": "HARmless_STATIC_WITNESS_NO_FROZEN_CORE_NO_EXECUTION_AUTHORITY",
                "mission": "NZ-20261008-INFRA-001",
                "originalProductionSourceHashes": base,
                "qualifiedRuntimePayloadSha256": sha(QUALIFIED / "payload.tar"),
                "frozenInputSpecSha256": "247cd5aed0a3154891a5f966992c10e6a6d319c0f1554887c99aaa3f3c3572d3",
                "transaction": "HARD_BOUND_STATIC_PROOF",
                "inputRoot": "<private-working-directory>/.g3a-transaction-HARD_BOUND_STATIC_PROOF/inputs",
                "receiptRoot": "<private-working-directory>/.g3a-transaction-HARD_BOUND_STATIC_PROOF/receipts",
                "evidenceRoot": "<private-working-directory>/.g3a-isolation-proof-hard-bound-static",
                "capacity": {"buildRootBytes": 1073741824, "buildRootInodes": 32768,
                             "tmpBytes": 268435456, "tmpInodes": 4096},
                "inputStaging": "external immutable exact fifteen inputs, direct readonly /inputs bind",
                "proofChildTimeoutSeconds": 75, "proofOutputLimitBytes": 262144,
                "diagnosticLineMaximumCharacters": 3800,
                "witness": {"source": "static_witness.go", "stdout": "G3A_HARMLESS_STATIC_EXEC_WITNESS_V1\n",
                            "arguments": [], "environment": ["PATH=/unavailable", "HOME=/unavailable"]},
                "futureExecutionAuthorityDigest": "", "frozenCoreInvocations": 0,
                "permittedConfiguration": "one exact proof contract digest; no alternate paths, limits, payloads or commands"}
    raw = (json.dumps(contract, sort_keys=True, separators=(",", ":")) + "\n").encode()
    fresh("proof_contract.json", raw)
    digest = hashlib.sha256(raw).hexdigest()
    fresh("proof_contract_binding.go", 'package main\n\nconst hardProofContractSHA256 = "' + digest + '"\n')
    fresh("PREPARATION.json", {"initialBaseline": initial, "proofContractSha256": digest,
                             "sourceCopies": base, "payloadSha256": sha(HERE / "payload.tar")})
    print("PROOF_CONTRACT_SHA256=" + digest)


if __name__ == "__main__":
    main()
