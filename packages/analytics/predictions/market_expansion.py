"""
Market Expansion Analyzer
Assess market opportunities, prioritize expansion, and estimate TAM/SAM/SOM
"""

import json
from datetime import datetime
from typing import Dict, List, Optional

class MarketExpansionAnalyzer:
    """Analyze market expansion opportunities across verticals and geographies"""
    
    def __init__(self):
        # TAM/SAM/SOM data by vertical (USD)
        self.vertical_markets = {
            "uniontech": {
                "name": "Uniontech",
                "tam": 50_000_000_000,  # $50B (global union management software)
                "sam": 2_500_000_000,  # $2.5B (North America focus)
                "som_2026": 350_000,  # $350K (Union Eyes initial capture)
                "som_2030": 10_000_000,  # $10M (aggressive growth)
                "geographic_focus": ["Canada", "USA"],
                "competitive_intensity": "MEDIUM",
                "regulatory_barriers": "MEDIUM",
                "go_to_market_fit": "HIGH"
            },
            "dei_training": {
                "name": "DEI/Anti-Bias Training",
                "tam": 1_500_000_000,  # $1.5B (corporate training market)
                "sam": 300_000_000,  # $300M (SMB + enterprise focus)
                "som_2026": 420_000,  # $420K (ABR Insights)
                "som_2030": 8_000_000,  # $8M
                "geographic_focus": ["Canada", "USA", "UK"],
                "competitive_intensity": "HIGH",
                "regulatory_barriers": "LOW",
                "go_to_market_fit": "MEDIUM"
            },
            "agrotech": {
                "name": "AgTech Supply Chain",
                "tam": 8_600_000_000,  # $8.6B (farm management software)
                "sam": 500_000_000,  # $500M (smallholder farmers)
                "som_2026": 300_000,  # $300K (CORA + PonduOps)
                "som_2030": 6_000_000,  # $6M
                "geographic_focus": ["Canada", "USA", "Kenya", "Nigeria"],
                "competitive_intensity": "MEDIUM-HIGH",
                "regulatory_barriers": "LOW",
                "go_to_market_fit": "MEDIUM"
            },
            "fintech_remittance": {
                "name": "Fintech Remittance",
                "tam": 15_000_000_000,  # $15B (diaspora remittance market)
                "sam": 1_000_000_000,  # $1B (African diaspora to Canada/USA)
                "som_2026": 200_000,  # $200K (DiasporaCore)
                "som_2030": 5_000_000,  # $5M
                "geographic_focus": ["Canada", "USA", "UK", "DRC", "Kenya", "Nigeria"],
                "competitive_intensity": "EXTREME",
                "regulatory_barriers": "HIGH",
                "go_to_market_fit": "MEDIUM"
            },
            "insurtech": {
                "name": "Insurtech Claims Automation",
                "tam": 12_000_000_000,  # $12B (insurance tech)
                "sam": 800_000_000,  # $800M (claims processing automation)
                "som_2026": 150_000,  # $150K (SentryIQ)
                "som_2030": 4_000_000,  # $4M
                "geographic_focus": ["Canada", "USA"],
                "competitive_intensity": "HIGH",
                "regulatory_barriers": "HIGH",
                "go_to_market_fit": "LOW-MEDIUM"
            },
            "legaltech": {
                "name": "Legaltech Research",
                "tam": 7_000_000_000,  # $7B (legal tech market)
                "sam": 500_000_000,  # $500M (legal research tools)
                "som_2026": 180_000,  # $180K (Court Lens)
                "som_2030": 3_500_000,  # $3.5M
                "geographic_focus": ["Canada"],
                "competitive_intensity": "HIGH",
                "regulatory_barriers": "MEDIUM",
                "go_to_market_fit": "MEDIUM"
            },
            "trade_commerce": {
                "name": "Trade & Commerce",
                "tam": 10_000_000_000,  # $10B (B2B trade platforms)
                "sam": 600_000_000,  # $600M (cross-border trade SMBs)
                "som_2026": 250_000,  # $250K (Trade OS, Shop Quoter, eEXPORTS)
                "som_2030": 4_500_000,  # $4.5M
                "geographic_focus": ["Canada", "USA", "Africa"],
                "competitive_intensity": "MEDIUM",
                "regulatory_barriers": "MEDIUM",
                "go_to_market_fit": "MEDIUM-HIGH"
            },
            "entertainment_streaming": {
                "name": "Entertainment Streaming",
                "tam": 25_000_000_000,  # $25B (music streaming)
                "sam": 500_000_000,  # $500M (African music streaming)
                "som_2026": 100_000,  # $100K (CongoWave)
                "som_2030": 2_000_000,  # $2M
                "geographic_focus": ["Canada", "USA", "DRC", "francophone Africa"],
                "competitive_intensity": "EXTREME",
                "regulatory_barriers": "MEDIUM",
                "go_to_market_fit": "LOW"
            },
            "virtual_cfo": {
                "name": "Virtual CFO Services",
                "tam": 3_500_000_000,  # $3.5B (fractional CFO market)
                "sam": 200_000_000,  # $200M (SMB focus)
                "som_2026": 80_000,  # $80K (Insight CFO)
                "som_2030": 1_500_000,  # $1.5M
                "geographic_focus": ["Canada"],
                "competitive_intensity": "MEDIUM",
                "regulatory_barriers": "LOW",
                "go_to_market_fit": "MEDIUM"
            },
            "healthtech": {
                "name": "HealthTech AI Companions",
                "tam": 20_000_000_000,  # $20B (health tech AI)
                "sam": 1_000_000_000,  # $1B (mental health + senior care)
                "som_2026": 120_000,  # $120K (Memora)
                "som_2030": 3_000_000,  # $3M
                "geographic_focus": ["Canada", "USA"],
                "competitive_intensity": "HIGH",
                "regulatory_barriers": "HIGH",
                "go_to_market_fit": "MEDIUM"
            },
            "edtech": {
                "name": "EdTech Skills Training",
                "tam": 6_000_000_000,  # $6B (cybersecurity training)
                "sam": 400_000_000,  # $400M (SMB + workforce development)
                "som_2026": 90_000,  # $90K (CyberLearn)
                "som_2030": 1_800_000,  # $1.8M
                "geographic_focus": ["Canada", "USA"],
                "competitive_intensity": "HIGH",
                "regulatory_barriers": "LOW",
                "go_to_market_fit": "MEDIUM"
            }
        }
        
        # Geographic expansion priorities
        self.geographic_markets = {
            "canada": {
                "name": "Canada",
                "market_size_modifier": 1.0,  # Base market
                "ease_of_entry": "HIGH",
                "regulatory_environment": "Familiar",
                "current_platforms": 15,  # All platforms
                "expansion_priority": "PRIMARY"
            },
            "usa": {
                "name": "United States",
                "market_size_modifier": 10.0,  # 10x Canada market
                "ease_of_entry": "MEDIUM",
                "regulatory_environment": "State-by-state complexity",
                "current_platforms": 0,
                "expansion_priority": "HIGH",
                "recommended_entry_date": "2027-Q1"
            },
            "uk": {
                "name": "United Kingdom",
                "market_size_modifier": 2.5,
                "ease_of_entry": "MEDIUM",
                "regulatory_environment": "GDPR compliance required",
                "current_platforms": 0,
                "expansion_priority": "MEDIUM",
                "recommended_entry_date": "2028-Q1"
            },
            "kenya": {
                "name": "Kenya",
                "market_size_modifier": 0.5,
                "ease_of_entry": "MEDIUM-HIGH",
                "regulatory_environment": "Mobile-first, M-Pesa integration critical",
                "current_platforms": 0,
                "expansion_priority": "MEDIUM",
                "recommended_entry_date": "2027-Q3",
                "strategic_verticals": ["agrotech", "fintech_remittance"]
            },
            "nigeria": {
                "name": "Nigeria",
                "market_size_modifier": 1.0,
                "ease_of_entry": "MEDIUM",
                "regulatory_environment": "Complex, partnership-driven",
                "current_platforms": 0,
                "expansion_priority": "MEDIUM",
                "recommended_entry_date": "2028-Q2",
                "strategic_verticals": ["agrotech", "fintech_remittance"]
            },
            "drc": {
                "name": "Democratic Republic of Congo",
                "market_size_modifier": 0.3,
                "ease_of_entry": "LOW",
                "regulatory_environment": "High complexity, local partners essential",
                "current_platforms": 0,
                "expansion_priority": "LOW",
                "recommended_entry_date": "2029-Q1",
                "strategic_verticals": ["fintech_remittance", "entertainment_streaming"]
            }
        }
    
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
            "go_to_market_fit": vertical["go_to_market_fit"]
        }
    
    def market_prioritization_matrix(self) -> List[Dict]:
        """Generate market prioritization matrix for all verticals"""
        # Scoring model (0-100)
        scoring_weights = {
            "tam_size": 0.25,
            "competitive_intensity": 0.20,  # Lower is better
            "go_to_market_fit": 0.20,  # Higher is better
            "regulatory_barriers": 0.15,  # Lower is better
            "som_growth_rate": 0.20  # Higher is better
        }
        
        intensity_scores = {"LOW": 90, "MEDIUM-LOW": 75, "MEDIUM": 60, "MEDIUM-HIGH": 45, "HIGH": 30, "EXTREME": 10}
        fit_scores = {"LOW": 20, "LOW-MEDIUM": 40, "MEDIUM": 60, "MEDIUM-HIGH": 80, "HIGH": 100}
        
        results = []
        
        for vertical_id, vertical in self.vertical_markets.items():
            # TAM size score (normalized 0-100)
            max_tam = 50_000_000_000
            tam_score = (vertical["tam"] / max_tam) * 100
            
            # Competitive intensity score (inverted - lower intensity = higher score)
            competitive_score = intensity_scores.get(vertical["competitive_intensity"], 60)
            
            # Go-to-market fit score
            gtm_score = fit_scores.get(vertical["go_to_market_fit"], 60)
            
            # Regulatory barriers score (inverted)
            regulatory_score = intensity_scores.get(vertical["regulatory_barriers"], 60)
            
            # SOM growth rate (2026 to 2030 CAGR)
            som_2026 = vertical["som_2026"]
            som_2030 = vertical["som_2030"]
            cagr = ((som_2030 / som_2026) ** (1/4) - 1) * 100 if som_2026 > 0 else 0
            growth_score = min(cagr * 2, 100)  # Cap at 100
            
            # Weighted priority score
            priority_score = (
                tam_score * scoring_weights["tam_size"] +
                competitive_score * scoring_weights["competitive_intensity"] +
                gtm_score * scoring_weights["go_to_market_fit"] +
                regulatory_score * scoring_weights["regulatory_barriers"] +
                growth_score * scoring_weights["som_growth_rate"]
            )
            
            results.append({
                "vertical": vertical["name"],
                "vertical_id": vertical_id,
                "priority_score": round(priority_score, 1),
                "tam": vertical["tam"],
                "som_2026": vertical["som_2026"],
                "som_2030": vertical["som_2030"],
                "cagr_pct": round(cagr, 1),
                "competitive_intensity": vertical["competitive_intensity"],
                "go_to_market_fit": vertical["go_to_market_fit"],
                "recommendation": self._get_expansion_recommendation(priority_score)
            })
        
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
    
    def geographic_expansion_readiness(self, target_geography: str, vertical_id: str) -> Dict:
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
            "localization": "NOT_STARTED"
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
            "next_steps": self._get_geographic_next_steps(geo, vertical)
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
        synergies = [
            {
                "synergy_id": "edtech_legaltech_ai",
                "verticals": ["dei_training", "legaltech"],
                "platforms": ["ABR Insights", "Court Lens"],
                "opportunity": "Shared AI-powered legal research and training modules",
                "estimated_arr_potential": 200_000,
                "implementation_effort": "MEDIUM",
                "timeline": "2026-Q3"
            },
            {
                "synergy_id": "agrotech_consolidation",
                "verticals": ["agrotech"],
                "platforms": ["CORA", "PonduOps"],
                "opportunity": "Unified supply chain management (farm to distributor)",
                "estimated_arr_potential": 150_000,
                "implementation_effort": "HIGH",
                "timeline": "2027-Q1"
            },
            {
                "synergy_id": "fintech_commerce_payments",
                "verticals": ["fintech_remittance", "trade_commerce"],
                "platforms": ["DiasporaCore", "Trade OS", "Shop Quoter"],
                "opportunity": "Unified payment gateway (remittance + cross-border trade)",
                "estimated_arr_potential": 100_000,
                "implementation_effort": "HIGH",
                "timeline": "2027-Q2"
            },
            {
                "synergy_id": "edtech_entertainment_gamification",
                "verticals": ["dei_training", "edtech", "entertainment_streaming"],
                "platforms": ["ABR Insights", "CyberLearn", "CongoWave"],
                "opportunity": "Shared gamification engine (badges, leaderboards, social)",
                "estimated_arr_potential": 80_000,
                "implementation_effort": "MEDIUM",
                "timeline": "2026-Q4"
            }
        ]
        
        return synergies


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
