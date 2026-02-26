"""
Extract and analyze Nzila's Backbone Infrastructure requirements
Based on Shared Services, Multi-Product Architecture, and AI Core documentation
"""

import os
import re
from html.parser import HTMLParser
from pathlib import Path


class DetailedContentExtractor(HTMLParser):
    """Extract detailed text content from HTML, preserving structure"""

    def __init__(self):
        super().__init__()
        self.content_blocks = []
        self.current_block = {"type": None, "text": "", "level": 0}
        self.in_body = False

    def handle_starttag(self, tag, attrs):
        if tag == "article":
            self.in_body = True
        elif self.in_body:
            if tag == "h1":
                self._save_block()
                self.current_block = {"type": "h1", "text": "", "level": 1}
            elif tag == "h2":
                self._save_block()
                self.current_block = {"type": "h2", "text": "", "level": 2}
            elif tag == "h3":
                self._save_block()
                self.current_block = {"type": "h3", "text": "", "level": 3}
            elif tag == "p":
                if self.current_block["type"] not in ["h1", "h2", "h3"]:
                    self._save_block()
                    self.current_block = {"type": "p", "text": "", "level": 0}
            elif tag == "li":
                self._save_block()
                self.current_block = {"type": "li", "text": "", "level": 1}
            elif tag in ["td", "th"]:
                self.current_block["text"] += " | "

    def handle_endtag(self, tag):
        if tag == "article":
            self._save_block()
            self.in_body = False
        elif tag in ["h1", "h2", "h3", "p", "li", "td", "th"]:
            self._save_block()

    def handle_data(self, data):
        if self.in_body:
            text = data.strip()
            if text and not text.startswith("http"):
                self.current_block["text"] += text + " "

    def _save_block(self):
        if self.current_block["text"].strip():
            self.content_blocks.append(
                {
                    "type": self.current_block["type"],
                    "text": self.current_block["text"].strip(),
                    "level": self.current_block["level"],
                }
            )
        self.current_block = {"type": None, "text": "", "level": 0}


def extract_content(html_file):
    """Extract structured content from HTML"""
    try:
        with open(html_file, "r", encoding="utf-8") as f:
            content = f.read()

        parser = DetailedContentExtractor()
        parser.feed(content)

        return parser.content_blocks
    except Exception as e:
        return []


