"""Unit tests for core.migration_ops.AddFieldIfNotExists (no database required).

Run: ``python -m unittest core.tests.test_migration_ops`` from apps/union-eyes/backend with DJANGO_SETTINGS_MODULE set.
The database behavior is exercised end to end by the release-sequence rehearsal (group F).
"""
import unittest
from unittest import mock

from django.db import models

from core import migration_ops as ops


class FamilyMapping(unittest.TestCase):
    def test_text_family_covers_varchar_and_text(self):
        for pg in ("character varying", "text", "character"):
            self.assertEqual(ops.pg_family(pg), "text")
        for dj in ("varchar(64)", "text", "char(2)"):
            self.assertEqual(ops.django_family(dj), "text")

    def test_numeric_and_json_and_time_families(self):
        self.assertEqual(ops.django_family("bigint"), "int")
        self.assertEqual(ops.pg_family("integer"), "int")
        self.assertEqual(ops.django_family("jsonb"), "json")
        self.assertEqual(ops.django_family("timestamp with time zone"), "timestamp")
        self.assertEqual(ops.pg_family("timestamp without time zone"), "timestamp")
        self.assertEqual(ops.django_family("uuid"), "uuid")
        self.assertEqual(ops.django_family("text[]"), "array")

    def test_compatibility_rules(self):
        self.assertTrue(ops.families_compatible("text", "text"))
        self.assertTrue(ops.families_compatible("int", "numeric"))
        self.assertFalse(ops.families_compatible("int", "text"))
        self.assertFalse(ops.families_compatible("bool", "text"))
        self.assertFalse(ops.families_compatible("json", "text"))
        self.assertTrue(ops.families_compatible(None, "text"), "unknown families must not block")
        self.assertTrue(ops.families_compatible("text", None))


def _op(field):
    op = ops.AddFieldIfNotExists("documents", "contains_pii", field)
    model = mock.Mock()
    model._meta.db_table = "documents"
    model._meta.get_field.return_value = field
    to_state = mock.Mock()
    to_state.apps.get_model.return_value = model
    editor = mock.Mock()
    editor.connection.alias = "default"
    editor.connection.cursor = mock.MagicMock()
    return op, editor, to_state


class DatabaseForwards(unittest.TestCase):
    def _field(self, f):
        f.set_attributes_from_name("contains_pii")
        return f

    def test_adds_when_column_absent(self):
        op, editor, to_state = _op(self._field(models.BooleanField(default=False)))
        with mock.patch.object(ops, "_existing_column", return_value=None), \
             mock.patch.object(ops.migrations.AddField, "database_forwards") as parent, \
             mock.patch.object(op, "allow_migrate_model", return_value=True):
            op.database_forwards("content", editor, mock.Mock(), to_state)
        parent.assert_called_once()

    def test_skips_when_compatible_column_present(self):
        op, editor, to_state = _op(self._field(models.BooleanField(default=False)))
        with mock.patch.object(ops, "_existing_column", return_value=("boolean", "NO")), \
             mock.patch.object(ops.migrations.AddField, "database_forwards") as parent, \
             mock.patch.object(op, "allow_migrate_model", return_value=True), \
             mock.patch.object(models.BooleanField, "db_type", return_value="boolean"):
            op.database_forwards("content", editor, mock.Mock(), to_state)
        parent.assert_not_called()

    def test_fails_closed_on_incompatible_type(self):
        op, editor, to_state = _op(self._field(models.BooleanField(default=False)))
        with mock.patch.object(ops, "_existing_column", return_value=("integer", "NO")), \
             mock.patch.object(op, "allow_migrate_model", return_value=True), \
             mock.patch.object(models.BooleanField, "db_type", return_value="boolean"):
            with self.assertRaisesRegex(RuntimeError, "Refusing to continue"):
                op.database_forwards("content", editor, mock.Mock(), to_state)

    def test_fails_closed_when_unique_index_missing(self):
        field = self._field(models.CharField(max_length=64, null=True, unique=True))
        op, editor, to_state = _op(field)
        with mock.patch.object(ops, "_existing_column", return_value=("character varying", "YES")), \
             mock.patch.object(ops, "_has_single_column_unique_index", return_value=False), \
             mock.patch.object(op, "allow_migrate_model", return_value=True), \
             mock.patch.object(models.CharField, "db_type", return_value="varchar(64)"):
            with self.assertRaisesRegex(RuntimeError, "unique index"):
                op.database_forwards("content", editor, mock.Mock(), to_state)

    def test_unique_with_existing_index_is_skipped(self):
        field = self._field(models.CharField(max_length=64, null=True, unique=True))
        op, editor, to_state = _op(field)
        with mock.patch.object(ops, "_existing_column", return_value=("character varying", "YES")), \
             mock.patch.object(ops, "_has_single_column_unique_index", return_value=True), \
             mock.patch.object(ops.migrations.AddField, "database_forwards") as parent, \
             mock.patch.object(op, "allow_migrate_model", return_value=True), \
             mock.patch.object(models.CharField, "db_type", return_value="varchar(64)"):
            op.database_forwards("content", editor, mock.Mock(), to_state)
        parent.assert_not_called()

    def test_backwards_never_drops_a_column(self):
        op, editor, to_state = _op(self._field(models.BooleanField(default=False)))
        with mock.patch.object(ops.migrations.AddField, "database_backwards") as parent:
            op.database_backwards("content", editor, mock.Mock(), to_state)
        parent.assert_not_called()
        editor.remove_field.assert_not_called()


if __name__ == "__main__":
    unittest.main()