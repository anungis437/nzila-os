"""Fixed delivery diagnostic, lossless decode and governed parse(message) boundary."""
import base64
import hashlib
import json
from pathlib import Path
import re
import zlib

HERE = Path(__file__).resolve().parent
BASE = "/var/lib/waagent/custom-script/download/0"
MARKER = "G3A_FINAL_DELIVERY_EXACT_V1 "
HANDOFF = "G3A_HARD_DELIVERY_V1 "
FIELDS = {"baselineJson", "proofJson", "runtimeJson", "handoffJson"}
MAX_LINE = 3800
MAX_DECODED = 819200
CHECKS = {
    "baseline", "buildLimitEffective", "executableMounts", "hardBoundCleanup",
    "hostFSNegative", "minimalNull", "mountNamespace", "namespaceCleanup",
    "networkIsolation", "networkNegative", "noNewPrivs", "privilegeDrop",
    "privilegeRegainNegative", "productionDispatch", "productionFailClosed",
    "productionMounts", "readonlyInputs", "rootIsolation", "selfContained", "tmpLimitEffective",
}


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def pairs(values):
    result = {}
    for key, value in values:
        require(key not in result, "DUPLICATE_JSON_KEY")
        result[key] = value
    return result


def loads(raw):
    return json.loads(raw, object_pairs_hook=pairs)


def bindings():
    return loads((HERE / "DELIVERY_CONSTANTS_FINAL.json").read_text())


def dictionary():
    raw = (HERE / "proof_dictionary.bin").read_bytes()
    require(len(raw) == 32000 and hashlib.sha256(raw).hexdigest() == bindings()["dictionarySha256"],
            "SEALED_CANDIDATE_DICTIONARY")
    return raw


def envelope_check(value):
    require(isinstance(value, dict) and set(value) == FIELDS, "EXACT_COMPLETE_FIELD_CENSUS")
    for name, raw in value.items():
        require(isinstance(raw, str) and len(raw.encode()) <= (16384 if name == "handoffJson" else 262144),
                "EXACT_RAW_FIELD_BOUND")
        require(isinstance(loads(raw), dict), "STRUCTURED_RAW_EVIDENCE_REQUIRED")


def encode(value):
    envelope_check(value)
    raw = json.dumps(value, separators=(",", ":"), ensure_ascii=False).encode()
    require(len(raw) <= MAX_DECODED, "COMPLETE_DECODED_BOUND")
    compressor = zlib.compressobj(9, zdict=dictionary())
    line = MARKER + base64.b64encode(compressor.compress(raw) + compressor.flush()).decode()
    require(len(line) <= MAX_LINE, "COMPLETE_EVIDENCE_EXCEEDS_SAFE_BOUND")
    return line


def decode(message):
    require(isinstance(message, str) and len(message.encode()) <= 16384, "DIAGNOSTIC_MESSAGE_BOUND")
    matches = re.findall(r"^" + re.escape(MARKER) + r"([A-Za-z0-9+/=]+)$", message, re.MULTILINE)
    require(message.count(MARKER) == 1 and len(matches) == 1 and len(MARKER) + len(matches[0]) <= MAX_LINE, "COMPLETE_MARKER_CENSUS_OR_BOUND")
    compressed = base64.b64decode(matches[0], validate=True)
    reader = zlib.decompressobj(zdict=dictionary())
    raw = reader.decompress(compressed, MAX_DECODED + 1)
    require(len(raw) <= MAX_DECODED and reader.eof and not reader.unused_data and not reader.unconsumed_tail,
            "COMPRESSED_BOMB_TRUNCATION_OR_TRAILING_BYTES")
    result = loads(raw.decode())
    envelope_check(result)
    return result


