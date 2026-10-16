import json
from pathlib import Path
import unittest

from retry import HERE, PRIOR, effective_handler


class RetryContracts(unittest.TestCase):
    def test_only_selector_changes_in_extension_template(self):
        old = (PRIOR / "infra" / "cse.bicep").read_text()
        new = (HERE / "infra" / "cse.bicep").read_text()
        self.assertEqual(new, old.replace("typeHandlerVersion: '2.1.10'", "typeHandlerVersion: '2.1'"))
        template = json.loads((HERE / "infra" / "cse.json").read_text())
        props = template["resources"][0]["properties"]
        self.assertEqual(props["typeHandlerVersion"], "2.1")
        self.assertFalse(props["autoUpgradeMinorVersion"])
        self.assertFalse(props["enableAutomaticUpgrade"])

    def test_observed_patch_is_not_invented(self):
        for value in (None, "", "2.1"):
            self.assertEqual(effective_handler(value), "PLATFORM_RESOLVED_2_1_SERIES")
        self.assertEqual(effective_handler("2.1.19"), "2.1.19")
        for value in ("2.0", "3.0.1", "Latest"):
            with self.assertRaises(RuntimeError):
                effective_handler(value)

    def test_transport_and_probes_are_unchanged(self):
        for name in ("main", "transport", "vm"):
            self.assertEqual((HERE / "infra" / (name + ".bicep")).read_bytes(),
                             (PRIOR / "infra" / (name + ".bicep")).read_bytes())
        for name in ("g3a-bootstrap-proof-V1", "g3a-bootstrap-proof-V2"):
            self.assertEqual((HERE / name).read_bytes(), (PRIOR / name).read_bytes())
        self.assertFalse((HERE / "ephemeral-provisioning-key").exists())


if __name__ == "__main__":
    unittest.main()
