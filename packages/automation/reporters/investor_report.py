"""
Investor Report Generator

Generates investor update reports for Nzila Ventures.
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional


class InvestorReporter:
    """Generate investor update reports."""
    
    def __init__(self, data_dir: Optional[Path] = None):
        """Initialize investor reporter."""
        self.data_dir = data_dir or Path(__file__).parent.parent / "data"
        self.output_dir = self.data_dir.parent / "analytics" / "exports"
        self.output_dir.mkdir(exist_ok=True, parents=True)
    
    def load_data(self) -> Dict[str, Any]:
        """Load portfolio and financial data."""
        profiles_file = self.data_dir / "platform_profiles.json"
        if profiles_file.exists():
            with open(profiles_file) as f:
                return json.load(f)
        return {}
    
    def generate_investor_update(self, month: Optional[str] = None) -> str:
        """
        Generate monthly investor update.
        
        Args:
            month: Month to report on (defaults to current)
            
        Returns:
            Report markdown content
        """
        if month is None:
            month = datetime.now().strftime('%B %Y')
        
        data = self.load_data()
        
        # Default values
        platforms = data.get("platforms", [
            {"name": "CongoWave", "status": "production", "vertical": "Entertainment"},
            {"name": "ABR Insights", "status": "production", "vertical": "EdTech/Legaltech"},
            {"name": "UnionEyes", "status": "development", "vertical": "Uniontech"},
            {"name": "Lexora", "status": "production", "vertical": "Legaltech"},
            {"name": "CORA", "status": "beta", "vertical": "Agrotech"}
        ])
        
        financial = data.get("financial", {
            "total_raised": 4000000,
            "arr_target": 350000,
            "runway": 24,
            "series_a_target": 4000000
        })
        
        report = f"""# Nzila Ventures - Investor Update

## {month}

---

### 🚀 Highlights

- **4 platforms in production** - CongoWave, ABR Insights, Lexora, and partner integrations
- **10+ business verticals** serving African markets
- **$4M+ engineering investment** deployed
- **$100B+ TAM** across all verticals
- **Backbone architecture 80% complete**

---

### 📊 Portfolio Performance

#### Production Platforms
"""
        
        production = [p for p in platforms if p.get("status") == "production"]
        for p in production:
            report += f"- **{p.get('name')}** ({p.get('vertical')}) - Live\n"
        
        report += """
#### Beta Platforms
"""
        beta = [p for p in platforms if p.get("status") == "beta"]
        for p in beta:
            report += f"- **{p.get('name')}** ({p.get('vertical')}) - Testing\n"
        
        report += """
#### Development
"""
        dev = [p for p in platforms if p.get("status") == "development"]
        for p in dev:
            report += f"- **{p.get('name')}** ({p.get('vertical')}) - In Progress\n"
        
        report += f"""

---

### 💰 Financial Position

| Metric | Status |
|--------|--------|
| Total Investment | ${financial.get('total_raised', 4000000):,} |
| 2026 ARR Target | ${financial.get('arr_target', 350000):,} |
| Series A Target | ${financial.get('series_a_target', 4000000):,} |
| Runway | {financial.get('runway', 24)} months |

---

### 🎯 Milestones Achieved

1. ✅ **Platform Launch** - CongoWave reached 10K users
2. ✅ **Technical Foundation** - Backbone architecture 80% complete
3. ✅ **Market Expansion** - Expanded to 10+ verticals
4. ✅ **Team Growth** - Engineering team scaled to 8+ members

---

### 📈 Traction & Metrics

- **Total Entities:** 12,500+
- **Platforms:** 15 across 10+ verticals
- **Code Reuse:** 80% via backbone architecture
- **Production Readiness:** Average 7.8/10

---

### 🔮 Looking Ahead

**Q2 2026 Priorities:**
- Series A preparation
- ARR growth to $350K
- Complete backbone migration
- Launch 2 additional platforms

---

### 🙏 Thank You

Your support makes it possible to build Africa's digital infrastructure. 
We're excited to continue this journey together.

---

*Best regards,*  
*The Nzila Team*

**Contact:** investors@nzila.ventures
"""
        
        return report
    
    def generate_cap_table(self) -> str:
        """Generate cap table summary."""
        return """# Cap Table Summary

| Shareholder | Shares | % | Type |
|-------------|--------|---|------|
| Founders | 8,000,000 | 80% | Common |
| Angel Investors | 1,500,000 | 15% | Common |
| Option Pool | 500,000 | 5% | Options |
| **Total** | **10,000,000** | **100%** | |

---

### Post-Series A Projection (Target: $4M)

| Shareholder | Pre-Money | Post-Money | % |
|-------------|-----------|------------|---|
| Existing | $4M | $4M | 50% |
| Series A | $4M | $4M | 50% |
"""
    
    def generate_deck_summary(self) -> str:
        """Generate one-pager summary for investor meetings."""
        return """# Nzila Ventures - Investor One-Pager

## The Opportunity
- **$100B+ TAM** across 10+ verticals in African markets
- **15 platforms** in portfolio
- **$4M+ engineering investment** deployed

## Traction
- 4 platforms in production
- 12,500+ orgs generated
- 80% code reuse via backbone architecture

## Ask
- **Series A:** $4M
- **Timeline:** Q2 2026
- **Use of Funds:** Scale to 20 platforms, expand team, accelerate growth

## Contact
investors@nzila.ventures
"""
    
    def save_update(self, month: Optional[str] = None) -> Path:
        """Generate and save investor update."""
        update = self.generate_investor_update(month)
        
        filename = f"INVESTOR_UPDATE_{datetime.now().strftime('%Y%m')}.md"
        output_path = self.output_dir / filename
        
        output_path.write_text(update, encoding='utf-8')
        
        return output_path


def generate_investor_report(month: Optional[str] = None) -> str:
    """Convenience function to generate investor report."""
    reporter = InvestorReporter()
    return reporter.generate_investor_update(month)


if __name__ == "__main__":
    reporter = InvestorReporter()
    print(reporter.generate_investor_update())
    print(f"\n[Saved to: {reporter.save_update()}]")
