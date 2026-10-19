"""Tests for core.migration_ops.AddFieldIfNotExists.

Pure tests (no database): ``python -m unittest core.tests.test_migration_ops`` from apps/union-eyes/backend with
DJANGO_SETTINGS_MODULE set.

Database tests run against a real PostgreSQL and are skipped unless ``UE_MIGRATION_OPS_DB_TESTS=1`` (the release-sequence
rehearsal, group F, sets it with the loopback database). They create and drop a scratch table ``mo_probe`` only.
"""
import os
import unittest
from decimal import Decimal

from django.contrib.postgres.fields import ArrayField
from django.db import connection, migrations, models
from django.db.migrations.state import ModelState, ProjectState
from django.db.models import NOT_PROVIDED

from core import migration_ops as ops


def T(text):
    parsed = ops.parse_type(text)
    assert parsed is not None, text
    return parsed


class ParseType(unittest.TestCase):
    def test_known_types_normalise_postgres_and_django_spellings(self):
        self.assertEqual(T("character varying(64)"), T("varchar(64)"))
        self.assertEqual(T("timestamp with time zone"), T("timestamptz"))
        self.assertEqual(T("timestamp(3) with time zone"), T("timestamp with time zone"))
        self.assertEqual(T("integer"), T("int4"))
        self.assertEqual(T("numeric(10, 2)"), T("numeric(10,2)"))
        self.assertTrue(T("text[]").array)
        self.assertEqual(T("character varying(50)[]").length, 50)

    def test_unknown_types_are_unresolved_not_accepted(self):
        for unknown in ("citext", "hstore", "tsvector", "my_domain", "vector(3)", "geometry", "", None, "money"):
            self.assertIsNone(ops.parse_type(unknown), unknown)


class TypeCompatibility(unittest.TestCase):
    def ok(self, existing, wanted):
        self.assertIsNone(ops.type_problem(T(existing), T(wanted)), f"{existing} -> {wanted}")

    def bad(self, existing, wanted):
        self.assertIsNotNone(ops.type_problem(T(existing), T(wanted)), f"{existing} -> {wanted} should be incompatible")

    def test_equivalent_or_more_permissive_columns_are_accepted(self):
        for existing, wanted in [
            ("text", "text"), ("text", "character varying(50)"), ("character varying", "text"),
            ("character varying(255)", "character varying(50)"), ("character varying(50)", "character varying(50)"),
            ("bigint", "bigint"), ("bigint", "integer"), ("integer", "smallint"),
            ("boolean", "boolean"), ("uuid", "uuid"), ("jsonb", "jsonb"), ("date", "date"),
            ("timestamp with time zone", "timestamp with time zone"),
            ("numeric", "numeric(10,2)"), ("numeric(12,2)", "numeric(10,2)"), ("text[]", "text[]"),
            ("character varying(10)[]", "character varying(5)[]"),
        ]:
            self.ok(existing, wanted)

    def test_everything_else_is_rejected(self):
        for existing, wanted in [
            ("integer", "boolean"), ("boolean", "text"), ("text", "boolean"), ("text", "uuid"), ("uuid", "text"),
            ("json", "jsonb"), ("jsonb", "json"), ("jsonb", "text"),
            ("timestamp without time zone", "timestamp with time zone"),
            ("timestamp with time zone", "timestamp without time zone"),
            ("date", "timestamp with time zone"),
            ("integer", "bigint"), ("smallint", "integer"), ("numeric", "bigint"), ("bigint", "numeric"),
            ("character varying(10)", "character varying(50)"), ("character varying(10)", "text"),
            ("character(10)", "character varying(10)"), ("character varying(10)", "character(10)"),
            ("character(5)", "character(10)"),
            ("numeric(8,2)", "numeric(10,2)"), ("numeric(10,3)", "numeric(10,2)"), ("numeric(10,2)", "numeric"),
            ("text", "text[]"), ("text[]", "text"), ("integer[]", "text[]"), ("character varying(5)[]", "character varying(50)[]"),
        ]:
            self.bad(existing, wanted)


def wanted(**kw):
    base = dict(
        column="c", db_type="text", null=True, unique=False, db_default=NOT_PROVIDED, has_remote=False, db_check=None,
        python_default=NOT_PROVIDED,
    )
    base.update(kw)
    return ops.WantedField(**base)


