"""
Analytics Data Models
Defines data structures for analytics modules.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional


@dataclass
class PlatformMetrics:
    """Core metrics for a single platform."""
    platform_id: str
    name: str
    vertical: str
    entity_count: int
    complexity: str
    production_readiness: float
    security_score: float
    rls_policies: int = 0
    migration_weeks: str = ""
    tech_stack: Dict[str, str] = field(default_factory=dict)
    key_features: List[str] = field(default_factory=list)


@dataclass
class FinancialMetrics:
    """Financial metrics snapshot."""
    timestamp: str = ""
    arr_current: float = 0
    arr_target: float = 0
    mrr_current: float = 0
    customer_count: int = 0
    runway_months: int = 0
    burn_rate: float = 0

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now().isoformat()


@dataclass
class VerticalMetrics:
    """Metrics for a business vertical."""
    vertical_id: str
    name: str
    platforms: List[str]
    tam: float
    som_current: float
    som_target: float
    maturity: str
    flagship: str


@dataclass
class RiskMetrics:
    """Risk assessment metrics."""
    risk_id: str
    category: str
    description: str
    impact: str  # CRITICAL, HIGH, MEDIUM, LOW
    probability: str  # HIGH, MEDIUM, LOW
    owner: str
    status: str  # open, monitored, mitigated, closed
    mitigation: str = ""


@dataclass
class MigrationMetrics:
    """Migration tracking metrics."""
    platform_id: str
    name: str
    complexity: str
    estimated_weeks: str
    status: str  # pending, in_progress, completed
    phase: int = 0
    completion_pct: float = 0
    dependencies: List[str] = field(default_factory=list)
    risk_factors: List[str] = field(default_factory=list)


@dataclass
class DashboardConfig:
    """Dashboard configuration model."""
    dashboard_id: str
    name: str
    description: str
    version: str = "1.0.0"
    refresh_rate: str = "daily"
    audience: List[str] = field(default_factory=list)
    sections: List[Dict[str, Any]] = field(default_factory=list)
