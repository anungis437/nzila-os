"""The API must not move because a model did.

The converged models describe every column of their tables. What a client may read, write and must send is what the
serializers say, and every reachable serializer lists its fields explicitly. These tests hold that line:

* no reachable serializer says ``fields = '__all__'``, so a column a model learns does not reach the API by itself;
* no serializer, routed or not, returns a credential: un-containing a view must not publish one;
* the committed surface (core/api_surface.json) equals the real one, so a change to it is a diff in review;
* a services/api list endpoint that projects a model names its columns (core/api_projections.json), so completing the model
  does not widen the response.
"""
import json

from django.test import SimpleTestCase, TestCase

from core import api_projection, emit_api_surface, exposure


class ReachableSerializersAreExplicit(SimpleTestCase):
    def test_no_reachable_serializer_says_all_fields(self):
        offenders = sorted(
            f"{s.__module__}.{s.__name__}" for s in exposure.live_serializers() if getattr(s.Meta, "fields", None) == "__all__"
        )
        self.assertEqual(
            offenders,
            [],
            "A reachable serializer lists its fields. Run `python manage.py ue_converge_models --apply`, or list them by hand.",
        )

    def test_there_are_reachable_serializers_to_hold_to_it(self):
        self.assertGreater(len(exposure.live_serializers()), 250)


class CredentialsAreNeverReturned(SimpleTestCase):
    def test_no_serializer_returns_a_credential_column(self):
        offenders = []
        for serializer, model in exposure.model_serializers().items():
            for name, field in serializer().fields.items():
                try:
                    column = model._meta.get_field(name).column
                except Exception:
                    column = name
                if exposure.SENSITIVE_COLUMN.search(column) and not field.write_only:
                    offenders.append(f"{serializer.__module__}.{serializer.__name__}.{name}")
        self.assertEqual(
            sorted(offenders),
            [],
            "A credential column must be write-only (or left out) in every serializer, routed or not. "
            "`python manage.py ue_converge_models --apply` marks them.",
        )


class ApiSurfaceIsPinned(SimpleTestCase):
    def test_the_committed_surface_equals_the_real_one(self):
        committed = json.loads(emit_api_surface.OUTPUT.read_text(encoding="utf-8"))
        regenerated = json.loads(json.dumps(emit_api_surface.build()))
        self.assertEqual(
            committed,
            regenerated,
            "core/api_surface.json is stale: what the API returns or accepts changed. If that was intended, run "
            "`python -m core.emit_api_surface --write` and review the diff.",
        )


class ProjectionsNameTheirColumns(SimpleTestCase):
    def test_no_service_view_projects_a_whole_model(self):
        self.assertEqual(
            exposure.bare_values_calls(),
            [],
            "A bare .values() returns every column of the model, so a column the model learns reaches the response. "
            "Name the columns: .values(*api_columns(queryset)) (core/api_projection.py).",
        )

    def test_every_model_a_projecting_view_can_query_has_its_columns_recorded(self):
        missing = sorted(model._meta.label for model in exposure.projected_models() if model._meta.label not in api_projection.projections())
        self.assertEqual(missing, [], "Add the model to core/api_projections.json: the columns its list endpoints return.")

    def test_every_recorded_column_is_a_field_of_its_model(self):
        from django.apps import apps

        offenders = []
        for label, columns in api_projection.projections().items():
            model = apps.get_model(label)
            names = {f.attname for f in model._meta.concrete_fields}
            offenders += [f"{label}.{c}" for c in columns if c not in names]
        self.assertEqual(offenders, [], "A recorded projection names a column its model does not have.")

    def test_no_recorded_column_is_a_credential(self):
        offenders = sorted(
            f"{label}.{column}"
            for label, columns in api_projection.projections().items()
            for column in columns
            if exposure.SENSITIVE_COLUMN.search(column)
        )
        self.assertEqual(offenders, [], "A credential column must never be returned by a list endpoint.")


class ProjectionsRunAgainstTheDatabase(TestCase):
    """``.values(*columns)`` must run for every recorded model, in both shapes the views use, and return exactly the named columns.

    The converged database may hold rows (the native proofs write fixtures into it), so the tables are not assumed to be empty.
    """

    def test_every_projection_is_a_valid_query(self):
        from django.apps import apps

        for label in api_projection.projections():
            model = apps.get_model(label)
            columns = api_projection.api_columns(model)
            for rows in (
                list(model.objects.values(*columns)[:1]),
                list(model.objects.order_by("-created_at")[:5].values(*columns)),
            ):
                for row in rows:
                    self.assertEqual(set(row), set(columns), label)
