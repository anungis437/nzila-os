"""Lossless bounded V2 receipt/evidence transport; never truncates or substitutes proof summaries."""
import base64, hashlib, io, json, os, re, stat, tarfile, zlib
from pathlib import Path

MARKER="G3A_V2_EXACT_EVIDENCE_V1 "
MAX_ARCHIVE=65*1024*1024
MAX_DECODED=4*((MAX_ARCHIVE+2)//3)+3*1024*1024
MAX_LINE=3800
FIELDS={"schema","mode","candidateSha256","candidateBytes","sourceSha256","policySha256","authoritySha256",
        "authorityJson","receiptJson","baselineJson","productionResultJson","outputsTarBase64"}
GATES={"baseline","mountNamespace","rootIsolation","hostFSNegative","networkIsolation","networkNegative",
       "noNewPrivs","privilegeDrop","privilegeRegainNegative","selfContained"}
EXACT_OUTPUTS={
 "g3-runtime":"5a1ab8fdd71a8db76220de0d8867eea6c5a1fedd2889cfe9092f3e6f98d9f7b0",
 "layer1.tar":"000cdf8c38857aab9b5a16244b98eb8f6017bf251f064c124622633c8850fc38",
 "layer2.tar":"622d4366d78c36ca5ca6086e93b66d93305e0e11b95941375c1c4ff1f51cdfa1",
 "layer1.tar.gz":"e384c980a44e96f09d36cc4e6ffb44b4d7e03af6a75af1bd283c8cd9543aace7",
 "layer2.tar.gz":"af22bfbdda5d1f2c63684516b52acd617cd5913c758d117c044121992d67bb2d",
 "config.json":"905dccbd2a9da110a68dcbfb17704b205eb10dfb326e51ace2a7db9bc5d3801e",
 "manifest.json":"82b24793125bceae37828bb3c1adea26882a33cff5ca557fa49d370853db93b7"}
def require(v,reason):
    if not v:raise ValueError(reason)
def digest(raw):return hashlib.sha256(raw).hexdigest()
def pairs(rows):
    out={}
    for k,v in rows:
        require(k not in out,"DUPLICATE_JSON_KEY");out[k]=v
    return out
def loads(raw):return json.loads(raw,object_pairs_hook=pairs)
def read_file(path,bound,private=True):
    path=Path(path)
    require(path.is_absolute() and str(path.resolve())==str(path),"CANONICAL_EVIDENCE_PATH")
    fd=os.open(path,os.O_RDONLY|getattr(os,"O_NOFOLLOW",0)|getattr(os,"O_NONBLOCK",0))
    try:
        before=os.fstat(fd)
        require(stat.S_ISREG(before.st_mode) and before.st_size<=bound and before.st_nlink==1,"EVIDENCE_TYPE_SIZE_LINK")
        if os.name!="nt" and private:
            require(before.st_uid==os.geteuid() and stat.S_IMODE(before.st_mode) in (0o400,0o600),"EVIDENCE_OWNER_MODE")
        with os.fdopen(fd,"rb",closefd=False) as f:raw=f.read(bound+1)
        after=os.fstat(fd)
        require(len(raw)==before.st_size==after.st_size and before.st_mtime_ns==after.st_mtime_ns,"EVIDENCE_CHANGED")
        return raw
    finally:os.close(fd)

def validate(envelope):
    require(isinstance(envelope,dict) and set(envelope)==FIELDS,"EXACT_TRANSPORT_FIELDS")
    require(envelope["schema"]=="g3a-v2-exact-runtime-evidence-v1","TRANSPORT_SCHEMA")
    require(envelope["mode"] in ("--production","--production-dispatch-proof"),"TRANSPORT_MODE")
    require(type(envelope["candidateBytes"]) is int and 0<envelope["candidateBytes"]<=64*1024*1024,"CANDIDATE_BYTE_BOUND")
    for k in ("candidateSha256","sourceSha256","policySha256","authoritySha256"):
        require(isinstance(envelope[k],str) and re.fullmatch("[0-9a-f]{64}",envelope[k]),"IDENTITY_FORMAT_"+k)
    for k,n in [("authorityJson",16384),("receiptJson",1024),("baselineJson",262144),("productionResultJson",2097152)]:
        require(isinstance(envelope[k],str) and len(envelope[k].encode())<=n,"FIELD_BOUND_"+k)
    a=loads(envelope["authorityJson"]);receipt=loads(envelope["receiptJson"]);result=loads(envelope["productionResultJson"])
    require(digest(envelope["authorityJson"].encode())==envelope["authoritySha256"]==receipt["authoritySha256"]==result["authoritySha256"],"AUTHORITY_RECEIPT_BYTES_HASH")
    require(a["runnerSha256"]==envelope["candidateSha256"] and a["runnerSourceSha256"]==envelope["sourceSha256"] and
            a["authorityPolicySha256"]==envelope["policySha256"],"SELF_SOURCE_POLICY_EVIDENCE_BINDING")
    require(a["syntheticOnly"] is True and a["singleUse"] is True and result["authorityConsumed"] is True and
            result["automaticRetry"] is False and result["transaction"]==a["transactionId"],"TRANSACTION_RECEIPT_BINDING")
    require(result["commandError"]=="<nil>" and result["planError"]=="<nil>" and result["evidenceStreamError"]=="<nil>","ACTUAL_EXECUTION_ERRORS")
    child=loads(result["childStdout"])
    require(child["schema"]=="g3a-isolation-proof/v1" and child["mode"]=="--production" and child["outcome"]=="PASS","ACTUAL_CHILD_PROOF")
    checks=child["checks"]
    require(set(checks)==GATES and checks["baseline"]=="NOT_RUN" and
            all(v=="PASS" for k,v in checks.items() if k!="baseline"),"EXACT_CHILD_ISOLATION_GATES")
    require(isinstance(loads(envelope["baselineJson"]),dict),"BASELINE_JSON")
    detail=child["details"]
    require(detail["buildTmpEmptied"] is True,"ACTUAL_BUILD_TMP_CLEANUP")
    require(isinstance(envelope["outputsTarBase64"],str) and len(envelope["outputsTarBase64"])<=4*((MAX_ARCHIVE+2)//3),"ARCHIVE_ENCODED_BOUND")
    archive=base64.b64decode(envelope["outputsTarBase64"],validate=True)
    require(len(archive)<=MAX_ARCHIVE and len(archive)==result["archiveBytes"] and
            digest(archive)==result["archiveSha256"]==detail["outputArchiveSha256"],"ARCHIVE_EXACT_BYTES_BINDING")
    with tarfile.open(fileobj=io.BytesIO(archive),mode="r:") as t:
        members=t.getmembers()
        require(len(members)<=4096 and sum(m.size for m in members)<=64*1024*1024,"ARCHIVE_BOUND")
        names=set()
        for m in members:
            require(m.isfile() and not m.name.startswith("/") and "\\" not in m.name and
                    all(p not in ("",".","..") for p in m.name.split("/")) and m.name not in names,"ARCHIVE_SAFE_REGULAR_CENSUS")
            names.add(m.name)
        if envelope["mode"]=="--production-dispatch-proof":
            require(a["authorityKind"]=="SYNTHETIC_DISPATCH_PROOF_AUTHORITY" and detail["coreInvocations"]==0 and
                    detail["staticWitnessInvocations"]==1 and len(members)==0,"STATIC_NO_CORE_SCOPE")
            require(detail["runtimeProofAuthoritySha256"]==envelope["authoritySha256"],"STATIC_AUTHORITY_GATE_BINDING")
        else:
            require(a["authorityKind"] in ("PRODUCTION_EXECUTION_AUTHORITY","SYNTHETIC_LOCAL_TEST_AUTHORITY") and
                    detail["coreInvocations"]==1 and detail["exactImageGates"]=={k:"YES" for k in EXACT_OUTPUTS},"EXACT_CORE_GATES")
            for n,h in EXACT_OUTPUTS.items():
                f=t.extractfile("transaction/"+n)
                require(f is not None and digest(f.read())==h,"EXACT_OUTPUT_"+n)
    return envelope

def collect(receipts,authority_path,mode,candidate_sha,candidate_bytes,source_sha,policy_sha):
    root=Path(receipts)
    require(root.is_absolute() and root.resolve()==root and root.is_dir(),"CANONICAL_RECEIPT_ROOT")
    if os.name!="nt":
        st=root.stat();require(st.st_uid==os.geteuid() and stat.S_IMODE(st.st_mode)==0o700,"PRIVATE_RECEIPT_ROOT")
    evidence=list(root.glob(".g3a-isolation-proof-*"))
    require(len(evidence)==1 and evidence[0].is_dir() and evidence[0].resolve()==evidence[0],"SINGLE_TRANSACTION_EVIDENCE_ROOT")
    e=evidence[0]
    a=read_file(authority_path,16384)
    envelope={"schema":"g3a-v2-exact-runtime-evidence-v1","mode":mode,"candidateSha256":candidate_sha,
              "candidateBytes":candidate_bytes,"sourceSha256":source_sha,"policySha256":policy_sha,"authoritySha256":digest(a),
              "authorityJson":a.decode(),"receiptJson":read_file(root/"transaction.consumed.json",1024).decode(),
              "baselineJson":read_file(e/"baseline.json",262144).decode(),
              "productionResultJson":read_file(e/"production-result.json",2097152).decode(),
              "outputsTarBase64":base64.b64encode(read_file(e/"outputs.tar",MAX_ARCHIVE)).decode()}
    return validate(envelope)

def encode(envelope,dictionary):
    validate(envelope)
    require(isinstance(dictionary,bytes) and 0<len(dictionary)<=32000,"SOURCE_BOUND_DICTIONARY_BOUND")
    raw=json.dumps(envelope,separators=(",",":"),ensure_ascii=False).encode()
    require(len(raw)<=MAX_DECODED,"COMPLETE_ENVELOPE_BOUND")
    c=zlib.compressobj(9,zdict=dictionary)
    line=MARKER+base64.b64encode(c.compress(raw)+c.flush()).decode()
    require(len(line)<=MAX_LINE,"FULL_EVIDENCE_EXCEEDS_SAFE_DIAGNOSTIC_BOUND_STOP_NO_TRUNCATION")
    return line

def decode(message,dictionary):
    require(isinstance(message,str) and len(message)<=16384,"DIAGNOSTIC_BOUND")
    values=re.findall(r"^"+re.escape(MARKER)+r"([A-Za-z0-9+/=]+)$",message,re.MULTILINE)
    require(len(values)==1 and len(MARKER)+len(values[0])<=MAX_LINE,"EXACT_MARKER_BOUND")
    require(isinstance(dictionary,bytes) and 0<len(dictionary)<=32000,"DICTIONARY_BOUND")
    c=zlib.decompressobj(zdict=dictionary)
    raw=c.decompress(base64.b64decode(values[0],validate=True),MAX_DECODED+1)
    require(len(raw)<=MAX_DECODED and c.eof and not c.unused_data and not c.unconsumed_tail,"COMPRESSED_BOUND_TRAILING")
    return validate(loads(raw))

def reader_code(authority_path,receipt_root,mode,candidate_sha,candidate_bytes,source_sha,policy_sha,dictionary):
    """Generate self-contained read-only live evidence collector; no Azure calls or summary fallback."""
    require(mode=="--production-dispatch-proof","LIVE_STATIC_PROOF_ONLY")
    source=Path(__file__).read_text()
    # The complete module is transported source-bound; its reader never reconstructs child proof.
    return source+"\n"+(
       "assert hashlib.sha256(base64.b64decode("+repr(base64.b64encode(dictionary).decode())+")).hexdigest()=="+repr(digest(dictionary))+"\n"+
       "envelope=collect("+",".join(repr(v) for v in (receipt_root,authority_path,mode,candidate_sha,candidate_bytes,source_sha,policy_sha))+")\n"+
       "print(encode(envelope,base64.b64decode("+repr(base64.b64encode(dictionary).decode())+")))\n")