def handoff_check(value):
    b = bindings()
    require(set(value) == {
        "baselineSha256", "bundleBytes", "bundleSha256", "candidateAndExactEvidenceRetained",
        "candidateBytes", "candidateExitCode", "candidatePath", "candidateSha256",
        "evidenceRoot", "frozenCoreInvocations", "futureAuthorityIssued", "inputBuildChargeBytes",
        "inputBytes", "inputCount", "inputRoot", "inputStagingFilesystem", "outcome",
        "ownedStagingCleanup", "productionAuthorityDigest", "proofContractSha256", "proofSha256",
        "readonlyInputBind", "runtimeSha256", "schema", "shimBytes", "shimSha256",
    }, "EXACT_HANDOFF_SCHEMA_FIELD_CENSUS")
    require(value["schema"] == "g3a-hard-delivery-handoff/v1" and value["outcome"] == "PASS", "HANDOFF_NOT_PASS")
    for key in ("shimSha256", "shimBytes", "bundleSha256", "bundleBytes", "candidateSha256",
                "candidateBytes", "proofContractSha256"):
        require(type(value[key]) is type(b[key]) and value[key] == b[key], "IDENTITY_" + key)
    for key, expected in {
        "inputCount": 15, "inputBytes": 265077049, "candidateExitCode": 0,
        "inputBuildChargeBytes": 0, "frozenCoreInvocations": 0,
        "productionAuthorityDigest": "", "futureAuthorityIssued": False,
        "candidateAndExactEvidenceRetained": True, "readonlyInputBind": "PASS",
        "ownedStagingCleanup": "PASS", "inputStagingFilesystem": "EXTERNAL_DISK_NO_TMPFS_COPY",
        "inputRoot": BASE + "/.g3a-transaction-HARD_BOUND_STATIC_PROOF/inputs",
        "candidatePath": BASE + "/g3a-final-runner",
        "evidenceRoot": BASE + "/.g3a-isolation-proof-hard-bound-static",
    }.items():
        require(type(value[key]) is type(expected) and value[key] == expected, "HANDOFF_" + key)
    for key in ("baselineSha256", "proofSha256", "runtimeSha256"):
        require(isinstance(value[key], str) and re.fullmatch("[a-f0-9]{64}", value[key]), "HASH_" + key)


def compact(message):
    require(isinstance(message, str) and len(message.encode()) <= 16384, "HANDOFF_MESSAGE_BOUND")
    matches = re.findall(r"^" + re.escape(HANDOFF) + r"(\{[^\n]+\})$", message, re.MULTILINE)
    require(message.count(HANDOFF) == 1 and len(matches) == 1, "HANDOFF_MARKER_CENSUS")
    raw = matches[0]
    value = loads(raw)
    handoff_check(value)
    return {
        "allPassed": False, "checksAllPassed": False, "evidenceComplete": False,
        "diagnosticRequired": True, "evidenceRetentionRequiredBeforeCleanup": True,
        "extensionSuccessRequiredSeparately": True,
        "scope": "HASH_BOUND_HANDOFF_SUMMARY_ONLY_NOT_KERNEL_QUALIFICATION",
        "handoff": value, "handoffJson": raw,
        "evidenceReference": {"proofFile": BASE + "/.g3a-isolation-proof-hard-bound-static/proof.json",
                              "baselineFile": BASE + "/.g3a-isolation-proof-hard-bound-static/baseline.json",
                              "handoffFile": BASE + "/.g3a-hard-delivery-evidence/handoff.json"},
    }


def pinned_baseline(value):
    b = bindings()
    require(value["architecture"] == "linux/amd64" and value["kernel"] == b["pinnedKernel"] and
            value["cwd"] == BASE, "PINNED_KERNEL_ARCHITECTURE_CWD")
    s = value["status"]
    require(s["Uid"].split() == ["0"] * 4 and s["Gid"].split() == ["0"] * 4, "PINNED_ROOT_IDS")
    require(s["NoNewPrivs"] == "0" and s["Seccomp"] == "0" and s["Seccomp_filters"] == "0",
            "PINNED_KERNEL_SECCOMP_BASELINE")
    require(s["Groups"] in ("", "0"), "PINNED_ROOT_GROUPS")
    for name in ("CapEff", "CapPrm", "CapBnd"):
        require(s[name] == b["pinnedRootCaps"], "PINNED_ROOT_CAPABILITIES")
    require(s["CapAmb"] == s["CapInh"] == "0000000000000000", "PINNED_AMBIENT_INHERITABLE")
    namespaces = value["namespaces"]
    require(set(namespaces) == {"mnt", "net", "pid", "user", "uts", "ipc", "cgroup"}, "BASELINE_NAMESPACE_CENSUS")
    for name, identity in namespaces.items():
        require(isinstance(identity, str) and re.fullmatch(re.escape(name) + r":\[[0-9]+\]", identity),
                "BASELINE_NAMESPACE_IDENTITY")
    require(isinstance(value["relevantMountState"], list) and value["relevantMountState"],
            "BASELINE_MOUNT_STATE")


