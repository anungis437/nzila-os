"""Synthetic local qualification fixture only: no production issuer authentication or rights."""
import argparse, datetime, hashlib, json, re
from pathlib import Path, PurePosixPath

HERE=Path(__file__).resolve().parent
def digest(raw):return hashlib.sha256(raw).hexdigest()
def identities():
    text=(HERE/"frozen_bindings.go").read_text()
    entries={n:{"sha256":s,"bytes":int(b),"mode":0}
             for n,b,s in re.findall(r'"([^"]+)":\s*\{(\d+), "([0-9a-f]{64})"\}',text.split("var exactOutputs")[0])}
    if len(entries)!=15 or sum(v["bytes"] for v in entries.values())!=265077049:raise ValueError("EXACT_15_INPUT_BINDING")
    census=digest(json.dumps(entries,sort_keys=True,separators=(",",":")).encode())
    root=digest("".join(f'{n}\0{entries[n]["bytes"]}\0{entries[n]["sha256"]}\n' for n in sorted(entries)).encode())
    payloadspec=re.search(r'const frozenInputSpecSHA256 = "([0-9a-f]{64})"',text)[1]
    runtime=re.search(r'const qualifiedRuntimePayloadSHA256 = "([0-9a-f]{64})"',(HERE/"dispatch.go").read_text())[1]
    payload=digest(json.dumps({"inputsSha256":payloadspec,"runtimeSha256":runtime},sort_keys=True,separators=(",",":")).encode())
    return root,census,payload

def make_authority(mode,transaction,boundary,candidate=None,now=None):
    prefix={"local-test":"SYNTHETIC_LOCAL_TEST_","dispatch-proof":"SYNTHETIC_DISPATCH_PROOF_"}[mode]
    kind={"local-test":"SYNTHETIC_LOCAL_TEST_AUTHORITY","dispatch-proof":"SYNTHETIC_DISPATCH_PROOF_AUTHORITY"}[mode]
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,64}",transaction) or not transaction.startswith(prefix):
        raise ValueError("SYNTHETIC_TRANSACTION_PREFIX_REQUIRED")
    p=PurePosixPath(boundary)
    if not p.is_absolute() or str(p)!=boundary or p.name!=".g3a-transaction-"+transaction or ".." in p.parts:
        raise ValueError("EXACT_ABSOLUTE_LINUX_TRANSACTION_BOUNDARY_REQUIRED")
    binding=(HERE/"authority_binding.go").read_text()
    source=re.search(r'boundRunnerSourceSHA256 = "([0-9a-f]{64})"',binding)[1]
    policy=re.search(r'boundAuthorityPolicySHA256 = "([0-9a-f]{64})"',binding)[1]
    root,census,payload=identities()
    candidate=Path(candidate) if candidate else HERE/"production-runner-v2"
    rawcandidate=candidate.read_bytes()
    if rawcandidate[:4]!=b"\x7fELF":raise ValueError("ACTUAL_ELF_REQUIRED")
    now=now or datetime.datetime.now(datetime.timezone.utc)
    stamp=lambda d:d.isoformat(timespec="microseconds").replace("+00:00","Z")
    return {"schema":"g3a-execution-authority-v1","mission":"NZ-20261008-INFRA-001",
      "gate":"G3_PRIVATE_APPLICATION_SUBSTRATE","transactionId":transaction,
      "operation":"G3A_SYNTHETIC_RUNTIME_IMAGE_BUILD","runnerSha256":digest(rawcandidate),
      "runnerSourceSha256":source,"authorityPolicySha256":policy,"inputRootSha256":root,
      "inputCensusSha256":census,"expectedManifestSha256":"82b24793125bceae37828bb3c1adea26882a33cff5ca557fa49d370853db93b7",
      "buildRootBytes":1073741824,"buildRootInodes":32768,"tmpBytes":268435456,"tmpInodes":4096,
      "issuedAt":stamp(now),"notBefore":stamp(now),"expiresAt":stamp(now+datetime.timedelta(hours=1)),
      "singleUse":True,"syntheticOnly":True,"targetRegistry":"nzilag2tzo75uuozprbo.azurecr.io",
      "targetRepository":"g3-synthetic-runtime","evidenceRoot":boundary+"/receipts",
      "inputRoot":boundary+"/inputs","receiptRoot":boundary+"/receipts","payloadSha256":payload,"authorityKind":kind}

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--mode",choices=["local-test","dispatch-proof"],required=True)
    p.add_argument("--transaction",required=True);p.add_argument("--linux-boundary",required=True)
    p.add_argument("--candidate",type=Path);p.add_argument("--output",type=Path,required=True)
    a=p.parse_args()
    authority=make_authority(a.mode,a.transaction,a.linux_boundary,a.candidate)
    raw=json.dumps(authority,sort_keys=True,separators=(",",":")).encode()
    with a.output.open("xb") as f:f.write(raw)
    print(json.dumps({"classification":authority["authorityKind"],"executionAuthoritySha256":digest(raw),
                      "bytes":len(raw),"hostPath":str(a.output),"linuxPath":a.linux_boundary+"/execution-authority.json",
                      "cloudRights":False,"issuerAuthenticated":False},sort_keys=True))
if __name__=="__main__":main()
