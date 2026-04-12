"""
Vertical Performance Analyzer
Benchmark and compare performance across business verticals
"""

import json
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

_DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'market_data.json')


def _load_market_data() -> Dict:
    """Load market data from the shared JSON config."""
    with open(_DATA_PATH, 'r') as f:
        return json.load(f)


class VerticalPerformanceAnalyzer:
    """Analyze and benchmark performance across business verticals."""

    def __init__(self):
        self.verticals = self._load_verticals()

    def _load_verticals(self) -> Dict[str, Dict[str, Any]]:
        """Load vertical definitions — TAM/SOM from shared market_data.json, platform metadata local."""
        market_data = _load_market_data()
        shared = market_data["vertical_markets"]

        # Platform-specific metadata that augments the shared market data
        platform_meta = {
            "uniontech": {"platforms": ["union_eyes"], "flagship": "UnionEyes", "maturity": "growth"},
            "dei_training": {"platforms": ["abr_insights"], "flagship": "ABR Insights", "maturity": "growth"},
            "agrotech": {"platforms": ["cora", "agrimoops"], "flagship": "CORA", "maturity": "early"},
            "fintech_remittance": {"platforms": ["c3uo", "stsa", "insight_cfo"], "flagship": "DiasporaCore V2", "maturity": "early"},
            "insurtech": {"platforms": ["sentryiq"], "flagship": "SentryIQ360", "maturity": "early"},
            "legaltech": {"platforms": ["court_lens"], "flagship": "Court Lens", "maturity": "early"},
            "trade_commerce": {"platforms": ["trade_os", "eexports", "shop_quoter"], "flagship": "Trade OS", "maturity": "early"},
            "entertainment_streaming": {"platforms": ["congowave"], "flagship": "CongoWave", "maturity": "beta"},
            "edtech": {"platforms": ["cyberlearn"], "flagship": "CyberLearn", "maturity": "early"},
            "healthtech": {"platforms": ["memora"], "flagship": "Memora", "maturity": "concept"},
            "virtual_cfo": {"platforms": ["insight_cfo"], "flagship": "Insight CFO", "maturity": "early"},
        }

        result = {}
        for vid, meta in platform_meta.items():
            market = shared.get(vid, {})
            result[vid] = {
                "name": market.get("name", vid),
                "platforms": meta["platforms"],
                "tam": market.get("tam", 0),
                "som_2026": market.get("som_2026", 0),
                "som_2030": market.get("som_2030", 0),
                "flagship": meta["flagship"],
                "maturity": meta["maturity"],
                "geographic_focus": market.get("geographic_focus", []),
            }
        return result

    def benchmark_verticals(self) -> Dict[str, Any]:
        """Benchmark all verticals against each other."""
        benchmarks = []
        for vid, v in self.verticals.items():
            score = self._calculate_vertical_score(v)
            benchmarks.append(
                {
                    "vertical_id": vid,
                    "name": v["name"],
                    "platform_count": len(v["platforms"]),
                    "tam": v["tam"],
                    "som_2026": v["som_2026"],
                    "som_2030": v["som_2030"],
                    "maturity": v["maturity"],
                    "score": score,
                    "rank": 0,  # populated below
                }
            )

        # Assign ranks by score descending
        benchmarks.sort(key=lambda b: b["score"], reverse=True)
        for i, b in enumerate(benchmarks, 1):
            b["rank"] = i

        return {
            "generated_at": datetime.now().isoformat(),
            "total_verticals": len(benchmarks),
            "benchmarks": benchmarks,
            "top_verticals": [b["name"] for b in benchmarks[:3]],
            "combined_tam": sum(v["tam"] for v in self.verticals.values()),
            "combined_som_2026": sum(v["som_2026"] for v in self.verticals.values()),
            "combined_som_2030": sum(v["som_2030"] for v in self.verticals.values()),
        }

    def _calculate_vertical_score(self, vertical: Dict[str, Any]) -> float:
        """Calculate a composite score for a vertical (0-100)."""
        maturity_weights = {
            "concept": 10,
            "early": 30,
            "beta": 50,
            "growth": 70,
            "production": 90,
        }

        # Weighted components
        max_tam = max(v["tam"] for v in self.verticals.values()) or 1
        tam_score = min(vertical["tam"] / max_tam, 1.0) * 25
        som_score = min(vertical["som_2030"] / 10_000_000, 1.0) * 25
        maturity_score = maturity_weights.get(vertical["maturity"], 20) * 0.25
        platform_score = min(len(vertical["platforms"]) / 3, 1.0) * 15
        geo_score = min(len(vertical["geographic_focus"]) / 5, 1.0) * 10

        return round(
            tam_score + som_score + maturity_score + platform_score + geo_score, 1
        )

    def get_vertical_detail(self, vertical_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed performance data for a specific vertical."""
        v = self.verticals.get(vertical_id)
        if not v:
            return None

        return {
            "vertical_id": vertical_id,
            "name": v["name"],
            "platforms": v["platforms"],
            "tam": v["tam"],
            "som_2026": v["som_2026"],
            "som_2030": v["som_2030"],
            "growth_rate": (
                round(v["som_2030"] / v["som_2026"], 1) if v["som_2026"] > 0 else 0
            ),
            "maturity": v["maturity"],
            "flagship": v["flagship"],
            "geographic_focus": v["geographic_focus"],
            "score": self._calculate_vertical_score(v),
        }

    def compare_verticals(self, vertical_ids: List[str]) -> Dict[str, Any]:
        """Compare two or more verticals side by side."""
        comparisons = []
        for vid in vertical_ids:
            detail = self.get_vertical_detail(vid)
            if detail:
                comparisons.append(detail)

        return {
            "generated_at": datetime.now().isoformat(),
            "compared_verticals": len(comparisons),
            "comparisons": comparisons,
        }

    def identify_growth_opportunities(self) -> List[Dict[str, Any]]:
        """Identify verticals with highest growth potential."""
        opportunities = []
        for vid, v in self.verticals.items():
            if v["som_2026"] == 0:
                continue
            growth_multiple = v["som_2030"] / v["som_2026"]
            market_penetration = v["som_2030"] / v["tam"] * 100

            opportunities.append(
                {
                    "vertical_id": vid,
                    "name": v["name"],
                    "growth_multiple": round(growth_multiple, 1),
                    "market_penetration_2030_pct": round(market_penetration, 4),
                    "untapped_tam": v["tam"] - v["som_2030"],
                    "recommendation": (
                        "HIGH PRIORITY"
                        if growth_multiple >= 25
                        else "MEDIUM PRIORITY" if growth_multiple >= 15 else "SUSTAIN"
                    ),
                }
            )

        opportunities.sort(key=lambda o: o["growth_multiple"], reverse=True)
        return opportunities


def main():
    """CLI entry point."""
    analyzer = VerticalPerformanceAnalyzer()
    results = analyzer.benchmark_verticals()
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