def column(**kw):
    base = dict(fmt="text", not_null=False, default_expr=None, generated=False, identity=False, type_kind="b", enum_labels=())
    base.update(kw)
    return ops.ColumnFacts(**base)


def index(**kw):
    base = dict(key_columns=1, valid=True, ready=True, has_expression=False, predicate=None)
    base.update(kw)
    return ops.UniqueIndexFacts(**base)


def run_assess(w, c, indexes=(), nulls=False):
    problems, warnings, _actions = ops.assess(w, c, list(indexes), w.column, lambda: nulls)
    return problems, warnings


def run_actions(w, c, indexes=(), nulls=False):
    return ops.assess(w, c, list(indexes), w.column, lambda: nulls)[2]


class Assess(unittest.TestCase):
    def test_equivalent_column_has_no_problems(self):
        self.assertEqual(run_assess(wanted(), column()), ([], []))

    def test_unknown_existing_type_is_unresolved_and_rejected(self):
        problems, _ = run_assess(wanted(), column(fmt="citext"))
        self.assertTrue(any("unresolved existing type" in p for p in problems), problems)
        problems, _ = run_assess(wanted(), column(fmt="my_domain"))
        self.assertTrue(any("unresolved existing type" in p for p in problems), problems)

    def test_unknown_wanted_type_is_unresolved_and_rejected(self):
        problems, _ = run_assess(wanted(db_type="hstore"), column())
        self.assertTrue(any("unresolved wanted type" in p for p in problems), problems)
        problems, _ = run_assess(wanted(db_type=None), column())
        self.assertTrue(any("unresolved wanted type" in p for p in problems), problems)

    def test_type_attribute_mismatches_are_rejected(self):
        problems, _ = run_assess(wanted(db_type="timestamp with time zone"), column(fmt="timestamp without time zone"))
        self.assertTrue(any("incompatible type" in p for p in problems), problems)
        problems, _ = run_assess(wanted(db_type="character(10)"), column(fmt="character varying(10)"))
        self.assertTrue(any("incompatible type" in p for p in problems), problems)
        problems, _ = run_assess(wanted(db_type="integer"), column(fmt="smallint"))
        self.assertTrue(any("narrower" in p for p in problems), problems)

    def test_only_lossless_varchar_widening_is_planned(self):
        self.assertEqual(run_assess(wanted(db_type="text"), column(fmt="character varying(50)"))[0], [])
        self.assertEqual(run_actions(wanted(db_type="text"), column(fmt="character varying(50)")), ["widen:text"])
        self.assertEqual(run_actions(wanted(db_type="varchar(64)"), column(fmt="character varying(32)")), ["widen:varchar(64)"])
        self.assertEqual(run_actions(wanted(db_type="text"), column(fmt="text")), [])
        for existing, wanted_type in [("character(5)", "text"), ("integer", "bigint"), ("numeric(8,2)", "numeric(10,2)"), ("character varying(5)[]", "text[]")]:
            problems, _ = run_assess(wanted(db_type=wanted_type), column(fmt=existing))
            self.assertTrue(problems, f"{existing} -> {wanted_type} must be rejected, never widened")
            self.assertEqual(run_actions(wanted(db_type=wanted_type), column(fmt=existing)), [])

    def test_enum_columns(self):
        labels = ("team_confidential", "public", "restricted")
        enum_col = column(fmt="document_privacy_label", type_kind="e", enum_labels=labels, not_null=True)
        field = wanted(db_type="varchar(32)", null=False, python_default="team_confidential")
        problems, warnings = run_assess(field, enum_col)
        self.assertEqual(problems, [])
        self.assertTrue(any("enum" in w for w in warnings), warnings)
        # default is not a label
        problems, _ = run_assess(wanted(db_type="varchar(32)", null=False, python_default="standard"), enum_col)
        self.assertTrue(any("not a label" in p for p in problems), problems)
        # a label longer than max_length
        problems, _ = run_assess(wanted(db_type="varchar(8)", null=False, python_default="public"), enum_col)
        self.assertTrue(any("longer than" in p for p in problems), problems)
        # a callable default cannot be checked
        problems, _ = run_assess(wanted(db_type="varchar(32)", null=False, python_default=lambda: "public"), enum_col)
        self.assertTrue(any("callable" in p for p in problems), problems)
        # enum for a non-text field
        problems, _ = run_assess(wanted(db_type="integer", null=False), enum_col)
        self.assertTrue(any("not a varchar/text field" in p for p in problems), problems)
        # no labels at all
        problems, _ = run_assess(field, column(fmt="empty_enum", type_kind="e", enum_labels=()))
        self.assertTrue(any("no labels" in p for p in problems), problems)
        # domains / composites / range types stay unresolved
        for kind in ("d", "c", "r"):
            problems, _ = run_assess(wanted(), column(fmt="some_type", type_kind=kind))
            self.assertTrue(any("unresolved existing type" in p for p in problems), (kind, problems))

    def test_nullability(self):
        # nullable field, NOT NULL column: Django writes NULL explicitly -> reject
        problems, _ = run_assess(wanted(null=True), column(not_null=True))
        self.assertTrue(any("NOT NULL" in p for p in problems), problems)
        # NOT NULL field, nullable column holding NULLs -> reject
        problems, _ = run_assess(wanted(null=False), column(not_null=False), nulls=True)
        self.assertTrue(any("holds NULL" in p for p in problems), problems)
        # NOT NULL field, nullable column without NULLs -> accepted with a warning
        problems, warnings = run_assess(wanted(null=False), column(not_null=False), nulls=False)
        self.assertEqual(problems, [])
        self.assertTrue(any("nullable" in w for w in warnings), warnings)

    def test_db_default_requires_an_equal_literal_default(self):
        w = wanted(db_type="character varying(50)", null=False, db_default="pending")
        c = column(fmt="character varying(50)", not_null=True)
        problems, _ = run_assess(w, c)
        self.assertTrue(any("no database default" in p for p in problems), problems)
        self.assertEqual(run_assess(w, column(fmt="character varying(50)", not_null=True, default_expr="'pending'::character varying"))[0], [])
        problems, _ = run_assess(w, column(fmt="character varying(50)", not_null=True, default_expr="'active'::character varying"))
        self.assertTrue(any("differs" in p for p in problems), problems)
        problems, _ = run_assess(wanted(db_default=models.functions.Now()), column(default_expr="now()"))
        self.assertTrue(any("database expression" in p for p in problems), problems)
        self.assertEqual(run_assess(wanted(db_type="boolean", null=False, db_default=False), column(fmt="boolean", not_null=True, default_expr="false"))[0], [])
        self.assertEqual(run_assess(wanted(db_type="numeric(5,2)", null=False, db_default=Decimal("1.50")), column(fmt="numeric(5,2)", not_null=True, default_expr="1.50"))[0], [])

    def test_generated_and_identity_columns_are_rejected(self):
        self.assertTrue(any("generated" in p for p in run_assess(wanted(), column(generated=True))[0]))
        self.assertTrue(any("identity" in p for p in run_assess(wanted(), column(identity=True))[0]))

    def test_unique_requires_an_equivalent_index(self):
        w = wanted(unique=True)
        self.assertTrue(any("unique index" in p for p in run_assess(w, column())[0]))
        self.assertEqual(run_assess(w, column(), [index()])[0], [])
        self.assertEqual(run_assess(w, column(), [index(predicate="(c IS NOT NULL)")])[0], [])
        self.assertEqual(run_assess(w, column(), [index(predicate='("c" IS NOT NULL)')])[0], [])
        for bad in (
            index(predicate="(c <> 'x'::text)"),         # partial on something else: other rows are not unique
            index(predicate="(deleted_at IS NULL)"),
            index(predicate="(c IS NOT NULL AND status = 'active')"),
            index(key_columns=2),                         # composite: not single-column uniqueness
            index(valid=False),
            index(ready=False),
            index(has_expression=True),
        ):
            self.assertTrue(any("unique index" in p for p in run_assess(w, column(), [bad])[0]), bad)

    def test_foreign_keys_and_check_constraints_are_unresolved(self):
        self.assertTrue(any("foreign-key" in p for p in run_assess(wanted(has_remote=True), column())[0]))
        self.assertTrue(any("CHECK" in p for p in run_assess(wanted(db_check='"c" >= 0'), column())[0]))

    def test_every_problem_is_reported_together(self):
        problems, _ = run_assess(wanted(db_type="boolean", null=False, unique=True), column(fmt="integer", not_null=False), nulls=True)
        self.assertGreaterEqual(len(problems), 3, problems)