def analyze_backbone_infrastructure():
    """Analyze what backbone infrastructure should be built first"""

    export_dir = r"d:\APPS\nzila-automation\notion_export\part1"

    print("=" * 100)
    print("NZILA BACKBONE INFRASTRUCTURE ANALYSIS")
    print("What to Build BEFORE Individual Products")
    print("=" * 100)

    # 1. Multi-Product Operating Architecture
    multi_product_file = (
        Path(export_dir)
        / "🏗️ Multi-Product Operating Architecture 1e585df01907804c85b6debb645d1f39.html"
    )
    if multi_product_file.exists():
        print("\n\n1️⃣ MULTI-PRODUCT OPERATING ARCHITECTURE")
        print("=" * 100)
        blocks = extract_content(multi_product_file)

        for block in blocks:
            if block["type"] in ["h1", "h2", "h3"]:
                print(f"\n{'  ' * block['level']}{block['text']}")
            elif block["type"] == "p" and len(block["text"]) > 30:
                print(f"   {block['text'][:400]}")
            elif block["type"] == "li":
                print(f"   • {block['text'][:300]}")

    # 2. Shared Services Playbooks
    shared_services_file = (
        Path(export_dir)
        / "🧩 Shared Services Playbooks 1e685df01907802ab0acefa79d68e227.html"
    )
    if shared_services_file.exists():
        print("\n\n2️⃣ SHARED SERVICES PLAYBOOKS")
        print("=" * 100)
        blocks = extract_content(shared_services_file)

        for block in blocks:
            if block["type"] in ["h2", "h3"]:
                print(f"\n{block['text']}")
            elif block["type"] == "li" and any(
                word in block["text"]
                for word in ["Service", "Team", "Platform", "Infrastructure"]
            ):
                print(f"   • {block['text'][:300]}")

    # 3. AI Core System
    ai_core_file = (
        Path(export_dir) / "📌 CareAI Core System 1e785df0190780b68806d7a18c14f3b2.html"
    )
    if ai_core_file.exists():
        print("\n\n3️⃣ CAREAI CORE SYSTEM (Shared AI Infrastructure)")
        print("=" * 100)
        blocks = extract_content(ai_core_file)

        for block in blocks:
            if block["type"] in ["h2", "h3"]:
                print(f"\n{block['text']}")
            elif block["type"] in ["p", "li"] and len(block["text"]) > 40:
                print(f"   {block['text'][:350]}")

    # 4. Shared Services Directory
    directory_file = (
        Path(export_dir)
        / "🤝 Shared Services Directory 1e685df0190780178224c73fd564a794.html"
    )
    if directory_file.exists():
        print("\n\n4️⃣ SHARED SERVICES DIRECTORY")
        print("=" * 100)
        blocks = extract_content(directory_file)

        services = []
        for block in blocks:
            if block["type"] == "li" or "|" in block["text"]:
                text = block["text"]
                if len(text) > 20 and not text.startswith("Owner"):
                    services.append(text[:200])

        for service in services[:20]:  # First 20 services
            print(f"   • {service}")

    # SYNTHESIZE BACKBONE REQUIREMENTS
    print("\n\n" + "=" * 100)
    print("BACKBONE PLATFORM REQUIREMENTS (Build These FIRST)")
    print("=" * 100)

    backbone = {
        "Layer 1: Foundation Infrastructure": [
            "Multi-Org Platform Core",
            "  - Org isolation (by clinic, trial, organization)",
            "  - Role-Based Access Control (RBAC) across all products",
            "  - Unified authentication & authorization (Clerk/Auth0)",
            "  - Audit logging infrastructure",
            "  - Data encryption at rest and in transit",
        ],
        "Layer 2: Shared Services Platform": [
            "Consent Management Service",
            "  - Granular consent scopes across all products",
            "  - PIPEDA, GDPR, HIPAA compliance engine",
            "  - Consent change history and audit trails",
            "  - Patient consent portal API",
            "",
            "User Management Service",
            "  - Unified user profiles across products",
            "  - Accessibility profile management",
            "  - Multi-product SSO",
            "  - User preference synchronization",
            "",
            "Notification Service",
            "  - Multi-channel notifications (email, SMS, push, in-app)",
            "  - Notification routing by product/org",
            "  - Fatigue prevention logic",
            "  - Delivery status tracking",
            "",
            "Integration Hub",
            "  - HL7/FHIR gateway for clinic EMR systems",
            "  - Wearable device connectors",
            "  - Third-party API orchestration",
            "  - Data transformation pipelines",
            "",
            "Data Governance Service",
            "  - Cross-product data retention policies",
            "  - Automated compliance checks",
            "  - Data subject access request (DSAR) automation",
            "  - Anonymization and de-identification",
        ],
        "Layer 3: AI Core Infrastructure (CareAI Core)": [
            "LLM Orchestration Layer",
            "  - Azure OpenAI API gateway with rate limiting",
            "  - Prompt template management",
            "  - Multi-model routing (GPT-4, custom fine-tuned models)",
            "  - Token usage tracking and cost allocation per product",
            "",
            "Companion Memory Engine",
            "  - Vector database (pgvector) for semantic memory",
            "  - Memory graph storage (relationships, context)",
            "  - Memory rights and consent integration",
            "  - Cross-product memory isolation",
            "",
            "AI Safety & Governance",
            "  - Prompt logging and audit (all AI interactions)",
            "  - Content filtering and safety checks",
            "  - Bias detection and monitoring",
            "  - Clinical safety alert triggering",
            "  - Hallucination detection",
            "",
            "Cognitive Analytics Service",
            "  - Centralized cognitive scoring algorithms",
            "  - Drift detection (behavioral anomalies)",
            "  - Predictive models for outcomes",
            "  - Cross-product insight aggregation",
        ],
        "Layer 4: Platform Services": [
            "API Gateway & Service Mesh",
            "  - Rate limiting per org/product",
            "  - Request authentication and routing",
            "  - Service discovery",
            "  - API versioning strategy",
            "",
            "Observability Stack",
            "  - Centralized logging (Azure Log Analytics)",
            "  - Distributed tracing",
            "  - Performance metrics per product",
            "  - Error tracking and alerting",
            "  - Real-time dashboards",
            "",
            "Background Task Orchestration",
            "  - Celery with Redis for async processing",
            "  - Task queues per product domain",
            "  - Scheduled job management",
            "  - Task retry and failure handling",
            "",
            "File Storage Service",
            "  - Secure file upload/download",
            "  - Media processing (images, audio for games)",
            "  - CDN integration",
            "  - Encryption and access control",
        ],
        "Layer 5: Developer Platform": [
            "SDK & Component Library",
            "  - Python SDK for internal service communication",
            "  - React component library (shared UI across products)",
            "  - API client generators",
            "  - Testing utilities",
            "",
            "CI/CD Pipeline (from scripts-book template)",
            "  - Automated testing (unit, integration, E2E)",
            "  - Azure Container Apps deployment",
            "  - Environment management (dev, staging, prod)",
            "  - Blue-green deployments",
            "",
            "Developer Portal",
            "  - API documentation (Swagger/OpenAPI)",
            "  - Service catalog",
            "  - Onboarding guides",
            "  - Shared services SLA tracking",
        ],
    }

    for layer, services in backbone.items():
        print(f"\n{layer}")
        print("-" * 100)
        for service in services:
            print(f"  {service}")

    # RECOMMENDED BUILD ORDER
    print("\n\n" + "=" * 100)
    print("RECOMMENDED BUILD ORDER (20-Week Timeline)")
    print("=" * 100)

    phases = [
        {
            "phase": "Phase 0: Scaffold (Weeks 1-2)",
            "deliverables": [
                "✅ Apply scripts-book template to create repo structure",
                "✅ Set up Azure PostgreSQL + Redis infrastructure",
                "✅ Configure Azure Container Apps deployment",
                "✅ Create monorepo structure for platform services",
                "✅ Establish CI/CD pipelines",
                "✅ Set up development environments",
            ],
        },
        {
            "phase": "Phase 1: Foundation (Weeks 3-6)",
            "deliverables": [
                "✅ Multi-org core with clinic/trial isolation",
                "✅ Authentication service (Clerk integration)",
                "✅ RBAC system across all future products",
                "✅ Audit logging infrastructure",
                "✅ User management service with profiles",
                "✅ API gateway with rate limiting",
            ],
        },
        {
            "phase": "Phase 2: Consent & Governance (Weeks 7-10)",
            "deliverables": [
                "✅ Consent management system (PIPEDA/GDPR compliant)",
                "✅ Data governance service with retention policies",
                "✅ DSAR automation (data subject access requests)",
                "✅ Consent change tracking and audit",
                "✅ Patient consent portal API",
                "✅ Privacy-preserving analytics framework",
            ],
        },
        {
            "phase": "Phase 3: AI Core Infrastructure (Weeks 11-14)",
            "deliverables": [
                "✅ LLM orchestration layer (Azure OpenAI gateway)",
                "✅ Prompt management and versioning",
                "✅ Vector database setup (pgvector for semantic memory)",
                "✅ AI safety layer (content filtering, bias detection)",
                "✅ Prompt logging for all AI interactions",
                "✅ Token usage tracking and cost allocation",
            ],
        },
        {
            "phase": "Phase 4: Shared Services (Weeks 15-18)",
            "deliverables": [
                "✅ Notification service (multi-channel)",
                "✅ Integration hub (HL7/FHIR gateway foundation)",
                "✅ File storage service with encryption",
                "✅ Background task orchestration (Celery)",
                "✅ Observability stack (logging, tracing, metrics)",
                "✅ Cognitive analytics service (scoring, drift detection)",
            ],
        },
        {
            "phase": "Phase 5: Developer Platform (Weeks 19-20)",
            "deliverables": [
                "✅ Python SDK for service communication",
                "✅ React component library kickoff",
                "✅ API documentation automation",
                "✅ Developer portal with service catalog",
                "✅ Shared services SLA dashboard",
                "✅ Platform ready for product teams to build on",
            ],
        },
    ]

    for phase_info in phases:
        print(f"\n{phase_info['phase']}")
        print("-" * 100)
        for deliverable in phase_info["deliverables"]:
            print(f"  {deliverable}")

    # PRODUCT ACCELERATION
    print("\n\n" + "=" * 100)
    print("HOW BACKBONE ACCELERATES PRODUCT DEVELOPMENT")
    print("=" * 100)

    acceleration = {
        "Memora (Flagship)": [
            "✅ Inherit: Consent, auth, multi-tenancy, AI Core, notifications",
            "Build only: Game engine, companion personality, memory garden, quest system",
            "Timeline: 12 weeks (vs 24 without backbone)",
        ],
        "ClinicConnect SaaS": [
            "✅ Inherit: Multi-org, RBAC, data governance, integration hub, reporting",
            "Build only: Clinical workspace UI, trial management, device provisioning",
            "Timeline: 8 weeks (vs 20 without backbone)",
        ],
        "CareAI Decision Support": [
            "✅ Inherit: AI Core, LLM orchestration, safety layer, consent, audit logging",
            "Build only: Clinical recommendation algorithms, EMR integration logic",
            "Timeline: 6 weeks (vs 16 without backbone)",
        ],
        "FamilySync Caregiver": [
            "✅ Inherit: User management, consent, notifications, secure messaging",
            "Build only: Caregiver dashboards, observation logging UI",
            "Timeline: 6 weeks (vs 14 without backbone)",
        ],
        "Companion API (White-label)": [
            "✅ Inherit: Entire AI Core + safety + memory engine",
            "Build only: API documentation, partner onboarding, usage metering",
            "Timeline: 4 weeks (vs 18 without backbone)",
        ],
    }

    for product, benefits in acceleration.items():
        print(f"\n{product}")
        for benefit in benefits:
            print(f"  {benefit}")

    print("\n\n" + "=" * 100)
    print("KEY INSIGHT: Build the backbone ONCE, accelerate 7+ products")
    print("=" * 100)
    print("\n Investment: 20 weeks for backbone")
    print(" Return: 60+ weeks saved across 7 products")
    print(" ROI: 300% time savings + enforced compliance + unified experience")
    print("\n" + "=" * 100)


if __name__ == "__main__":
    analyze_backbone_infrastructure()
