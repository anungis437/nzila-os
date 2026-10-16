"""Bounded, lossless final-candidate evidence; the source-bound dictionary is not live evidence."""
import base64
import hashlib
import json
import re
import zlib

MARKER = "G3A_FINAL_EXACT_EVIDENCE_V1 "
FIELDS = {"baselineJson", "proofJson", "runtimeJson"}
MAX_FIELD = 262144
MAX_DECODED = MAX_FIELD * 3 + 16384
MAX_LINE = 3800
MAX_DIAGNOSTIC = 16384


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


def validate(envelope):
    require(isinstance(envelope, dict) and set(envelope) == FIELDS, "EXACT_EVIDENCE_FIELD_CENSUS")
    for value in envelope.values():
        require(isinstance(value, str) and len(value.encode()) <= MAX_FIELD, "EXACT_EVIDENCE_FIELD_BOUND")
        require(isinstance(loads(value), dict), "STRUCTURED_EVIDENCE_REQUIRED")


def verify_identity(envelope, candidate_sha, candidate_bytes, contract_sha, proof_sha=None):
    validate(envelope)
    proof = loads(envelope["proofJson"])
    require(proof["schema"] == "g3a-final-hard-bound-static-proof/v1" and
            proof["mode"] == "--hard-bound-static-proof", "FINAL_PROOF_SCHEMA")
    require(proof["candidateSha256"] == candidate_sha and proof["candidateBytes"] == candidate_bytes,
            "CANDIDATE_IDENTITY")
    require(proof["details"]["proofContractSha256"] == contract_sha, "PROOF_CONTRACT_IDENTITY")
    require(hashlib.sha256(envelope["baselineJson"].encode()).hexdigest() == proof["baselineSha256"],
            "BASELINE_EXACT_BYTES_HASH")
    require(loads(envelope["baselineJson"]) == proof["baseline"], "BASELINE_CONTENT")
    require(hashlib.sha256(envelope["runtimeJson"].encode()).hexdigest() == proof["runtimeEvidenceSha256"],
            "RUNTIME_EXACT_BYTES_HASH")
    require(loads(envelope["runtimeJson"]) == proof["details"]["runtimeSelfTest"], "RUNTIME_CONTENT")
    if proof_sha is not None:
        require(hashlib.sha256(envelope["proofJson"].encode()).hexdigest() == proof_sha, "PROOF_EXACT_BYTES_HASH")


def encode(envelope, dictionary):
    validate(envelope)
    require(isinstance(dictionary, bytes) and 0 < len(dictionary) <= 32000, "PRESET_BOUND")
    raw = json.dumps(envelope, separators=(",", ":"), ensure_ascii=False).encode()
    require(len(raw) <= MAX_DECODED, "EXACT_EVIDENCE_DECODED_BOUND")
    compressor = zlib.compressobj(9, zdict=dictionary)
    line = MARKER + base64.b64encode(compressor.compress(raw) + compressor.flush()).decode()
    require(len(line) <= MAX_LINE, "COMPLETE_EVIDENCE_EXCEEDS_EXISTING_SAFE_DIAGNOSTIC_BOUND")
    return line


def decode(message, dictionary):
    require(isinstance(message, str) and len(message) <= MAX_DIAGNOSTIC, "DIAGNOSTIC_MESSAGE_BOUND")
    matches = re.findall(r"^" + re.escape(MARKER) + r"([A-Za-z0-9+/=]+)$", message, re.MULTILINE)
    require(len(matches) == 1, "EXACT_EVIDENCE_MARKER_CENSUS")
    require(len(MARKER) + len(matches[0]) <= MAX_LINE, "ENCODED_EVIDENCE_BOUND")
    require(isinstance(dictionary, bytes) and 0 < len(dictionary) <= 32000, "PRESET_BOUND")
    compressed = base64.b64decode(matches[0], validate=True)
    reader = zlib.decompressobj(zdict=dictionary)
    raw = reader.decompress(compressed, MAX_DECODED + 1)
    require(len(raw) <= MAX_DECODED and reader.eof and not reader.unused_data and
            not reader.unconsumed_tail, "COMPRESSED_EVIDENCE_BOUND_OR_TRAILING_BYTES")
    envelope = loads(raw.decode())
    validate(envelope)
    return envelope


