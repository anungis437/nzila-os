"""
Network Effects Tracker
Track and quantify network effects across the Nzila portfolio
"""

import json
from datetime import datetime
from typing import Any, Dict, List


class NetworkEffectsTracker:
    """Track platform network effects and cross-portfolio synergies."""

    def __init__(self):
        self.platforms = self._load_platform_network_data()
        self.cross_platform_links = self._define_cross_platform_links()

    def _load_platform_network_data(self) -> Dict[str, Dict[str, Any]]:
        """Load network effect data for each platform."""
        return {
            "union_eyes": {
                "name": "Union Eyes",
                "network_type": "two_sided",  # unions + members
                "supply_side": "unions",
                "demand_side": "members",
                "supply_count_2026": 25,
                "demand_count_2026": 3000,
                "network_density": 0.65,
                "viral_coefficient": 1.2,
                "data_network_effect": True,
                "shared_services": ["auth", "payments", "notifications", "analytics", "ai_companion"],
            },
            "abr_insights": {
                "name": "ABR Insights",
                "network_type": "two_sided",  # organizations + employees
                "supply_side": "organizations",
                "demand_side": "employees",
                "supply_count_2026": 50,
                "demand_count_2026": 5000,
                "network_density": 0.45,
                "viral_coefficient": 0.9,
                "data_network_effect": True,
                "shared_services": ["auth", "notifications", "analytics", "ai_companion", "gamification"],
            },
            "cora": {
                "name": "CORA",
                "network_type": "marketplace",
                "supply_side": "farms",
                "demand_side": "buyers",
                "supply_count_2026": 100,
                "demand_count_2026": 500,
                "network_density": 0.30,
                "viral_coefficient": 0.7,
                "data_network_effect": True,
                "shared_services": ["auth", "payments", "notifications", "analytics"],
            },
            "congowave": {
                "name": "CongoWave",
                "network_type": "two_sided",  # artists + listeners
                "supply_side": "artists",
                "demand_side": "listeners",
                "supply_count_2026": 200,
                "demand_count_2026": 10000,
                "network_density": 0.20,
                "viral_coefficient": 1.5,
                "data_network_effect": True,
                "shared_services": ["auth", "payments", "notifications", "analytics"],
            },
            "c3uo": {
                "name": "DiasporaCore V2",
                "network_type": "two_sided",  # senders + receivers
                "supply_side": "senders",
                "demand_side": "receivers",
                "supply_count_2026": 1000,
                "demand_count_2026": 2000,
                "network_density": 0.55,
                "viral_coefficient": 1.3,
                "data_network_effect": False,
                "shared_services": ["auth", "payments", "notifications", "analytics", "compliance"],
            },
            "trade_os": {
                "name": "Trade OS",
                "network_type": "marketplace",
                "supply_side": "exporters",
                "demand_side": "importers",
                "supply_count_2026": 60,
                "demand_count_2026": 200,
                "network_density": 0.35,
                "viral_coefficient": 0.8,
                "data_network_effect": True,
                "shared_services": ["auth", "payments", "notifications", "analytics", "documents"],
            },
            "sentryiq": {
                "name": "SentryIQ360",
                "network_type": "single_sided",
                "supply_side": "insurance_cos",
                "demand_side": "claims",
                "supply_count_2026": 5,
                "demand_count_2026": 5000,
                "network_density": 0.70,
                "viral_coefficient": 0.5,
                "data_network_effect": True,
                "shared_services": ["auth", "notifications", "analytics", "ai_companion", "documents"],
            },
            "court_lens": {
                "name": "Court Lens",
                "network_type": "single_sided",
                "supply_side": "law_firms",
                "demand_side": "cases",
                "supply_count_2026": 30,
                "demand_count_2026": 3000,
                "network_density": 0.50,
                "viral_coefficient": 0.6,
                "data_network_effect": True,
                "shared_services": ["auth", "notifications", "analytics", "documents"],
            },
        }

    def _define_cross_platform_links(self) -> List[Dict[str, Any]]:
        """Define cross-platform network links and synergies."""
        return [
            {
                "source": "cora",
                "target": "ponduops",
                "link_type": "data_sharing",
                "strength": 0.9,
                "description": "Shared farm data and supply chain",
            },
            {
                "source": "trade_os",
                "target": "eexports",
                "link_type": "workflow_integration",
                "strength": 0.85,
                "description": "Trade order to export documentation flow",
            },
            {
                "source": "c3uo",
                "target": "stsa",
                "link_type": "shared_compliance",
                "strength": 0.7,
                "description": "Shared KYC/AML and financial compliance",
            },
            {
                "source": "c3uo",
                "target": "insight_cfo",
                "link_type": "financial_data",
                "strength": 0.6,
                "description": "Transaction data feeding CFO analytics",
            },
            {
                "source": "union_eyes",
                "target": "abr_insights",
                "link_type": "content_sharing",
                "strength": 0.5,
                "description": "Training content for union members",
            },
            {
                "source": "court_lens",
                "target": "abr_insights",
                "link_type": "legal_data",
                "strength": 0.4,
                "description": "Legal research for tribunal cases",
            },
        ]

    def calculate_network_effects(self) -> Dict[str, Any]:
        """Calculate network effect metrics across the portfolio."""
        platform_scores = []

        for pid, p in self.platforms.items():
            score = self._calculate_platform_network_score(pid, p)
            platform_scores.append({
                "platform_id": pid,
                "name": p["name"],
                "network_type": p["network_type"],
                "network_score": score,
                "viral_coefficient": p["viral_coefficient"],
                "data_network_effect": p["data_network_effect"],
                "shared_service_count": len(p["shared_services"]),
                "cross_platform_links": self._count_links(pid),
            })

        platform_scores.sort(key=lambda s: s["network_score"], reverse=True)

        return {
            "generated_at": datetime.now().isoformat(),
            "total_platforms_analyzed": len(platform_scores),
            "platform_network_scores": platform_scores,
            "portfolio_network_density": self._calculate_portfolio_density(),
            "cross_platform_links": len(self.cross_platform_links),
            "shared_service_coverage": self._calculate_shared_service_coverage(),
            "network_effect_strength": self._classify_portfolio_network(),
        }

    def _calculate_platform_network_score(
        self, platform_id: str, platform: Dict[str, Any]
    ) -> float:
        """Calculate a network effect score for a platform (0-100)."""
        # Viral coefficient contribution (0-30)
        viral_score = min(platform["viral_coefficient"] / 2.0, 1.0) * 30

        # Network density contribution (0-25)
        density_score = platform["network_density"] * 25

        # Data network effect bonus (0-15)
        data_score = 15 if platform["data_network_effect"] else 0

        # Cross-platform link contribution (0-15)
        link_count = self._count_links(platform_id)
        link_score = min(link_count / 3, 1.0) * 15

        # Shared services contribution (0-15)
        service_score = min(len(platform["shared_services"]) / 6, 1.0) * 15

        return round(viral_score + density_score + data_score + link_score + service_score, 1)

    def _count_links(self, platform_id: str) -> int:
        """Count cross-platform links for a platform."""
        return sum(
            1
            for link in self.cross_platform_links
            if link["source"] == platform_id or link["target"] == platform_id
        )

    def _calculate_portfolio_density(self) -> float:
        """Calculate overall portfolio network density."""
        total_platforms = len(self.platforms)
        max_links = total_platforms * (total_platforms - 1) / 2
        actual_links = len(self.cross_platform_links)
        return round(actual_links / max_links, 3) if max_links > 0 else 0

    def _calculate_shared_service_coverage(self) -> Dict[str, int]:
        """Calculate how many platforms share each backbone service."""
        service_counts: Dict[str, int] = {}
        for p in self.platforms.values():
            for svc in p["shared_services"]:
                service_counts[svc] = service_counts.get(svc, 0) + 1
        return dict(sorted(service_counts.items(), key=lambda x: x[1], reverse=True))

    def _classify_portfolio_network(self) -> str:
        """Classify the overall portfolio network effect strength."""
        density = self._calculate_portfolio_density()
        avg_viral = sum(
            p["viral_coefficient"] for p in self.platforms.values()
        ) / len(self.platforms)

        if density > 0.3 and avg_viral > 1.0:
            return "STRONG"
        elif density > 0.15 or avg_viral > 0.8:
            return "MODERATE"
        else:
            return "EMERGING"


def main():
    """CLI entry point."""
    tracker = NetworkEffectsTracker()
    results = tracker.calculate_network_effects()
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
