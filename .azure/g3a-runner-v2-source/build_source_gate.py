import hashlib, json, os, subprocess
from pathlib import Path
from prepare_v2 import HERE, ROOT, V1, guard, fresh, sha

GO = Path(r"C:\Program Files\Go\bin\go.exe")
IMAGE = "sha256:e88e9763f943ec1834f992a4b51e0f24500486803e8bc534e5767af9ea65f6ce"
FINAL = ["launcher.go","census.go","proof_linux.go","dispatch.go","frozen_bindings.go",
         "production_linux.go","hardproof_linux.go","hardproof_child_linux.go",
         "proof_contract_binding.go","static_witness_binding.go","runtime_authority_linux.go",
         "runtime_proof_linux.go","authority_binding.go"]
TESTS = ["production_linux_test.go","runtime_authority_linux_test.go"]

def execute(args,env,timeout=180):
    before=guard()
    p=subprocess.run(list(map(str,args)),cwd=HERE,env=env,capture_output=True,text=True,
                     encoding="utf-8",errors="replace",timeout=timeout)
    result={"command":list(map(str,args)),"exitCode":p.returncode,"stdout":p.stdout,"stderr":p.stderr,
            "beforeBaseline":before,"afterBaseline":guard()}
    return result

def main():
    guard()
    checks=HERE/".checks"
    checks.mkdir(exist_ok=True)
    env=dict(os.environ,GOENV="off",GOTOOLCHAIN="local",GO111MODULE="off",CGO_ENABLED="0")
    for key,name in [("GOCACHE","cache"),("GOPATH","gopath"),("GOTMPDIR","go-work"),("TEMP","host-work"),("TMP","host-work")]:
        p=checks/name; p.mkdir(exist_ok=True);env[key]=str(p)
    linux=dict(env,GOOS="linux",GOARCH="amd64")
    if not (HERE/"authority-policy.json").exists():
        policy={"schema":"g3a-stable-execution-policy-v1","authoritySchema":"g3a-execution-authority-v1",
                "mission":"NZ-20261008-INFRA-001","gate":"G3_PRIVATE_APPLICATION_SUBSTRATE",
                "operation":"G3A_SYNTHETIC_RUNTIME_IMAGE_BUILD","syntheticOnly":True,"singleUse":True,
                "capacity":{"buildRootBytes":1073741824,"buildRootInodes":32768,"tmpBytes":268435456,"tmpInodes":4096},
                "maximumValiditySeconds":14400,"exactCapacities":True,
                "expectedManifestSha256":"82b24793125bceae37828bb3c1adea26882a33cff5ca557fa49d370853db93b7",
                "targetRegistry":"nzilag2tzo75uuozprbo.azurecr.io","targetRepository":"g3-synthetic-runtime",
                "targetSource":"immutable frozen private-reader.py INPUT_REGISTRY_BINDING; prior g3-synthetic-runtime contracts",
                "issuerAuthentication":"NOT_PROVIDED_CONTROL_PLANE_RESPONSIBILITY",
                "requiredFields":["schema","mission","gate","transactionId","operation","runnerSha256","runnerSourceSha256",
                  "authorityPolicySha256","inputRootSha256","inputCensusSha256","expectedManifestSha256","buildRootBytes",
                  "buildRootInodes","tmpBytes","tmpInodes","issuedAt","notBefore","expiresAt","singleUse","syntheticOnly",
                  "targetRegistry","targetRepository","evidenceRoot","inputRoot","receiptRoot","payloadSha256","authorityKind"],
                "selfBinding":"actual /proc/self/exe SHA256; exact canonical source-map SHA; embedded policy byte SHA",
                "inputBinding":"exact frozen 15-file size/hash census, kernel-readonly external root, rechecked child before core",
                "authorityFile":"absolute canonical transaction-owned execution-authority.json; regular no symlink; euid owner; no write bits; <=16384 bytes; explicit byte digest",
                "receipt":"exclusive fsynced transaction-local receipts/transaction.consumed.json; transaction denies replay across envelope digests",
                "consumptionBoundary":"after complete envelope/file/input/capacity validation; immediately before launch/setup; no rollback",
                "modes":{"production":["PRODUCTION_EXECUTION_AUTHORITY","SYNTHETIC_LOCAL_TEST_AUTHORITY"],
                         "production-dispatch-proof":["SYNTHETIC_DISPATCH_PROOF_AUTHORITY"]},
                "failClosed":["unknown/missing/null/duplicate/trailing fields","wrong identities","invalid temporal bounds",
                              "alternate commands","wrong target","changed file/input","consumed transaction","proof/production substitution"]}
        fresh("authority-policy.json",json.dumps(policy,sort_keys=True,separators=(",",":")).encode())
        fresh("authority_binding.go",'package main\n\nconst boundAuthorityPolicySHA256 = "'+sha(HERE/"authority-policy.json")+'"\nconst boundRunnerSourceSHA256 = "'+"0"*64+'"\n')
    results=[]
    for name in FINAL+TESTS+["verify_v2_primitives.go"]:
        r=execute([GO.parent/"gofmt.exe","-w",HERE/name],env);results.append(r)
        if r["exitCode"]:raise RuntimeError(r)
    # The sole normalized placeholder prevents the source hash binding itself.
    if True:
        source_names=FINAL+TESTS+["verify_primitives.go","verify_static_primitives.go","verify_v2_primitives.go",
                                "authority-policy.json","proof_contract.json","payload.tar","static-witness"]
        source_map={}
        for name in sorted(source_names):
            raw=(HERE/name).read_bytes()
            if name=="authority_binding.go":
                import re
                raw=re.sub(rb'(const boundRunnerSourceSHA256 = ")[0-9a-f]{64}(")',rb'\g<1>'+b"0"*64+rb'\g<2>',raw)
            source_map[name]=hashlib.sha256(raw).hexdigest()
        canonical=json.dumps(source_map,sort_keys=True,separators=(",",":")).encode()
        source_sha=hashlib.sha256(canonical).hexdigest()
        p=HERE/"authority_binding.go"
        guard();p.write_bytes(re.sub(rb'(const boundRunnerSourceSHA256 = ")[0-9a-f]{64}(")',rb'\g<1>'+source_sha.encode()+rb'\g<2>',p.read_bytes()))
        attempt = len(list(HERE.glob("SOURCE_BINDING_V2*.json"))) + 1
        fresh(f"CANONICAL_SOURCE_MAP_ATTEMPT_{attempt}.json",canonical)
        fresh(f"SOURCE_BINDING_V2_ATTEMPT_{attempt}.json",{"sourceSha256":source_sha,"policySha256":sha(HERE/"authority-policy.json"),
               "canonicalRule":"SHA256 compact sorted filename->SHA256 map; only authority_binding.go boundRunnerSourceSHA256 value normalized to 64 zeroes; all other bytes exact",
               "fullSources":{name:{"sha256":sha(HERE/name),"bytes":(HERE/name).stat().st_size} for name in sorted(source_names)}})
    qualified=ROOT/".azure/g3a-isolation-artifacts"
    args=[qualified/"proof_linux.go",HERE/"proof_linux.go",qualified/"launcher.go",HERE/"launcher.go",HERE/"production_linux.go"]
    for name,argv in [
        ("BASELINE_30_AST.json",[GO,"run","verify_primitives.go","--"]+args),
        ("BASELINE_STATIC_30_AST.json",[GO,"run","verify_static_primitives.go","--"]+args+[HERE/"hardproof_child_linux.go",HERE/"hardproof_linux.go"]),
        ("EXTENDED_V1_V2_AST.json",[GO,"run","verify_v2_primitives.go","--",V1,HERE])]:
        r=execute(argv,env);results.append(r)
        if r["exitCode"]:fresh("SOURCE_GATE_FAILURE_"+str(len(list(HERE.glob("SOURCE_GATE_FAILURE*")))+1)+".json",results);print(r["stderr"]);return 1
        target = name if not (HERE/name).exists() else name[:-5]+"_ATTEMPT_"+str(attempt)+".json"
        fresh(target,json.loads(r["stdout"]))
    testbinary = "runner-source-tests-" + str(len(list(HERE.glob("runner-source-tests*"))) + 1)
    if not (HERE/testbinary).exists():
        r=execute([GO,"test","-c","-o",HERE/testbinary]+FINAL+TESTS,linux);results.append(r)
        if r["exitCode"]:fresh("SOURCE_GATE_FAILURE_"+str(len(list(HERE.glob("SOURCE_GATE_FAILURE*")))+1)+".json",results);print(r["stderr"]);return 1
    command=["docker","run","--rm","--pull","never","--network","none","--read-only","--memory","768m",
             "--pids-limit","128","--cpus","2","--cap-drop","ALL","--security-opt","no-new-privileges",
             "--mount",f"type=bind,source={HERE},target=/candidate,readonly",
             "--tmpfs","/proof:rw,noexec,nosuid,nodev,size=8388608,nr_inodes=512,mode=0700",
             "--workdir","/proof",IMAGE,"/candidate/"+testbinary,"-test.v","-test.timeout=90s"]
    r=execute(command,env,180);results.append(r)
    name="SOURCE_GATE_PASS_"+str(attempt)+".json" if r["exitCode"]==0 else "SOURCE_GATE_FAILURE_"+str(len(list(HERE.glob("SOURCE_GATE_FAILURE*")))+1)+".json"
    fresh(name,{"status":"PASS" if r["exitCode"]==0 else "FAIL","sourceBinding":"SOURCE_BINDING_V2_ATTEMPT_"+str(attempt)+".json",
                "results":results,"frozenCoreInvocations":0,"constructorInvocations":0})
    print(r["stdout"][-6000:]);print(r["stderr"]);return r["exitCode"]

if __name__=="__main__":raise SystemExit(main())
