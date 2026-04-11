"""
Board Report Generator

Generates quarterly board reports for Nzila Ventures.
"""

import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional


class BoardReporter:
    """Generate quarterly board reports."""
    
    def __init__(self, data_dir: Optional[Path] = None):
        """Initialize board reporter."""
        self.data_dir = data_dir or Path(__file__).parent.parent / "data"
        self.output_dir = self.data_dir.parent / "analytics" / "exports"
        self.output_dir.mkdir(exist_ok=True, parents=True)
    
    def load_portfolio_data(self) -> Dict[str, Any]:
        """Load portfolio data from data directory."""
        # Try to load platform profiles
        profiles_file = self.data_dir / "platform_profiles.json"
        if profiles_file.exists():
            with open(profiles_file) as f:
                return json.load(f)
        return {}
    
    def get_quarter(self, date: Optional[datetime] = None) -> str:
        """Get current quarter string."""
        if date is None:
            date = datetime.now()
        quarter = (date.month - 1) // 3 + 1
        return f"Q{quarter} {date.year}"
    
    def generate_report(self, quarter: Optional[str] = None) -> str:
        """
        Generate a complete board report.
        
        Args:
            quarter: Quarter to report on (defaults to current quarter)
            
        Returns:
            Report markdown content
        """
        if quarter is None:
            quarter = self.get_quarter()
        
        data = self.load_portfolio_data()
        
        # Default data if no profiles exist
        portfolio = data.get("portfolio", {
            "total_platforms": 15,
            "total_verticals": 10,
            "total_entities": 12500,
            "platforms_production": 4,
            "platforms_beta": 3,
            "platforms_development": 8
        })
        
        financial = data.get("financial", {
            "arr_target_2026": 350000,
            "arr_target_2027": 1200000,
            "series_a_target": 4000000,
            "runway_months": 24,
            "total_investment": 4000000
        })
        
        technical = data.get("technical", {
            "avg_production_readiness": 7.8,
            "code_reuse_potential": 65,
            "backbone_completion": 80
        })
        
        report = f"""# 📊 Nzila Ventures - Quarterly Board Report

**Report Date:** {datetime.now().strftime('%B %d, %Y')}  
**Reporting Period:** {quarter}  
**Prepared By:** Analytics & BI Team

---

## 🎯 Executive Summary

### Portfolio Overview
- **Total Platforms:** {portfolio.get('total_platforms', 15)}
- **Business Verticals:** {portfolio.get('total_verticals', 10)}
- **Total Entities:** {portfolio.get('total_entities', 12500):,}
- **Engineering Investment:** ${portfolio.get('investment', 4000000):,}

### Platform Status
- **Production:** {portfolio.get('platforms_production', 4)} platforms
- **Beta:** {portfolio.get('platforms_beta', 3)} platforms  
- **Development:** {portfolio.get('platforms_development', 8)} platforms

### Financial Position
- **2026 ARR Target:** ${financial.get('arr_target_2026', 350000):,}
- **2027 ARR Target:** ${financial.get('arr_target_2027', 1200000):,}
- **Series A Target:** ${financial.get('series_a_target', 4000000):,}
- **Runway:** {financial.get('runway_months', 24)} months

### Technical Health
- **Avg Production Readiness:** {technical.get('avg_production_readiness', 7.8)}/10
- **Code Reuse Potential:** {technical.get('code_reuse_potential', 65)}%
- **Backbone Completion:** {technical.get('backbone_completion', 80)}%

---

## 📈 Portfolio Performance

### Platform Status Summary

| Status | Count | Platforms |
|--------|-------|-----------|
| Production | {portfolio.get('platforms_production', 4)} | CongoWave, ABR Insights, UnionEyes, Lexora |
| Beta | {portfolio.get('platforms_beta', 3)} | CORA, DiasporaCore, Insight CFO |
| Development | {portfolio.get('platforms_development', 8)} | Remaining platforms |

### Top Performing Platforms

1. **CongoWave** - Entertainment - 10.0/10 production readiness
2. **UnionEyes** - Uniontech - 9.5/10 production readiness  
3. **ABR Insights** - EdTech/Legaltech - 9.1/10 production readiness
4. **Lexora** - Legaltech - 8.5/10 production readiness
5. **DiasporaCore** - Fintech - 8.0/10 production readiness

---

## 💰 Financial Summary

### Revenue Metrics

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| ARR (2026) | $0 | ${financial.get('arr_target_2026', 350000):,} | Planning |
| MRR | $0 | $29167 | Planning |
| ARR Growth | - | 243% YoY | Target |

### Fundraising Status

- **Total Investment:** ${financial.get('total_investment', 4000000):,}
- **Series A Target:** ${financial.get('series_a_target', 4000000):,}
- **Runway:** {financial.get('runway_months', 24)} months ({self._calculate_runway_end()})

---

## 🔧 Technical Progress

### Backbone Architecture
- **Status:** {technical.get('backbone_completion', 80)}% Complete
- **Components:**
  - Authentication (Clerk) - ✅ Complete
  - Database (PostgreSQL) - ✅ Complete
  - Storage (Azure Blob) - ✅ Complete
  - API Gateway - 🟡 In Progress
  - CDN - 🟡 In Progress

### Migration Progress
- **Platforms Migrated:** 4 of 15 (27%)
- **Expected Completion:** Q3 2026

---

## 🎯 Strategic Highlights

### Key Achievements This Quarter
1. Launched production-ready platforms (CongoWave, ABR Insights)
2. Achieved 80% backbone architecture completion
3. Expanded to {portfolio.get('total_verticals', 10)} business verticals
4. Generated {portfolio.get('total_entities', 12500):,} orgs across platforms

### Upcoming Milestones
- Q2 2026: Series A preparation
- Q3 2026: Complete backbone migration
- Q4 2026: Achieve $350K ARR target

---

## ⚠️ Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Funding Gap | High | Accelerate Series A preparation |
| Technical Debt | Medium | Backbone completion by Q3 |
| Resource Constraints | Medium | Prioritize production platforms |

---

## 📋 Board Action Items

1. Approve Q2 2026 budget allocation
2. Review Series A timeline and targets
3. Approve new platform prioritization criteria
4. Discuss strategic partnerships

---

*Next Board Meeting: {self._next_board_meeting()}*

---
**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
**Nzila Ventures - Building Africa's Digital Future**
"""
        
        return report
    
    def _calculate_runway_end(self) -> str:
        """Calculate runway end date."""
        runway_months = 24
        end_date = datetime.now() + timedelta(days=runway_months * 30)
        return end_date.strftime('%B %Y')
    
    def _next_board_meeting(self) -> str:
        """Calculate next board meeting date (quarterly)."""
        now = datetime.now()
        quarter = (now.month - 1) // 3 + 1
        next_quarter = quarter + 1
        next_year = now.year
        
        if next_quarter > 4:
            next_quarter = 1
            next_year += 1
            
        month = (next_quarter - 1) * 3 + 1
        meeting_date = datetime(next_year, month, 15)
        
        return meeting_date.strftime('%B %d, %Y')
    
    def save_report(self, quarter: Optional[str] = None) -> Path:
        """Generate and save report to file."""
        report = self.generate_report(quarter)
        
        filename = f"BOARD_REPORT_{datetime.now().strftime('%Y%m%d')}.md"
        output_path = self.output_dir / filename
        
        output_path.write_text(report, encoding='utf-8')
        
        return output_path
    
    def generate_summary_cards(self) -> List[Dict[str, Any]]:
        """Generate summary cards for dashboard display."""
        data = self.load_portfolio_data()
        
        return [
            {
                "title": "Total Platforms",
                "value": data.get("portfolio", {}).get("total_platforms", 15),
                "change": "+2",
                "trend": "up"
            },
            {
                "title": "Production Ready",
                "value": data.get("portfolio", {}).get("platforms_production", 4),
                "change": "+1",
                "trend": "up"
            },
            {
                "title": "ARR Target 2026",
                "value": f"${data.get('financial', {}).get('arr_target_2026', 350000):,}",
                "change": "243% growth",
                "trend": "target"
            },
            {
                "title": "Runway",
                "value": f"{data.get('financial', {}).get('runway_months', 24)} months",
                "change": "On track",
                "trend": "stable"
            }
        ]


def generate_board_report(quarter: Optional[str] = None) -> str:
    """Convenience function to generate a board report."""
    reporter = BoardReporter()
    return reporter.generate_report(quarter)


if __name__ == "__main__":
    reporter = BoardReporter()
    report = reporter.generate_report()
    print(report)
    print(f"\n[Report saved to: {reporter.save_report()}]")
