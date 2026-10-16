"""Local-only builds and one harmless actual published handoff, never frozen core."""
import json
import os
from delivery_guard import CANDIDATE, GO, HERE, IMAGE, execute, fresh, guard, sha


def main():
    env = os.environ.copy()
    env.update({"GOENV": "off", "GOTOOLCHAIN": "local", "GO111MODULE": "off", "CGO_ENABLED": "0",
                "GOOS": "linux", "GOARCH": "amd64", "GOCACHE": str(HERE / ".checks" / "go-cache")})
    guard()
    (HERE / ".checks").mkdir(exist_ok=False)
    sources = ["handoff_linux.go", "bundle_binding.go"]
    results = []
    for command in (
        [str(GO.with_name("gofmt.exe")), "-w", *sources, "handoff_linux_test.go"],
        [GO, "test", "-c", "-trimpath", "-buildvcs=false", "-o", ".checks\\handoff-tests",
         *sources, "handoff_linux_test.go"],
        [GO, "build", "-trimpath", "-buildvcs=false", "-ldflags=-s -w -buildid=",
         "-o", "g3a-handoff", *sources],
    ):
        result = execute(command, env=env)
        results.append(result)
        if result["exitCode"] != 0:
            fresh("BUILD_FAILURE_1.json", {"results": results})
            raise RuntimeError("LOCAL_DELIVERY_BUILD_FAILED")
    census = json.loads((HERE / "BUNDLE_CENSUS.json").read_text())
    witness = json.loads((CANDIDATE / "KERNEL_CANDIDATE_WITNESS.json").read_text())
    constants = {key: census[key] for key in ("bundleSha256", "bundleBytes", "candidateSha256", "candidateBytes")}
    constants.update({"shimSha256": sha(HERE / "g3a-handoff"), "shimBytes": (HERE / "g3a-handoff").stat().st_size,
        "proofContractSha256": census["contractSha256"], "dictionarySha256": sha(HERE / "proof_dictionary.bin"),
        "fixedReaderSha256": sha(HERE / "proof_evidence_reader.py"),
        "embeddedCensusSha256": witness["embeddedCensusSha256"], "runtimeCensusCount": witness["runtimeCensusCount"],
        "runtimeSha256": witness["runtimeEvidenceSha256"],
        "inputSpecSha256": witness["details"]["inputSpecSha256"],
        "pinnedKernel": "6.17.0-1022-azure", "pinnedRootCaps": "000001ffffffffff"})
    fresh("DELIVERY_CONSTANTS.json", constants)
    volume = "nzila-g3a-hard-delivery-14500503"
    absent = execute(["docker", "volume", "inspect", volume])
    if absent["exitCode"] == 0:
        fresh("VOLUME_CONFLICT.json", absent)
        raise RuntimeError("EXCLUSIVE_LOCAL_VALIDATION_VOLUME_ALREADY_EXISTS")
    created = execute(["docker", "volume", "create", "--label", "nzila.scope=g3a-hard-runner-delivery",
                       "--label", "nzila.owner=14500503", volume])
    fresh("LOCAL_VOLUME_OWNERSHIP.json", {"name": volume, "created": created, "preexisting": False})
    if created["exitCode"] != 0:
        raise RuntimeError("LOCAL_OWNED_DISK_VOLUME_UNAVAILABLE")
    driver = r'''
import hashlib,json,os,pathlib,shutil,subprocess
base=pathlib.Path("/var/lib/waagent/custom-script/download/0")
os.chmod(base,0o700);os.chdir(base)
os.mkdir(".checks",0o700)
test=subprocess.run(["/delivery/.checks/handoff-tests","-test.v"],capture_output=True,text=True,timeout=60)
print(json.dumps({"unitTests":test.returncode,"stdout":test.stdout,"stderr":test.stderr}))
assert test.returncode==0
shutil.rmtree(".checks")
for name,mode in (("g3a-handoff",0o500),("g3a-proof-capsule",0o400)):
    fd=os.open(name,os.O_WRONLY|os.O_CREAT|os.O_EXCL,mode)
    with open("/delivery/"+name,"rb") as source,os.fdopen(fd,"wb") as target:
        shutil.copyfileobj(source,target,1048576)
    os.chmod(name,mode)
constants=json.load(open("/delivery/DELIVERY_CONSTANTS.json"))
bundle=constants["bundleSha256"]
negative=[]
for args in ([],["--deliver-bound-static-proof"],["--deliver-bound-static-proof","0"*64],
             ["--deliver-bound-static-proof",bundle,"extra"],["--production",bundle],
             ["--deliver-bound-static-proof",bundle.upper()],["--verify-bound-bundle",bundle,"/other"]):
    r=subprocess.run(["./g3a-handoff",*args],capture_output=True,text=True,timeout=10)
    assert r.returncode!=0 and not r.stdout
    negative.append({"args":args,"exitCode":r.returncode,"stderr":r.stderr})
verify=subprocess.run(["./g3a-handoff","--verify-bound-bundle",bundle],capture_output=True,text=True,timeout=90)
assert verify.returncode==0,(verify.stdout,verify.stderr)
with open("g3a-proof-capsule","r+b") as file:
    file.seek(512);original=file.read(1);file.seek(512);file.write(bytes([original[0]^1]))
corrupt=subprocess.run(["./g3a-handoff","--verify-bound-bundle",bundle],capture_output=True,text=True,timeout=90)
assert corrupt.returncode!=0 and not corrupt.stdout and not (base/".g3a-transaction-HARD_BOUND_STATIC_PROOF").exists()
with open("g3a-proof-capsule","r+b") as file:
    file.seek(512);file.write(original)
assert hashlib.sha256(open("g3a-proof-capsule","rb").read()).hexdigest()==bundle
actual=subprocess.run(["./g3a-handoff","--deliver-bound-static-proof",bundle],capture_output=True,text=True,timeout=150)
record={"negativeEntryPoints":negative,"wholeBundleIntegrity":verify.returncode,
        "corruptMemberDenial":{"exitCode":corrupt.returncode,"stderr":corrupt.stderr},
        "actualHandoffExitCode":actual.returncode,"actualStdout":actual.stdout,"actualStderr":actual.stderr,
        "frozenCoreInvocations":0,"scope":"LOCAL_ACTUAL_HARMLESS_CANDIDATE_HANDOFF_NOT_PINNED_GUEST"}
if actual.returncode==0:
    record["exactFiles"]={name:(base/name).read_text() for name in
        (".g3a-hard-delivery-evidence/handoff.json",".g3a-isolation-proof-hard-bound-static/baseline.json",
         ".g3a-isolation-proof-hard-bound-static/proof.json")}
    record["transactionRootGone"]=not (base/".g3a-transaction-HARD_BOUND_STATIC_PROOF").exists()
print("G3A_LOCAL_DELIVERY_VALIDATION_V1 "+json.dumps(record,separators=(",",":")))
assert actual.returncode==0,(actual.stdout,actual.stderr)
assert record["transactionRootGone"]
'''
    command = ["docker", "run", "--rm", "--pull", "never", "--network", "none", "--read-only",
               "--memory", "768m", "--pids-limit", "128", "--cpus", "2", "--cap-drop", "ALL"]
    for cap in ("SYS_ADMIN", "SYS_CHROOT", "SETPCAP", "SETUID", "SETGID", "CHOWN", "DAC_OVERRIDE", "FOWNER"):
        command += ["--cap-add", cap]
    command += ["--security-opt", "seccomp=unconfined", "--mount", f"type=bind,source={HERE},target=/delivery,readonly",
                "--mount", f"type=volume,source={volume},target=/var/lib/waagent/custom-script/download/0",
                IMAGE, "python3", "-I", "-B", "-S", "-c", driver]
    result = execute(command, timeout=300)
    results.append(result)
    fresh("HANDOFF_VALIDATION_ATTEMPT_1.json", {"results": results, "candidateUnchanged": sha(CANDIDATE / "production-runner")})
    if result["exitCode"] != 0:
        raise RuntimeError("ACTUAL_LOCAL_DELIVERY_VALIDATION_FAILED_VOLUME_RETAINED_FOR_OWNED_DIAGNOSTICS")
    print(json.dumps({"shimSha256": constants["shimSha256"], "shimBytes": constants["shimBytes"],
                      "handoffValidation": "PASS", "volume": volume}))


if __name__ == "__main__":
    main()
