"""Optional metadata is tri-state; required privacy controls stay mandatory."""
from contextlib import closing
import importlib
import ast
from pathlib import Path
import unittest
import os
from types import SimpleNamespace
from urllib.parse import urlsplit
from django.db.models import NOT_PROVIDED
from core.migration_ops import assess, ColumnFacts, WantedField

prior = importlib.import_module('content.migrations.0004_documents_access_level_documents_blob_container_and_more')
forward = importlib.import_module('content.migrations.0005_optional_document_sensitivity_flags')


class OptionalDocumentFlagTests(unittest.TestCase):
    def test_only_three_optional_flags_are_nullable_in_creation_state(self):
        fields = {op.name: op.field for op in prior.Migration.operations if hasattr(op, 'name')}
        for name in forward.FLAGS:
            self.assertTrue(fields[name].null)
            self.assertTrue(fields[name].blank)
            self.assertFalse(fields[name].default)
        for name in ('contains_pii', 'contains_medical_sensitive', 'contains_legal_privilege', 'privacy_label', 'status'):
            self.assertFalse(fields[name].null)
        # Compare the model declaration without bootstrapping any database or
        # importing the app's operational startup graph.
        tree = ast.parse((Path(__file__).parents[1] / 'content' / 'models.py').read_text())
        model = next(node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == 'Documents')
        declarations = {node.targets[0].id: node.value for node in model.body
                        if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name)
                        and isinstance(node.value, ast.Call)}
        for name in (*forward.FLAGS, 'contains_pii', 'contains_medical_sensitive', 'contains_legal_privilege', 'privacy_label', 'status'):
            keywords = {kw.arg: ast.literal_eval(kw.value) for kw in declarations[name].keywords}
            self.assertEqual(keywords.get('null', False), name in forward.FLAGS)

    def test_strict_equivalence_accepts_optional_nulls_but_rejects_required_nulls_and_wrong_types(self):
        facts = ColumnFacts(fmt='boolean', not_null=False, default_expr=None, generated=False, identity=False, type_kind='b', enum_labels=())
        def check(nullable, column=facts):
            wanted = WantedField(column='member_pii', db_type='boolean', null=nullable, unique=False,
                                 db_default=NOT_PROVIDED, has_remote=False, db_check=None, python_default=False)
            return assess(wanted, column, [], 'member_pii', lambda: True)[0]
        self.assertEqual(check(True), [])
        self.assertTrue(check(False))
        self.assertTrue(check(True, ColumnFacts(fmt='text', not_null=False, default_expr=None,
                                              generated=False, identity=False, type_kind='b', enum_labels=())))

    def test_forward_state_is_atomic_and_does_not_reverse_to_not_null(self):
        self.assertTrue(forward.Migration.atomic)
        operation = forward.Migration.operations[0]
        self.assertFalse(operation.database_operations[0].reversible)
        self.assertEqual({op.name for op in operation.state_operations}, set(forward.FLAGS))
        self.assertTrue(all(op.field.null for op in operation.state_operations))

    def test_nonpostgres_or_nonatomic_execution_refused(self):
        for vendor, atomic in [('sqlite', True), ('postgresql', False)]:
            editor = SimpleNamespace(connection=SimpleNamespace(vendor=vendor, in_atomic_block=atomic))
            with self.assertRaisesRegex(RuntimeError, 'atomic PostgreSQL'):
                forward.preserve_optional_flags(None, editor)


