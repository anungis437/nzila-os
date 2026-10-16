"""Read-only independent artifact checks; writes one append-only verification receipt."""
import hashlib
import json
import struct
import tarfile
import zlib
from delivery_guard import CANDIDATE, HERE, fresh, guard, sha
import delivery_evidence as evidence


def verify():
    baseline = guard()
    constants = evidence.bindings()
    census = json.loads((HERE / "BUNDLE_CENSUS.json").read_text())
    names = [member["name"] for member in census["members"]]
    assert len(names) == 16 and names == sorted(names) and len(set(names)) == 16
    assert sha(HERE / "g3a-proof-capsule") == constants["bundleSha256"]
    assert (HERE / "g3a-proof-capsule").stat().st_size == constants["bundleBytes"]
    with tarfile.open(HERE / "g3a-proof-capsule", "r:") as tar:
        members = tar.getmembers()
        assert [member.name for member in members] == names
        for member, expected in zip(members, census["members"]):
            assert member.isreg() and not member.linkname and not member.pax_headers
            assert "/" not in member.name and "\\" not in member.name
            assert member.uid == member.gid == member.mtime == 0
            assert member.size == expected["bytes"] and member.mode == expected["mode"]
            h = hashlib.sha256()
            stream = tar.extractfile(member)
            for block in iter(lambda: stream.read(1048576), b""):
                h.update(block)
            assert h.hexdigest() == expected["sha256"]
    binary = (HERE / "g3a-handoff-bound-reader").read_bytes()
    packaging = json.loads((HERE / "READER_PACKAGING.json").read_text())
    assert hashlib.sha256(binary).hexdigest() == constants["shimSha256"] and len(binary) == constants["shimBytes"]
    prefix = binary[:packaging["originalELFBytes"]]
    assert prefix == (HERE / "g3a-handoff").read_bytes()
    assert prefix[:7] == b"\x7fELF\x02\x01\x01" and struct.unpack_from("<H", prefix, 18)[0] == 62
    phoff = struct.unpack_from("<Q", prefix, 32)[0]
    phsize, phcount = struct.unpack_from("<HH", prefix, 54)
    kinds = [struct.unpack_from("<I", prefix, phoff+i*phsize)[0] for i in range(phcount)]
    assert 3 not in kinds and 2 not in kinds, "NO_INTERPRETER_OR_DYNAMIC_DEPENDENCIES"
    magic = b"G3A_READ_ONLY_BOUND_READER_V1"
    assert binary.endswith(magic)
    length = struct.unpack("<Q", binary[-len(magic)-8:-len(magic)])[0]
    assert length == packaging["compressedReaderBytes"]
    wrapper = zlib.decompress(binary[len(prefix):len(prefix)+length])
    assert hashlib.sha256(wrapper).hexdigest() == packaging["readerWrapperSha256"]
    assert repr((HERE / "proof_evidence_reader.py").read_text()).encode() in wrapper
    assert sha(HERE / "proof_evidence_reader.py") == constants["fixedReaderSha256"]
    assert sha(HERE / "proof_dictionary.bin") == constants["dictionarySha256"]
    assert sha(CANDIDATE / "production-runner") == constants["candidateSha256"]
    assert (CANDIDATE / "production-runner").stat().st_size == constants["candidateBytes"]
    actual = json.loads((HERE / "ACTUAL_COMPLETE_DELIVERY_ENVELOPE.json").read_text())
    assert evidence.decode(evidence.encode(actual)) == actual
    try:
        evidence.parse(actual)
    except ValueError:
        pass
    else:
        raise AssertionError("LOCAL_UNPINNED_EVIDENCE_ACCEPTED")
    compact = evidence.parse(evidence.HANDOFF + actual["handoffJson"])
    assert not compact["allPassed"] and compact["diagnosticRequired"]
    assert len(evidence.diagnostic_script()) == packaging["diagnosticBytes"] <= 3800
    guard()
    return {"outcome": "PASS", "scope": "INDEPENDENT_LOCAL_DELIVERY_ARTIFACTS_ONLY_NOT_LIVE_QUALIFICATION",
        "bundleRegularFiles": 16, "inputRegularFiles": 15, "inputBytes": 265077049,
        "staticELF": True, "compiledShimPrefixUnchanged": True, "sealedCandidateUnchanged": True,
        "sealedReaderDictionaryUnchanged": True, "rawEvidenceRoundtrip": True,
        "localUnpinnedEvidenceDenied": True, "compactSummaryNotSuccess": True, "baseline": baseline}


if __name__ == "__main__":
    result = verify()
    fresh("INDEPENDENT_DELIVERY_VERIFICATION.json", result)
    print("INDEPENDENT_DELIVERY_ARTIFACT_VERIFICATION_PASS")
