"""
tooling/ml/lib/thresholds.py

Threshold selection strategies for IsolationForest anomaly detection.
"""
from __future__ import annotations

import numpy as np


def percentile_threshold(scores: np.ndarray, contamination: float = 0.02) -> float:
    """
    Select threshold as the (contamination * 100)th percentile of scores.
    IsolationForest scores are in [-1, 0.5]: lower = more anomalous.
    Rows where score < threshold are flagged as anomalies.

    Args:
        scores: Array of anomaly scores from IsolationForest.decision_function()
        contamination: Fraction of samples expected to be anomalous (default 2%).

    Returns:
        Threshold value.
    """
    return float(np.percentile(scores, contamination * 100))