def observation(value, total, inodes):
    require(set(value) == {"availableBytes", "availableInodes", "filesystemType", "mountFlags", "totalBytes", "totalInodes"},
            "EFFECTIVE_LIMIT_FIELD_CENSUS")
    require(all(type(x) is int for x in value.values()), "EFFECTIVE_LIMIT_INTEGER_TYPES")
    require(value == {"availableBytes": total, "availableInodes": inodes - 1, "filesystemType": 16914836,
                      "mountFlags": 4134, "totalBytes": total, "totalInodes": inodes}, "EXACT_KERNEL_LIMITS")


def full(value):
    envelope_check(value)
    b = bindings()
    h = loads(value["handoffJson"])
    handoff_check(h)
    proof, baseline, runtime = (loads(value[name]) for name in ("proofJson", "baselineJson", "runtimeJson"))
    for field, reference in (("proofJson", "proofSha256"), ("baselineJson", "baselineSha256"), ("runtimeJson", "runtimeSha256")):
        require(hashlib.sha256(value[field].encode()).hexdigest() == h[reference], "HANDOFF_EXACT_HASH_" + field)
    require(proof["schema"] == "g3a-final-hard-bound-static-proof/v1" and
            proof["mode"] == "--hard-bound-static-proof" and proof["outcome"] == "PASS", "FINAL_CANDIDATE_PROOF_SCHEMA")
    require(not any(proof.get(x) for x in ("failedPrimitive", "failedOperation", "errorCode")), "FAILURE_IN_SUCCESS_PROOF")
    require(proof["candidateSha256"] == b["candidateSha256"] and type(proof["candidateBytes"]) is int and
            proof["candidateBytes"] == b["candidateBytes"], "UNCHANGED_FINAL_CANDIDATE_IDENTITY")
    require(set(proof["checks"]) == CHECKS and set(proof["checks"].values()) == {"PASS"}, "EXACT_TWENTY_CHECKS_PASS")
    require(proof["baseline"] == baseline and proof["baselineSha256"] == h["baselineSha256"], "BASELINE_EXACT_BINDING")
    require(proof["embeddedCensusSha256"] == b["embeddedCensusSha256"] and proof["embeddedFileCount"] == 141,
            "QUALIFIED_EMBEDDED_CENSUS")
    require(proof["runtimeCensusCount"] == b["runtimeCensusCount"] and
            proof["runtimeEvidenceSha256"] == h["runtimeSha256"] == b["runtimeSha256"], "QUALIFIED_RUNTIME_HASH_CENSUS")
    d = proof["details"]
    require(d["runtimeSelfTest"] == runtime and d["proofContractSha256"] == b["proofContractSha256"], "RUNTIME_CONTRACT_CONTENT")
    require(type(d["coreInvocations"]) is int and d["coreInvocations"] == 0 and
            type(d["staticWitnessInvocations"]) is int and d["staticWitnessInvocations"] == 1 and
            d["productionExecutionAuthorityDigest"] == "", "STATIC_ONLY_NO_PRODUCTION_AUTHORITY")
    pinned_baseline(baseline)
    require(d["isolationMechanism"] == "clone(CLONE_NEWNS|CLONE_NEWNET)+private-bind-readonly+chroot(no-proc)",
            "QUALIFIED_ISOLATION_MECHANISM")
    require(d["dependencyClasses"] == ["CAPSULE_EMBEDDED", "PINNED_KERNEL_ABI"], "SELF_CONTAINED_DEPENDENCIES")
    for stage in ("initialLimits", "effectiveLimitsBeforeCore", "finalLimits"):
        observation(d[stage]["build"], 1073741824, 32768)
        observation(d[stage]["tmp"], 268435456, 4096)
    require(d["buildTmpEmptied"] is True and d["inputCount"] == 15 and d["inputBuildChargeBytes"] == 0 and
            d["inputLayout"] == "direct readonly /inputs external bind" and d["inputSpecSha256"] == b["inputSpecSha256"],
            "EXACT_REHEARSED_INPUT_LAYOUT_CLEANUP")
    for path in ("/build", "/tmp"):
        require(d["executableMountWitness"][path] == "G3A_HARMLESS_STATIC_EXEC_WITNESS_V1\n", "EXECUTABLE_MOUNT_WITNESS")
    for path in ("/work", "/output"):
        require(d["executableMountWitness"][path] == "EACCES" and d["actualMounts"][path]["mountFlags"] & 14 == 14,
                "WRITABLE_ROOT_EXEC_DENIAL")
    for path in ("/", "/runtime", "/inputs"):
        require(d["actualMounts"][path]["mountFlags"] & 7 == 7, "READONLY_NON_HOST_ROOT")
    require(d["actualMounts"]["/dev"]["totalBytes"] == 1048576 and d["actualMounts"]["/dev"]["totalInodes"] == 8,
            "EXACT_MINIMAL_NULL_CONSTRUCTOR")
    p = d["privilegeState"]
    require(p["uidRealEffectiveSaved"] == p["gidRealEffectiveSaved"] == [65532] * 3 and
            p["supplementaryGroups"] == [] and p["noNewPrivs"] == 1 and p["capBoundingAmbient"] == "ZERO",
            "EXACT_PRIVILEGE_DROP")
    require(p["capEffectivePermittedInheritable"] == [{"Effective": 0, "Inheritable": 0, "Permitted": 0}] * 2,
            "ZERO_CAPABILITY_SETS")
    require(d["routeCount"] == 0 and d["interfaces"] == [{"addressCount": 0, "flags": 4, "name": "lo"}],
            "DISCONNECTED_NETWORK")
    require(d["tcpNegatives"] == [{"state": "UNREACHABLE", "targetClass": name} for name in ("loopback", "private", "linklocal")],
            "THREE_NETWORK_NEGATIVES")
    for name in ("mnt", "net"):
        require(re.fullmatch(name + r":\[[0-9]+\]", d["isolatedNamespaces"][name]) and
                d["isolatedNamespaces"][name] != baseline["namespaces"][name], "NAMESPACE_SEPARATION")
    require(d["actualDispatchNegatives"] == {"effectiveCapacityMismatch": "DENIED_BEFORE_STATIC_CALLBACK",
            "preexistingBuildTransaction": "DENIED_BEFORE_STATIC_CALLBACK"}, "REAL_DISPATCH_NEGATIVES")
    cleanup = d["namespaceCleanup"]
    for key in ("childGone", "isolatedRootRemoved", "isolatedUnderlyingRootEmpty", "outerInputsUnchanged", "parentMountinfoUnchanged"):
        require(cleanup[key] is True, "QUALIFIED_CLEANUP_" + key)
    return {
        "allPassed": True, "checksAllPassed": True, "evidenceComplete": True, "diagnosticRequired": False,
        "extensionSuccessRequiredSeparately": True, "evidenceRetentionRequiredBeforeCleanup": False,
        "scope": "SOURCE_BOUND_HANDOFF_AND_COMPLETE_PINNED_STATIC_PROOF_NOT_CORE_EXECUTION_AUTHORITY",
        "checks": proof["checks"], "handoff": h, "proof": proof,
        "baselineEvidence": baseline, "runtimeEvidence": runtime,
        **value,
    }


