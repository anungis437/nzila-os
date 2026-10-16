import base64
import binascii
import json
from pathlib import Path
import unittest
import zlib

import evidence_transport as transport


class ExactEvidenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        report = json.loads((Path(__file__).resolve().parent.parent / "g3a-isolation-artifacts" /
                             "PARENT_INTEGRATION_REPORT.json").read_text())
        cls.envelope = {key: report["positiveFixtureFullOutputs"]["exactEvidenceEnvelope"][key]
                        for key in sorted(transport.FIELDS)}
        cls.preset = transport.dictionary(report)

    def test_full_fixture_retained_exactly_under_output_bound(self):
        line = transport.encode(self.envelope, self.preset)
        self.assertLessEqual(len(line), 3800)
        self.assertEqual(transport.decode("[stdout]\n" + line + "\n[stderr]\n", self.preset), self.envelope)

    def test_observed_delta_is_not_replaced_by_dictionary(self):
        changed = dict(self.envelope)
        changed["baselineJson"] = changed["baselineJson"].replace('"kernel":', '"actualGuestKernel":')
        line = transport.encode(changed, self.preset)
        self.assertEqual(transport.decode(line, self.preset), changed)
        self.assertNotEqual(transport.decode(line, self.preset), self.envelope)

    def test_ambiguous_or_truncated_output_rejected(self):
        line = transport.encode(self.envelope, self.preset)
        with self.assertRaisesRegex(ValueError, "MARKER_CENSUS"):
            transport.decode(line + "\n" + line, self.preset)
        with self.assertRaises((ValueError, zlib.error, binascii.Error)):
            transport.decode(line[:-8], self.preset)

    def test_trailing_compressed_bytes_rejected(self):
        line = transport.encode(self.envelope, self.preset)
        compressed = base64.b64decode(line[len(transport.MARKER):]) + b"extra"
        malformed = transport.MARKER + base64.b64encode(compressed).decode()
        with self.assertRaisesRegex(ValueError, "COMPRESSED_EVIDENCE_BOUND"):
            transport.decode(malformed, self.preset)


if __name__ == "__main__":
    unittest.main()
