"""The committed R1 specification must equal what the real migrations define (it is generated, never hand-edited)."""
import json
import unittest

from core import emit_wanted_fields


class WantedFieldsAreCurrent(unittest.TestCase):
    def test_committed_json_matches_regeneration(self):
        committed = json.loads(emit_wanted_fields.OUTPUT.read_text(encoding="utf-8"))
        regenerated = json.loads(json.dumps(emit_wanted_fields.build()))
        self.assertEqual(
            committed,
            regenerated,
            "core/migration_wanted_fields.json is stale: run `python -m core.emit_wanted_fields --write` and commit it.",
        )

    def test_every_guarded_operation_is_covered(self):
        committed = json.loads(emit_wanted_fields.OUTPUT.read_text(encoding="utf-8"))
        self.assertEqual(len(committed["fields"]), 27)
        self.assertIn(("claims", "idempotency_hash"), {(f["table"], f["column"]) for f in committed["fields"]})


if __name__ == "__main__":
    unittest.main()