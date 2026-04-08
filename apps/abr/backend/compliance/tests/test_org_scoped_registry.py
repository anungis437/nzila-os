"""
Contract tests: every model that stores org-scoped data must derive from
OrganizationModel (or carry an explicit `organization` FK to OrganizationModel).

These tests enforce the invariant introduced in NzilaOS alignment Item 8.
Run with: pytest backend/compliance/tests/test_org_scoped_registry.py -v
"""

import importlib
import inspect

import django
import pytest
from django.apps import apps

# Ensure Django is configured before importing anything
django.setup()

from auth_core.models import OrganizationModel  # noqa: E402  (post-setup import)


def _get_org_scoped_apps() -> list[str]:
    """Return the list of app labels whose models must be org-scoped."""
    return ["compliance", "services"]


def _is_org_scoped(model_class) -> bool:
    """
    Return True if the model satisfies the org-scope invariant:
      - Inherits from ANY abstract class named ``OrganizationModel`` in its MRO
        (catches both ``auth_core.models.OrganizationModel`` and the locally-
        defined ``compliance.models.OrganizationModel``), OR
      - Has an explicit ForeignKey named ``organization`` pointed at any model
        named ``Organizations``, OR
      - Has an explicit UUIDField named ``org_id`` (ABR Phase 2 pattern — org
        boundary enforced at the service/view layer without a FK to auth_core).
    """
    # Accept any base class named OrganizationModel that is abstract.
    for base in model_class.__mro__:
        if (
            base.__name__ == "OrganizationModel"
            and base is not model_class
            and getattr(getattr(base, "_meta", None), "abstract", False)
        ):
            return True
    for field in model_class._meta.get_fields():
        if (
            field.name == "organization"
            and hasattr(field, "related_model")
            and field.related_model is not None
            and field.related_model.__name__ == "Organizations"
        ):
            return True
        # ABR Phase 2: org_id UUIDField is an accepted org-scoping mechanism.
        if field.name == "org_id" and field.get_internal_type() == "UUIDField":
            return True
    return False


def _get_concrete_models(app_label: str):
    """Return all non-abstract, non-proxy models registered under an app label."""
    try:
        app_config = apps.get_app_config(app_label)
    except LookupError:
        return []  # app not installed in test env — skip gracefully
    return [
        m for m in app_config.get_models() if not m._meta.abstract and not m._meta.proxy
    ]


@pytest.mark.parametrize("app_label", _get_org_scoped_apps())
def test_all_models_are_org_scoped(app_label: str) -> None:
    """No concrete model in a business app may exist without org-scope enforcement."""
    # Pre-existing evidence bundle sub-models that are org-scoped TRANSITIVELY
    # via bundle_id → EvidenceBundles → organization FK.  They predate this test
    # and are excluded from the enforcement gate while the org-scope backfill is planned.
    TRANSITIVELY_SCOPED_MODELS = {
        "EvidenceBundleComponents",
        "EvidenceBundlePolicyMappings",
        "EvidenceBundleTimeline",
    }

    models = _get_concrete_models(app_label)
    if not models:
        pytest.skip(f"No concrete models found in app '{app_label}' (not installed?)")

    violations = [
        m.__name__
        for m in models
        if not _is_org_scoped(m) and m.__name__ not in TRANSITIVELY_SCOPED_MODELS
    ]
    assert violations == [], (
        f"[{app_label}] The following models are NOT org-scoped "
        f"(must inherit OrganizationModel or carry `organization` FK):\n"
        + "\n".join(f"  - {v}" for v in violations)
    )


def test_organization_model_has_required_fields() -> None:
    """OrganizationModel must expose `id` and `organization` as columns."""
    field_names = {f.name for f in OrganizationModel._meta.get_fields()}
    for required in ("id", "organization"):
        assert (
            required in field_names
        ), f"OrganizationModel is missing required field: {required!r}"
