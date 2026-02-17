# 📊 Nzila Analytics Hub

**Last Updated:** February 17, 2026  
**Owner:** Analytics & BI Team  
**Review Cycle:** Weekly (Operations), Monthly (Executive), Quarterly (Board)

---

## 🎯 Overview

The Nzila Analytics Hub provides **real-time, cross-platform business intelligence** for the entire portfolio. It consolidates data from 15 platforms across 10+ verticals to deliver actionable insights for executive decision-making, operational optimization, and strategic planning.

This hub serves as the **single source of truth** for:
- Portfolio performance metrics
- Platform-level KPIs
- Financial forecasting
- Risk management
- Predictive analytics

---

## 📂 Folder Structure

```
analytics/
├── README.md                           # This file - Analytics Hub Index
├── dashboards/                         # Pre-built dashboard definitions
│   ├── EXECUTIVE_SUMMARY.json         # C-suite dashboard
│   ├── PORTFOLIO_HEALTH.json          # Portfolio-wide metrics
│   ├── PLATFORM_PERFORMANCE.json       # Individual platform KPIs
│   ├── FINANCIAL_FORECAST.json        # Revenue & cost projections
│   ├── MIGRATION_TRACKER.json         # Backbone migration progress
│   └── RISK_DASHBOARD.json            # Risk monitoring
├── portfolio/                         # Portfolio-level analytics
│   ├── README.md                       # Portfolio analytics index
│   ├── cross_platform_insights.py     # Cross-platform analysis
│   ├── entity_consolidation.py        # Entity reuse metrics
│   ├── vertical_performance.py        # Vertical benchmark analysis
│   └── network_effects.py              # Network effect tracking
├── predictions/                       # Predictive analytics
│   ├── README.md                       # Predictions index
│   ├── revenue_forecast.py            # ARR/MRR projections
│   ├── churn_prediction.py            # Customer churn models
│   ├── migration_timeline.py          # Migration effort estimation
│   └── market_expansion.py            # Market opportunity scoring
├── exports/                           # Export configurations
│   ├── BOARD_REPORT.md                # Quarterly board export
│   ├── INVESTOR_DASHBOARD.json        # Investor-facing metrics
│   └── REGULATORY_COMPLIANCE.json     # Compliance reporting
├── generators/                        # Analytics generators
│   ├── __init__.py
│   ├── dashboard_generator.py         # Dashboard builder
│   ├── metric_collector.py            # Metrics aggregation
│   ├── report_builder.py              # Report generation
│   └── export_manager.py              # Export orchestration
├── data/                              # Analytics data store
│   ├── cache/                         # Cached analytics data
│   ├── models/                        # Analytics data models
│   └── seeds/                         # Sample/seed data
└── tests/                             # Analytics tests
    ├── test_dashboards.py
    ├── test_predictions.py
    └── test_exports.py
```

---

## 🚀 Quick Start

### Generate Executive Dashboard
```bash
python -m analytics.generators.dashboard_generator --dashboard executive_summary
```

### Run Portfolio Analysis
```bash
python -m analytics.portfolio.cross_platform_insights
```

### Generate Revenue Forecast
```bash
python -m analytics.predictions.revenue_forecast --year 2026
```

### Export Board Report
```bash
python -m analytics.generators.export_manager --template board_report --format markdown
```

---

## 📊 Available Dashboards

| Dashboard | Purpose | Refresh Rate | Audience |
|-----------|---------|--------------|----------|
| **Executive Summary** | High-level portfolio health | Daily | C-Suite, Board |
| **Portfolio Health** | Cross-platform metrics | Daily | Leadership |
| **Platform Performance** | Individual platform KPIs | Real-time | Product Teams |
| **Financial Forecast** | Revenue projections | Weekly | Finance, Board |
| **Migration Tracker** | Backbone migration progress | Daily | Engineering |
| **Risk Dashboard** | Risk monitoring & alerts | Real-time | Risk, Legal |

---

## 🔑 Key Metrics Tracked

### Portfolio Level
- **Total Platforms**: 15 (12 core + 3 undocumented)
- **Business Verticals**: 10+
- **Total Entities**: 12,000+
- **Engineering Investment**: $4M+
- **TAM Coverage**: $100B+

### Financial Metrics
- **ARR Target (2026)**: $350K
- **ARR Target (2030)**: $6M
- **Customer Count Target**: 500
- **Gross Margin Target**: 80%
- **LTV/CAC Ratio**: 5-10x (flagship platforms)

### Platform Metrics
- **Production Readiness**: 9.1/10 (ABR Insights - highest)
- **Security Score**: 10/10 (Union Eyes)
- **Migration Complexity**: EXTREME (4), HIGH-EXTREME (2), HIGH (6)
- **Database Entities**: 4,773 (Union Eyes - most)

### AI/ML Metrics
- **Companion Prompts**: 200+ (trade secret)
- **AI Platforms**: 5+ (ABR, Court Lens, Union Eyes, CongoWave, Insight CFO)
- **Vector Search**: pgVector enabled
- **Model Providers**: Azure OpenAI

---

## 📈 Data Sources

| Source | Type | Update Frequency |
|--------|------|------------------|
| `automation/data/platform_profiles.json` | Platform metadata | On analysis |
| `automation/data/nzila-platform-manifest.json` | Backbone specs | On update |
| `PORTFOLIO_DEEP_DIVE.md` | Portfolio analysis | Monthly |
| `business/financial-models/5-year-projections.md` | Financial targets | Quarterly |
| Legacy codebases | Entity extraction | On migration |

---

## 🔒 Security & Governance

- **Data Classification**: Internal (all analytics)
- **Access Control**: Role-based (Executive, Leadership, Product, Engineering)
- **Audit Trail**: All dashboard views logged
- **Compliance**: SOC 2 Type II, PIPEDA, GDPR

---

## 🔗 Related Documentation

- [Backbone Architecture](../BACKBONE_ARCHITECTURE.md)
- [Portfolio Deep Dive](../PORTFOLIO_DEEP_DIVE.md)
- [Financial Projections](../business/financial-models/5-year-projections.md)
- [AI Infrastructure](../ai/README.md)
- [Corporate Dashboard](../CORPORATE_DASHBOARD.md)

---

## 📞 Support

- **Analytics Lead**: TBD
- **Data Engineer**: TBD
- **BI Analyst**: TBD

**Questions?** Open an issue in the repository or contact the Analytics team.

---

*© 2026 Nzila Ventures. Confidential & Proprietary.*
