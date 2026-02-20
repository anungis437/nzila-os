"""
tooling/ml/lib/metrics.py

Standardised metrics collection for ML training runs.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

import numpy as np


def build_training_metrics(
    *,
    model_key: str,
    dataset_sha256: str,
    dataset_key: str,
    period_start: str,
    period_end: str,
    n_train: int,
    feature_names: list[str],
    scores: np.ndarray,
    threshold: float,
    hyperparams: dict[str, Any],
    feature_spec: dict[str, Any],
) -> dict[str, Any]:
    """Build a standardised metrics JSON for a training run."""
    anomaly_mask = scores < threshold
    return {
        "schema_version": "1.0",
        "model_key": model_key,
        "algorithm": "isolation_forest",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "dataset": {
            "sha256": dataset_sha256,
            "dataset_key": dataset_key,
            "period_start": period_start,
            "period_end": period_end,
            "n_train": n_train,
        },
        "hyperparams": hyperparams,
        "features": {
            "names": feature_names,
            "count": len(feature_names),
        },
        "score_distribution": {
            "min": float(np.min(scores)),
            "max": float(np.max(scores)),
            "mean": float(np.mean(scores)),
            "std": float(np.std(scores)),
            "p5": float(np.percentile(scores, 5)),
            "p25": float(np.percentile(scores, 25)),
            "p50": float(np.percentile(scores, 50)),
            "p75": float(np.percentile(scores, 75)),
            "p95": float(np.percentile(scores, 95)),
        },
        "threshold": float(threshold),
        "anomaly_rate_train": float(anomaly_mask.sum() / len(scores)),
        "feature_spec": feature_spec,
    }


def to_json(metrics: dict[str, Any]) -> str:
    return json.dumps(metrics, indent=2, default=str)
