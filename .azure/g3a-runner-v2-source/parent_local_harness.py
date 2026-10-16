"""Parent-only qualification harness. This source-phase worker must not execute its transaction path."""
import argparse, json, os, re, shutil, subprocess
from pathlib import Path
from prepare_v2 import HERE, ROOT, guard, sha
from build_source_gate import IMAGE
from generate_authority import make_authority, digest

CAPS=["SYS_ADMIN","SYS_CHROOT","SETPCAP","SETUID","SETGID","CHOWN","DAC_OVERRIDE","FOWNER"]
def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--mode",choices=["local-test","dispatch-proof"],required=True)
    p.add_argument("--run-root",type=Path,required=True);p.add_argument("--transaction",required=True)
    p.add_argument("--parent-single-core-permit",action="store_true")
    a=p.parse_args()
    if a.mode=="local-test" and not a.parent_single_core_permit:
        p.error("parent owns sole frozen-core permit; explicit --parent-single-core-permit required")
    initial=guard()
    run=a.run_root.resolve()
    if not run.is_relative_to(ROOT/".azure") or run.exists():raise ValueError("FRESH_OWNED_RUN_ROOT_REQUIRED")
    candidate=HERE/"production-runner-v2"
    census=json.loads((HERE/"FINAL_V2_COMPONENT_CENSUS.json").read_text())
    if sha(candidate)!=census["candidate"]["sha256"]:raise ValueError("CANDIDATE_DRIFT")
    run.mkdir();inputs=run/"inputs";inputs.mkdir()
    spec=re.findall(r'"([^"]+)":\s*\{(\d+), "([0-9a-f]{64})"\}',
                    (HERE/"frozen_bindings.go").read_text().split("var exactOutputs")[0])
    if len(spec)!=15 or sum(int(n) for _,n,_ in spec)!=265077049:raise ValueError("FROZEN_INPUT_CENSUS")
    source=ROOT/".azure/g3a-controller-repair/inputs"
    for name,size,h in spec:
        original=source/name
        if original.is_symlink() or original.stat().st_size!=int(size) or sha(original)!=h:raise ValueError("INPUT_DRIFT_"+name)
        with original.open("rb") as src,(inputs/name).open("xb") as dst:shutil.copyfileobj(src,dst,1024*1024)
        if sha(inputs/name)!=h:raise ValueError("STAGED_INPUT_DRIFT")
    boundary="/proof/.g3a-transaction-"+a.transaction
    authority=make_authority(a.mode,a.transaction,boundary,candidate)
    raw=json.dumps(authority,sort_keys=True,separators=(",",":")).encode()
    with (run/"SYNTHETIC_AUTHORITY.json").open("xb") as f:f.write(raw)
    output=run/"results";output.mkdir()
    mode="--production" if a.mode=="local-test" else "--production-dispatch-proof"
    code=r'''
import base64, hashlib, json, os, shutil, subprocess, sys
sys.path.insert(0,"/candidate")
from runtime_evidence_transport import collect, read_file
raw=base64.b64decode(AUTHORITY);a=json.loads(raw);boundary=os.path.dirname(a["inputRoot"])
os.chmod("/proof",0o700);os.chmod(boundary,0o700);os.mkdir(a["receiptRoot"],0o700)
path=boundary+"/execution-authority.json"
with open(path,"xb") as f:f.write(raw)
os.chmod(path,0o400)
pin=hashlib.sha256(raw).hexdigest()
before=open("/proc/self/mountinfo","rb").read()
runner="/candidate/production-runner-v2"
p=subprocess.run([runner,MODE,"--execution-authority",path,"--execution-authority-sha256",pin],
                 capture_output=True,timeout=1000,env={"PATH":"/unavailable","HOME":"/unavailable","LC_ALL":"C"})
assert len(p.stdout)<=1048576 and len(p.stderr)<=1048576,"PARENT_OUTPUT_BOUND"
summary={"runnerExitCode":p.returncode,"stdout":p.stdout.decode(),"stderr":p.stderr.decode(),
         "parentMountinfoUnchanged":open("/proc/self/mountinfo","rb").read()==before,"automaticRetry":False}
with open("/results/HARNESS_RESULT.json","x") as f:json.dump(summary,f)
receipt=a["receiptRoot"]+"/transaction.consumed.json"
if os.path.isfile(receipt):
    with open("/results/transaction.consumed.json","xb") as f:f.write(read_file(receipt,1024))
for entry in os.listdir(a["receiptRoot"]):
    if not entry.startswith(".g3a-isolation-proof-"):continue
    target="/results/"+entry;os.mkdir(target,0o700)
    for name,bound in [("baseline.json",262144),("production-result.json",2097152),("outputs.tar",65*1024*1024)]:
        original=a["receiptRoot"]+"/"+entry+"/"+name
        if os.path.isfile(original):
            with open(target+"/"+name,"xb") as f:f.write(read_file(original,bound))
assert p.returncode==0,summary
assert summary["parentMountinfoUnchanged"],"PARENT_MOUNT_DRIFT"
e=collect(a["receiptRoot"],path,MODE,a["runnerSha256"],SIZE,a["runnerSourceSha256"],a["authorityPolicySha256"])
with open("/results/EXACT_RUNTIME_EVIDENCE.json","x") as f:json.dump(e,f,separators=(",",":"))
evidence=[x for x in os.listdir(a["receiptRoot"]) if x.startswith(".g3a-isolation-proof-")]
assert len(evidence)==1 and not os.path.exists(a["receiptRoot"]+"/"+evidence[0]+"/root"),"ROOT_CLEANUP"
replay=subprocess.run([runner,MODE,"--execution-authority",path,"--execution-authority-sha256",pin],
                    capture_output=True,timeout=30,env={"PATH":"/unavailable","HOME":"/unavailable"})
assert replay.returncode!=0 and b"AUTHORITY_CONSUMED" in replay.stderr,"ACTUAL_REPLAY_DENIAL"
with open("/results/REPLAY_DENIAL.json","x") as f:json.dump({"exitCode":replay.returncode,"stderr":replay.stderr.decode(),"coreInvocations":0},f)
print(json.dumps({"status":"PASS_PARENT_QUALIFICATION_ONLY","authoritySha256":pin,"mode":MODE,
                  "coreInvocations":1 if MODE=="--production" else 0,"frozenManifestSha256":a["expectedManifestSha256"]}))
'''
    import base64
    for key,val in [("AUTHORITY",repr(base64.b64encode(raw).decode())),("MODE",repr(mode)),("SIZE",str(candidate.stat().st_size))]:
        code=re.sub(r"\b"+key+r"\b",lambda _:val,code)
    command=["docker","run","--rm","--pull","never","--network","none","--read-only","--memory","3g",
             "--pids-limit","128","--cpus","2","--cap-drop","ALL"]
    for c in CAPS:command+=["--cap-add",c]
    command+=["--security-opt","seccomp=unconfined",
              "--mount",f"type=bind,source={HERE},target=/candidate,readonly",
              "--mount",f"type=bind,source={inputs},target={boundary}/inputs,readonly",
              "--mount",f"type=bind,source={output},target=/results",
              "--tmpfs","/proof:rw,noexec,nosuid,nodev,size=8388608,nr_inodes=512,mode=0700",
              "--workdir","/proof",IMAGE,"python3","-I","-B","-S","-c",code]
    with (run/"INVOCATION.json").open("x") as f:json.dump({"beforeBaseline":initial,"argv":command,"noRetry":True},f,indent=2)
    result=subprocess.run(command,capture_output=True,text=True,timeout=1100)
    after=guard()
    with (run/"CONTROLLER_RESULT.json").open("x") as f:
        json.dump({"exitCode":result.returncode,"stdout":result.stdout,"stderr":result.stderr,"afterBaseline":after},f,indent=2)
    print(result.stdout);print(result.stderr)
    return result.returncode
if __name__=="__main__":raise SystemExit(main())