@unittest.skipUnless(os.environ.get("UE_MIGRATION_OPS_DB_TESTS") == "1", "database tests need UE_MIGRATION_OPS_DB_TESTS=1")
class DatabaseBehavior(unittest.TestCase):
    """Real catalog behaviour on PostgreSQL: the exact decision AddFieldIfNotExists makes during ``migrate``."""

    TABLE = "mo_probe"

    @classmethod
    def setUpClass(cls):
        import django

        django.setup()

    def setUp(self):
        self._drop()

    def tearDown(self):
        self._drop()

    def _drop(self):
        with connection.cursor() as cursor:
            cursor.execute(f"DROP TABLE IF EXISTS {self.TABLE}")

    def _sql(self, sql):
        with connection.cursor() as cursor:
            cursor.execute(sql)

    def _apply(self, field, name="c"):
        state = ProjectState()
        state.add_model(ModelState("mo", "Probe", [("id", models.AutoField(primary_key=True))], options={"db_table": self.TABLE}))
        to_state = state.clone()
        op = ops.AddFieldIfNotExists("Probe", name, field)
        op.state_forwards("mo", to_state)
        with connection.schema_editor() as editor:
            op.database_forwards("mo", editor, state, to_state)

    def _columns(self):
        with connection.cursor() as cursor:
            cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name=%s", [self.TABLE])
            return {r[0] for r in cursor.fetchall()}

    def _base(self, column_def):
        self._sql(f"CREATE TABLE {self.TABLE} (id serial PRIMARY KEY, {column_def})")

    def test_absent_column_is_added(self):
        self._sql(f"CREATE TABLE {self.TABLE} (id serial PRIMARY KEY)")
        self._apply(models.BooleanField(default=False))
        self.assertIn("c", self._columns())

    def test_equivalent_existing_column_is_left_alone(self):
        self._base("c boolean NOT NULL DEFAULT false")
        self._apply(models.BooleanField(default=False))

    def test_array_and_jsonb_and_varchar_equivalents(self):
        self._base("c text[]")
        self._apply(ArrayField(models.TextField(), blank=True, null=True, size=None))
        self._drop(); self._base("c jsonb")
        self._apply(models.JSONField(blank=True, default=dict, null=True))
        self._drop(); self._base("c varchar(100) NOT NULL")
        self._apply(models.CharField(default="x", max_length=50))
        self.assertEqual(self._column_type(), "character varying(100)")  # wider than needed: left alone

    def test_incompatible_existing_definitions_fail_closed_and_change_nothing(self):
        self._sql("DROP DOMAIN IF EXISTS mo_dom CASCADE")
        self._sql("CREATE DOMAIN mo_dom AS text")
        self.addCleanup(self._sql, "DROP DOMAIN IF EXISTS mo_dom CASCADE")
        cases = {
            "integer type for boolean": ("c integer NOT NULL", models.BooleanField(default=False)),
            "timestamp without tz": ("c timestamp without time zone", models.DateTimeField(blank=True, null=True)),
            "json for jsonb": ("c json", models.JSONField(blank=True, null=True)),
            "char(n) for text": ("c char(8)", models.TextField(blank=True, null=True)),
            "text array vs text": ("c text", ArrayField(models.TextField(), blank=True, null=True, size=None)),
            "unknown domain type": ("c mo_dom", models.TextField(blank=True, null=True)),
            "NOT NULL for a nullable field": ("c text NOT NULL", models.TextField(blank=True, null=True)),
            "generated column": ("c text GENERATED ALWAYS AS ('x') STORED", models.TextField(blank=True, null=True)),
            "missing db_default": ("c varchar(50) NOT NULL", models.CharField(db_default="pending", default="pending", max_length=50)),
            "different db_default": ("c varchar(50) NOT NULL DEFAULT 'active'", models.CharField(db_default="pending", default="pending", max_length=50)),
        }
        for label, (column_def, field) in cases.items():
            with self.subTest(label):
                self._drop(); self._base(column_def)
                with self.assertRaisesRegex(RuntimeError, "not provably equivalent"):
                    self._apply(field)

    def _column_type(self):
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT format_type(a.atttypid, a.atttypmod) FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid "
                "WHERE c.relname = %s AND a.attname = 'c'", [self.TABLE],
            )
            return cursor.fetchone()[0]

    def test_bounded_varchar_under_a_text_field_is_widened_losslessly(self):
        self._base("c varchar(50) DEFAULT 'other'")
        self._sql(f"INSERT INTO {self.TABLE} (c) VALUES ('keep-me')")
        self._apply(models.TextField(blank=True, null=True))
        self.assertEqual(self._column_type(), "text")
        with connection.cursor() as cursor:
            cursor.execute(f"SELECT c FROM {self.TABLE}")
            self.assertEqual(cursor.fetchall(), [("keep-me",)])

    def test_varchar_is_lengthened_but_never_shortened_or_retyped(self):
        self._base("c varchar(20)")
        self._apply(models.CharField(blank=True, max_length=64, null=True))
        self.assertEqual(self._column_type(), "character varying(64)")
        self._drop(); self._base("c char(8)")
        with self.assertRaisesRegex(RuntimeError, "not provably equivalent"):
            self._apply(models.TextField(blank=True, null=True))
        self.assertEqual(self._column_type(), "character(8)")  # untouched on failure

    def test_enum_column_is_accepted_only_when_labels_and_default_fit(self):
        self._sql("DROP TYPE IF EXISTS mo_label CASCADE")
        self._sql("CREATE TYPE mo_label AS ENUM ('team_confidential', 'public')")
        self.addCleanup(self._sql, "DROP TYPE IF EXISTS mo_label CASCADE")
        self._base("c mo_label NOT NULL DEFAULT 'team_confidential'")
        self._apply(models.CharField(default="team_confidential", max_length=32))
        self.assertEqual(self._column_type(), "mo_label")  # never retyped
        for label, field in {
            "default outside the labels": models.CharField(default="standard", max_length=32),
            "label longer than max_length": models.CharField(default="public", max_length=8),
            "not a text field": models.IntegerField(default=0),
        }.items():
            with self.subTest(label):
                with self.assertRaisesRegex(RuntimeError, "not provably equivalent"):
                    self._apply(field)

    def test_nullable_column_with_nulls_for_not_null_field_fails_closed(self):
        self._base("c boolean")
        self._sql(f"INSERT INTO {self.TABLE} (c) VALUES (NULL)")
        with self.assertRaisesRegex(RuntimeError, "holds NULL"):
            self._apply(models.BooleanField(default=False))
        self._sql(f"UPDATE {self.TABLE} SET c = false")
        self._apply(models.BooleanField(default=False))  # no NULLs left: accepted with a warning

    def test_unique_requires_an_equivalent_index(self):
        field = lambda: models.CharField(blank=True, max_length=64, null=True, unique=True)  # noqa: E731
        scenarios = {
            "no index": ("c varchar(64)", None, False),
            "plain unique": ("c varchar(64)", f"CREATE UNIQUE INDEX mo_u ON {self.TABLE} (c)", True),
            "partial not null": ("c varchar(64)", f"CREATE UNIQUE INDEX mo_u ON {self.TABLE} (c) WHERE c IS NOT NULL", True),
            "partial other predicate": ("c varchar(64)", f"CREATE UNIQUE INDEX mo_u ON {self.TABLE} (c) WHERE c <> 'x'", False),
            "partial on another column": ("c varchar(64), s text", f"CREATE UNIQUE INDEX mo_u ON {self.TABLE} (c) WHERE s IS NULL", False),
            "composite": ("c varchar(64), s text", f"CREATE UNIQUE INDEX mo_u ON {self.TABLE} (c, s)", False),
            "expression": ("c varchar(64)", f"CREATE UNIQUE INDEX mo_u ON {self.TABLE} (lower(c))", False),
            "non-unique index": ("c varchar(64)", f"CREATE INDEX mo_u ON {self.TABLE} (c)", False),
        }
        for label, (column_def, index_sql, accepted) in scenarios.items():
            with self.subTest(label):
                self._drop(); self._base(column_def)
                if index_sql:
                    self._sql(index_sql)
                if accepted:
                    self._apply(field())
                else:
                    with self.assertRaisesRegex(RuntimeError, "unique index"):
                        self._apply(field())

    def test_backwards_never_drops_a_column(self):
        self._base("c boolean NOT NULL")
        op = ops.AddFieldIfNotExists("Probe", "c", models.BooleanField(default=False))
        with connection.schema_editor() as editor:
            op.database_backwards("mo", editor, ProjectState(), ProjectState())
        self.assertIn("c", self._columns())


if __name__ == "__main__":
    unittest.main()