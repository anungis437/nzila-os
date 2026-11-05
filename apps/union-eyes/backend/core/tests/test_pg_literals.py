"""The literal parsers behind the parity measurement and the model generator: what PostgreSQL prints for a default or a CHECK."""
import functools
from decimal import Decimal

from django.db import models
from django.db.models import NOT_PROVIDED
from django.test import SimpleTestCase

from core.management.commands.ue_physical_parity import COMPUTED, defaults_agree, model_default
from core.pg_literals import check_list_values, constant_default, parse_pg_array, split_arguments


class ConstantDefaultTests(SimpleTestCase):
    def test_booleans_and_numbers(self):
        self.assertEqual(constant_default("true"), (True, True))
        self.assertEqual(constant_default("false"), (True, False))
        self.assertEqual(constant_default("0"), (True, Decimal("0")))
        self.assertEqual(constant_default("-1.5"), (True, Decimal("-1.5")))
        self.assertEqual(constant_default("(30)::numeric"), (True, Decimal("30")))
        self.assertEqual(constant_default("'0'::numeric"), (True, Decimal("0")))

    def test_text_keeps_its_quotes_and_casts(self):
        self.assertEqual(constant_default("'active'::text"), (True, "active"))
        self.assertEqual(constant_default("'full_member'::character varying"), (True, "full_member"))
        self.assertEqual(constant_default("'it''s'::text"), (True, "it's"))
        self.assertEqual(constant_default("'staff'::visibility_scope"), (True, "staff"))
        self.assertEqual(constant_default("'2024-12-31'::date"), (True, "2024-12-31"))

    def test_json_and_arrays(self):
        self.assertEqual(constant_default("'{}'::jsonb"), (True, {}))
        self.assertEqual(constant_default("'[]'::json"), (True, []))
        self.assertEqual(constant_default("""'{"a": 1}'::jsonb"""), (True, {"a": 1}))
        self.assertEqual(constant_default("'{a,b}'::text[]"), (True, ["a", "b"]))
        self.assertEqual(constant_default("'{}'::text[]"), (True, []))
        self.assertEqual(constant_default("ARRAY[]::text[]"), (True, []))
        self.assertEqual(constant_default("ARRAY['a'::text, 'b'::text]"), (True, ["a", "b"]))

    def test_a_default_postgresql_computes_is_not_a_constant(self):
        for expression in (
            None,
            "now()",
            "CURRENT_TIMESTAMP",
            "CURRENT_DATE",
            "gen_random_uuid()",
            "nextval('t_id_seq'::regclass)",
            "timezone('utc'::text, now())",
            "(now() + '30 days'::interval)",
            "'not json'::jsonb",
        ):
            self.assertEqual(constant_default(expression), (False, None), expression)


class CheckListTests(SimpleTestCase):
    def test_a_list_over_the_column(self):
        self.assertEqual(
            check_list_values("CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'retired'::text])))", "status"),
            {"draft", "active", "retired"},
        )
        self.assertEqual(
            check_list_values(
                "CHECK (((status)::text = ANY ((ARRAY['a'::character varying, 'b'::character varying])::text[])))", "status"
            ),
            {"a", "b"},
        )
        self.assertEqual(check_list_values("CHECK ((priority = ANY (ARRAY[1, 2, 3])))", "priority"), {"1", "2", "3"})

    def test_null_is_allowed_beside_the_list(self):
        self.assertEqual(check_list_values("CHECK (((status IS NULL) OR (status = ANY (ARRAY['a'::text]))))", "status"), {"a"})

    def test_anything_else_is_not_read_as_a_list(self):
        self.assertIsNone(check_list_values("CHECK ((end_time > start_time))", "end_time"))
        # Another condition ANDed on, or ORed in, changes what the column may hold.
        self.assertIsNone(check_list_values("CHECK (((status = ANY (ARRAY['a'::text])) AND (kind = 'x'::text)))", "status"))
        self.assertIsNone(check_list_values("CHECK (((kind IS NULL) OR (status = ANY (ARRAY['a'::text]))))", "status"))
        # A column whose name merely ends the same way is another column.
        self.assertIsNone(check_list_values("CHECK ((other_status = ANY (ARRAY['a'::text])))", "status"))
        self.assertIsNone(check_list_values("CHECK ((status = ANY (ARRAY[lower(kind)])))", "status"))


class HelperTests(SimpleTestCase):
    def test_split_and_array_literals(self):
        self.assertEqual(split_arguments("'a, b', f(1, 2), [3, 4]"), ["'a, b'", "f(1, 2)", "[3, 4]"])
        self.assertEqual(parse_pg_array('{a,"b c",d}'), ["a", "b c", "d"])
        with self.assertRaises(ValueError):
            parse_pg_array("not an array")


class ModelDefaultTests(SimpleTestCase):
    def test_what_the_model_writes_for_an_omitted_field(self):
        self.assertIs(model_default(models.CharField(max_length=5)), NOT_PROVIDED)
        self.assertEqual(model_default(models.BooleanField(default=True)), True)
        self.assertEqual(model_default(models.JSONField(default=dict)), {})
        self.assertEqual(model_default(models.JSONField(default=list)), [])
        self.assertEqual(model_default(models.CharField(max_length=5, db_default="x")), "x")
        # Evaluated at write time, so it cannot be compared with a constant.
        self.assertIs(model_default(models.DateTimeField(default=functools.partial(len, "a"))), COMPUTED)
        self.assertIs(model_default(models.DateTimeField(db_default=models.functions.Now())), COMPUTED)

    def test_defaults_agree_only_when_the_stored_value_is_the_same(self):
        self.assertTrue(defaults_agree(True, True))
        self.assertFalse(defaults_agree(False, True))
        self.assertTrue(defaults_agree(30, Decimal("30")))
        self.assertTrue(defaults_agree(Decimal("0.0"), Decimal("0")))
        self.assertFalse(defaults_agree(0, Decimal("30")))
        self.assertTrue(defaults_agree("active", "active"))
        self.assertFalse(defaults_agree("", "claim_filed"))
        self.assertTrue(defaults_agree({}, {}))
        self.assertFalse(defaults_agree({}, []))
        self.assertTrue(defaults_agree([], []))
        self.assertTrue(defaults_agree(["a"], ["a"]))
        self.assertTrue(defaults_agree(("a",), ["a"]))
        self.assertFalse(defaults_agree(None, "x"))
