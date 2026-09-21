"""Canonical table-name / ORM-alignment tests.

The authoritative schema (frozen Drizzle lineage ``db/migrations/`` and the
active scoped bootstrap
``db/migrations-cache/0006_external_specialist_runtime_privilege_closure.sql``,
which carries FKs ``REFERENCES "documents"`` / ``REFERENCES "votes"``) names
these tables ``documents`` and ``votes``. The Django models must resolve to
those exact names so the ORM, the scoped bootstrap, and any snapshot-restored
environment all agree. These tests guard against reintroduction of the
anomalous ``ue_documents`` / ``ue_votes`` model drift.
"""

from django.test import TransactionTestCase


class CanonicalTableNameTests(TransactionTestCase):
    def test_documents_model_resolves_canonical_table(self):
        from content.models import Documents

        self.assertEqual(Documents._meta.db_table, "documents")
        # Query executes without 'relation does not exist'.
        self.assertEqual(Documents.objects.count(), 0)

    def test_votes_model_resolves_canonical_table(self):
        from unions.models import Votes

        self.assertEqual(Votes._meta.db_table, "votes")
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
