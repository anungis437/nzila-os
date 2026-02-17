"""
Nzila Analytics Generators

This module provides analytics generation capabilities for the Nzila portfolio.
"""

__version__ = "1.0.0"
__author__ = "Analytics & BI Team"

from .dashboard_generator import DashboardGenerator
from .metric_collector import MetricCollector
from .report_builder import ReportBuilder
from .export_manager import ExportManager

__all__ = [
    "DashboardGenerator",
    "MetricCollector", 
    "ReportBuilder",
    "ExportManager",
]
