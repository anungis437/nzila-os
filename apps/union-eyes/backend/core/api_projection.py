"""What a services/api list endpoint returns for a model.

Those views project a whole queryset with ``.values()``, so every column of the model reaches the response. A model that
learns a column (it should: it describes its table) must not widen the response, so the response names its columns:
``api_columns(model)`` is the list the endpoint returned when it was written, and ``api_projections.json`` holds it.
Adding a column to a response is a deliberate edit of that file, reviewed as the API change it is.
"""
from __future__ import annotations

import json
from pathlib import Path

PROJECTIONS_FILE = Path(__file__).with_name("api_projections.json")


def projections() -> dict[str, list[str]]:
    return json.loads(PROJECTIONS_FILE.read_text(encoding="utf-8"))["models"]


def api_columns(model_or_queryset) -> list[str]:
    """The columns a list endpoint returns for the model (or for the model of a queryset)."""
    model = getattr(model_or_queryset, "model", model_or_queryset)
    return projections()[model._meta.label]