def reader_code(dictionary, candidate_sha, candidate_bytes, contract_sha):
    """Fixed live path and identity, no caller-selected file/root/configuration."""
    require(isinstance(dictionary, bytes) and 0 < len(dictionary) <= 32000, "PRESET_BOUND")
    source = r'''
import base64, hashlib, json, os, stat, zlib
base = "/var/lib/waagent/custom-script/download/0"
assert os.path.realpath(base) == base, "BASE_SYMLINK"
directory = os.open(base+"/.g3a-isolation-proof-hard-bound-static", os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
info = os.fstat(directory)
assert info.st_uid == 0 and stat.S_IMODE(info.st_mode) == 0o700, "PRIVATE_EVIDENCE_ROOT"
def pairs(values):
    result={}
    for key,value in values:
        assert key not in result, "DUPLICATE_JSON_KEY"
        result[key]=value
    return result
def loads(raw):
    return json.loads(raw,object_pairs_hook=pairs)
def read(name):
    fd=os.open(name,os.O_RDONLY|os.O_NOFOLLOW,dir_fd=directory)
    try:
        before=os.fstat(fd)
        assert stat.S_ISREG(before.st_mode) and before.st_uid==0 and before.st_nlink==1, "EVIDENCE_TYPE_OWNER_LINK"
        assert stat.S_IMODE(before.st_mode)==0o600 and before.st_size<=262144, "EVIDENCE_FILE_BOUND"
        with os.fdopen(fd,"rb",closefd=False) as stream:
            raw=stream.read(262145)
        after=os.fstat(fd)
        assert len(raw)==before.st_size==after.st_size and before.st_mtime_ns==after.st_mtime_ns, "EVIDENCE_CHANGED"
        return raw.decode()
    finally:
        os.close(fd)
try:
    baseline=read("baseline.json")
    proof=read("proof.json")
finally:
    os.close(directory)
value=loads(proof)
assert value["schema"]=="g3a-final-hard-bound-static-proof/v1", "FINAL_PROOF_SCHEMA"
assert value["mode"]=="--hard-bound-static-proof", "FINAL_PROOF_MODE"
assert value["candidateSha256"]==CANDIDATE and value["candidateBytes"]==SIZE, "CANDIDATE_IDENTITY"
assert value["details"]["proofContractSha256"]==CONTRACT, "FIXED_CONTRACT"
assert hashlib.sha256(baseline.encode()).hexdigest()==value["baselineSha256"], "BASELINE_HASH"
assert loads(baseline)==value["baseline"], "BASELINE_CONTENT"
runtime=json.dumps(value["details"]["runtimeSelfTest"],sort_keys=True)+"\n"
assert hashlib.sha256(runtime.encode()).hexdigest()==value["runtimeEvidenceSha256"], "RUNTIME_HASH"
envelope={"baselineJson":baseline,"proofJson":proof,"runtimeJson":runtime}
assert all(len(x.encode())<=262144 for x in envelope.values()), "EVIDENCE_FIELD_BOUND"
raw=json.dumps(envelope,separators=(",",":"),ensure_ascii=False).encode()
assert len(raw)<=802816, "DECODED_BOUND"
dictionary=base64.b64decode(PRESET,validate=True)
assert hashlib.sha256(dictionary).hexdigest()==PRESET_SHA, "PRESET_IDENTITY"
compressor=zlib.compressobj(9,zdict=dictionary)
line="G3A_FINAL_EXACT_EVIDENCE_V1 "+base64.b64encode(compressor.compress(raw)+compressor.flush()).decode()
assert len(line)<=3800, "COMPLETE_EVIDENCE_EXCEEDS_EXISTING_SAFE_DIAGNOSTIC_BOUND"
print(line)
'''
    for key, value in (
        ("CANDIDATE", repr(candidate_sha)), ("SIZE", str(candidate_bytes)), ("CONTRACT", repr(contract_sha)),
        ("PRESET_SHA", repr(hashlib.sha256(dictionary).hexdigest())),
        ("PRESET", repr(base64.b64encode(dictionary).decode())),
    ):
        source = re.sub(r"\b" + key + r"\b", lambda _: value, source)
    return source