@unittest.skipUnless(os.environ.get('UE_DOCUMENT_FLAGS_TEST_URL'), 'isolated local PostgreSQL URL required')
class OptionalDocumentFlagPostgresTests(unittest.TestCase):
    def test_nullable_and_previously_not_null_rows_preserve_all_values(self):
        import psycopg2 as psycopg
        url = os.environ['UE_DOCUMENT_FLAGS_TEST_URL']
        parsed = urlsplit(url)
        self.assertIn(parsed.hostname, ('localhost', '127.0.0.1'))
        self.assertEqual(parsed.path, '/ue_document_flags_disposable')
        self.assertFalse(parsed.query)
        with closing(psycopg.connect(url)) as connection:
            with connection.cursor() as cursor:
                cursor.execute('DROP TABLE IF EXISTS public.documents')
                cursor.execute('CREATE TABLE documents (id integer PRIMARY KEY, disciplinary_sensitive boolean, '
                               'medical_sensitive boolean, member_pii boolean, privacy_label text NOT NULL)')
                cursor.execute("INSERT INTO documents VALUES (1,NULL,NULL,NULL,'privileged'),"
                               "(2,true,false,true,'highly_sensitive'),(3,false,true,false,'team_confidential')")
                cursor.execute('SELECT * FROM documents ORDER BY id')
                before = cursor.fetchall()
            editor = SimpleNamespace(connection=SimpleNamespace(vendor='postgresql', in_atomic_block=True,
                                                                 cursor=connection.cursor),
                                     quote_name=lambda name: '"' + name + '"')
            with connection:
                forward.preserve_optional_flags(None, editor)
            with connection.cursor() as cursor:
                cursor.execute('SELECT * FROM documents ORDER BY id')
                self.assertEqual(cursor.fetchall(), before)
                cursor.execute('DELETE FROM documents WHERE id=1')
                for flag in forward.FLAGS:
                    cursor.execute('ALTER TABLE documents ALTER COLUMN "' + flag + '" SET NOT NULL')
                cursor.execute('SELECT * FROM documents ORDER BY id')
                strict_before = cursor.fetchall()
            with connection:
                forward.preserve_optional_flags(None, editor)
            with connection.cursor() as cursor:
                cursor.execute('SELECT * FROM documents ORDER BY id')
                self.assertEqual(cursor.fetchall(), strict_before)
                cursor.execute("SELECT count(*) FROM information_schema.columns WHERE table_name='documents' "
                               "AND column_name IN ('disciplinary_sensitive','medical_sensitive','member_pii') "
                               "AND is_nullable='YES'")
                self.assertEqual(cursor.fetchone()[0], 3)
                cursor.execute('ALTER TABLE documents ALTER COLUMN member_pii TYPE text USING member_pii::text')
                cursor.execute('SELECT * FROM documents ORDER BY id')
                wrong_type_before = cursor.fetchall()
            connection.commit()
            with self.assertRaisesRegex(RuntimeError, 'requires boolean column'):
                with connection:
                    forward.preserve_optional_flags(None, editor)
            with connection.cursor() as cursor:
                cursor.execute('SELECT * FROM documents ORDER BY id')
                self.assertEqual(cursor.fetchall(), wrong_type_before)
                cursor.execute('ALTER TABLE documents ALTER COLUMN member_pii TYPE boolean USING member_pii::boolean')
                cursor.execute("DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='ue_document_flags_reader') "
                               "THEN CREATE ROLE ue_document_flags_reader NOLOGIN; END IF; END $$")
                cursor.execute('GRANT USAGE ON SCHEMA public TO ue_document_flags_reader')
                cursor.execute('GRANT ALL ON documents TO ue_document_flags_reader')
                cursor.execute('ALTER TABLE documents ENABLE ROW LEVEL SECURITY')
                cursor.execute('ALTER TABLE documents FORCE ROW LEVEL SECURITY')
                cursor.execute('CREATE POLICY deny_document_rows ON documents USING (false)')
            connection.commit()
            with self.assertRaisesRegex(psycopg.Error, 'row-level security'):
                with connection:
                    with connection.cursor() as cursor:
                        cursor.execute('SET LOCAL ROLE ue_document_flags_reader')
                    forward.preserve_optional_flags(None, editor)
            with connection.cursor() as cursor:
                cursor.execute('SELECT * FROM documents ORDER BY id')
                self.assertEqual(cursor.fetchall(), strict_before)
