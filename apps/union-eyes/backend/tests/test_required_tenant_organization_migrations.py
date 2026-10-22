"""Guarded migration tests; optional actual local PostgreSQL, never an Azure server."""
import importlib.util
import os
from pathlib import Path
from types import SimpleNamespace
import unittest
from urllib.parse import urlsplit
import uuid

ROOT = Path(__file__).resolve().parents[1]


def load_migration(app, name):
    spec = importlib.util.spec_from_file_location(app + "_tenant_prerequisite", ROOT / app / "migrations" / (name + ".py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


MIGRATIONS = [
    load_migration("unions", "0002_required_tenant_organization"),
    load_migration("billing", "0004_cost_centers_required_tenant_organization"),
]
TABLES = tuple(table for migration in MIGRATIONS for table in migration.TABLES)
URL = os.environ.get("UE_TENANT_PREREQUISITE_TEST_URL")


class RequiredTenantMigrationStateTests(unittest.TestCase):
    def test_forward_state_requires_tenant_and_no_reverse_weakening(self):
        for module in MIGRATIONS:
            self.assertTrue(module.Migration.atomic)
            operation = module.Migration.operations[0]
            self.assertEqual(len(operation.state_operations), len(module.TABLES))
            for state in operation.state_operations:
                self.assertEqual(state.name, "organization_id")
                self.assertFalse(state.field.null)
                self.assertFalse(state.field.blank)
                self.assertFalse(state.field.has_default())
            self.assertFalse(operation.database_operations[0].reversible)

    def test_no_nonatomic_or_nonpostgres_execution(self):
        for module in MIGRATIONS:
            for vendor, atomic in [("sqlite", True), ("postgresql", False)]:
                editor = SimpleNamespace(connection=SimpleNamespace(vendor=vendor, in_atomic_block=atomic))
                with self.assertRaisesRegex(RuntimeError, "atomic PostgreSQL"):
                    module.enforce_required_organization(None, editor)


@unittest.skipUnless(URL, "set UE_TENANT_PREREQUISITE_TEST_URL to an isolated local PostgreSQL database")
class RequiredTenantPostgresTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        parsed = urlsplit(URL)
        if parsed.hostname not in ("127.0.0.1", "localhost") or parsed.path != "/ue_tenant_prerequisite_disposable" or parsed.query:
            raise RuntimeError("Tests require the exact disposable database on localhost without query routing")
        import psycopg
        cls.connection = psycopg.connect(URL, autocommit=True)
        with cls.connection.cursor() as cursor:
            cursor.execute("SELECT current_database()")
            if cursor.fetchone()[0] != "ue_tenant_prerequisite_disposable":
                raise RuntimeError("Wrong disposable database identity")

    @classmethod
    def tearDownClass(cls):
        cls.connection.close()

    def setUp(self):
        with self.connection.cursor() as cursor:
            for table in TABLES:
                cursor.execute('DROP TABLE IF EXISTS public."' + table + '"')
            cursor.execute("DROP TABLE IF EXISTS public.organizations")
            cursor.execute("CREATE TABLE public.organizations (id uuid PRIMARY KEY)")
            for table in TABLES:
                cursor.execute('CREATE TABLE public."' + table + '" (id uuid PRIMARY KEY, organization_id uuid, payload text)')
            self.tenant = uuid.uuid4()
            cursor.execute("INSERT INTO public.organizations VALUES (%s)", [self.tenant])

    def editor(self):
        adapter = SimpleNamespace(vendor="postgresql", in_atomic_block=True, cursor=self.connection.cursor)
        return SimpleNamespace(connection=adapter, quote_name=lambda value: '"' + value.replace('"', '""') + '"')

    def nullable(self, table):
        with self.connection.cursor() as cursor:
            cursor.execute("SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name=%s AND column_name='organization_id'", [table])
            return cursor.fetchone()[0]

    def run_migration(self, module):
        with self.connection.transaction():
            module.enforce_required_organization(None, self.editor())

    def test_empty_tables_pass_without_inventing_tenant_rows(self):
        for module in MIGRATIONS:
            self.run_migration(module)
        for table in TABLES:
            self.assertEqual(self.nullable(table), "NO")
            with self.connection.cursor() as cursor:
                cursor.execute('SELECT count(*) FROM public."' + table + '"')
                self.assertEqual(cursor.fetchone()[0], 0)

    def test_valid_rows_preserve_every_value(self):
        before = {}
        with self.connection.cursor() as cursor:
            for table in TABLES:
                values = (uuid.uuid4(), self.tenant, "synthetic preservation fixture " + table)
                cursor.execute('INSERT INTO public."' + table + '" VALUES (%s,%s,%s)', values)
                before[table] = values
        for module in MIGRATIONS:
            self.run_migration(module)
        for table in TABLES:
            self.assertEqual(self.nullable(table), "NO")
            with self.connection.cursor() as cursor:
                cursor.execute('SELECT id, organization_id, payload FROM public."' + table + '"')
                self.assertEqual(cursor.fetchall(), [before[table]])

    def test_null_or_orphan_refused_without_row_or_constraint_change(self):
        for module in MIGRATIONS:
            for tenant in (None, uuid.uuid4()):
                with self.subTest(app=module.__name__, tenant="null" if tenant is None else "orphan"):
                    table = module.TABLES[-1]
                    values = (uuid.uuid4(), tenant, "synthetic rejected fixture")
                    with self.connection.cursor() as cursor:
                        cursor.execute('INSERT INTO public."' + table + '" VALUES (%s,%s,%s)', values)
                    with self.assertRaisesRegex(RuntimeError, "NULL/orphan"):
                        self.run_migration(module)
                    for name in module.TABLES:
                        self.assertEqual(self.nullable(name), "YES")
                    with self.connection.cursor() as cursor:
                        cursor.execute('SELECT id, organization_id, payload FROM public."' + table + '"')
                        self.assertEqual(cursor.fetchall(), [values])
                        cursor.execute('DELETE FROM public."' + table + '"')

    def test_missing_relation_is_refused_before_any_constraint_change(self):
        for module in MIGRATIONS:
            with self.subTest(app=module.__name__):
                missing = module.TABLES[-1]
                with self.connection.cursor() as cursor:
                    cursor.execute('DROP TABLE public."' + missing + '"')
                with self.assertRaisesRegex(RuntimeError, "missing table"):
                    self.run_migration(module)
                for table in module.TABLES[:-1]:
                    self.assertEqual(self.nullable(table), "YES")
                with self.connection.cursor() as cursor:
                    cursor.execute('CREATE TABLE public."' + missing + '" (id uuid PRIMARY KEY, organization_id uuid, payload text)')


if __name__ == "__main__":
    unittest.main()
