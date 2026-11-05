"""The model fields and migration operation that exist because the schema is owned by the platform migrations.

``EnumArrayField`` and ``UnboundedDecimalField`` are for PostgreSQL types Django has no field for; ``RecordFieldState`` records
columns the platform migrations created in Django's migration state without running SQL.
"""
import decimal

from django.db import DataError, models, transaction
from django.db.migrations.state import ModelState, ProjectState
from django.test import SimpleTestCase, TestCase
from rest_framework import serializers

from analytics.models import AnalyticsMetrics
from analytics.serializers import AnalyticsMetricsSerializer
from auth_core.models import Organizations
from content.models import DataAggregationConsent
from core.fields import EnumArrayField, UnboundedDecimalField
from core.migration_ops import RecordFieldState
from core.testing import create_valid


class EnumArrayFieldRoundTrip(TestCase):
    def test_an_enum_array_is_stored_read_back_and_filtered_as_a_list(self):
        row = create_valid(DataAggregationConsent, categories=["grievance-type", "sector-trend"])
        row.refresh_from_db()
        self.assertEqual(row.categories, ["grievance-type", "sector-trend"])
        self.assertTrue(DataAggregationConsent.objects.filter(categories__contains=["sector-trend"]).exists())
        self.assertFalse(DataAggregationConsent.objects.filter(categories__contains=["jurisdiction-pattern"]).exists())

    def test_an_empty_enum_array_is_stored(self):
        row = create_valid(DataAggregationConsent, categories=[])
        row.refresh_from_db()
        self.assertEqual(row.categories, [])

    def test_the_database_rejects_a_value_that_is_not_a_member_of_the_enum(self):
        with self.assertRaises(DataError), transaction.atomic():
            create_valid(DataAggregationConsent, categories=["not-a-member"])

    def test_an_update_through_the_orm_casts_the_array_too(self):
        row = create_valid(DataAggregationConsent, categories=["grievance-type"])
        DataAggregationConsent.objects.filter(pk=row.pk).update(categories=["systemic-issue"])
        row.refresh_from_db()
        self.assertEqual(row.categories, ["systemic-issue"])


class UnboundedDecimalFieldRoundTrip(TestCase):
    VALUE = decimal.Decimal("1.234567890123456789012345678901")

    class MetricSerializer(serializers.ModelSerializer):
        # Not the API's own serializer: that one is frozen and deliberately does not expose columns the model learned.
        class Meta:
            model = AnalyticsMetrics
            fields = ["metric_value"]

    def test_the_value_is_not_quantized(self):
        org = create_valid(Organizations)
        row = create_valid(AnalyticsMetrics, organization=org, metric_value=self.VALUE)
        row.refresh_from_db()
        self.assertEqual(row.metric_value, self.VALUE)

    def test_a_model_serializer_returns_it_exactly(self):
        org = create_valid(Organizations)
        row = create_valid(AnalyticsMetrics, organization=org, metric_value=self.VALUE)
        self.assertEqual(self.MetricSerializer(row).data["metric_value"], str(self.VALUE))

    def test_a_model_serializer_accepts_it_without_a_precision_limit(self):
        serializer = self.MetricSerializer(data={"metric_value": "12345678901234567890.123456789"})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data["metric_value"], decimal.Decimal("12345678901234567890.123456789"))

    def test_the_live_api_does_not_expose_it(self):
        self.assertNotIn("metric_value", AnalyticsMetricsSerializer().fields)


class FieldsSurviveMigrationState(SimpleTestCase):
    """Migration state clones every field, and the migration writer deconstructs them."""

    def test_unbounded_decimal_deconstructs_without_a_precision_and_clones(self):
        field = UnboundedDecimalField(null=True)
        _, path, args, kwargs = field.deconstruct()
        self.assertEqual(path, "core.fields.UnboundedDecimalField")
        self.assertNotIn("max_digits", kwargs)
        self.assertNotIn("decimal_places", kwargs)
        clone = field.clone()
        self.assertIsInstance(clone, UnboundedDecimalField)
        self.assertIsNone(clone.max_digits)
        self.assertEqual(clone.db_type(None), "numeric")

    def test_enum_array_deconstructs_with_its_enum_type_and_clones(self):
        field = EnumArrayField(models.CharField(max_length=63, choices=[("a", "a")]), enum_type="some_enum")
        _, path, _, kwargs = field.deconstruct()
        self.assertEqual(path, "core.fields.EnumArrayField")
        self.assertEqual(kwargs["enum_type"], "some_enum")
        clone = field.clone()
        self.assertEqual(clone.enum_type, "some_enum")
        self.assertEqual(clone.db_type(None), "some_enum[]")


class RecordFieldStateRunsNoSql(SimpleTestCase):
    class NoSql:
        def execute(self, *args, **kwargs):
            raise AssertionError("RecordFieldState must not run SQL")

    def state(self):
        state = ProjectState()
        state.add_model(ModelState("app", "Thing", [("id", models.AutoField(primary_key=True))]))
        return state

    def test_it_records_every_field_in_the_state(self):
        state = self.state()
        RecordFieldState("Thing", [("a", models.TextField()), ("b", UnboundedDecimalField(null=True))]).state_forwards("app", state)
        self.assertEqual(set(state.models[("app", "thing")].fields), {"id", "a", "b"})
        self.assertIsInstance(state.apps.get_model("app", "Thing")._meta.get_field("b"), UnboundedDecimalField)

    def test_it_replaces_a_field_that_already_exists(self):
        state = self.state()
        RecordFieldState("Thing", [("a", models.TextField(null=True))]).state_forwards("app", state)
        RecordFieldState("Thing", [("a", models.TextField())]).state_forwards("app", state)
        self.assertFalse(state.models[("app", "thing")].fields["a"].null)

    def test_forwards_and_backwards_run_no_sql(self):
        state = self.state()
        operation = RecordFieldState("Thing", [("a", models.TextField())])
        operation.database_forwards("app", self.NoSql(), state, state)
        operation.database_backwards("app", self.NoSql(), state, state)
        self.assertTrue(operation.reversible)

    def test_it_refuses_a_relation_and_a_key(self):
        state = self.state()
        with self.assertRaises(ValueError):
            RecordFieldState("Thing", [("owner", models.ForeignKey("app.Thing", on_delete=models.CASCADE))]).state_forwards("app", state)
        with self.assertRaises(ValueError):
            RecordFieldState("Thing", [("code", models.TextField(primary_key=True))]).state_forwards("app", state)
