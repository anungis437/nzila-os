"""Bounded lossless evidence codec; the preset dictionary is not guest evidence."""

import base64
import json
import re
import shlex
import zlib

MARKER = "G3A_EXACT_EVIDENCE_V1 "
FIELDS = {"baselineJson", "proofJson", "runtimeJson"}
MAX_FIELD = 262144
MAX_DECODED = MAX_FIELD * 3 + 16384
MAX_LINE = 3800


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def dictionary(report):
    envelope = report["positiveFixtureFullOutputs"]["exactEvidenceEnvelope"]
    value = {key: envelope[key] for key in sorted(FIELDS)}
    return json.dumps(value, separators=(",", ":"), ensure_ascii=False).encode("utf-8")[-32768:]


def validate(envelope):
    require(isinstance(envelope, dict) and set(envelope) == FIELDS, "EVIDENCE_FIELD_CENSUS")
    for value in envelope.values():
        require(isinstance(value, str) and len(value.encode("utf-8")) <= MAX_FIELD, "EVIDENCE_FIELD_BOUND")


def encode(envelope, preset):
    validate(envelope)
    raw = json.dumps(envelope, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    compressor = zlib.compressobj(9, zdict=preset)
    body = base64.b64encode(compressor.compress(raw) + compressor.flush()).decode("ascii")
    line = MARKER + body
    require(len(line) <= MAX_LINE, "EXACT_EVIDENCE_EXCEEDS_SINGLE_DIAGNOSTIC_OUTPUT_BOUND")
    return line


def decode(message, preset):
    require(isinstance(message, str) and len(message) <= 16384, "DIAGNOSTIC_MESSAGE_BOUND")
    matches = re.findall(r"^" + re.escape(MARKER) + r"([A-Za-z0-9+/=]+)$", message, re.MULTILINE)
    require(len(matches) == 1, "EXACT_EVIDENCE_MARKER_CENSUS")
    require(len(MARKER) + len(matches[0]) <= MAX_LINE, "ENCODED_EVIDENCE_BOUND")
    compressed = base64.b64decode(matches[0], validate=True)
    decompressor = zlib.decompressobj(zdict=preset)
    raw = decompressor.decompress(compressed, MAX_DECODED + 1)
    require(len(raw) <= MAX_DECODED and decompressor.eof and
            not decompressor.unused_data and not decompressor.unconsumed_tail, "COMPRESSED_EVIDENCE_BOUND")
    envelope = json.loads(raw.decode("utf-8"))
    validate(envelope)
    return envelope


def reader_script(evidence_file, preset):
    require(isinstance(evidence_file, str) and
            re.fullmatch(r"\.g3a-isolation-proof-[0-9]+/proof\.json", evidence_file),
            "LIVE_EVIDENCE_PATH_BOUND")
    relative_directory = evidence_file.rsplit("/", 1)[0]
    code = '''
import base64, hashlib, json, os, stat, zlib
base = "/var/lib/waagent/custom-script/download/0"
relative = RELATIVE
assert os.path.realpath(base) == base, "CSE_BASE_PATH_SYMLINK"
directory = os.open(base + "/" + relative, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
info = os.fstat(directory)
assert info.st_uid == 0 and stat.S_IMODE(info.st_mode) == 0o700, "EVIDENCE_DIRECTORY_OWNER_MODE"
def read(name):
    descriptor = os.open(name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=directory)
    try:
        before = os.fstat(descriptor)
        assert stat.S_ISREG(before.st_mode) and before.st_uid == 0 and before.st_nlink == 1, "EVIDENCE_FILE_TYPE_OWNER"
        assert stat.S_IMODE(before.st_mode) == 0o600 and before.st_size <= 262144, "EVIDENCE_FILE_MODE_SIZE"
        with os.fdopen(descriptor, "rb", closefd=False) as stream:
            raw = stream.read(262145)
        after = os.fstat(descriptor)
        assert len(raw) == before.st_size == after.st_size and before.st_mtime_ns == after.st_mtime_ns, "EVIDENCE_READ_CHANGED"
        return raw.decode("utf-8")
    finally:
        os.close(descriptor)
try:
    baseline = read("baseline.json")
    proof = read("proof.json")
finally:
    os.close(directory)
value = json.loads(proof)
runtime = json.dumps(value["details"]["runtimeSelfTest"], sort_keys=True) + "\\n"
assert hashlib.sha256(runtime.encode()).hexdigest() == value["runtimeEvidenceSha256"], "RUNTIME_CANONICAL_HASH"
envelope = {"baselineJson": baseline, "proofJson": proof, "runtimeJson": runtime}
assert all(len(x.encode()) <= 262144 for x in envelope.values()), "EVIDENCE_FIELD_BOUND"
raw = json.dumps(envelope, separators=(",", ":"), ensure_ascii=False).encode()
preset = base64.b64decode(PRESET, validate=True)
compressor = zlib.compressobj(9, zdict=preset)
line = "G3A_EXACT_EVIDENCE_V1 " + base64.b64encode(compressor.compress(raw) + compressor.flush()).decode()
assert len(line) <= 3800, "EXACT_EVIDENCE_EXCEEDS_SINGLE_DIAGNOSTIC_OUTPUT_BOUND"
print(line)
'''
    code = code.replace("RELATIVE", repr(relative_directory)).replace(
        "PRESET", repr(base64.b64encode(preset).decode("ascii")))
    return ("set -eu\n"
            "if [ ! -x /usr/bin/python3 ]; then printf 'DIAGNOSTIC_COMPRESSOR_UNAVAILABLE\\n'; exit 1; fi\n"
            "/usr/bin/python3 -I -B -S -c " + shlex.quote(code) + "\n")
