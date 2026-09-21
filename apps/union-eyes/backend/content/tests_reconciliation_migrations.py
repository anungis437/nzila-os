"""Reconciliation-migration compatibility and ORM-alignment tests.

Covers the deterministic, fail-closed conditional table rename shared by
``content.0004`` (documents -> ue_documents) and ``unions.0002`` (votes ->
ue_votes), plus ORM smoke checks proving the model db_table / db_column
bindings resolve against the reconciled schema.
"""

import importlib

from django.db import connection
from django.test import TransactionTestCase

# Module names begin with a digit, so they must be imported via importlib.
_content_mig = importlib.import_module("content.migrations.0004_alter_documents_table")
_unions_mig = importlib.import_module("unions.migrations.0002_alter_votes_table")

_OLD = "_reconcile_probe_old"
_NEW = "_reconcile_probe_new"


class ConditionalRenameFailClosedTests(TransactionTestCase):
    """Exercise all four schema states for the conditional rename."""

    def _drop(self, *names):
        with connection.cursor() as cur:
            for name in names:
                cur.execute(f'DROP TABLE IF EXISTS "{name}" CASCADE')

    def _create(self, name):
        with connection.cursor() as cur:
            cur.execute(f'CREATE TABLE "{name}" (id integer)')

    def _exists(self, name):
        with connection.cursor() as cur:
            cur.execute("SELECT to_regclass(%s) IS NOT NULL", [f"public.{name}"])
            return cur.fetchone()[0]

    def setUp(self):
        self._drop(_OLD, _NEW)

    def tearDown(self):
        self._drop(_OLD, _NEW)

    def test_old_present_new_absent_renames(self):
        # COMPATIBILITY_OLD_SCHEMA: pre-reconciliation table gets renamed.
        self._create(_OLD)
        with connection.schema_editor() as se:
            _content_mig._conditional_rename_table(se, _OLD, _NEW)
        self.assertFalse(self._exists(_OLD))
        self.assertTrue(self._exists(_NEW))

    def test_new_present_old_absent_is_noop(self):
        # COMPATIBILITY_ALREADY_ALIGNED_SCHEMA: already-renamed table untouched.
        self._create(_NEW)
        with connection.schema_editor() as se:
            _content_mig._conditional_rename_table(se, _OLD, _NEW)
        self.assertTrue(self._exists(_NEW))
        self.assertFalse(self._exists(_OLD))

    def test_both_present_fails_closed(self):
        # MIGRATION_AMBIGUITY_FAIL_CLOSED: never guess.
        self._create(_OLD)
        self._create(_NEW)
        with connection.schema_editor() as se:
            with self.assertRaises(RuntimeError):
                _content_mig._conditional_rename_table(se, _OLD, _NEW)

    def test_neither_present_fails_closed(self):
        # MIGRATION_AMBIGUITY_FAIL_CLOSED: unknown state.
        with connection.schema_editor() as se:
            with self.assertRaises(RuntimeError):
                _content_mig._conditional_rename_table(se, _OLD, _NEW)

    def test_unions_helper_shares_identical_semantics(self):
        # The unions rename uses the same fail-closed contract.
        self._create(_OLD)
        with connection.schema_editor() as se:
            _unions_mig._conditional_rename_table(se, _OLD, _NEW)
        self.assertFalse(self._exists(_OLD))
        self.assertTrue(self._exists(_NEW))


class OrmSchemaAlignmentTests(TransactionTestCase):
    """The reconciled schema must satisfy every model binding at runtime."""

    def test_documents_model_resolves_ue_documents(self):
        from content.models import Documents

        self.assertEqual(Documents._meta.db_table, "ue_documents")
        # Query executes without 'relation does not exist'.
        self.assertEqual(Documents.objects.count(), 0)

    def test_votes_model_resolves_ue_votes(self):
        from unions.models import Votes

        self.assertEqual(Votes._meta.db_table, "ue_votes")
        self.assertEqual(Votes.objects.count(), 0)

    def test_organizations_legacy_org_id_maps_to_physical_column(self):
        from auth_core.models import Organizations

        field = Organizations._meta.get_field("legacy_org_id")
        self.assertEqual(field.db_column, "legacy_tenant_id")
        # Filtering on the renamed field resolves to the preserved column.
        self.assertEqual(
            Organizations.objects.filter(legacy_org_id__isnull=True).count(),
            Organizations.objects.count(),
        )
