import hashlib, json, subprocess
from pathlib import Path

ROOT = Path(r"C:\APPS\worktrees\nzila-g2-provenance")
HERE = Path(__file__).resolve().parent
V1 = ROOT / ".azure/g3a-hard-runner-candidate"
FOREIGN = Path(r"C:\APPS\nzila-os")

def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def guard():
    result = {}
    for label, root, head in (
        ("owned", ROOT, "7bec20aad11d43eeae8099c14e021b3074154b27"),
        ("foreign", FOREIGN, "1c337567635bb86ea0df7831557d8d2d22df1e6f"),
    ):
        actual = subprocess.check_output(["git", "-C", str(root), "rev-parse", "HEAD"], text=True).strip()
        status = subprocess.check_output(["git", "-C", str(root), "status", "--short"], text=True)
        if actual != head or label == "owned" and status.splitlines() != [
            "?? .azure/", "?? infrastructure/landing-zone/g2-builder/"]:
            raise RuntimeError("BASELINE_DRIFT_" + label)
        result[label] = {"head": actual, "statusCount": len(status.splitlines()),
                         "statusSha256": hashlib.sha256(status.encode()).hexdigest()}
    if sha(V1 / "production-runner") != "9889228f05e27a95593ba02e44e54127985175d4748bf98e0c6600bb662d1273":
        raise RuntimeError("V1_CHANGED")
    if sha(ROOT / ".azure/g3a-hard-capacity/FINAL_VERIFICATION.json") != "e5a652df093781d51d225119d3ded4849fe44e2f5cf8db13bf994e08b78d5f0e":
        raise RuntimeError("PROTECTED_ROOT_CHANGED")
    preserved = HERE / "PRESERVED.json"
    if preserved.exists():
        for p, h in json.loads(preserved.read_text())["hashes"].items():
            if sha(Path(p)) != h:
                raise RuntimeError("PRESERVED_BYTES_CHANGED_" + p)
    return result

def fresh(name, raw):
    guard()
    if not isinstance(raw, bytes):
        raw = (raw if isinstance(raw, str) else json.dumps(raw, indent=2) + "\n").encode()
    with (HERE / name).open("xb") as f:
        f.write(raw)

def main():
    baseline = guard()
    originals = [p for p in V1.iterdir() if p.is_file()]
    protected = ROOT / ".azure/g3a-hard-capacity/FINAL_VERIFICATION.json"
    fresh("PRESERVED.json", {"baseline": baseline, "hashes": {str(p): sha(p) for p in originals + [protected]}})
    names = ["launcher.go", "census.go", "proof_linux.go", "dispatch.go", "frozen_bindings.go",
             "production_linux.go", "payload.tar", "hardproof_linux.go", "hardproof_child_linux.go",
             "proof_contract_binding.go", "proof_contract.json", "static_witness_binding.go",
             "static-witness", "verify_primitives.go", "verify_static_primitives.go",
             "proof_evidence_reader.py", "proof_dictionary.bin", "evidence_transport.py",
             "test_evidence_transport.py"]
    for name in names:
        raw = (V1 / name).read_bytes()
        if name == "dispatch.go":
            text = raw.decode()
            start = text.index("// Only a future")
            end = text.index("const qualifiedRuntime")
            text = text[:start] + text[end:]
            start, end = text.index("type executionAuthority struct"), text.index("type verifiedProduction")
            text = text[:start] + text[end:]
            start, end = text.index("func validateRequest("), text.index("func dispatchProduction(")
            text = text[:start] + text[end:]
            raw = text.encode()
        if name == "hardproof_linux.go":
            raw = raw.replace(b'trustedExecutionAuthoritySHA256 != "" || ', b'')
        if name == "production_linux.go":
            text = raw.decode()
            start, end = text.index("func runProduction("), text.index("type cappedBuffer")
            child = text[text.index("func validatedChildPlan(", start):end]
            child = child.replace('validateRequest([]byte(plan["production"]), trustedExecutionAuthoritySHA256)',
                                  'validateRequest([]byte(plan["production"]), plan["authoritySha256"])')
            child = child.replace('if err = secureRoot(verified.Request.ReceiptRoot);', '''
    if len(plan) != 5 || (plan["mode"] != "--production" && plan["mode"] != "--production-dispatch-proof") ||
        validateAuthorityMode(verified.Request.Authority, plan["mode"]) != nil {
        return verified, errors.New("CHILD_DISPATCH_MODE_BINDING")
    }
    if err = secureRoot(verified.Request.ReceiptRoot);''')
            text = text[:start] + '''func runProduction(input io.Reader) error {
    return errors.New("EXPLICIT_RUNTIME_AUTHORITY_FILE_AND_DIGEST_REQUIRED")
}

''' + child + text[end:]
            text = text.replace('"evidence": evidence, "cwd": b.CWD, "production": string(verified.Raw),',
                                '"evidence": evidence, "cwd": b.CWD, "production": string(verified.Raw),\n "authoritySha256": verified.Pin, "mode": authorityMode(verified.Request.Authority),')
            text = text.replace('return dispatchConstructedCore(plan, r, func() error { return executeFrozenCore(r, output) })',
                                '''if authorityMode(plan.Request.Authority) == "--production-dispatch-proof" {
        return invokeHardProofWitness(plan, r, output)
    }
    return dispatchConstructedCore(plan, r, func() error { return executeFrozenCore(r, output) })''')
            raw = text.encode()
        if name == "launcher.go":
            text = raw.decode().replace('func main() {', '''func main() {
    if len(os.Args) > 2 && (os.Args[1] == "--production" || os.Args[1] == "--production-dispatch-proof") {
        if err := runRuntimeProduction(os.Args[1:]); err != nil {
            fmt.Fprintln(os.Stderr, err)
            os.Exit(1)
        }
        return
    }''')
            raw = text.encode()
        fresh(name, raw)
    tests = (V1 / "production_linux_test.go").read_text()
    start, end = tests.index("func TestActualProductionEntrypoint"), tests.index("func localFixture")
    tests = tests[:start] + tests[end:]
    start, end = tests.index("func TestActualDurableReceipt"), tests.index("func TestBoundedMount")
    tests = tests[:start] + tests[end:]
    tests = tests.replace('\n\t"strings"', '')
    fresh("production_linux_test.go", tests)

if __name__ == "__main__":
    main()
