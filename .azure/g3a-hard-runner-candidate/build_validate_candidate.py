"""Bound and test the static runner; one harmless candidate proof, zero frozen-core calls."""
import hashlib
import json
import os
import re
import shutil
import sys

from candidate_guard import (CORE, GO, HERE, IMAGE, QUALIFIED, ROOT, SOURCE,
                             directory, execute, fresh, guard, sha)

FINAL = CORE + ("hardproof_linux.go", "hardproof_child_linux.go",
                "proof_contract_binding.go", "static_witness_binding.go")
TESTS = ("dispatch_test.go", "transaction_roots_test.go", "production_linux_test.go",
         "hardproof_linux_test.go")
CAPS = ("SYS_ADMIN", "SYS_CHROOT", "SETPCAP", "SETUID", "SETGID", "CHOWN", "DAC_OVERRIDE", "FOWNER")


def main():
    initial = guard()
    check = HERE / ".checks"
    directory(check)
    env = dict(os.environ, GOENV="off", GOTOOLCHAIN="local", GO111MODULE="off", CGO_ENABLED="0")
    for var, name in (("GOCACHE", "cache"), ("GOPATH", "gopath"), ("GOTMPDIR", "go-work"),
                      ("TEMP", "host-work"), ("TMP", "host-work")):
        path = check / name
        directory(path)
        env[var] = str(path)
    results = []
    linux = dict(env, GOOS="linux", GOARCH="amd64")
    if not (HERE / "static-witness").exists():
        results.append(execute([GO, "build", "-trimpath", "-buildvcs=false", "-ldflags=-s -w -buildid=",
                                "-o", HERE / "static-witness", "static_witness.go"], linux))
        if results[-1]["exitCode"] != 0:
            return save(results, initial, 1)
        fresh("static_witness_binding.go", 'package main\n\nconst hardProofExecutableSHA256 = "' +
              sha(HERE / "static-witness") + '"\n')
    verifier = HERE / "verify_static_primitives.go"
    if not verifier.exists():
        text = (HERE / "verify_primitives.go").read_text()
        text = text.replace('len(args) == 5, "FIVE_SOURCE_ARGUMENTS_REQUIRED"',
                            'len(args) == 7, "SEVEN_SOURCE_ARGUMENTS_REQUIRED"')
        text = text.replace('backend := functions(args[4])', '''backend := functions(args[4])
        proofChild, proofParent := functions(args[5]), functions(args[6])
        candidate["productionChild"] = proofChild["hardBoundStaticProofChild"]
        backend["launch"] = proofParent["hardBoundStaticProof"]
        require(candidate["productionChild"] != nil && backend["launch"] != nil, "ACTUAL_STATIC_PROOF_NOT_WIRED")''')
        text = text.replace("validatedChildPlan(plan)", "validatedHardProofPlan(plan)")
        text = text.replace("invokeProductionCore(productionPlan, &r, evidenceFD)",
                            "invokeHardProofWitness(productionPlan, &r, evidenceFD)")
        text = text.replace('"PASS_PRIMITIVE_EQUIVALENCE_AND_SOURCE_WIRING"',
                            '"PASS_STATIC_PROOF_PRIMITIVE_EQUIVALENCE_AND_SOURCE_WIRING"')
        fresh("verify_static_primitives.go", text)
    for name in FINAL + TESTS + ("static_witness.go", "verify_static_primitives.go"):
        result = execute([GO.parent / "gofmt.exe", "-w", HERE / name], env)
        if result["exitCode"] != 0:
            return save(results + [result], initial, 1)
    results.append(execute([GO, "test", "-v", "dispatch.go", "frozen_bindings.go",
                            "dispatch_test.go", "transaction_roots_test.go"], env))
    original_args = [QUALIFIED / "proof_linux.go", HERE / "proof_linux.go",
                     QUALIFIED / "launcher.go", HERE / "launcher.go", HERE / "production_linux.go"]
    results.append(execute([GO, "run", "verify_primitives.go", "--"] + original_args, env))
    results.append(execute([GO, "run", "verify_static_primitives.go", "--"] + original_args +
                           [HERE / "hardproof_child_linux.go", HERE / "hardproof_linux.go"], env))
    if any(r["exitCode"] != 0 for r in results):
        return save(results, initial, 1)
    if not (HERE / "runner-source-tests").exists():
        results.append(execute([GO, "test", "-c", "-o", HERE / "runner-source-tests"] + list(FINAL + TESTS), linux))
    if any(r["exitCode"] != 0 for r in results):
        return save(results, initial, 1)
    container = ["docker", "run", "--rm", "--pull", "never", "--network", "none", "--read-only",
                 "--memory", "768m", "--pids-limit", "128", "--cpus", "2",
                 "--mount", f"type=bind,source={HERE},target=/candidate,readonly",
                 "--tmpfs", "/proof:rw,noexec,nosuid,nodev,size=8388608,nr_inodes=256,mode=0700",
                 "--workdir", "/proof"]
    results.append(execute(container + ["--cap-drop", "ALL", "--security-opt", "no-new-privileges",
                           IMAGE, "/candidate/runner-source-tests", "-test.v", "-test.timeout=60s"], env))
    if any(r["exitCode"] != 0 for r in results):
        return save(results, initial, 1)
    if not (HERE / "production-runner").exists():
        results.append(execute([GO, "build", "-trimpath", "-buildvcs=false", "-ldflags=-s -w -buildid=",
                                "-o", HERE / "production-runner"] + list(FINAL), linux))
    if any(r["exitCode"] != 0 for r in results):
        return save(results, initial, 1)
    token = json.loads((HERE / "PREPARATION.json").read_text())["proofContractSha256"]
    binary_negatives = r'''
import json, os, subprocess
runner = "/candidate/production-runner"
token = TOKEN
values = [
    ["--production"],
    ["--hard-bound-static-proof"],
    ["--hard-bound-static-proof", ""],
    ["--hard-bound-static-proof", "0"*64],
    ["--hard-bound-static-proof", token.upper()],
    ["--hard-bound-static-proof", token, "extra"],
    ["--hard-bound-static-proof", token, '{"buildRootBytes":2147483648}'],
    ["--hard-bound-static-proof", token, "/alternate/inputs"],
    ["--_hard-bound-static-proof-child", token],
    ["--hard-bound-static-proof", token],
    ["--production", token],
    ["--production", '{"authority":"future"}'],
]
reports=[]
for args in values:
    result = subprocess.run([runner]+args, input=b'{"authority":"unissued"}',
        capture_output=True, timeout=10, env=dict(os.environ,
        G3A_EXECUTION_AUTHORITY_SHA256=token, G3A_PROOF_CAPACITY="2147483648",
        G3A_PROOF_INPUT_ROOT="/alternate/inputs"))
    assert result.returncode != 0, (args, result.stdout, result.stderr)
    assert len(result.stdout) <= 3800 and len(result.stderr) <= 4096
    reports.append({"args":args, "exitCode":result.returncode,
        "stdout":result.stdout.decode(), "stderr":result.stderr.decode()})
# Missing authority must deny before reading EOF, even with environment overrides.
process = subprocess.Popen([runner, "--production"], stdin=subprocess.PIPE,
    stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    env=dict(os.environ, G3A_EXECUTION_AUTHORITY_SHA256=token))
exit_code = process.wait(timeout=3)
assert exit_code != 0
reports.append({"args":["--production"], "openStdinDeniedBeforeEOF":True,
    "exitCode":exit_code, "stdout":process.stdout.read().decode(),
    "stderr":process.stderr.read().decode()})
process.stdin.close()
print(json.dumps({"status":"PASS_CANDIDATE_ENTRYPOINT_NEGATIVES","reports":reports,
    "futureAuthorityDigest":"","productionExecutions":0,"frozenCoreInvocations":0}))
'''.replace("TOKEN", repr(token))
    results.append(execute(container + ["--cap-drop", "ALL", "--security-opt", "no-new-privileges",
                                       IMAGE, "python3", "-I", "-B", "-S", "-c", binary_negatives], env))
    if any(r["exitCode"] != 0 for r in results):
        return save(results, initial, 1)
    inputs = check / ".g3a-transaction-HARD_BOUND_STATIC_PROOF" / "inputs"
    directory(inputs)
    spec = re.findall(r'"([^"]+)":\s+\{(\d+), "([0-9a-f]{64})"\}', (HERE / "frozen_bindings.go").read_text())
    if len(spec) != 15:
        raise RuntimeError("EXACT_FIFTEEN_INPUT_CENSUS_REQUIRED")
    for name, size, digest in spec:
        original = ROOT / ".azure" / "g3a-controller-repair" / "inputs" / name
        target = inputs / name
        if original.is_symlink() or original.stat().st_size != int(size) or sha(original) != digest:
            raise RuntimeError("HISTORICAL_INPUT_CHANGED_" + name)
        if not target.exists():
            guard()
            with original.open("rb") as source, target.open("xb") as destination:
                shutil.copyfileobj(source, destination, 1024*1024)
        if target.stat().st_size != int(size) or sha(target) != digest:
            raise RuntimeError("DISK_FIXTURE_INPUT_CHANGED_" + name)
    if {p.name for p in inputs.iterdir()} != {n for n, _, _ in spec}:
        raise RuntimeError("EXACT_DISK_FIXTURE_CENSUS")
    live_command = container + ["--cap-drop", "ALL"]
    for cap in CAPS:
        live_command += ["--cap-add", cap]
    live_command += ["--security-opt", "seccomp=unconfined",
                     "--mount", f"type=bind,source={inputs},target=/proof/.g3a-transaction-HARD_BOUND_STATIC_PROOF/inputs,readonly"]
    witness = r'''
import hashlib, json, os, stat, subprocess
token = TOKEN
base = "/proof"
os.chmod(base, 0o700)
boundary = base+"/.g3a-transaction-HARD_BOUND_STATIC_PROOF"
os.chmod(boundary, 0o700)
os.mkdir(boundary+"/receipts", 0o700)
assert os.stat(boundary+"/inputs").st_mode & 5 == 5
before = open("/proc/self/mountinfo", "rb").read()
result = subprocess.run(["/candidate/production-runner","--hard-bound-static-proof",token],
    capture_output=True, timeout=90)
summary = result.stdout.decode()
assert len(summary.rstrip("\n")) <= 3800
evidence = base+"/.g3a-isolation-proof-hard-bound-static"
files={}
for name in ("baseline.json","proof.json"):
    path=evidence+"/"+name
    if os.path.isfile(path):
        files[name]=open(path,"rb").read().decode()
print(json.dumps({"candidateExitCode":result.returncode,"stdout":summary,
    "stderr":result.stderr.decode(),"files":files,
    "controllerParentMountinfoUnchanged":open("/proc/self/mountinfo","rb").read()==before,
    "proofRootRemoved":not os.path.exists(evidence+"/root"),
    "receiptsEmpty":not os.listdir(boundary+"/receipts"),
    "frozenCoreInvocations":0,"futureAuthorityIssued":False}))
assert result.returncode == 0, (result.returncode,summary,result.stderr.decode())
assert open("/proc/self/mountinfo","rb").read()==before
assert not os.path.exists(evidence+"/root")
assert not os.listdir(boundary+"/receipts")
'''.replace("TOKEN", repr(token))
    results.append(execute(live_command + [IMAGE, "python3", "-I", "-B", "-S", "-c", witness], env))
    return save(results, initial, 0 if all(r["exitCode"] == 0 for r in results) else 1)


def save(results, initial, code):
    attempt = 1
    while (HERE / f"CANDIDATE_VALIDATION_ATTEMPT_{attempt}.json").exists():
        attempt += 1
    report = {"initialBaseline": initial, "finalBaseline": guard(), "results": results,
              "candidateSha256": sha(HERE / "production-runner") if (HERE / "production-runner").exists() else None,
              "candidateBytes": (HERE / "production-runner").stat().st_size if (HERE / "production-runner").exists() else None,
              "sourceHashes": {name: sha(HERE / name) for name in FINAL + TESTS if (HERE / name).exists()},
              "frozenCoreInvocations": 0, "azureReads": 0, "azureMutations": 0,
              "registryCalls": 0, "futureAuthorityIssued": False}
    fresh(f"CANDIDATE_VALIDATION_ATTEMPT_{attempt}.json", report)
    for result in results:
        print(json.dumps({"command": result["command"][:6], "exitCode": result["exitCode"]}))
        if result["exitCode"] != 0:
            print(result["stdout"])
            print(result["stderr"])
    print("EVIDENCE=" + str(HERE / f"CANDIDATE_VALIDATION_ATTEMPT_{attempt}.json"))
    return code


if __name__ == "__main__":
    sys.exit(main())
