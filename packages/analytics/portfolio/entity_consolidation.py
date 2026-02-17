"""
Entity Consolidation Analyzer
Identify shared entity types and consolidation opportunities across platforms
"""

import json
from datetime import datetime
from typing import Dict, List, Set

class EntityConsolidationAnalyzer:
    """Analyze entity reuse and consolidation opportunities across portfolio"""
    
    def __init__(self):
        # Platform entity inventories (from PORTFOLIO_DEEP_DIVE v2)
        self.platform_entities = {
            "union_eyes": {
                "name": "Union Eyes",
                "total_entities": 4773,
                "entity_types": {
                    "User": 1200,
                    "Organization": 25,  # Unions
                    "Member": 3800,
                    "Grievance": 450,
                    "Contract": 60,
                    "Notification": 2100,
                    "Document": 850,
                    "Analytics": 320,
                    "Payment": 180,
                    "Role": 45,
                    "Permission": 238  # RLS policies
                }
            },
            "abr_insights": {
                "name": "ABR Insights",
                "total_entities": 132,
                "entity_types": {
                    "User": 80,
                    "Organization": 15,
                    "TrainingModule": 25,
                    "Assessment": 45,
                    "Badge": 30,
                    "Notification": 60,
                    "Analytics": 35,
                    "Role": 12
                }
            },
            "cora": {
                "name": "CORA",
                "total_entities": 80,
                "entity_types": {
                    "User": 35,
                    "Farm": 12,
                    "Product": 45,
                    "Transaction": 60,
                    "Marketplace": 8,
                    "Notification": 25,
                    "Analytics": 18,
                    "Payment": 30
                }
            },
            "congowave": {
                "name": "CongoWave",
                "total_entities": 83,
                "entity_types": {
                    "User": 50,
                    "Artist": 20,
                    "Track": 1200,
                    "Playlist": 180,
                    "Subscription": 45,
                    "Notification": 35,
                    "Analytics": 28,
                    "Payment": 40
                }
            },
            "cyberlearn": {
                "name": "CyberLearn",
                "total_entities": 30,
                "entity_types": {
                    "User": 22,
                    "Course": 8,
                    "Module": 35,
                    "Assessment": 15,
                    "Certificate": 12,
                    "Notification": 18,
                    "Analytics": 10
                }
            },
            "court_lens": {
                "name": "Court Lens",
                "total_entities": 682,
                "entity_types": {
                    "User": 45,
                    "LawFirm": 12,
                    "Case": 450,
                    "Document": 1800,
                    "Search": 320,
                    "Citation": 580,
                    "Notification": 58,
                    "Analytics": 42,
                    "Payment": 22
                }
            },
            "c3uo_diasporacore": {
                "name": "DiasporaCore V2",
                "total_entities": 485,
                "entity_types": {
                    "User": 280,
                    "Account": 250,
                    "Transaction": 1200,
                    "Beneficiary": 320,
                    "KYC": 240,
                    "Compliance": 180,
                    "Notification": 150,
                    "Analytics": 95,
                    "Payment": 1100
                }
            },
            "sentryiq": {
                "name": "SentryIQ360",
                "total_entities": 79,
                "entity_types": {
                    "User": 35,
                    "Claim": 120,
                    "Policy": 85,
                    "Document": 250,
                    "Notification": 42,
                    "Analytics": 38,
                    "Organization": 8
                }
            },
            "trade_os": {
                "name": "Trade OS",
                "total_entities": 337,
                "entity_types": {
                    "User": 95,
                    "Organization": 28,
                    "Order": 450,
                    "Product": 280,
                    "Invoice": 380,
                    "Notification": 72,
                    "Analytics": 55,
                    "Payment": 180,
                    "Document": 150
                }
            },
            "eexports": {
                "name": "eEXPORTS",
                "total_entities": 78,
                "entity_types": {
                    "User": 42,
                    "Shipment": 180,
                    "Document": 320,
                    "CustomsForm": 150,
                    "Notification": 38,
                    "Analytics": 28,
                    "Organization": 12
                }
            },
            "shop_quoter": {
                "name": "Shop Quoter",
                "total_entities": 93,
                "entity_types": {
                    "User": 52,
                    "Organization": 18,
                    "Quote": 280,
                    "Product": 180,
                    "Notification": 45,
                    "Analytics": 32,
                    "Payment": 85
                }
            },
            "ponduops": {
                "name": "PonduOps",
                "total_entities": 220,
                "entity_types": {
                    "User": 68,
                    "Farm": 22,
                    "Harvest": 85,
                    "Distribution": 120,
                    "Product": 95,
                    "Transaction": 180,
                    "Notification": 48,
                    "Analytics": 38
                }
            },
            "insight_cfo": {
                "name": "Insight CFO",
                "total_entities": 37,
                "entity_types": {
                    "User": 28,
                    "Client": 15,
                    "FinancialReport": 45,
                    "Transaction": 280,
                    "Document": 120,
                    "Notification": 22,
                    "Analytics": 18
                }
            },
            "stsa": {
                "name": "STSA",
                "total_entities": 95,
                "entity_types": {
                    "User": 48,
                    "Student": 120,
                    "Application": 95,
                    "Document": 180,
                    "Notification": 38,
                    "Analytics": 25
                }
            },
            "memora": {
                "name": "Memora",
                "total_entities": 150,
                "entity_types": {
                    "User": 85,
                    "Conversation": 420,
                    "Memory": 850,
                    "Reminder": 280,
                    "Notification": 120,
                    "Analytics": 65,
                    "Payment": 55
                }
            }
        }
    
    def identify_shared_entity_types(self) -> Dict:
        """Identify entity types shared across multiple platforms"""
        # Aggregate entity types across platforms
        entity_type_map = {}
        
        for platform_id, platform_data in self.platform_entities.items():
            for entity_type, count in platform_data["entity_types"].items():
                if entity_type not in entity_type_map:
                    entity_type_map[entity_type] = {
                        "platforms": [],
                        "total_instances": 0,
                        "consolidation_priority": "LOW"
                    }
                
                entity_type_map[entity_type]["platforms"].append({
                    "platform_id": platform_id,
                    "platform_name": platform_data["name"],
                    "count": count
                })
                entity_type_map[entity_type]["total_instances"] += count
        
        # Calculate platform count and prioritize
        shared_entities = []
        for entity_type, data in entity_type_map.items():
            platform_count = len(data["platforms"])
            total_instances = data["total_instances"]
            
            # Prioritization logic
            if platform_count >= 10:
                priority = "CRITICAL"  # Almost all platforms
                consolidation_potential = "80-100%"
            elif platform_count >= 7:
                priority = "HIGH"  # Majority of platforms
                consolidation_potential = "60-80%"
            elif platform_count >= 4:
                priority = "MEDIUM"  # Several platforms
                consolidation_potential = "40-60%"
            else:
                priority = "LOW"  # Few platforms
                consolidation_potential = "20-40%"
            
            shared_entities.append({
                "entity_type": entity_type,
                "platform_count": platform_count,
                "total_instances": total_instances,
                "priority": priority,
                "consolidation_potential": consolidation_potential,
                "platforms": data["platforms"]
            })
        
        # Sort by platform count descending
        shared_entities.sort(key=lambda x: x["platform_count"], reverse=True)
        
        return {
            "total_unique_entity_types": len(entity_type_map),
            "shared_entity_types": shared_entities,
            "consolidation_summary": self._generate_consolidation_summary(shared_entities)
        }
    
    def _generate_consolidation_summary(self, shared_entities: List[Dict]) -> Dict:
        """Generate summary statistics for consolidation"""
        critical = sum(1 for e in shared_entities if e["priority"] == "CRITICAL")
        high = sum(1 for e in shared_entities if e["priority"] == "HIGH")
        medium = sum(1 for e in shared_entities if e["priority"] == "MEDIUM")
        low = sum(1 for e in shared_entities if e["priority"] == "LOW")
        
        return {
            "critical_priority": critical,
            "high_priority": high,
            "medium_priority": medium,
            "low_priority": low,
            "total_consolidation_opportunities": critical + high + medium
        }
    
    def calculate_backbone_entity_mapping(self) -> Dict:
        """Map platform entities to Backbone shared components"""
        backbone_components = {
            "multi_tenant_system": {
                "name": "Multi-Tenant System",
                "shared_entities": ["Organization", "Tenant", "Role", "Permission"],
                "platforms_affected": 12,
                "consolidation_savings": "60 engineering hours"
            },
            "auth_system": {
                "name": "Authentication & Authorization (Clerk)",
                "shared_entities": ["User", "Role", "Permission", "Session"],
                "platforms_affected": 15,
                "consolidation_savings": "40 engineering hours"
            },
            "notification_system": {
                "name": "Notification System",
                "shared_entities": ["Notification", "EmailTemplate", "SMSTemplate"],
                "platforms_affected": 15,
                "consolidation_savings": "30 engineering hours"
            },
            "analytics_system": {
                "name": "Analytics Dashboard",
                "shared_entities": ["Analytics", "Metric", "Report", "Event"],
                "platforms_affected": 15,
                "consolidation_savings": "40 engineering hours"
            },
            "payment_system": {
                "name": "Billing & Payments (Stripe)",
                "shared_entities": ["Payment", "Subscription", "Invoice", "Transaction"],
                "platforms_affected": 8,
                "consolidation_savings": "50 engineering hours"
            },
            "document_system": {
                "name": "Document Management",
                "shared_entities": ["Document", "File", "Attachment"],
                "platforms_affected": 7,
                "consolidation_savings": "35 engineering hours"
            },
            "ai_companion": {
                "name": "AI Companion Engine",
                "shared_entities": ["Conversation", "Prompt", "Memory", "Context"],
                "platforms_affected": 5,
                "consolidation_savings": "45 engineering hours"
            },
            "compliance_module": {
                "name": "Compliance & Audit Logging",
                "shared_entities": ["AuditLog", "Compliance", "DataRetention"],
                "platforms_affected": 8,
                "consolidation_savings": "25 engineering hours"
            }
        }
        
        return {
            "backbone_components": backbone_components,
            "total_consolidation_savings": "325 engineering hours",
            "migration_complexity": "MEDIUM-HIGH (data schema consolidation required)"
        }
    
    def estimate_database_schema_overlap(self) -> Dict:
        """Estimate database schema consolidation opportunities"""
        # Shared schema patterns
        schema_patterns = [
            {
                "pattern": "User Management",
                "tables": ["users", "roles", "permissions", "sessions"],
                "platforms": 15,
                "consolidation_approach": "Shared Auth (Clerk) + tenant-scoped users",
                "estimated_reduction": "60% fewer user tables"
            },
            {
                "pattern": "Multi-Tenancy",
                "tables": ["organizations", "tenants", "memberships"],
                "platforms": 12,
                "consolidation_approach": "Backbone tenant isolation + RLS policies",
                "estimated_reduction": "80% consolidation via shared tenant model"
            },
            {
                "pattern": "Notifications",
                "tables": ["notifications", "email_queue", "sms_queue"],
                "platforms": 15,
                "consolidation_approach": "Shared notification service (multi-tenant)",
                "estimated_reduction": "90% consolidation (single notification table)"
            },
            {
                "pattern": "Analytics & Events",
                "tables": ["events", "metrics", "analytics", "reports"],
                "platforms": 15,
                "consolidation_approach": "Centralized analytics warehouse",
                "estimated_reduction": "70% consolidation (shared analytics schema)"
            },
            {
                "pattern": "Payments",
                "tables": ["payments", "subscriptions", "invoices", "transactions"],
                "platforms": 8,
                "consolidation_approach": "Shared Stripe integration + tenant isolation",
                "estimated_reduction": "75% consolidation"
            },
            {
                "pattern": "Documents",
                "tables": ["documents", "files", "attachments"],
                "platforms": 7,
                "consolidation_approach": "Centralized document storage (Azure Blob)",
                "estimated_reduction": "85% consolidation"
            }
        ]
        
        return {
            "schema_patterns": schema_patterns,
            "overall_consolidation_estimate": "30-40% reduction in total database tables",
            "migration_approach": "Phased consolidation during Backbone migration"
        }
    
    def generate_consolidation_roadmap(self) -> List[Dict]:
        """Generate phased consolidation roadmap"""
        roadmap = [
            {
                "phase": "Phase 1: Backbone Foundation",
                "timeline": "2026-Q1 to Q2",
                "consolidation_targets": [
                    "User/Auth entities (15 platforms)",
                    "Organization/Tenant entities (12 platforms)",
                    "Role/Permission entities (15 platforms)"
                ],
                "expected_outcome": "60% reduction in auth-related tables",
                "effort": "Included in Backbone build"
            },
            {
                "phase": "Phase 2: Notification & Analytics",
                "timeline": "2026-Q2 to Q3",
                "consolidation_targets": [
                    "Notification entities (15 platforms)",
                    "Analytics entities (15 platforms)"
                ],
                "expected_outcome": "80% reduction in notification/analytics tables",
                "effort": "Included in Backbone Phase 4"
            },
            {
                "phase": "Phase 3: Payments & Documents",
                "timeline": "2026-Q3 to Q4",
                "consolidation_targets": [
                    "Payment entities (8 platforms)",
                    "Document entities (7 platforms)"
                ],
                "expected_outcome": "75% reduction in payment/document tables",
                "effort": "Included in Backbone Phase 3"
            },
            {
                "phase": "Phase 4: Platform Migration",
                "timeline": "2026-Q2 to 2027-Q1",
                "consolidation_targets": [
                    "Batch 1 POC (3 platforms)",
                    "Batch 2 parallel (12 platforms)"
                ],
                "expected_outcome": "Full entity consolidation per platform",
                "effort": "8 weeks per platform (on average)"
            }
        ]
        
        return roadmap
    
    def calculate_data_migration_complexity(self) -> Dict:
        """Calculate data migration complexity for entity consolidation"""
        # Platform-specific complexity
        complexity_breakdown = []
        
        for platform_id, platform_data in self.platform_entities.items():
            total_entities = platform_data["total_entities"]
            entity_type_count = len(platform_data["entity_types"])
            
            # Complexity scoring
            if total_entities > 1000:
                size_complexity = "HIGH"
            elif total_entities > 200:
                size_complexity = "MEDIUM"
            else:
                size_complexity = "LOW"
            
            if entity_type_count > 10:
                schema_complexity = "HIGH"
            elif entity_type_count > 6:
                schema_complexity = "MEDIUM"
            else:
                schema_complexity = "LOW"
            
            complexity_breakdown.append({
                "platform": platform_data["name"],
                "total_entities": total_entities,
                "entity_type_count": entity_type_count,
                "size_complexity": size_complexity,
                "schema_complexity": schema_complexity,
                "estimated_migration_weeks": self._estimate_migration_weeks(
                    total_entities, entity_type_count
                )
            })
        
        # Sort by total entities descending
        complexity_breakdown.sort(key=lambda x: x["total_entities"], reverse=True)
        
        return {
            "complexity_breakdown": complexity_breakdown,
            "total_entities_to_migrate": sum(p["total_entities"] for p in self.platform_entities.values()),
            "average_migration_weeks": round(
                sum(c["estimated_migration_weeks"] for c in complexity_breakdown) / len(complexity_breakdown), 1
            )
        }
    
    def _estimate_migration_weeks(self, total_entities: int, entity_type_count: int) -> int:
        """Estimate migration weeks based on entity volume and schema complexity"""
        # Base: 2 weeks
        # +1 week per 1000 entities
        # +1 week per 5 entity types
        base = 2
        entity_factor = total_entities // 1000
        schema_factor = entity_type_count // 5
        
        return min(base + entity_factor + schema_factor, 14)  # Cap at 14 weeks


def main():
    """Example usage"""
    analyzer = EntityConsolidationAnalyzer()
    
    # Shared entity types
    shared_entities = analyzer.identify_shared_entity_types()
    print(json.dumps(shared_entities, indent=2))
    
    # Backbone entity mapping
    backbone_mapping = analyzer.calculate_backbone_entity_mapping()
    print(json.dumps(backbone_mapping, indent=2))
    
    # Database schema overlap
    schema_overlap = analyzer.estimate_database_schema_overlap()
    print(json.dumps(schema_overlap, indent=2))
    
    # Consolidation roadmap
    roadmap = analyzer.generate_consolidation_roadmap()
    print(json.dumps(roadmap, indent=2))
    
    # Data migration complexity
    migration_complexity = analyzer.calculate_data_migration_complexity()
    print(json.dumps(migration_complexity, indent=2))


if __name__ == "__main__":
    main()
