"""Finalize append-only source-phase report; never executes runner/constructor/core."""
import datetime, hashlib, json, re
from pathlib import Path
from prepare_v2 import HERE, ROOT, guard, fresh, sha
from generate_authority import identities, make_authority
from runtime_evidence_transport import FIELDS, EXACT_OUTPUTS, reader_code

def load(n):return json.loads((HERE/n).read_text())
def file(n):return {"path":str(HERE/n),"sha256":sha(HERE/n),"bytes":(HERE/n).stat().st_size}
def main():
    baseline=guard()
    stop=ROOT/".azure/g3a-transaction-integration-stop/VERIFICATION.json"
    assert sha(stop)=="220230442c5eaf79fc02645b2d1c1ac39089285b5e019134e381fd15399ab6ea"
    gate=load("SOURCE_GATE_PASS_5.json");binding=load(gate["sourceBinding"])
    assert gate["status"]=="PASS" and all(r["exitCode"]==0 for r in gate["results"])
    canonical={}
    for n,value in binding["fullSources"].items():
        p=HERE/n
        assert sha(p)==value["sha256"] and p.stat().st_size==value["bytes"],"SOURCE_DRIFT_"+n
        raw=p.read_bytes()
        if n=="authority_binding.go":
            raw,count=re.subn(rb'(boundRunnerSourceSHA256 = ")[0-9a-f]{64}(")',lambda m:m[1]+b"0"*64+m[2],raw)
            assert count==1
        canonical[n]=hashlib.sha256(raw).hexdigest()
    assert hashlib.sha256(json.dumps(canonical,sort_keys=True,separators=(",",":")).encode()).hexdigest()==binding["sourceSha256"]
    census=load("FINAL_V2_COMPONENT_CENSUS.json")
    assert file("production-runner-v2")["sha256"]==census["candidate"]["sha256"]
    assert file("production-runner-v2")["bytes"]==census["candidate"]["bytes"]
    for n,v in census["components"].items():assert sha(HERE/n)==v["sha256"] and (HERE/n).stat().st_size==v["bytes"]
    support=load("SUPPORT_VALIDATION.json")
    assert support["status"]=="PASS"
    root,censussha,payload=identities()
    local=make_authority("local-test","SYNTHETIC_LOCAL_TEST_V2_QUALIFICATION",
                         "/proof/.g3a-transaction-SYNTHETIC_LOCAL_TEST_V2_QUALIFICATION")
    proof=make_authority("dispatch-proof","SYNTHETIC_DISPATCH_PROOF_V2_QUALIFICATION",
                         "/proof/.g3a-transaction-SYNTHETIC_DISPATCH_PROOF_V2_QUALIFICATION")
    lane=str(HERE)
    localcmd=f'python -B "{lane}\\parent_local_harness.py" --mode local-test --run-root "{ROOT}\\.azure\\g3a-runner-v2-local-qualification" --transaction SYNTHETIC_LOCAL_TEST_V2_QUALIFICATION --parent-single-core-permit'
    proofcmd=f'python -B "{lane}\\parent_local_harness.py" --mode dispatch-proof --run-root "{ROOT}\\.azure\\g3a-runner-v2-static-qualification" --transaction SYNTHETIC_DISPATCH_PROOF_V2_QUALIFICATION'
    dictionary=(HERE/"proof_dictionary.bin").read_bytes()
    report={
      "schema":"g3a-parent-v2-source-report-v1","createdAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),
      "scope":"SOURCE_INTEGRATION_ONLY","ownedRoot":str(ROOT),"sourceLane":lane,
      "soleParentReadsurface":"PARENT_V2_SOURCE_REPORT.json",
      "reportHashConvention":"SHA256 of UTF-8 json.dumps(report excluding reportHash,sort_keys=True,separators=(',',':'),ensure_ascii=False); raw file SHA reported separately",
      "status":{
        "RUNNER_V2_RUNTIME_AUTHORITY_SOURCE":"PASS","RUNNER_V2_SINGLE_USE_SOURCE":"PASS",
        "RUNNER_V2_CAPACITY_SOURCE":"PASS","RUNNER_V2_PRIMITIVE_EQUIVALENCE":"PASS",
        "RUNNER_V2_STATIC_CANDIDATE_BUILD":"PASS","RUNNER_V2_REAL_CLI_DENIALS":"PASS",
        "RUNNER_V2_EVIDENCE_TRANSPORT_UNIT_TESTS":"PASS",
        "V2_FROZEN_CORE_EXACT":"NOT_RUN","RUNNER_V2_OFFLINE_QUALIFICATION":"NOT_RUN",
        "RUNNER_V2_PINNED_GUEST_PROOF":"NOT_RUN","RUNNER_V2_RUNTIME_CLEANUP":"NOT_RUN",
        "FINAL_PRODUCTION_COMPATIBLE_RUNNER":"BLOCKED_PENDING_PARENT_QUALIFICATION",
        "LIVE_STATIC_PROOF_TRANSPORT_FEASIBILITY":"NOT_RUN","EXECUTION_BOOTSTRAP_AUTHORIZED":"NO"},
      "authorizationRead":{"path":r"C:\Users\AubertNungisa\AppData\Roaming\Code\agentSessionData\7496e6a0-5c9e-4c19-86cb-183af2c0f9c4\attachments\18ca65e2-85b9-4758-b65a-bea7ec5efb17\Pasted text #1.txt",
                           "entire975LinesRead":True,"sourceIntegrationOnly":True},
      "contextMapReportedBeforeImplementation":{
        "launcher.go":"explicit production/proof CLI only",
        "dispatch.go":"retain capacity/JSON/dispatch; remove obsolete compiled transaction pin",
        "production_linux.go":"authority and mode transport; actual constructor/core/cleanup unchanged",
        "runtime_authority_linux.go":"stable-policy runtime authority validation, exact self/input identities",
        "runtime_proof_linux.go":"same validator/consume/constructor/dispatch, immutable static witness, zero core",
        "verify_primitives.go+verify_static_primitives.go+verify_v2_primitives.go":"baseline30/static30/extended67 AST gates",
        "frozen_bindings.go+payload.tar+static-witness":"immutable frozen execution inputs/assets"},
      "currentBaseline":baseline,
      "foreignRepository":{"root":r"C:\APPS\nzila-os","editedBySourceWorker":False,
          "requestedInitialStatusCount":623,"observedCountsDuringTask":[622,623,624,625],
          "note":"Shared-environment status changed between read-only rebaselines; HEAD remains requested value; worker writes confined to source lane."},
      "preservation":{"v1AllFileCensus":load("PRESERVED.json"),
        "v1Candidate":{"sha256":"9889228f05e27a95593ba02e44e54127985175d4748bf98e0c6600bb662d1273","bytes":28094588,
                       "sourceSha256":"418a34a10153dc4e653e62b3a282f438a8cc41a8454fae131f53a016806e3475"},
        "protectedFinalVerification":{"sha256":"e5a652df093781d51d225119d3ded4849fe44e2f5cf8db13bf994e08b78d5f0e","unchanged":True},
        "integrationStop":{"path":str(stop),"sha256":sha(stop),"unchanged":True},
        "frozenCoreWholeASTUnchanged":True,"productionChildWholeASTUnchanged":True,
        "v1Role":"Historical actual isolation/hard-core/pinned-guest PASS; empty compiled production pin unusable. No V1 rewrite."},
      "identities":{"candidate":file("production-runner-v2"),"sourceSha256":binding["sourceSha256"],
        "policy":file("authority-policy.json"),"fullSourceBinding":binding,
        "canonicalSourceMap":canonical,"sourceHashNormalization":binding["canonicalRule"],
        "compiledComponents":census,"supportComponents":{n:file(n) for n in (
           "runtime_evidence_transport.py","test_runtime_evidence_transport.py","parent_local_harness.py",
           "generate_authority.py","README.md","proof_dictionary.bin","finalize_parent_report.py")},
        "inputRootSha256":root,"inputCensusSha256":censussha,"payloadSha256":payload},
      "sourceGates":{"baseline30AST":load("BASELINE_30_AST_ATTEMPT_5.json"),
        "static30AST":load("BASELINE_STATIC_30_AST_ATTEMPT_5.json"),
        "extended67AST":load("EXTENDED_V1_V2_AST_ATTEMPT_5.json"),
        "allSourceGateCommandsAndResults":gate,"ELF":load("ELF_V2.json"),
        "candidateBuild":load("FINAL_BUILD.json"),"supportValidation":support},
      "denialMatrix":{"unitFields":27,"unitMutationsPerField":4,"unitFieldMutationCases":108,
        "unitSpecialCases":13,"unitMatrixScope":"source tests, including duplicate/trailing/temporal/target/file/mode/self/input/singleuse/capacity checks; no constructor/core",
        "realCandidateCLI":load("REAL_CLI_NEGATIVES.json"),
        "realCLICommandAndFullOutput":load("REAL_CLI_NEGATIVES_COMMAND.json"),
        "positiveEnvelopeThenMissingInputDenial":"valid-authority-missing-input exited1 FROZEN_INPUT_MANIFEST_BINDING_MISMATCH; receipt empty, no constructor/core"},
      "runtimeContract":{"policy":load("authority-policy.json"),
        "publicCLI":["runner --production --execution-authority ABSOLUTE_PATH --execution-authority-sha256 RAW_BYTE_SHA256",
                     "runner --production-dispatch-proof --execution-authority ABSOLUTE_PATH --execution-authority-sha256 RAW_BYTE_SHA256"],
        "argumentCountAndOrder":"exactly five arguments after executable, as shown; no arbitrary commands/fields/env override",
        "fileBoundary":"execution-authority.json under canonical absolute private .g3a-transaction-transactionId; euid-owned readonly regular no symlink <=16384 bytes, opened nofollow/nonblock",
        "identities":"actual /proc/self/exe SHA256; exact canonical source/policy; input-root/census/manifest/payload; actual15 files fully hashed before consumption and child dispatch",
        "temporal":"nonzero RFC3339Nano; issuedAt<=notBefore<=now<expiresAt; expiresAt-issuedAt<=14400seconds",
        "oneShot":"O_CREATE|O_EXCL receipts/transaction.consumed.json mode0600; file+directory fsync, authority raw SHA and parentPID; after full checks before setup; no rollback/reset; transaction denies changed-envelope replay",
        "kinds":{"PRODUCTION_EXECUTION_AUTHORITY":"--production; non-SYNTHETIC_ transaction",
                 "SYNTHETIC_LOCAL_TEST_AUTHORITY":"--production; SYNTHETIC_LOCAL_TEST_ prefix",
                 "SYNTHETIC_DISPATCH_PROOF_AUTHORITY":"proof mode only; SYNTHETIC_DISPATCH_PROOF_ prefix"},
        "compiledTransactionPinRemovedParentAndChild":True,
        "targetSource":"nzilag2tzo75uuozprbo.azurecr.io extracted from immutable frozen private-reader.py INPUT_REGISTRY_BINDING; g3-synthetic-runtime from prior contracts",
        "issuerAuthentication":"NONE; no signatures/secrets/cryptographic authentication claims; control-plane governance responsibility"},
      "syntheticGeneratorAPI":{"function":"generate_authority.make_authority(mode, transaction, linux_boundary, candidate=None, now=None)",
        "modes":["local-test","dispatch-proof"],"productionIssuanceAllowed":False,
        "command":f'python -B "{lane}\\generate_authority.py" --mode local-test --transaction SYNTHETIC_LOCAL_TEST_V2_QUALIFICATION --linux-boundary /proof/.g3a-transaction-SYNTHETIC_LOCAL_TEST_V2_QUALIFICATION --output FRESH_AUTHORITY.json',
        "output":"exclusive fresh JSON file; stdout contains raw executionAuthoritySha256/bytes/Linux authority path",
        "positiveLocalEnvelopeExample":local,"positiveStaticEnvelopeExample":proof,
        "warning":"examples expire after one hour; regenerate before parent execution; copy exact bytes and chmod0400 in Linux transaction; never mutate archived fixtures"},
      "parentLocalHarness":{"command":localcmd,"staticCommand":proofcmd,"executedBySourceWorker":False,
        "sourceFile":file("parent_local_harness.py"),"requiredParentPermit":"--parent-single-core-permit for local-test only",
        "image":"sha256:e88e9763f943ec1834f992a4b51e0f24500486803e8bc534e5767af9ea65f6ce",
        "dockerConstraints":"--pull never --network none --read-only --memory3g --pids-limit128 --cpus2 --cap-dropALL; add SYS_ADMIN,SYS_CHROOT,SETPCAP,SETUID,SETGID,CHOWN,DAC_OVERRIDE,FOWNER; seccomp=unconfined per original constructor harness",
        "layout":"external host staged15-file readonly bind at /proof/.g3a-transaction-ID/inputs; /proof8MiB/512inodes mode0700 tmpfs; Linux boundary/receipts0700 and authority0400; no Windows private-receipt bind",
        "frozenInputs":{"count":15,"bytes":265077049,"metadataBindingJsonExcluded":True,"buildCharged":False},
        "hardCapacities":{"buildBytes":1073741824,"buildInodes":32768,"tmpBytes":268435456,"tmpInodes":4096},
        "actualCoreCommand":["/inputs/portable-assembler","/inputs","/build/transaction","/output/transaction"],
        "sevenOutputs":EXACT_OUTPUTS,
        "outputs":"fresh run root retains INVOCATION.json/CONTROLLER_RESULT.json, synthetic authority, receipts, baseline/result/archive, HARNESS_RESULT.json, EXACT_RUNTIME_EVIDENCE.json, REPLAY_DENIAL.json; no retry",
        "acceptance":"exit0, actual one core (local) or zero core/one static witness(proof), exact seven output digests(local), constructor isolation, effective capacities, readonly inputs/null-only dev, mount-state/root/build/tmp cleanup, durable replay denial"},
      "productionEvidenceAPI":{"receipt":"receiptRoot/transaction.consumed.json",
        "evidence":"receiptRoot/.g3a-isolation-proof-*/baseline.json,production-result.json,outputs.tar",
        "productionResult":"actual childStdout/childStderr, authoritySha256, transaction, archiveSha256/archiveBytes, commandError/planError/evidenceStreamError, automaticRetry=false,authorityConsumed=true",
        "childBaseline":"raw child schema g3a-isolation-proof/v1 mode --production baseline NOT_RUN; all nine remaining checks PASS. Parent captures complete baseline separately, no rewritten evidence.",
        "archivePayloadBound":67108864,"archiveTransportBound":68157440,
        "requireOuterRunnerExit0BeforeAcceptance":True,"parentNoRetry":True},
      "staticProofAPI":{"CLI":"--production-dispatch-proof --execution-authority absolutePath --execution-authority-sha256 rawSHA",
        "authorityKind":"SYNTHETIC_DISPATCH_PROOF_AUTHORITY","sameValidatorConsumeConstructorDispatch":True,
        "actualAssemblerInvocations":0,"witness":"immutable static-witness; /build and /tmp success; /work and /output EACCES; cleanup; empty governed archive",
        "evidenceFields":"coreInvocations=0,staticWitnessInvocations=1,runtimeProofAuthoritySha256, outputArchiveSha256; original isolation proof checks"},
      "fullBoundedEvidenceTransport":{"module":file("runtime_evidence_transport.py"),
        "schema":"g3a-v2-exact-runtime-evidence-v1","exactFields":sorted(FIELDS),
        "collectAPI":"collect(receipts,authority_path,mode,candidate_sha,candidate_bytes,source_sha,policy_sha)",
        "encodeDecodeAPI":"encode(envelope,dictionary)->one marker line; decode(diagnostic,dictionary)->full original envelope",
        "readerAPI":"reader_code(authority_path,receipt_root,mode,candidate_sha,candidate_bytes,source_sha,policy_sha,dictionary)->self-contained readonly Python; mode proof only",
        "dictionary":file("proof_dictionary.bin"),"maximumDictionaryBytes":32000,"maximumLineCharacters":3800,
        "maximumDiagnosticCharacters":16384,
        "lossless":"full raw authority/receipt/baseline/production result; actual complete child stdout/stderr; full archive Base64; zlib; no summary reconstruction or truncation",
        "failClosed":"duplicate/trailing JSON, exact fields/identities/modes/receipt/archive/output checks, corrupt/truncated/trailing compression, oversized diagnostic",
        "sourceBoundReaderExample":reader_code("/proof/.g3a-transaction-SYNTHETIC_DISPATCH_PROOF_V2_QUALIFICATION/execution-authority.json",
          "/proof/.g3a-transaction-SYNTHETIC_DISPATCH_PROOF_V2_QUALIFICATION/receipts","--production-dispatch-proof",
          census["candidate"]["sha256"],census["candidate"]["bytes"],binding["sourceSha256"],binding["policySha256"],dictionary),
        "qualification":"unit tests only; no actual live diagnostic feasibility claim; production full archive local-only"},
      "executionAccounting":{"sourceWorkerFrozenCoreInvocations":0,"sourceWorkerActualConstructorInvocations":0,
        "localQualificationInvocations":0,"liveProofAuthorityConsumed":False,"fullTransactionAllowanceRemaining":1,
        "AzureReads":0,"AzureMutations":0,"registryMutations":0,"outerFullTransactions":0,
        "dependenciesInstalledOrFetched":0,"commits":0},
      "parentNextActions":["Read only this report and verify reportHash/raw file digest",
        "Parent explicitly elects and runs the sole core local qualification command, preserving all evidence; do not silently retry",
        "On actual primitive failure stop: no widening, fallback, bypass, patching frozen core, or invented PASS",
        "Only after parent qualification decide pinned-guest/live static proof and runtime production-compatible runner status",
        "No Azure/bootstrap/registry/outer full transaction authority is granted by source PASS"]
    }
    report["reportHash"]=hashlib.sha256(json.dumps(report,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()).hexdigest()
    fresh("PARENT_V2_SOURCE_REPORT.json",(json.dumps(report,indent=2,ensure_ascii=False)+"\n").encode())
    print(json.dumps({"path":str(HERE/"PARENT_V2_SOURCE_REPORT.json"),"reportHash":report["reportHash"],
                      "rawFileSha256":sha(HERE/"PARENT_V2_SOURCE_REPORT.json"),"bytes":(HERE/"PARENT_V2_SOURCE_REPORT.json").stat().st_size}))
if __name__=="__main__":main()
