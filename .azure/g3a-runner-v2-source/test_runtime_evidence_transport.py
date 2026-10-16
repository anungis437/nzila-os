import base64, copy, io, json, os, tarfile, unittest
from runtime_evidence_transport import *

def fixture():
    buffer=io.BytesIO()
    with tarfile.open(fileobj=buffer,mode="w",format=tarfile.USTAR_FORMAT):pass
    archive=buffer.getvalue()
    a={"runnerSha256":"a"*64,"runnerSourceSha256":"b"*64,"authorityPolicySha256":"c"*64,"syntheticOnly":True,
       "singleUse":True,"transactionId":"SYNTHETIC_DISPATCH_PROOF_UNIT","authorityKind":"SYNTHETIC_DISPATCH_PROOF_AUTHORITY"}
    authority=json.dumps(a,separators=(",",":"));pin=digest(authority.encode())
    checks={k:"PASS" for k in GATES};checks["baseline"]="NOT_RUN"
    child={"schema":"g3a-isolation-proof/v1","mode":"--production","outcome":"PASS","checks":checks,
           "details":{"buildTmpEmptied":True,"outputArchiveSha256":digest(archive),"coreInvocations":0,
                      "staticWitnessInvocations":1,"runtimeProofAuthoritySha256":pin}}
    result={"authoritySha256":pin,"authorityConsumed":True,"automaticRetry":False,"transaction":a["transactionId"],
            "commandError":"<nil>","planError":"<nil>","evidenceStreamError":"<nil>",
            "childStdout":json.dumps(child,separators=(",",":")),"archiveSha256":digest(archive),"archiveBytes":len(archive)}
    return {"schema":"g3a-v2-exact-runtime-evidence-v1","mode":"--production-dispatch-proof",
            "candidateSha256":"a"*64,"candidateBytes":28151932,"sourceSha256":"b"*64,"policySha256":"c"*64,
            "authoritySha256":pin,"authorityJson":authority,"receiptJson":json.dumps({"authoritySha256":pin,"parentPID":1}),
            "baselineJson":'{"classification":"FABRICATED_UNIT_TEST_NOT_LIVE_PROOF"}',
            "productionResultJson":json.dumps(result,separators=(",",":")),"outputsTarBase64":base64.b64encode(archive).decode()}

class TransportTests(unittest.TestCase):
    @unittest.skipUnless(os.name!="nt" and os.environ.get("G3A_UNIT_ROOT"),"Linux private unit root required")
    def test_regular_readonly_file_type_bounds(self):
        root=Path(os.environ["G3A_UNIT_ROOT"]);root.mkdir(mode=0o700)
        path=root/"readonly"
        with path.open("xb") as f:f.write(b"unit")
        os.chmod(path,0o400)
        try:
            self.assertEqual(read_file(path,4),b"unit")
            with self.assertRaises(Exception):read_file(path,3)
            os.chmod(path,0o644)
            with self.assertRaises(Exception):read_file(path,4)
            os.chmod(path,0o400)
            link=root/"link";link.symlink_to(path)
            with self.assertRaises(Exception):read_file(link,4)
            fifo=root/"fifo";os.mkfifo(fifo)
            with self.assertRaises(Exception):read_file(fifo,4)
        finally:
            for item in root.iterdir():item.unlink()
            root.rmdir()
    def test_full_roundtrip(self):
        e=fixture();d=b"SOURCE_BOUND_UNIT_TEST_ONLY"
        line=encode(e,d)
        self.assertLessEqual(len(line),3800)
        self.assertEqual(decode(line,d),e)
    def test_denials(self):
        e=fixture();d=b"SOURCE_BOUND_UNIT_TEST_ONLY";line=encode(e,d)
        for message in (line[:-3],line+"\n"+line,MARKER+"!!!","x"*16385):
            with self.assertRaises(Exception):decode(message,d)
        for field in FIELDS:
            x=copy.deepcopy(e);del x[field]
            with self.assertRaises(Exception):validate(x)
        for field in ("authorityJson","receiptJson","baselineJson","productionResultJson"):
            x=copy.deepcopy(e);x[field]="x"*(2097153)
            with self.assertRaises(Exception):validate(x)
        for field in ("authoritySha256","candidateSha256","sourceSha256","policySha256"):
            x=copy.deepcopy(e);x[field]="0"*64
            with self.assertRaises(Exception):validate(x)
        x=copy.deepcopy(e);x["outputsTarBase64"]=base64.b64encode(b"bad archive").decode()
        with self.assertRaises(Exception):validate(x)
    def test_no_summary_or_mode_substitution(self):
        e=fixture();e["mode"]="--production"
        with self.assertRaises(Exception):validate(e)
    def test_duplicate_unknown_and_compressed_trailing(self):
        with self.assertRaises(Exception):loads('{"k":1,"k":2}')
        with self.assertRaises(Exception):loads('{}{}')
        e=fixture();e["unknown"]=True
        with self.assertRaises(Exception):validate(e)
        d=b"SOURCE_BOUND_UNIT_TEST_ONLY";line=encode(fixture(),d)
        body=base64.b64decode(line[len(MARKER):])
        with self.assertRaises(Exception):decode(MARKER+base64.b64encode(body+b"trailing").decode(),d)
        with self.assertRaises(Exception):decode(line,b"WRONG_DICTIONARY")
    def test_oversize_diagnostic_denied_without_truncation(self):
        e=fixture();e["baselineJson"]=json.dumps({"syntheticUnitBlob":base64.b64encode(os.urandom(20000)).decode()})
        with self.assertRaisesRegex(ValueError,"STOP_NO_TRUNCATION"):encode(e,b"SOURCE_BOUND_UNIT_TEST_ONLY")
        e=fixture();r=loads(e["productionResultJson"]);c=loads(r["childStdout"])
        c["details"]["coreInvocations"]=1;r["childStdout"]=json.dumps(c);e["productionResultJson"]=json.dumps(r)
        with self.assertRaises(Exception):validate(e)
if __name__=="__main__":unittest.main()
