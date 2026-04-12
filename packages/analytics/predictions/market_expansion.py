"""
Market Expansion Analyzer
Assess market opportunities, prioritize expansion, and estimate TAM/SAM/SOM
"""

import json
import os
from datetime import datetime
from typing import Dict, List, Optional

_DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "market_data.json")


def _load_market_data() -> Dict:
    """Load market data from the shared JSON config."""
    with open(_DATA_PATH, "r") as f:
        return json.load(f)


class MarketExpansionAnalyzer:
    """Analyze market expansion opportunities across verticals and geographies"""

    def __init__(self):
        data = _load_market_data()
        self.vertical_markets = data["vertical_markets"]
        self.geographic_markets = data["geographic_markets"]
        self._synergies = data.get("synergies", [])
        self._scoring_weights = data.get(
            "scoring_weights",
            {
                "tam_size": 0.25,
                "competitive_intensity": 0.20,
                "go_to_market_fit": 0.20,
                "regulatory_barriers": 0.15,
                "som_growth_rate": 0.20,
            },
        )

    def calculate_tam_sam_som(self, vertical_id: str, year: int = 2026) -> Dict:
        """Calculate TAM/SAM/SOM for specific vertical and year"""
        if vertical_id not in self.vertical_markets:
            return {"error": f"Vertical {vertical_id} not found"}

        vertical = self.vertical_markets[vertical_id]

        # Linear interpolation for SOM between 2026 and 2030
        if year < 2026:
            som = 0
        elif year > 2030:
            som = vertical["som_2030"]
        else:
            years_elapsed = year - 2026
            som_growth = (vertical["som_2030"] - vertical["som_2026"]) / 4
            som = vertical["som_2026"] + (som_growth * years_elapsed)

        # Market penetration calculations
        sam_penetration = (som / vertical["sam"]) * 100 if vertical["sam"] > 0 else 0
        tam_penetration = (som / vertical["tam"]) * 100 if vertical["tam"] > 0 else 0

        return {
            "vertical": vertical["name"],
            "year": year,
            "tam": vertical["tam"],
            "sam": vertical["sam"],
            "som": int(som),
            "sam_penetration_pct": round(sam_penetration, 4),
            "tam_penetration_pct": round(tam_penetration, 6),
            "geographic_focus": vertical["geographic_focus"],
            "competitive_intensity": vertical["competitive_intensity"],
            "go_to_market_fit": vertical["go_to_market_fit"],
        }

    def market_prioritization_matrix(self) -> List[Dict]:
        """Generate market prioritization matrix for all verticals"""
        scoring_weights = self._scoring_weights

        intensity_scores = {
            "LOW": 90,
            "MEDIUM-LOW": 75,
            "MEDIUM": 60,
            "MEDIUM-HIGH": 45,
            "HIGH": 30,
            "EXTREME": 10,
        }
        fit_scores = {
            "LOW": 20,
            "LOW-MEDIUM": 40,
            "MEDIUM": 60,
            "MEDIUM-HIGH": 80,
            "HIGH": 100,
        }

        results = []

        for vertical_id, vertical in self.vertical_markets.items():
            # TAM size score (normalized by largest TAM in dataset)
            max_tam = max(v["tam"] for v in self.vertical_markets.values())
            tam_score = (vertical["tam"] / max_tam) * 100

            # Competitive intensity score (inverted - lower intensity = higher score)
            competitive_score = intensity_scores.get(
                vertical["competitive_intensity"], 60
            )

            # Go-to-market fit score
            gtm_score = fit_scores.get(vertical["go_to_market_fit"], 60)

            # Regulatory barriers score (inverted)
            regulatory_score = intensity_scores.get(vertical["regulatory_barriers"], 60)

            # SOM growth rate (2026 to 2030 CAGR)
            som_2026 = vertical["som_2026"]
            som_2030 = vertical["som_2030"]
            cagr = ((som_2030 / som_2026) ** (1 / 4) - 1) * 100 if som_2026 > 0 else 0
            growth_score = min(cagr * 2, 100)  # Cap at 100

            # Weighted priority score
            priority_score = (
                tam_score * scoring_weights["tam_size"]
                + competitive_score * scoring_weights["competitive_intensity"]
                + gtm_score * scoring_weights["go_to_market_fit"]
                + regulatory_score * scoring_weights["regulatory_barriers"]
                + growth_score * scoring_weights["som_growth_rate"]
            )

            results.append(
                {
                    "vertical": vertical["name"],
                    "vertical_id": vertical_id,
                    "priority_score": round(priority_score, 1),
                    "tam": vertical["tam"],
                    "som_2026": vertical["som_2026"],
                    "som_2030": vertical["som_2030"],
                    "cagr_pct": round(cagr, 1),
                    "competitive_intensity": vertical["competitive_intensity"],
                    "go_to_market_fit": vertical["go_to_market_fit"],
                    "recommendation": self._get_expansion_recommendation(
                        priority_score
                    ),
                }
            )

        # Sort by priority score descending
        results.sort(key=lambda x: x["priority_score"], reverse=True)

        return results

    def _get_expansion_recommendation(self, priority_score: float) -> str:
        """Get expansion recommendation based on priority score"""
        if priority_score >= 75:
            return "ACCELERATE - Double down on this vertical"
        elif priority_score >= 60:
            return "INVEST - Continue strong investment"
        elif priority_score >= 45:
            return "MAINTAIN - Steady investment, monitor metrics"
        elif priority_score >= 30:
            return "OPTIMIZE - Reduce cost, focus on efficiency"
        else:
            return "DIVEST - Consider strategic exit or pivot"

    def geographic_expansion_readiness(
        self, target_geography: str, vertical_id: str
    ) -> Dict:
        """Assess readiness for geographic expansion"""
        if target_geography not in self.geographic_markets:
            return {"error": f"Geography {target_geography} not found"}

        if vertical_id not in self.vertical_markets:
            return {"error": f"Vertical {vertical_id} not found"}

        geo = self.geographic_markets[target_geography]
        vertical = self.vertical_markets[vertical_id]

        # Readiness assessment
        readiness_factors = {
            "product_market_fit": "UNKNOWN",  # Requires validation
            "regulatory_compliance": "NOT_STARTED",
            "local_partnerships": "NOT_STARTED",
            "market_research": "NOT_STARTED",
            "sales_infrastructure": "NOT_STARTED",
            "localization": "NOT_STARTED",
        }

        # Market opportunity estimate
        base_som = vertical["som_2026"]
        geographic_som = base_som * geo["market_size_modifier"]

        return {
            "target_geography": geo["name"],
            "vertical": vertical["name"],
            "expansion_priority": geo["expansion_priority"],
            "ease_of_entry": geo["ease_of_entry"],
            "estimated_som_2026": int(geographic_som),
            "market_size_vs_canada": f"{geo['market_size_modifier']}x",
            "regulatory_environment": geo["regulatory_environment"],
            "readiness_assessment": readiness_factors,
            "recommended_entry_date": geo.get("recommended_entry_date", "TBD"),
            "next_steps": self._get_geographic_next_steps(geo, vertical),
        }

    def _get_geographic_next_steps(self, geo: Dict, vertical: Dict) -> List[str]:
        """Get recommended next steps for geographic expansion"""
        steps = []

        if geo["expansion_priority"] == "HIGH":
            steps.append("Conduct detailed market research (TAM/SAM validation)")
            steps.append("Identify and engage local strategic partners")
            steps.append("Regulatory compliance assessment (legal counsel)")
            steps.append("Localization requirements (language, payment, support)")
            steps.append("Pilot customer identification (beta program)")
            steps.append("Establish local sales/support infrastructure")
        elif geo["expansion_priority"] == "MEDIUM":
            steps.append("Monitor market developments quarterly")
            steps.append("Build relationships with potential local partners")
            steps.append("Track regulatory changes")
        else:  # LOW priority
            steps.append("Monitor annually")
            steps.append("Re-evaluate in 2028")

        return steps

    def vertical_expansion_synergies(self) -> List[Dict]:
        """Identify cross-vertical expansion synergies"""
        return self._synergies


def main():
    """Example usage"""
    analyzer = MarketExpansionAnalyzer()

    # TAM/SAM/SOM analysis
    uniontech_market = analyzer.calculate_tam_sam_som("uniontech", 2026)
    print(json.dumps(uniontech_market, indent=2))

    # Market prioritization matrix
    priority_matrix = analyzer.market_prioritization_matrix()
    print(json.dumps(priority_matrix, indent=2))

    # Geographic expansion readiness
    usa_expansion = analyzer.geographic_expansion_readiness("usa", "uniontech")
    print(json.dumps(usa_expansion, indent=2))

    # Vertical synergies
    synergies = analyzer.vertical_expansion_synergies()
    print(json.dumps(synergies, indent=2))


if __name__ == "__main__":
    main()