def parse(message):
    if isinstance(message, dict):
        value = dict(message)
        original = value.pop("message", None)
        result = full(value)
        if original is not None:
            require(compact(original)["handoffJson"] == value["handoffJson"], "SUMMARY_COMPLETE_HANDOFF_BINDING")
        return result
    require(isinstance(message, str), "MESSAGE_TYPE")
    return full(decode(message)) if MARKER in message else compact(message)


def diagnostic_script():
    raw = (HERE / "FIXED_DIAGNOSTIC.sh").read_text()
    require(len(raw) <= MAX_LINE, "FIXED_DIAGNOSTIC_INVOCATION_BOUND")
    expected = loads((HERE / "READER_PACKAGING.json").read_text())["diagnosticSha256"]
    require(hashlib.sha256(raw.encode()).hexdigest() == expected, "FIXED_DIAGNOSTIC_SOURCE_BINDING")
    return raw


def embedded_reader_code(b):
    """One read-only diagnostic; executes the exact sealed candidate reader text."""
    reader = (HERE / "proof_evidence_reader.py").read_text()
    require(hashlib.sha256(reader.encode()).hexdigest() == b["fixedReaderSha256"], "SEALED_FIXED_READER")
    wrapper = r'''
import base64, contextlib, hashlib, io, json, os, stat, zlib
constants=CONSTANTS
namespace={}
capture=io.StringIO()
with contextlib.redirect_stdout(capture):
    exec(compile(READER, "<sealed-final-candidate-reader>", "exec"), namespace)
preset=namespace["dictionary"]
assert hashlib.sha256(preset).hexdigest()==constants["dictionarySha256"], "DICTIONARY"
line=capture.getvalue().strip()
prefix="G3A_FINAL_EXACT_EVIDENCE_V1 "
assert line.startswith(prefix) and len(line)<=3800, "FIXED_READER_OUTPUT"
decoder=zlib.decompressobj(zdict=preset)
raw=decoder.decompress(base64.b64decode(line[len(prefix):],validate=True),802817)
assert len(raw)<=802816 and decoder.eof and not decoder.unused_data and not decoder.unconsumed_tail, "FIXED_READER_COMPLETE"
envelope=json.loads(raw,object_pairs_hook=namespace["pairs"])
base="/var/lib/waagent/custom-script/download/0"
assert os.path.realpath(base)==base and os.stat(base).st_uid==0 and stat.S_IMODE(os.stat(base).st_mode)==0o700, "BASE"
def file(path,bound,mode):
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
    try:
        before=os.fstat(fd)
        assert stat.S_ISREG(before.st_mode) and before.st_uid==0 and before.st_nlink==1 and before.st_size<=bound, "FILE_TYPE_BOUND"
        assert stat.S_IMODE(before.st_mode)==mode, "FILE_MODE"
        stream=os.fdopen(fd,"rb",closefd=False)
        digest=hashlib.sha256(); pieces=[]; count=0
        while True:
            block=stream.read(1048576)
            if not block: break
            count+=len(block)
            assert count<=bound, "FILE_GROWTH"
            digest.update(block)
            if bound<=16384: pieces.append(block)
        after=os.fstat(fd)
        assert count==before.st_size==after.st_size and before.st_mtime_ns==after.st_mtime_ns, "FILE_CHANGED"
        return digest.hexdigest(),count,b"".join(pieces)
    finally: os.close(fd)
for name,key in (("g3a-handoff","shim"),("g3a-final-runner","candidate"),("g3a-proof-capsule","bundle")):
    mode=0o400 if key=="bundle" else 0o500
    digest,size,_=file(base+"/"+name,constants[key+"Bytes"],mode)
    assert digest==constants[key+"Sha256"] and size==constants[key+"Bytes"], "PUBLISHED_IDENTITY_"+key
directory=base+"/.g3a-hard-delivery-evidence"
assert os.path.realpath(directory)==directory and stat.S_IMODE(os.stat(directory).st_mode)==0o700 and os.stat(directory).st_uid==0, "HANDOFF_ROOT"
_,_,rawhandoff=file(directory+"/handoff.json",16384,0o600)
handoff=json.loads(rawhandoff,object_pairs_hook=namespace["pairs"])
assert handoff["schema"]=="g3a-hard-delivery-handoff/v1" and handoff["outcome"]=="PASS", "HANDOFF"
for key in ("shimSha256","shimBytes","candidateSha256","candidateBytes","bundleSha256","bundleBytes","proofContractSha256"):
    assert handoff[key]==constants[key], "HANDOFF_IDENTITY"
for field,key in (("baselineJson","baselineSha256"),("proofJson","proofSha256"),("runtimeJson","runtimeSha256")):
    assert hashlib.sha256(envelope[field].encode()).hexdigest()==handoff[key], "HANDOFF_EXACT_BYTES"
assert not os.path.lexists(base+"/.g3a-transaction-HARD_BOUND_STATIC_PROOF"), "STAGING_NOT_CLEANED"
envelope["handoffJson"]=rawhandoff.decode()
raw=json.dumps(envelope,separators=(",",":"),ensure_ascii=False).encode()
assert len(raw)<=819200, "COMPLETE_BOUND"
compressor=zlib.compressobj(9,zdict=preset)
line="G3A_FINAL_DELIVERY_EXACT_V1 "+base64.b64encode(compressor.compress(raw)+compressor.flush()).decode()
assert len(line)<=3800, "COMPLETE_EVIDENCE_EXCEEDS_SAFE_BOUND"
print(line)
'''
    wrapper = wrapper.replace("constants=CONSTANTS", "constants=" + repr(b)).replace("compile(READER,", "compile(" + repr(reader) + ",")
    return "#!/bin/sh\nset -eu\nexec /usr/bin/python3 -I -B -S - <<'G3A_READ_ONLY_EXACT_DELIVERY'\n" + wrapper + "\nG3A_READ_ONLY_EXACT_DELIVERY\n"
