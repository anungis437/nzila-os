import base64
import copy
import hashlib
import json
from pathlib import Path
import unittest
import zlib

import evidence_transport as codec

HERE = Path(__file__).resolve().parent


class EvidenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dictionary = (HERE / "proof_dictionary.bin").read_bytes()
        cls.envelope = json.loads((HERE / "EXACT_EVIDENCE_ENVELOPE.json").read_text())
        proof = json.loads(cls.envelope["proofJson"])
        cls.sha, cls.size = proof["candidateSha256"], proof["candidateBytes"]
        cls.token = proof["details"]["proofContractSha256"]

    def test_exact_full_bytes_roundtrip_and_identity(self):
        line = codec.encode(self.envelope, self.dictionary)
        self.assertLessEqual(len(line), 3800)
        decoded = codec.decode(line, self.dictionary)
        self.assertEqual(decoded, self.envelope)
        codec.verify_identity(decoded, self.sha, self.size, self.token,
                              hashlib.sha256(self.envelope["proofJson"].encode()).hexdigest())

    def test_wrong_candidate_bytes_hash_contract_and_exact_proof(self):
        for sha, size, token, proof in (
            ("0"*64, self.size, self.token, None),
            (self.sha, self.size+1, self.token, None),
            (self.sha, self.size, "0"*64, None),
            (self.sha, self.size, self.token, "0"*64),
        ):
            with self.subTest(sha=sha, size=size, token=token, proof=proof), self.assertRaises(ValueError):
                codec.verify_identity(self.envelope, sha, size, token, proof)

    def test_missing_extra_wrong_type_oversized_evidence(self):
        fixtures = [{k:v for k,v in self.envelope.items() if k!="baselineJson"},
                    dict(self.envelope, extra="{}"), dict(self.envelope, runtimeJson=0),
                    dict(self.envelope, runtimeJson="x"*262145)]
        for value in fixtures:
            with self.subTest(keys=list(value)), self.assertRaises(ValueError):
                codec.encode(value, self.dictionary)

    def test_wrong_empty_and_oversized_dictionary(self):
        line = codec.encode(self.envelope, self.dictionary)
        for dictionary in (b"", b"x"*32001, b"wrong"):
            with self.subTest(length=len(dictionary)), self.assertRaises((ValueError, zlib.error)):
                codec.decode(line, dictionary)

    def test_duplicate_markers_invalid_base64_and_diagnostic_bounds(self):
        line = codec.encode(self.envelope, self.dictionary)
        for value in (line+"\n"+line, "no marker", codec.MARKER+"@@@", "x"*16385,
                      codec.MARKER+"A"*3800):
            with self.subTest(length=len(value)), self.assertRaises((ValueError, zlib.error)):
                codec.decode(value, self.dictionary)

    def test_trailing_compressed_bytes_and_truncation(self):
        line = codec.encode(self.envelope, self.dictionary)
        raw = base64.b64decode(line[len(codec.MARKER):])
        for compressed in (raw+b"extra", raw[:-1]):
            with self.subTest(length=len(compressed)), self.assertRaises((ValueError, zlib.error)):
                codec.decode(codec.MARKER+base64.b64encode(compressed).decode(), self.dictionary)

    def test_decompression_bomb_and_duplicate_envelope_fields(self):
        for raw in (b"x"*(codec.MAX_DECODED+1),
                    b'{"proofJson":"{}","proofJson":"{}","baselineJson":"{}","runtimeJson":"{}"}'):
            compressor = zlib.compressobj(9,zdict=self.dictionary)
            line = codec.MARKER+base64.b64encode(compressor.compress(raw)+compressor.flush()).decode()
            with self.subTest(length=len(raw)), self.assertRaises(ValueError):
                codec.decode(line,self.dictionary)

    def test_live_variability_is_complete_and_within_bound(self):
        envelope = copy.deepcopy(self.envelope)
        proof = json.loads(envelope["proofJson"])
        baseline = json.loads(envelope["baselineJson"])
        baseline["kernel"] = "Linux PINNED_GUEST_VARIABILITY_FIXTURE_NOT_LIVE"
        baseline["cwd"] = "/var/lib/waagent/custom-script/download/0"
        baseline["namespaceIds"] = {"mnt":"mnt:[4026533991]","net":"net:[4026533992]"}
        proof["baseline"] = baseline
        envelope["baselineJson"] = json.dumps(baseline, separators=(",",":"))
        proof["baselineSha256"] = hashlib.sha256(envelope["baselineJson"].encode()).hexdigest()
        proof["details"]["namespaceCleanup"]["childPid"] = 4321
        proof["details"]["namespaceCleanup"]["parentMountinfoSha256"] = "a"*64
        envelope["proofJson"] = json.dumps(proof,separators=(",",":"))
        line = codec.encode(envelope,self.dictionary)
        self.assertLessEqual(len(line),3800)
        self.assertEqual(codec.decode(line,self.dictionary),envelope)
        codec.verify_identity(envelope,self.sha,self.size,self.token)


if __name__ == "__main__":
    unittest.main()
