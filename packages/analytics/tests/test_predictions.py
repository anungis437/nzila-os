"""
Prediction Module Tests
Validate predictive analytics modules.
"""

import json
import pytest
from datetime import datetime


class TestRevenueForecast:
    """Test revenue forecasting module."""

    def test_import(self):
        """RevenueForecast should be importable."""
        from analytics.predictions.revenue_forecast import RevenueForecast
        rf = RevenueForecast()
        assert rf is not None

    def test_forecast_arr_base_scenario(self):
        """Base scenario should return unmodified targets."""
        from analytics.predictions.revenue_forecast import RevenueForecast
        rf = RevenueForecast()
        result = rf.forecast_arr(2026, "base")
        assert result["year"] == 2026
        assert result["scenario"] == "base"
        assert result["projected"] == 350000
        assert result["multiplier"] == 1.0

    def test_forecast_arr_conservative(self):
        """Conservative scenario should reduce projections."""
        from analytics.predictions.revenue_forecast import RevenueForecast
        rf = RevenueForecast()
        result = rf.forecast_arr(2026, "conservative")
        assert result["projected"] < 350000
        assert result["multiplier"] == 0.7

    def test_forecast_arr_optimistic(self):
        """Optimistic scenario should increase projections."""
        from analytics.predictions.revenue_forecast import RevenueForecast
        rf = RevenueForecast()
        result = rf.forecast_arr(2030, "optimistic")
        assert result["projected"] > 6000000
        assert result["multiplier"] == 1.3

    def test_forecast_mrr(self):
        """MRR forecast should return positive values for valid years."""
        from analytics.predictions.revenue_forecast import RevenueForecast
        rf = RevenueForecast()
        result = rf.forecast_mrr(2027, 6)
        assert result["projected_mrr"] > 0
        assert result["year"] == 2027
        assert result["month"] == 6

    def test_forecast_by_platform(self):
        """Platform-level forecast should return entries."""
        from analytics.predictions.revenue_forecast import RevenueForecast
        rf = RevenueForecast()
        result = rf.forecast_by_platform(2026)
        assert isinstance(result, list)
        assert len(result) > 0
        assert "platform" in result[0]


class TestChurnPrediction:
    """Test churn prediction module."""

    def test_import(self):
        """ChurnPredictor should be importable."""
        from analytics.predictions.churn_prediction import ChurnPredictor
        cp = ChurnPredictor()
        assert cp is not None

    def test_platform_models_loaded(self):
        """Should load platform-specific churn models."""
        from analytics.predictions.churn_prediction import ChurnPredictor
        cp = ChurnPredictor()
        assert "union_eyes" in cp.platform_models
        assert "abr_insights" in cp.platform_models

    def test_churn_rates_within_range(self):
        """All churn rates should be between 0 and 1."""
        from analytics.predictions.churn_prediction import ChurnPredictor
        cp = ChurnPredictor()
        for pid, model in cp.platform_models.items():
            assert 0 < model["target_churn_rate"] < 1, f"{pid} has invalid target churn rate"
            assert 0 < model["current_churn_estimate"] < 1, f"{pid} has invalid current churn estimate"

    def test_retention_drivers_exist(self):
        """Each platform model should have retention drivers."""
        from analytics.predictions.churn_prediction import ChurnPredictor
        cp = ChurnPredictor()
        for pid, model in cp.platform_models.items():
            assert len(model["retention_drivers"]) > 0, f"{pid} has no retention drivers"


class TestMigrationTimeline:
    """Test migration timeline module."""

    def test_import(self):
        """MigrationTimeline should be importable."""
        from analytics.predictions.migration_timeline import MigrationTimeline
        mt = MigrationTimeline()
        assert mt is not None

    def test_platforms_loaded(self):
        """Should load platform migration data."""
        from analytics.predictions.migration_timeline import MigrationTimeline
        mt = MigrationTimeline()
        assert len(mt.platforms) > 0

    def test_complexity_factors_defined(self):
        """All complexity levels should have factors."""
        from analytics.predictions.migration_timeline import MigrationTimeline
        for complexity in ["EXTREME", "HIGH-EXTREME", "HIGH", "MEDIUM-HIGH", "MEDIUM"]:
            assert complexity in MigrationTimeline.COMPLEXITY_FACTORS

    def test_complexity_base_weeks_ordering(self):
        """Higher complexity should have more base weeks."""
        from analytics.predictions.migration_timeline import MigrationTimeline
        factors = MigrationTimeline.COMPLEXITY_FACTORS
        assert factors["EXTREME"]["base_weeks"] > factors["HIGH"]["base_weeks"]
        assert factors["HIGH"]["base_weeks"] > factors["MEDIUM"]["base_weeks"]


class TestMarketExpansion:
    """Test market expansion module."""

    def test_import(self):
        """MarketExpansionAnalyzer should be importable."""
        from analytics.predictions.market_expansion import MarketExpansionAnalyzer
        me = MarketExpansionAnalyzer()
        assert me is not None

    def test_vertical_markets_loaded(self):
        """Should have market data for key verticals."""
        from analytics.predictions.market_expansion import MarketExpansionAnalyzer
        me = MarketExpansionAnalyzer()
        assert "uniontech" in me.vertical_markets
        assert "fintech_remittance" in me.vertical_markets

    def test_tam_greater_than_sam(self):
        """TAM should always exceed SAM for every vertical."""
        from analytics.predictions.market_expansion import MarketExpansionAnalyzer
        me = MarketExpansionAnalyzer()
        for vid, v in me.vertical_markets.items():
            assert v["tam"] > v["sam"], f"{vid}: TAM should exceed SAM"
            assert v["sam"] > v["som_2030"], f"{vid}: SAM should exceed SOM 2030"
