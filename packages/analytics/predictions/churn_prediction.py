"""
Churn Prediction Engine
Predict customer churn probability and identify retention intervention opportunities
"""

import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional

class ChurnPredictor:
    """Predict and analyze customer churn across platforms"""
    
    def __init__(self):
        # B2B SaaS benchmark churn rates (annual)
        self.benchmark_churn = {
            "best_in_class": 0.05,  # 5% annual
            "good": 0.07,  # 7% annual
            "average": 0.10,  # 10% annual
            "poor": 0.15  # 15% annual
        }
        
        # Platform-specific churn models (based on business model)
        self.platform_models = {
            "union_eyes": {
                "name": "Union Eyes",
                "vertical": "Uniontech",
                "customer_type": "union_organizations",
                "contract_length_months": 12,
                "target_churn_rate": 0.05,  # 5% annual (unions are sticky)
                "current_churn_estimate": 0.07,  # 7% (MVP phase)
                "cohort_size_2026": 25,
                "retention_drivers": [
                    "Member engagement (daily active users)",
                    "Grievance tracking utilization",
                    "AI Companion adoption",
                    "Integration with union workflows",
                    "Executive buy-in"
                ]
            },
            "abr_insights": {
                "name": "ABR Insights",
                "vertical": "EdTech/Legaltech",
                "customer_type": "organizations",
                "contract_length_months": 12,
                "target_churn_rate": 0.08,  # 8% annual
                "current_churn_estimate": 0.10,  # 10% (launch phase)
                "cohort_size_2026": 50,
                "retention_drivers": [
                    "Training completion rates",
                    "AI gamification engagement",
                    "Manager dashboard usage",
                    "ROI demonstration (policy compliance)",
                    "Integration with LMS"
                ]
            },
            "cora": {
                "name": "CORA",
                "vertical": "Agrotech",
                "customer_type": "farms",
                "contract_length_months": 12,
                "target_churn_rate": 0.10,  # 10% annual
                "current_churn_estimate": 0.12,  # 12% (beta phase)
                "cohort_size_2026": 100,
                "retention_drivers": [
                    "Seasonal usage patterns (harvest cycles)",
                    "Marketplace transaction volume",
                    "Supply chain integration",
                    "Climate module adoption",
                    "Mobile app engagement"
                ]
            },
            "diasporacore": {
                "name": "DiasporaCore V2",
                "vertical": "Fintech",
                "customer_type": "remittance_customers",
                "contract_length_months": 0,  # Transaction-based
                "target_churn_rate": 0.15,  # 15% annual (fintech is competitive)
                "current_churn_estimate": 0.18,  # 18%
                "cohort_size_2026": 1000,
                "retention_drivers": [
                    "Transaction frequency (monthly active users)",
                    "Fee competitiveness vs Western Union",
                    "Transfer speed (compliance delays)",
                    "Mobile money integration",
                    "Referral program participation"
                ]
            },
            "sentryiq": {
                "name": "SentryIQ360",
                "vertical": "Insurtech",
                "customer_type": "insurance_companies",
                "contract_length_months": 24,
                "target_churn_rate": 0.05,  # 5% annual (enterprise contracts)
                "current_churn_estimate": 0.07,  # 7%
                "cohort_size_2026": 5,
                "retention_drivers": [
                    "Claims processing automation ROI",
                    "Integration with core insurance systems",
                    "Data accuracy and compliance",
                    "Support SLA adherence",
                    "Feature roadmap alignment"
                ]
            },
            "court_lens": {
                "name": "Court Lens",
                "vertical": "Legaltech",
                "customer_type": "law_firms",
                "contract_length_months": 12,
                "target_churn_rate": 0.08,  # 8% annual
                "current_churn_estimate": 0.10,  # 10%
                "cohort_size_2026": 30,
                "retention_drivers": [
                    "Case search frequency",
                    "AI-powered legal research usage",
                    "Document analysis adoption",
                    "Billable hours savings (ROI)",
                    "Integration with practice management"
                ]
            },
            "congowave": {
                "name": "CongoWave",
                "vertical": "Entertainment",
                "customer_type": "subscribers",
                "contract_length_months": 1,  # Monthly subscriptions
                "target_churn_rate": 0.30,  # 30% annual (streaming churn is high)
                "current_churn_estimate": 0.35,  # 35%
                "cohort_size_2026": 5000,
                "retention_drivers": [
                    "Weekly listening hours",
                    "Playlist creation and curation",
                    "Social features engagement",
                    "Exclusive content access",
                    "Mobile app stickiness"
                ]
            },
            "others": {
                "name": "Other Platforms (Trade OS, Shop Quoter, eEXPORTS, etc.)",
                "vertical": "Various",
                "customer_type": "mixed",
                "contract_length_months": 12,
                "target_churn_rate": 0.10,  # 10% annual average
                "current_churn_estimate": 0.12,  # 12%
                "cohort_size_2026": 290,
                "retention_drivers": [
                    "Platform-specific engagement metrics",
                    "Feature adoption",
                    "Customer support satisfaction",
                    "ROI demonstration",
                    "Competitive differentiation"
                ]
            }
        }
    
    def predict_platform_churn(self, platform_id: str, months: int = 12) -> Dict:
        """Predict churn for specific platform over time period"""
        if platform_id not in self.platform_models:
            platform_id = "others"
        
        model = self.platform_models[platform_id]
        churn_rate = model["current_churn_estimate"]
        cohort_size = model["cohort_size_2026"]
        
        # Monthly churn rate (simplified exponential decay)
        monthly_churn = 1 - (1 - churn_rate) ** (1/12)
        
        # Churn projection
        churned_customers = int(cohort_size * (1 - (1 - monthly_churn) ** months))
        remaining_customers = cohort_size - churned_customers
        retention_rate = remaining_customers / cohort_size if cohort_size > 0 else 0
        
        return {
            "platform": model["name"],
            "vertical": model["vertical"],
            "period_months": months,
            "starting_cohort": cohort_size,
            "predicted_churn_count": churned_customers,
            "predicted_retention_count": remaining_customers,
            "retention_rate": round(retention_rate * 100, 1),
            "annual_churn_rate": round(churn_rate * 100, 1),
            "target_churn_rate": round(model["target_churn_rate"] * 100, 1),
            "churn_gap": round((churn_rate - model["target_churn_rate"]) * 100, 1)
        }
    
    def calculate_customer_health_score(self, platform_id: str, customer_metrics: Dict) -> Dict:
        """Calculate customer health score and churn risk"""
        # Scoring model (0-100)
        weights = {
            "engagement": 0.30,  # Product usage frequency
            "value_realization": 0.25,  # Customer achieving desired outcomes
            "support_satisfaction": 0.15,  # Support ticket resolution
            "payment_health": 0.15,  # On-time payments, no disputes
            "growth": 0.15  # Usage growth month-over-month
        }
        
        # Default metrics if not provided
        default_metrics = {
            "engagement_score": 70,  # 0-100
            "value_realization_score": 65,
            "support_satisfaction_score": 80,
            "payment_health_score": 90,
            "growth_score": 60
        }
        
        metrics = {**default_metrics, **customer_metrics}
        
        # Weighted health score
        health_score = (
            metrics["engagement_score"] * weights["engagement"] +
            metrics["value_realization_score"] * weights["value_realization"] +
            metrics["support_satisfaction_score"] * weights["support_satisfaction"] +
            metrics["payment_health_score"] * weights["payment_health"] +
            metrics["growth_score"] * weights["growth"]
        )
        
        # Churn risk assessment
        if health_score >= 80:
            risk_level = "LOW"
            churn_probability = 0.05
        elif health_score >= 60:
            risk_level = "MEDIUM"
            churn_probability = 0.15
        elif health_score >= 40:
            risk_level = "HIGH"
            churn_probability = 0.35
        else:
            risk_level = "CRITICAL"
            churn_probability = 0.60
        
        return {
            "health_score": round(health_score, 1),
            "risk_level": risk_level,
            "churn_probability": round(churn_probability * 100, 1),
            "metrics": metrics,
            "recommended_actions": self._get_intervention_recommendations(risk_level, metrics)
        }
    
    def _get_intervention_recommendations(self, risk_level: str, metrics: Dict) -> List[str]:
        """Get recommended retention interventions based on risk level"""
        recommendations = []
        
        if risk_level in ["HIGH", "CRITICAL"]:
            if metrics["engagement_score"] < 50:
                recommendations.append("URGENT: Schedule executive business review (EBR)")
                recommendations.append("Conduct product training session")
                recommendations.append("Identify and remove adoption blockers")
            
            if metrics["value_realization_score"] < 50:
                recommendations.append("Document and communicate ROI achieved")
                recommendations.append("Align product roadmap with customer goals")
                recommendations.append("Case study development (if successful)")
            
            if metrics["payment_health_score"] < 70:
                recommendations.append("Address billing issues immediately")
                recommendations.append("Offer payment plan or temporary discount")
            
            if metrics["support_satisfaction_score"] < 60:
                recommendations.append("Assign dedicated customer success manager")
                recommendations.append("Escalate unresolved support tickets")
        
        elif risk_level == "MEDIUM":
            recommendations.append("Quarterly business review (QBR)")
            recommendations.append("Feature adoption campaign")
            recommendations.append("NPS survey and feedback collection")
            recommendations.append("Upsell/cross-sell opportunity exploration")
        
        else:  # LOW risk
            recommendations.append("Advocate development (case study, referrals)")
            recommendations.append("Community engagement (user groups, events)")
            recommendations.append("Beta testing new features")
        
        return recommendations
    
    def portfolio_churn_forecast(self, year: int = 2026) -> Dict:
        """Forecast churn across entire portfolio"""
        portfolio_summary = {
            "year": year,
            "platforms": [],
            "total_customers_start": 0,
            "total_customers_end": 0,
            "total_churned": 0,
            "portfolio_retention_rate": 0,
            "weighted_churn_rate": 0
        }
        
        for platform_id, model in self.platform_models.items():
            prediction = self.predict_platform_churn(platform_id, months=12)
            portfolio_summary["platforms"].append(prediction)
            portfolio_summary["total_customers_start"] += prediction["starting_cohort"]
            portfolio_summary["total_customers_end"] += prediction["predicted_retention_count"]
            portfolio_summary["total_churned"] += prediction["predicted_churn_count"]
        
        # Portfolio-wide metrics
        if portfolio_summary["total_customers_start"] > 0:
            portfolio_summary["portfolio_retention_rate"] = round(
                (portfolio_summary["total_customers_end"] / portfolio_summary["total_customers_start"]) * 100, 1
            )
            portfolio_summary["weighted_churn_rate"] = round(
                100 - portfolio_summary["portfolio_retention_rate"], 1
            )
        
        return portfolio_summary
    
    def cohort_retention_curve(self, platform_id: str, cohort_size: int = 100) -> Dict:
        """Generate retention curve for cohort analysis"""
        if platform_id not in self.platform_models:
            platform_id = "others"
        
        model = self.platform_models[platform_id]
        churn_rate = model["current_churn_estimate"]
        monthly_churn = 1 - (1 - churn_rate) ** (1/12)
        
        # 24-month retention curve
        curve = []
        remaining = cohort_size
        
        for month in range(0, 25):
            retention_pct = (remaining / cohort_size) * 100 if cohort_size > 0 else 0
            curve.append({
                "month": month,
                "customers_remaining": int(remaining),
                "retention_rate": round(retention_pct, 1),
                "churned_cumulative": cohort_size - int(remaining)
            })
            
            if month < 24:
                remaining = remaining * (1 - monthly_churn)
        
        return {
            "platform": model["name"],
            "cohort_size": cohort_size,
            "retention_curve": curve,
            "12_month_retention": curve[12]["retention_rate"],
            "24_month_retention": curve[24]["retention_rate"]
        }


def main():
    """Example usage"""
    predictor = ChurnPredictor()
    
    # Portfolio-wide forecast
    portfolio_forecast = predictor.portfolio_churn_forecast(2026)
    print(json.dumps(portfolio_forecast, indent=2))
    
    # Platform-specific prediction
    union_eyes_prediction = predictor.predict_platform_churn("union_eyes", months=12)
    print(json.dumps(union_eyes_prediction, indent=2))
    
    # Customer health scoring
    customer_health = predictor.calculate_customer_health_score(
        "abr_insights",
        {
            "engagement_score": 45,  # Low engagement
            "value_realization_score": 50,
            "support_satisfaction_score": 70,
            "payment_health_score": 90,
            "growth_score": 30
        }
    )
    print(json.dumps(customer_health, indent=2))
    
    # Cohort retention curve
    cohort_curve = predictor.cohort_retention_curve("union_eyes", cohort_size=100)
    print(json.dumps(cohort_curve, indent=2))


if __name__ == "__main__":
    main()
