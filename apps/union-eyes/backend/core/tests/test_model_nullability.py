"""
The register of columns a model may store NULL in (core/model_nullability.json) is what the platform tooling reads to decide where a column can be
NOT NULL. A model edit that is not followed by `manage.py ue_model_nullability --write` leaves the register describing a model that no longer exists.
"""
import json

from django.test import SimpleTestCase

from core.management.commands.ue_model_nullability import REGISTER, nullable_columns, render


class ModelNullabilityRegisterIsCurrent(SimpleTestCase):
    def test_the_committed_register_equals_what_the_models_say(self):
        committed = REGISTER.read_text(encoding="utf-8").replace("\r\n", "\n")
        self.assertEqual(
            committed,
            render(nullable_columns()),
            "core/model_nullability.json is stale: run `python manage.py ue_model_nullability --write` and commit it",
        )

    def test_the_register_lists_only_columns_a_model_can_leave_null(self):
        tables = json.loads(REGISTER.read_text(encoding="utf-8"))["tables"]
        self.assertTrue(tables, "an empty register would let the platform constrain every column")
        for table, columns in tables.items():
            self.assertEqual(columns, sorted(set(columns)), f"{table}: columns are not sorted and unique")
