import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import census


class CensusTests(unittest.TestCase):
    def test_go_suffix_directory_is_not_source(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "not_a_file.go").mkdir()
            (root / "actual.go").write_text('package x\nconst null = "/dev/null"\n', encoding="utf-8")
            result = census.source_inventory(root)
            self.assertEqual(set(result["fileHashes"]), {"actual.go"})
            self.assertEqual(result["directoriesWithGoSuffixNotSourceFiles"], ["not_a_file.go"])
            self.assertEqual(result["references"][0]["references"], ["/dev/null"])

    def test_scan_is_not_required_path_classification(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "x_test.go").write_text('const tty = "/dev/tty"', encoding="utf-8")
            result = census.source_inventory(root)
            self.assertTrue(result["references"][0]["testOrGenerator"])
            self.assertEqual(result["references"][0]["reachability"], "NOT_IMPLIED_BY_TEXT_MATCH")

    def test_explicit_device_and_descriptor_reference_scan(self):
        raw = b"/dev/null /dev/zero /dev/random /dev/urandom /dev/tty /dev/stdin /dev/stdout /dev/stderr /proc/self/fd/3"
        self.assertEqual(len(census.refs(raw)), 9)

    def test_receipt_never_overwrites_different_evidence(self):
        with tempfile.TemporaryDirectory() as temp, patch.object(census, "HERE", Path(temp)):
            census.fresh("a.json", {"x": 1})
            census.fresh("a.json", {"x": 1})
            with self.assertRaisesRegex(RuntimeError, "REFUSING_TO_REPLACE"):
                census.fresh("a.json", {"x": 2})
            self.assertEqual(json.loads((Path(temp) / "a.json").read_text()), {"x": 1})


if __name__ == "__main__":
    unittest.main()
