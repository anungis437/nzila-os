"""
Revenue Forecast Module

Provides revenue projections and forecasting models.
"""

import json
from datetime import datetime
from typing import Any, Dict, List, Optional


class RevenueForecast:
    """Generate revenue forecasts for the portfolio."""
    
    def __init__(self):
        self.base_revenue = {
            "2025": 0,
            "2026": 350000,
            "2027": 1200000,
            "2028": 2800000,
            "2029": 4500000,
            "2030": 6000000
        }
        
    def forecast_arr(self, year: int, scenario: str = "base") -> Dict[str, Any]:
        """Generate ARR forecast for a specific year."""
        
        scenarios = {
            "conservative": 0.7,
            "base": 1.0,
            "optimistic": 1.3
        }
        
        multiplier = scenarios.get(scenario, 1.0)
        
        targets = {
            "2025": 0,
            "2026": 350000,
            "2027": 1200000,
            "2028": 2800000,
            "2029": 4500000,
            "2030": 6000000
        }
        
        return {
            "year": year,
            "scenario": scenario,
            "target": targets.get(str(year), 0),
            "projected": int(targets.get(str(year), 0) * multiplier),
            "multiplier": multiplier
        }
    
    def forecast_mrr(self, year: int, month: int) -> Dict[str, Any]:
        """Generate MRR forecast for a specific month."""
        
        # Simplified monthly growth model
        if year == 2026:
            base = 0
            monthly_growth = 29000 / 12
        elif year == 2027:
            base = 29000
            monthly_growth = (100000 - 29000) / 12
        elif year == 2028:
            base = 100000
            monthly_growth = (233000 - 100000) / 12
        elif year == 2029:
            base = 233000
            monthly_growth = (375000 - 233000) / 12
        elif year == 2030:
            base = 375000
            monthly_growth = (500000 - 375000) / 12
        else:
            base = 0
            monthly_growth = 0
        
        mrr = int(base + (monthly_growth * month))
        
        return {
            "year": year,
            "month": month,
            "projected_mrr": mrr,
            "cumulative_revenue": int(mrr * month)
        }
    
    def forecast_by_platform(self, year: int) -> List[Dict[str, Any]]:
        """Forecast revenue by platform."""
        
        platform_forecasts = [
            {
                "platform": "Union Eyes",
                "vertical": "Uniontech",
                "arr_2026": 105000,
                "arr_2027": 420000,
                "arr_2028": 840000,
                "arr_2029": 1350000,
                "arr_2030": 1800000,
                "growth_rate": 1.0
            },
            {
                "platform": "ABR Insights",
                "vertical": "EdTech/Legaltech",
                "arr_2026": 84000,
                "arr_2027": 336000,
                "arr_2028": 672000,
                "arr_2029": 960000,
                "arr_2030": 1200000,
                "growth_rate": 0.9
            },
            {
                "platform": "CORA",
                "vertical": "Agrotech",
                "arr_2026": 63000,
                "arr_2027": 252000,
                "arr_2028": 504000,
                "arr_2029": 720000,
                "arr_2030": 900000,
                "growth_rate": 0.85
            },
            {
                "platform": "DiasporaCore",
                "vertical": "Fintech",
                "arr_2026": 42000,
                "arr_2027": 168000,
                "arr_2028": 336000,
                "arr_2029": 480000,
                "arr_2030": 600000,
                "growth_rate": 0.8
            },
            {
                "platform": "SentryIQ",
                "vertical": "Insurtech",
                "arr_2026": 28000,
                "arr_2027": 112000,
                "arr_2028": 224000,
                "arr_2029": 360000,
                "arr_2030": 450000,
                "growth_rate": 0.75
            },
            {
                "platform": "Others",
                "vertical": "Various",
                "arr_2026": 28000,
                "arr_2027": 120000,
                "arr_2028": 224000,
                "arr_2029": 540000,
                "arr_2030": 1050000,
                "growth_rate": 1.2
            }
        ]
        
        year_key = f"arr_{year}"
        return [
            {**p, "arr": p.get(year_key, 0)} 
            for p in platform_forecasts
        ]
    
    def generate_scenarios(self) -> Dict[str, Any]:
        """Generate three scenarios."""
        
        return {
            "generated_at": datetime.now().isoformat(),
            "scenarios": {
                "conservative": {
                    "2026": 245000,
                    "2027": 840000,
                    "2028": 1960000,
                    "2029": 3150000,
                    "2030": 4200000,
                    "description": "Delayed adoption, reduced customer growth"
                },
                "base": {
                    "2026": 350000,
                    "2027": 1200000,
                    "2028": 2800000,
                    "2029": 4500000,
                    "2030": 6000000,
                    "description": "On-target execution of roadmap"
                },
                "optimistic": {
                    "2026": 455000,
                    "2027": 1560000,
                    "2028": 3640000,
                    "2029": 5850000,
                    "2030": 7800000,
                    "description": "Accelerated growth, strong market reception"
                }
            },
            "key_assumptions": [
                "Series A closes Q2 2026",
                "3 flagship platforms launch in 2026",
                "Sales team scales as planned",
                "Customer retention 85-95%"
            ]
        }


def main():
    """CLI entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Generate Revenue Forecasts")
    parser.add_argument("--year", type=int, default=2026, help="Target year")
    parser.add_argument("--scenario", choices=["base", "optimistic", "conservative"], default="base")
    parser.add_argument("--platforms", action="store_true", help="Show platform breakdown")
    
    args = parser.parse_args()
    
    forecast = RevenueForecast()
    
    if args.platforms:
        results = forecast.forecast_by_platform(args.year)
        print(json.dumps(results, indent=2))
    else:
        result = forecast.forecast_arr(args.year, args.scenario)
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
