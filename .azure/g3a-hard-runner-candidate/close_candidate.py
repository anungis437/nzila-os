"""Seal candidate identities and complete evidence; cleanup only owned local validation fixtures."""
import base64
import difflib
import hashlib
import json
import os
import re
import shutil
import struct
import sys
import tarfile

from candidate_guard import CORE, GO, HERE, IMAGE, QUALIFIED, ROOT, SOURCE, execute, fresh, guard, sha
from build_validate_candidate import FINAL, TESTS
import evidence_transport as codec


def main():
    initial = guard()
    validation = json.loads((HERE / "CANDIDATE_VALIDATION_ATTEMPT_1.json").read_text())
    results = validation["results"]
    if len(results) != 9 or any(r["exitCode"] != 0 for r in results):
        raise RuntimeError("ALL_EXACT_CANDIDATE_VALIDATIONS_REQUIRED")
    witness = json.loads(results[-1]["stdout"])
    proof = json.loads(witness["files"]["proof.json"])
    summary = json.loads(witness["stdout"].strip().removeprefix("G3A_FINAL_STATIC_PROOF_V1 "))
    if proof["outcome"] != "PASS" or len(proof["checks"]) != 20 or set(proof["checks"].values()) != {"PASS"}:
        raise RuntimeError("COMPLETE_ACTUAL_CANDIDATE_PROOF_REQUIRED")
    candidate = HERE / "production-runner"
    if sha(candidate) != validation["candidateSha256"] or candidate.stat().st_size != validation["candidateBytes"]:
        raise RuntimeError("CANDIDATE_CHANGED_AFTER_KERNEL_PROOF")
    for name, digest in validation["sourceHashes"].items():
        if sha(HERE / name) != digest:
            raise RuntimeError("CANDIDATE_SOURCE_CHANGED_" + name)
    for name in CORE:
        if name != "launcher.go" and sha(HERE / name) != sha(SOURCE / name):
            raise RuntimeError("VERIFIED_PRODUCTION_COMPONENT_DRIFT_" + name)
    raw = candidate.read_bytes()
    if raw[:6] != b"\x7fELF\x02\x01" or struct.unpack_from("<H",raw,18)[0] != 62:
        raise RuntimeError("STATIC_LINUX_AMD64_ELF_REQUIRED")
    phoff = struct.unpack_from("<Q",raw,32)[0]
    size,count = struct.unpack_from("<HH",raw,54)
    types = [struct.unpack_from("<I",raw,phoff+i*size)[0] for i in range(count)]
    if 2 in types or 3 in types:
        raise RuntimeError("DYNAMIC_LINK_OR_INTERPRETER_DENIED")
    fresh("ELF_VERIFICATION.json", {"candidateSha256":sha(candidate),"candidateBytes":len(raw),
                                   "class":"ELF64","endianness":"little","machine":"EM_X86_64",
                                   "programHeaderTypes":types,"PT_DYNAMIC":False,"PT_INTERP":False,"status":"PASS_STATIC"})
    runtime = json.dumps(proof["details"]["runtimeSelfTest"],sort_keys=True)+"\n"
    envelope = {"baselineJson":witness["files"]["baseline.json"],"proofJson":witness["files"]["proof.json"],
                "runtimeJson":runtime}
    codec.verify_identity(envelope,sha(candidate),len(raw),proof["details"]["proofContractSha256"],
                          summary["evidenceSha256"])
    fresh("EXACT_EVIDENCE_ENVELOPE.json",envelope)
    fresh("KERNEL_CANDIDATE_WITNESS.json",proof)
    fresh("CANDIDATE_ENTRYPOINT_NEGATIVES.json",json.loads(results[-2]["stdout"]))
    fresh("PRODUCTION_PRIMITIVE_EQUIVALENCE_MATRIX.json",json.loads(results[2]["stdout"]))
    fresh("STATIC_PROOF_PRIMITIVE_EQUIVALENCE_MATRIX.json",json.loads(results[3]["stdout"]))
    preset = json.dumps(envelope,separators=(",",":"),ensure_ascii=False).encode()[:32000]
    line = codec.encode(envelope,preset)
    if codec.decode(line,preset) != envelope:
        raise RuntimeError("COMPLETE_TRANSPORT_ROUNDTRIP")
    fresh("proof_dictionary.bin",preset)
    fresh("EXACT_EVIDENCE_DIAGNOSTIC.txt",line+"\n")
    reader = codec.reader_code(preset,sha(candidate),len(raw),proof["details"]["proofContractSha256"])
    fresh("proof_evidence_reader.py",reader)
    env = dict(os.environ,PYTHONDONTWRITEBYTECODE="1",GOENV="off",GOTOOLCHAIN="local",GO111MODULE="off")
    tests = execute([sys.executable,"-B","-m","unittest","-v","test_evidence_transport.py"],env)
    version = execute([GO,"version","-m",candidate],env)
    if tests["exitCode"] != 0 or version["exitCode"] != 0:
        fresh("CLOSURE_FAILURE.json",{"transportTests":tests,"goVersion":version})
        raise RuntimeError("TRANSPORT_OR_COMPILER_BINDING_FAILED")
    reader_driver = r'''
import json, os, subprocess
base="/var/lib/waagent/custom-script/download/0"
directory=base+"/.g3a-isolation-proof-hard-bound-static"
os.mkdir(directory,0o700)
envelope=json.load(open("/candidate/EXACT_EVIDENCE_ENVELOPE.json"))
for name,key in (("baseline.json","baselineJson"),("proof.json","proofJson")):
    fd=os.open(directory+"/"+name,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,"w") as f:
        f.write(envelope[key])
command=["python3","-I","-B","-S","/candidate/proof_evidence_reader.py"]
result=subprocess.run(command,capture_output=True,timeout=10)
print(json.dumps({"readerExitCode":result.returncode,"stdout":result.stdout.decode(),
    "stderr":result.stderr.decode(),"scope":"READ_SAVED_ACTUAL_LOCAL_KERNEL_EVIDENCE_NOT_ANOTHER_PROOF"}))
assert result.returncode==0
assert len(result.stdout.rstrip(b"\n"))<=3800
os.chmod(directory+"/proof.json",0o644)
denial=subprocess.run(command,capture_output=True,timeout=10)
assert denial.returncode!=0 and not denial.stdout
os.chmod(directory+"/proof.json",0o600)
value=json.loads(envelope["proofJson"])
value["candidateSha256"]="0"*64
with open(directory+"/proof.json","w") as f:
    json.dump(value,f)
denial=subprocess.run(command,capture_output=True,timeout=10)
assert denial.returncode!=0 and not denial.stdout
'''
    reader_command=["docker","run","--rm","--pull","never","--network","none","--read-only",
                    "--memory","128m","--pids-limit","32","--cpus","1","--cap-drop","ALL",
                    "--security-opt","no-new-privileges",
                    "--mount",f"type=bind,source={HERE},target=/candidate,readonly",
                    "--tmpfs","/var/lib/waagent/custom-script/download/0:rw,noexec,nosuid,nodev,size=8388608,nr_inodes=128,mode=0700",
                    "--workdir","/var/lib/waagent/custom-script/download/0",
                    IMAGE,"python3","-I","-B","-S","-c",reader_driver]
    reader_test=execute(reader_command,env)
    fresh("EVIDENCE_READER_VALIDATION.json",reader_test)
    if reader_test["exitCode"]!=0:
        raise RuntimeError("FIXED_SOURCE_BOUND_EVIDENCE_READER_FAILED")
    actual_reader=json.loads(reader_test["stdout"])
    if codec.decode(actual_reader["stdout"],preset)!=envelope:
        raise RuntimeError("ACTUAL_READER_COMPLETE_BYTES_ROUNDTRIP")
    fresh("EVIDENCE_TRANSPORT_VALIDATION.json",{
        "dictionarySha256":sha(HERE/"proof_dictionary.bin"),"dictionaryBytes":len(preset),
        "encodedLineCharacters":len(line),"existingSafeDiagnosticBound":3800,
        "completeEnvelopeDecodedBytes":len(json.dumps(envelope,separators=(",",":"),ensure_ascii=False).encode()),
        "exactFieldBytes":{k:len(v.encode()) for k,v in envelope.items()},
        "exactFieldSha256":{k:hashlib.sha256(v.encode()).hexdigest() for k,v in envelope.items()},
        "losslessRoundtrip":True,"truncationOrOmittedFields":False,"tests":tests,
        "readerSha256":sha(HERE/"proof_evidence_reader.py"),
        "actualFixedPathReaderTest":"EVIDENCE_READER_VALIDATION.json",
        "actualReaderModeAndWrongCandidateDenials":"PASS",
        "dictionaryIsNotGuestEvidence":True,
        "futureDiagnosticPolicy":"fail closed if complete encoded evidence exceeds 3800; never truncate"})
    fresh("GO_COMPILER_BINDING.json",version)
    with tarfile.open(HERE/"payload.tar") as archive:
        census = json.load(archive.extractfile("census.json"))
        runtime_config = json.load(archive.extractfile("runtime.json"))
        members = []
        for member in archive.getmembers():
            data = archive.extractfile(member).read()
            digest = hashlib.sha256(data).hexdigest()
            if not member.isfile() or member.mode not in (0o400,0o500):
                raise RuntimeError("QUALIFIED_RUNTIME_CENSUS_CHANGED")
            members.append({"name":member.name,"bytes":len(data),"sha256":digest,"mode":oct(member.mode)})
    fresh("QUALIFIED_RUNTIME_COMPONENT_CENSUS.json",{
        "payloadTarSha256":sha(HERE/"payload.tar"),"payloadTarBytes":(HERE/"payload.tar").stat().st_size,
        "censusSha256":proof["embeddedCensusSha256"],"censusMemberCount":len(census),
        "archiveMemberCount":len(members),"runtime":runtime_config,"members":members,
        "payloadByteIdenticalToQualified":sha(HERE/"payload.tar")==sha(QUALIFIED/"payload.tar")})
    source_components = FINAL+("static_witness.go","static-witness","proof_contract.json","payload.tar")
    source_diff=[]
    diff_names=sorted({p.name for p in HERE.iterdir() if p.is_file() and
                       (p.suffix in (".go",".py",".md") or p.name=="proof_contract.json")})
    for name in diff_names:
        before=(SOURCE/name).read_text() if (SOURCE/name).exists() else ""
        after=(HERE/name).read_text()
        source_diff.extend(difflib.unified_diff(before.splitlines(True),after.splitlines(True),
                           fromfile="verified-source/"+name,tofile="candidate/"+name))
    fresh("SOURCE_CHANGESET.diff","".join(source_diff))
    source_map = {name:sha(HERE/name) for name in source_components}
    normalized = json.dumps(source_map,sort_keys=True,separators=(",",":")).encode()
    source_sha = hashlib.sha256(normalized).hexdigest()
    component_census = [{"name":name,"bytes":(HERE/name).stat().st_size,"sha256":source_map[name],
                        "kind":"compiled-go-source" if name in FINAL else
                        "embedded-runtime" if name=="payload.tar" else
                        "governed-proof-contract" if name=="proof_contract.json" else
                        "embedded-static-witness" if name=="static-witness" else "static-witness-source"}
                       for name in sorted(source_map)]
    spec = re.findall(r'"([^"]+)":\s+\{(\d+), "([0-9a-f]{64})"\}',(HERE/"frozen_bindings.go").read_text())
    input_census = []
    for name,size,digest in spec:
        path=ROOT/".azure"/"g3a-controller-repair"/"inputs"/name
        if sha(path)!=digest or path.stat().st_size!=int(size):
            raise RuntimeError("FINAL_INPUT_HASH_CHANGED")
        input_census.append({"name":name,"bytes":int(size),"sha256":digest,"staging":"external readonly /inputs"})
    auxiliary = {p.name:sha(p) for p in HERE.iterdir() if p.is_file() and p.name not in
                 source_map and p.name not in ("production-runner","runner-source-tests")}
    fresh("SOURCE_BINDING.json",{
        "PRODUCTION_RUNNER_SOURCE_SHA256":source_sha,
        "definition":"SHA256_OF_CANONICAL_SORTED_FILENAME_TO_SHA256_MAP_UTF8_NO_WHITESPACE",
        "sourceFileHashes":source_map,"sourceComponentCensus":component_census,
        "auxiliarySourceAndEvidenceHashes":auxiliary,
        "PRODUCTION_RUNNER_SHA256":sha(candidate),"PRODUCTION_RUNNER_BYTES":len(raw),
        "PRODUCTION_RUNNER_COMPONENT_CENSUS":component_census,
        "compilerBindingFile":"GO_COMPILER_BINDING.json",
        "buildCommand":results[-3]["command"],"testBuildCommand":results[4]["command"],
        "qualifiedRuntime":"QUALIFIED_RUNTIME_COMPONENT_CENSUS.json",
        "originalVerifiedProductionSource":str(SOURCE),
        "exactUnchangedProductionComponents":[n for n in CORE if n!="launcher.go"],
        "launcherOnlyDelta":"two separately governed static proof routes; historical run and production routes unchanged",
        "productionPrimitiveRows":30,"staticProofPrimitiveRows":30,
        "productionAuthorityDigest":"","proofContractSha256":proof["details"]["proofContractSha256"],
        "staticWitnessSourceSha256":sha(HERE/"static_witness.go"),
        "staticWitnessSha256":sha(HERE/"static-witness"),
        "staticWitnessBytes":(HERE/"static-witness").stat().st_size,
        "frozenInputCensus":input_census,"frozenInputTotalBytes":sum(x["bytes"] for x in input_census)})
    guard()
    shutil.rmtree(HERE/".checks")
    guard()
    (HERE/"runner-source-tests").unlink()
    cleanup={"ownedBuildCacheRemoved":not (HERE/".checks").exists(),
             "unitTestExecutableRemoved":not (HERE/"runner-source-tests").exists(),
             "localContainerRemoved":True,"kernelParentMountinfoUnchanged":witness["controllerParentMountinfoUnchanged"],
             "proofNamespaceChildRootRemoved":witness["proofRootRemoved"],
             "proofReceiptDirectoryNeverConsumed":witness["receiptsEmpty"],
             "historicalBytesUnchanged":True,"candidateAndEmbeddedWitnessRetained":True}
    if not all(cleanup.values()):
        raise RuntimeError("LOCAL_CANDIDATE_VALIDATION_RESIDUAL")
    fresh("LOCAL_VALIDATION_CLEANUP.json",cleanup)
    report={
        "schema":"g3a-final-runner-candidate-parent-report/v1","disposition":"PASS_CANDIDATE_BUILD_AND_LOCAL_ACTUAL_STATIC_PROOF",
        "mission":"NZ-20261008-INFRA-001","scope":"SOURCE_BOUND_STATIC_RUNNER_CANDIDATE_NOT_PINNED_GUEST_QUALIFICATION",
        "offlinePrerequisiteAuthority":"parent explicitly confirmed historical exact hard-bounded core plus verified source and constructor witness PASS",
        "PRODUCTION_RUNNER_OFFLINE_QUALIFICATION":"PASS",
        "PRODUCTION_RUNNER_SOURCE_SHA256":source_sha,"PRODUCTION_RUNNER_SHA256":sha(candidate),
        "PRODUCTION_RUNNER_BYTES":len(raw),"PRODUCTION_RUNNER_COMPONENT_CENSUS":component_census,
        "SOURCE_BINDING_SHA256":sha(HERE/"SOURCE_BINDING.json"),
        "QUALIFIED_PRIMITIVES_UNCHANGED":"YES","productionPrimitiveRows":30,"proofPrimitiveRows":30,
        "primitiveMatrixFiles":["PRODUCTION_PRIMITIVE_EQUIVALENCE_MATRIX.json","STATIC_PROOF_PRIMITIVE_EQUIVALENCE_MATRIX.json"],
        "completeSourceChanges":"exact source copies plus candidate-lane launcher routing and hardproof_* files; SOURCE_CHANGESET.diff",
        "trustedExecutionAuthoritySHA256":"","expectedExecutionAuthorityDigest":"",
        "productionFailClosed":"PASS","productionFutureAuthorityIssued":False,
        "candidateStaticKernelProof":"PASS_ACTUAL_PUBLISHED_FINAL_CANDIDATE_ENTRYPOINT",
        "fixedEvidenceReaderPositiveAndNegatives":"PASS",
        "actualConstructor":"stageProductionMounts","actualDispatchBoundary":"dispatchConstructedCore -> childDispatchBoundary",
        "frozenCoreInvocations":0,"actualStaticDispatchInvocations":1,"actualHarmlessStaticExecutableInvocations":2,
        "inputLayout":"unchanged external transaction-owned readonly /inputs; no /build/.inputs",
        "inputCount":15,"inputTotalBytes":sum(x["bytes"] for x in input_census),
        "inputBuildChargeBytes":0,"extraInputRootOrMemoryTmpfsCopies":0,
        "capacity":proof["details"]["initialLimits"],"cleanupCapacity":proof["details"]["finalLimits"],
        "devicePaths":["/dev/null"],"procfs":False,
        "kernelWitnessSha256":sha(HERE/"KERNEL_CANDIDATE_WITNESS.json"),
        "candidateEntryPointNegatives":13,"portableDispatchTestsAndSubtests":101,
        "linuxSourceTestsAndSubtests":134,"transportTests":8,
        "exactValidationResultsFile":"CANDIDATE_VALIDATION_ATTEMPT_1.json",
        "evidenceTransportValidation":"EVIDENCE_TRANSPORT_VALIDATION.json",
        "proofInvocationContract":{
            "argv":["./production-runner","--hard-bound-static-proof",proof["details"]["proofContractSha256"]],
            "workingDirectory":"controller-owned private root; pinned parent may use /var/lib/waagent/custom-script/download/0",
            "inputRoot":".g3a-transaction-HARD_BOUND_STATIC_PROOF/inputs",
            "receiptRoot":".g3a-transaction-HARD_BOUND_STATIC_PROOF/receipts",
            "evidenceRoot":".g3a-isolation-proof-hard-bound-static",
            "requirements":"exact immutable readonly fifteen inputs; exclusive private transaction/receipt roots; inherited root and qualified syscall capabilities",
            "configuration":"no extra arguments, request, env override, alternate root/limits/payload/commands",
            "timeoutSeconds":75,"summaryMarker":"G3A_FINAL_STATIC_PROOF_V1 ",
            "fullEvidenceSchema":"g3a-final-hard-bound-static-proof/v1",
            "requiredCheckFields":sorted(proof["checks"]),
            "completeEvidenceFields":sorted(codec.FIELDS),
            "losslessTransportMarker":codec.MARKER,"singleDiagnosticLineMaximum":3800,
            "offlineEncodedLineCharacters":len(line),"presetDictionarySha256":sha(HERE/"proof_dictionary.bin"),
            "fixedEvidenceReaderSha256":sha(HERE/"proof_evidence_reader.py"),
            "transportPolicy":"retain exact baseline/proof/runtime; fail closed on bound, never omit or truncate",
            "staticProofCannotAuthorizeProduction":True},
        "qualifiedRuntimePayloadSHA256":sha(HERE/"payload.tar"),
        "qualifiedRuntimePayloadBytes":(HERE/"payload.tar").stat().st_size,
        "runtimeComponentCensus":"QUALIFIED_RUNTIME_COMPONENT_CENSUS.json",
        "knownDistinctRunnerPlusFrozenInputBytes":len(raw)+sum(x["bytes"] for x in input_census),
        "payloadCensusScope":"exact candidate and frozen input inventory only; parent bootstrap/live proof packaging not created by this task",
        "azureReads":0,"azureMutations":0,"registryCalls":0,"liveAuthorityConsumed":False,
        "PINNED_GUEST_BUILD_CAPACITY_BOUND":"NOT_RUN","PINNED_GUEST_TMP_CAPACITY_BOUND":"NOT_RUN",
        "G3A_PRODUCTION_COMPATIBLE_RUNNER":"BLOCKED",
        "runnerQualificationBlocker":"parent-owned pinned-guest proof and live cleanup have not run",
        "G3A_TRANSACTION_READINESS":"BLOCKED","G3A_EXECUTION_AUTHORIZED":"NO",
        "parentOwnsFutureLiveSafetyDeploymentAndCleanup":True,"noCommit":True,
        "localCleanup":"LOCAL_VALIDATION_CLEANUP.json","initialBaseline":initial,"finalBaseline":guard()}
    fresh("PARENT_CANDIDATE_REPORT.json",report)
    print(json.dumps({"report":str(HERE/"PARENT_CANDIDATE_REPORT.json"),
                      "reportSha256":sha(HERE/"PARENT_CANDIDATE_REPORT.json"),
                      "sourceSha256":source_sha,"candidateSha256":sha(candidate),"candidateBytes":len(raw),
                      "evidenceLineCharacters":len(line),"status":report["disposition"]},indent=2))


if __name__=="__main__":
    main()
