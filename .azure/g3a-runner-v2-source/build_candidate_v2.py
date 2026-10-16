"""Build final candidate only after exact source gate PASS; CLI negatives never launch a constructor."""
import json, os, re, struct
from pathlib import Path
from prepare_v2 import HERE, guard, fresh, sha
from build_source_gate import GO, IMAGE, FINAL, execute
from generate_authority import make_authority, digest

def main():
    guard()
    gate=json.loads((HERE/"SOURCE_GATE_PASS_5.json").read_text())
    if gate["status"]!="PASS":raise ValueError("SOURCE_GATE_NOT_PASS")
    binding=json.loads((HERE/gate["sourceBinding"]).read_text())
    for n,item in binding["fullSources"].items():
        if sha(HERE/n)!=item["sha256"] or (HERE/n).stat().st_size!=item["bytes"]:raise ValueError("SOURCE_DRIFT_"+n)
    env=dict(os.environ,GOENV="off",GOTOOLCHAIN="local",GO111MODULE="off",CGO_ENABLED="0",GOOS="linux",GOARCH="amd64")
    for key,name in [("GOCACHE","cache"),("GOPATH","gopath"),("GOTMPDIR","go-work"),("TEMP","host-work"),("TMP","host-work")]:
        env[key]=str(HERE/".checks"/name)
    binary=HERE/"production-runner-v2"
    if binary.exists():raise ValueError("FINAL_CANDIDATE_ALREADY_EXISTS")
    result=execute([GO,"build","-trimpath","-buildvcs=false","-ldflags=-s -w -buildid=","-o",binary]+FINAL,env,180)
    fresh("FINAL_BUILD.json",result)
    if result["exitCode"]:print(result["stderr"]);return 1
    raw=binary.read_bytes()
    if raw[:6]!=b"\x7fELF\x02\x01" or struct.unpack_from("<H",raw,18)[0]!=62:raise ValueError("LINUX_AMD64_ELF_REQUIRED")
    offset=struct.unpack_from("<Q",raw,32)[0];size,count=struct.unpack_from("<HH",raw,54)
    types=[struct.unpack_from("<I",raw,offset+i*size)[0] for i in range(count)]
    if 3 in types or 2 in types:raise ValueError("DYNAMIC_ELF_DENIED")
    fresh("ELF_V2.json",{"sha256":digest(raw),"bytes":len(raw),"staticELF":True,"elfMachine":62,"programHeaderTypes":types})
    authority=make_authority("local-test","SYNTHETIC_LOCAL_TEST_SOURCE",
                            "/proof/.g3a-transaction-SYNTHETIC_LOCAL_TEST_SOURCE",binary)
    fresh("SYNTHETIC_LOCAL_TEST_AUTHORITY.json",json.dumps(authority,sort_keys=True,separators=(",",":")).encode())
    proof=make_authority("dispatch-proof","SYNTHETIC_DISPATCH_PROOF_SOURCE",
                        "/proof/.g3a-transaction-SYNTHETIC_DISPATCH_PROOF_SOURCE",binary)
    fresh("SYNTHETIC_DISPATCH_PROOF_AUTHORITY.json",json.dumps(proof,sort_keys=True,separators=(",",":")).encode())
    code=r'''
import copy, hashlib, json, os, subprocess
runner="/candidate/production-runner-v2"
base=json.load(open("/candidate/SYNTHETIC_LOCAL_TEST_AUTHORITY.json"))
boundary=os.path.dirname(base["inputRoot"])
os.mkdir(boundary,0o700);os.mkdir(base["receiptRoot"],0o700)
path=boundary+"/execution-authority.json"
results=[]
def run(label,args):
    p=subprocess.run([runner]+args,stdin=subprocess.DEVNULL,capture_output=True,text=True,timeout=15,
      env={"PATH":"/unavailable","HOME":"/unavailable","G3A_EXECUTION_AUTHORITY_SHA256":"a"*64})
    assert p.returncode!=0,label+"_NOT_DENIED"
    assert not os.listdir(base["receiptRoot"]),label+"_CONSUMED_OR_SETUP"
    results.append({"case":label,"exitCode":p.returncode,"stderr":p.stderr.strip(),"constructorInvocations":0,"frozenCoreInvocations":0})
for label,args in [
    ("no-authority",["--production"]),("no-proof-authority",["--production-dispatch-proof"]),
    ("missing-digest",["--production","--execution-authority",path]),
    ("digest-without-path",["--production","--execution-authority-sha256","a"*64]),
    ("relative",["--production","--execution-authority","authority.json","--execution-authority-sha256","a"*64]),
    ("child-direct",["--_isolated-production-child"]),
    ("extra-arg",["--production","--execution-authority",path,"--execution-authority-sha256","a"*64,"--shell"])]:
    run(label,args)
cases={"empty":None,"malformed":None,"wrong-supplied-digest":None,"symlink":None,"writable":None,"valid-authority-missing-input":None,
       "proof-production-substitution":None,"wrong-schema":("schema","wrong"),"wrong-mission":("mission","wrong"),
       "wrong-gate":("gate","wrong"),"wrong-operation":("operation","shell"),
       "wrong-runner":("runnerSha256","0"*64),"wrong-source":("runnerSourceSha256","0"*64),
       "wrong-policy":("authorityPolicySha256","0"*64),"wrong-transaction":("transactionId","OTHER"),
       "wrong-input-root":("inputRootSha256","0"*64),"wrong-census":("inputCensusSha256","0"*64),
       "wrong-manifest":("expectedManifestSha256","0"*64),"excess-build":("buildRootBytes",1073745920),
       "excess-build-inodes":("buildRootInodes",32769),"excess-tmp":("tmpBytes",268439552),
       "excess-tmp-inodes":("tmpInodes",4097),"synthetic-false":("syntheticOnly",False),
       "singleuse-false":("singleUse",False),"before-notBefore":("notBefore","2099-01-01T00:00:00Z"),
       "expired":("expiresAt","2000-01-01T00:00:00Z"),"overlong":("expiresAt","2099-01-01T00:00:00Z"),
       "wrong-registry":("targetRegistry","other.azurecr.io"),"wrong-repo":("targetRepository","other"),
       "unknown-command":("command","/bin/sh"),"missing-synthetic":None,"trailing":None,"duplicate":None}
for name,change in cases.items():
    a=copy.deepcopy(base)
    if change:a[change[0]]=change[1]
    if name=="missing-synthetic":del a["syntheticOnly"]
    raw=json.dumps(a,sort_keys=True,separators=(",",":")).encode()
    if name=="empty":raw=b""
    if name=="malformed":raw=b"{"
    if name=="trailing":raw+=b"{}"
    if name=="duplicate":raw=b'{"schema":"g3a-execution-authority-v1",'+raw[1:]
    if os.path.lexists(path):os.unlink(path)
    with open(path,"xb") as f:f.write(raw)
    os.chmod(path,0o600 if name=="writable" else 0o400)
    pin=hashlib.sha256(raw).hexdigest()
    if name=="wrong-supplied-digest":pin="0"*64
    if name=="symlink":
        target=boundary+"/original.json";os.rename(path,target);os.symlink(target,path)
    mode="--production-dispatch-proof" if name=="proof-production-substitution" else "--production"
    run(name,[mode,"--execution-authority",path,"--execution-authority-sha256",pin])
print(json.dumps({"status":"PASS","matrix":results,"receiptUnconsumed":True,"constructorInvocations":0,"frozenCoreInvocations":0}))
'''
    cmd=["docker","run","--rm","--pull","never","--network","none","--read-only","--memory","512m","--pids-limit","64",
         "--cap-drop","ALL","--security-opt","no-new-privileges",
         "--mount",f"type=bind,source={HERE},target=/candidate,readonly",
         "--tmpfs","/proof:rw,noexec,nosuid,nodev,size=8388608,nr_inodes=512,mode=0700",
         "--workdir","/proof",IMAGE,"python3","-I","-B","-S","-c",code]
    r=execute(cmd,env,180)
    fresh("REAL_CLI_NEGATIVES_COMMAND.json",r)
    if r["exitCode"]:print(r["stderr"]);return 1
    matrix=json.loads(r["stdout"]);fresh("REAL_CLI_NEGATIVES.json",matrix)
    fresh("FINAL_V2_COMPONENT_CENSUS.json",{"candidate":{"sha256":sha(binary),"bytes":binary.stat().st_size},
         "sourceBinding":gate["sourceBinding"],"sourceSha256":binding["sourceSha256"],
         "policySha256":binding["policySha256"],"sourceGate":"SOURCE_GATE_PASS_5.json",
         "components":{n:{"sha256":sha(HERE/n),"bytes":(HERE/n).stat().st_size} for n in FINAL+
            ["payload.tar","static-witness","authority-policy.json","generate_authority.py"]}})
    print("PASS candidate",sha(binary),binary.stat().st_size,"CLI denials",len(matrix["matrix"]))
    return 0
if __name__=="__main__":raise SystemExit(main())
