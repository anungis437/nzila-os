"""What the Django API can reach, and which columns must never leave it.

The models describe every column of their table, but the API must not widen because a model learned a column.
Two channels return model data, and this module is the single place that finds them:

* ``ModelSerializer``-backed views that are routed and not contained. Contained means ``DenyAllPermission``.
  Their serializers list their fields explicitly; ``fields = '__all__'`` on a reachable view is a defect.
* ``services/api`` views that project a queryset with ``.values()``. A bare ``.values()`` returns every column of the
  model, so those responses name their columns (``core/api_projection.py``); a bare one is a defect.

Reachability comes from the URL configuration, not from reading source text.
"""
from __future__ import annotations

import ast
import importlib
import inspect
import pkgutil
import re

SENSITIVE_COLUMN = re.compile(
    r"(secret|password|passwd|credential|private_key|api_key|apikey|totp|backup_codes|webauthn|salt"
    r"|(^|_)(access|refresh|session|auth|bank_account|device|sync|oauth)_token($|_)"
    r"|(^|_)token_(hash|prefix|secret)($|_)|(^|_)voter_)",
    re.IGNORECASE,
)


def is_contained(view_class) -> bool:
    """True when the view denies every request unconditionally."""
    return any("DenyAll" in getattr(p, "__name__", "") for p in getattr(view_class, "permission_classes", []) or [])


def _callbacks(patterns):
    for pattern in patterns:
        if hasattr(pattern, "url_patterns"):
            yield from _callbacks(pattern.url_patterns)
        else:
            yield pattern.callback


def routed_view_classes() -> set[type]:
    """Every view class that some URL resolves to."""
    from django.urls import get_resolver

    found = set()
    for callback in _callbacks(get_resolver().url_patterns):
        cls = getattr(callback, "cls", None) or getattr(callback, "view_class", None)
        if cls is not None:
            found.add(cls)
    return found


def live_view_classes() -> set[type]:
    return {cls for cls in routed_view_classes() if not is_contained(cls)}


def _model_of(view_class):
    queryset = getattr(view_class, "queryset", None)
    return queryset.model if queryset is not None else None


def live_serializers() -> dict[type, type]:
    """{serializer class: model} for every reachable, uncontained view that serializes a model."""
    from rest_framework import serializers

    found = {}
    for cls in live_view_classes():
        serializer = getattr(cls, "serializer_class", None)
        if serializer is None or not issubclass(serializer, serializers.ModelSerializer):
            continue
        model = getattr(getattr(serializer, "Meta", None), "model", None) or _model_of(cls)
        if model is not None:
            found[serializer] = model
    return found


def model_serializers() -> dict[type, type]:
    """{serializer class: model} for every ModelSerializer a local app defines, routed or not.

    A serializer that is unreachable today can be reached tomorrow by un-containing its view, so what it would return
    is held to the same rule as the reachable ones.
    """
    from django.apps import apps
    from rest_framework import serializers

    found = {}
    for config in apps.get_app_configs():
        try:
            module = importlib.import_module(f"{config.name}.serializers")
        except ModuleNotFoundError:
            continue
        for _, cls in inspect.getmembers(module, inspect.isclass):
            model = getattr(getattr(cls, "Meta", None), "model", None)
            if cls.__module__ == module.__name__ and issubclass(cls, serializers.ModelSerializer) and model is not None:
                found[cls] = model
    return found


#: Receivers of ``.values()`` in services/api that are plain dicts (celery inspect results, a sum by scope), not querysets.
DICT_VALUES_RECEIVERS = {"by_scope", "active", "reserved", "scheduled", "queue_data"}


def _service_modules():
    import services.api as package

    for info in pkgutil.iter_modules(package.__path__):
        name = f"services.api.{info.name}"
        yield name, importlib.import_module(name)


def bare_values_calls() -> list[str]:
    """``module:line`` of every ``.values()`` without arguments on a queryset in a services/api module.

    It returns every column of the model, so a column the model learns would reach the response. Name the columns
    with ``.values(*api_columns(queryset))`` (core/api_projection.py).
    """
    found = []
    for name, module in _service_modules():
        for node in ast.walk(ast.parse(inspect.getsource(module))):
            if not (isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "values"):
                continue
            if node.args or node.keywords:
                continue
            receiver = node.func.value
            if isinstance(receiver, ast.Name) and receiver.id in DICT_VALUES_RECEIVERS:
                continue
            found.append(f"{name}:{node.lineno}")
    return found


def projected_models() -> set[type]:
    """The models a services/api module that projects with ``api_columns`` can query."""
    from django.apps import apps

    by_name = {}
    all_models = set(apps.get_models())
    for model in all_models:
        by_name.setdefault(model.__name__, set()).add(model)

    found = set()
    for _, module in _service_modules():
        source = inspect.getsource(module)
        if "api_columns(" not in source:
            continue
        found |= {obj for _, obj in inspect.getmembers(module, inspect.isclass) if obj in all_models}
        for model_name in re.findall(r"\b([A-Z][A-Za-z0-9]+)\.objects\b", source):
            found |= by_name.get(model_name, set())
    return found
