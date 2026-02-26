"""
Nzila Legacy Portfolio Analyzer
Comprehensive analysis of 11 legacy platforms to enable portfolio unification

Analysis Goals:
1. Tech stack detection per platform
2. Entity/model extraction
3. API endpoint discovery
4. Dependencies mapping
5. Vertical classification
6. Cross-platform pattern detection
7. Migration manifest generation
"""

import json
import os
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, List, Set


class LegacyPortfolioAnalyzer:
    def __init__(self, legacy_codebases_dir: str):
        self.legacy_dir = Path(legacy_codebases_dir)
        self.platforms = []
        self.portfolio_analysis = {
            "platforms": {},
            "tech_stacks": {},
            "entities_summary": {},
            "api_patterns": {},
            "vertical_classification": {},
            "cross_platform_patterns": {
                "common_entities": set(),
                "common_workflows": set(),
                "shared_dependencies": set(),
                "ui_patterns": set(),
            },
            "migration_priorities": {},
            "portfolio_metrics": {},
        }

    def discover_platforms(self):
        """Discover all extracted platform directories"""
        print("=" * 80)
        print("DISCOVERING LEGACY PLATFORMS")
        print("=" * 80)

        for item in self.legacy_dir.iterdir():
            if item.is_dir() and not item.name.startswith("."):
                # Check for nested folder (common with GitHub zip downloads)
                actual_path = item
                nested_path = item / item.name
                if nested_path.exists() and nested_path.is_dir():
                    actual_path = nested_path
                    print(
                        f"  → Detected nested folder structure, using: {actual_path.name}"
                    )

                self.platforms.append(
                    {
                        "name": item.name,
                        "path": actual_path,
                        "size_mb": self._get_dir_size(actual_path) / (1024 * 1024),
                    }
                )
                print(
                    f"✓ Found: {item.name} ({self._get_dir_size(actual_path) / (1024 * 1024):.2f} MB)"
                )

        print(f"\nTotal platforms discovered: {len(self.platforms)}")
        return self.platforms

    def _get_dir_size(self, path: Path) -> int:
        """Calculate directory size"""
        total = 0
        try:
            for entry in path.rglob("*"):
                if entry.is_file():
                    try:
                        total += entry.stat().st_size
                    except:
                        pass
        except:
            pass
        return total

    def analyze_platform(self, platform: Dict) -> Dict[str, Any]:
        """Comprehensive analysis of a single platform"""
        print(f"\n{'=' * 80}")
        print(f"ANALYZING: {platform['name']}")
        print(f"{'=' * 80}")

        path = platform["path"]
        analysis = {
            "name": platform["name"],
            "path": str(path),
            "size_mb": platform["size_mb"],
            "tech_stack": self._detect_tech_stack(path),
            "package_files": self._find_package_files(path),
            "entities": self._extract_entities(path),
            "api_endpoints": self._extract_api_endpoints(path),
            "components": self._extract_components(path),
            "dependencies": self._extract_dependencies(path),
            "database_models": self._extract_database_models(path),
            "vertical": self._classify_vertical(platform["name"]),
            "framework": None,
            "ui_library": None,
            "backend_tech": None,
        }

        # Detailed tech stack classification
        tech_stack = analysis["tech_stack"]
        if tech_stack["is_react"]:
            analysis["framework"] = "React"
            analysis["ui_library"] = self._detect_ui_library(path)
        elif tech_stack["is_vue"]:
            analysis["framework"] = "Vue"
        elif tech_stack["is_angular"]:
            analysis["framework"] = "Angular"
        elif tech_stack["is_django"]:
            analysis["framework"] = "Django"
            analysis["backend_tech"] = "Python/Django"
        elif tech_stack["is_flask"]:
            analysis["framework"] = "Flask"
            analysis["backend_tech"] = "Python/Flask"
        elif tech_stack["is_nextjs"]:
            analysis["framework"] = "Next.js"

        # Print summary
        print(f"  Framework: {analysis['framework'] or 'Unknown'}")
        print(f"  Backend: {analysis['backend_tech'] or 'Unknown'}")
        print(f"  Vertical: {analysis['vertical']}")
        print(f"  Entities found: {len(analysis['entities'])}")
        print(f"  API endpoints: {len(analysis['api_endpoints'])}")
        print(f"  Components: {len(analysis['components'])}")

        return analysis

    def _detect_tech_stack(self, path: Path) -> Dict[str, bool]:
        """Detect technology stack from file patterns"""
        stack = {
            "is_react": False,
            "is_vue": False,
            "is_angular": False,
            "is_django": False,
            "is_flask": False,
            "is_nextjs": False,
            "is_typescript": False,
            "is_javascript": False,
            "is_python": False,
            "has_docker": False,
            "has_tests": False,
        }

        # Check for React
        package_json = path / "package.json"
        if package_json.exists():
            try:
                with open(package_json, "r", encoding="utf-8") as f:
                    pkg = json.load(f)
                    deps = {
                        **pkg.get("dependencies", {}),
                        **pkg.get("devDependencies", {}),
                    }
                    stack["is_react"] = "react" in deps
                    stack["is_vue"] = "vue" in deps
                    stack["is_angular"] = "@angular/core" in deps
                    stack["is_nextjs"] = "next" in deps
            except:
                pass

        # Check for Django
        if (path / "manage.py").exists() or (path / "settings.py").exists():
            stack["is_django"] = True
            stack["is_python"] = True

        # Check for Flask
        for file in path.rglob("*.py"):
            try:
                content = file.read_text(encoding="utf-8", errors="ignore")
                if "from flask import" in content or "import flask" in content:
                    stack["is_flask"] = True
                    stack["is_python"] = True
                    break
            except:
                pass

        # Check for TypeScript
        stack["is_typescript"] = (
            len(list(path.glob("**/*.ts"))) > 0 or len(list(path.glob("**/*.tsx"))) > 0
        )
        stack["is_javascript"] = (
            len(list(path.glob("**/*.js"))) > 0 or len(list(path.glob("**/*.jsx"))) > 0
        )

        # Check for Docker
        stack["has_docker"] = (path / "Dockerfile").exists() or (
            path / "docker-compose.yml"
        ).exists()

        # Check for tests
        test_patterns = [
            "**/*test*.py",
            "**/*spec*.js",
            "**/*test*.js",
            "**/*spec*.ts",
            "**/*test*.ts",
        ]
        for pattern in test_patterns:
            if len(list(path.glob(pattern))) > 0:
                stack["has_tests"] = True
                break

        return stack

    def _find_package_files(self, path: Path) -> List[str]:
        """Find package management files"""
        package_files = []
        candidates = [
            "package.json",
            "requirements.txt",
            "Pipfile",
            "pyproject.toml",
            "pom.xml",
            "build.gradle",
        ]

        for candidate in candidates:
            if (path / candidate).exists():
                package_files.append(candidate)

        return package_files

    def _extract_entities(self, path: Path) -> List[Dict[str, Any]]:
        """Extract entities/models from codebase"""
        entities = []

        # Python models (Django/SQLAlchemy)
        for py_file in path.glob("**/models.py"):
            entities.extend(self._parse_python_models(py_file))

        # JavaScript/TypeScript entities
        for js_file in list(path.glob("**/*.js")) + list(path.glob("**/*.ts")):
            if "node_modules" not in str(js_file):
                entities.extend(self._parse_js_entities(js_file))

        return entities

    def _parse_python_models(self, file_path: Path) -> List[Dict[str, Any]]:
        """Parse Django/SQLAlchemy models"""
        entities = []
        try:
            content = file_path.read_text(encoding="utf-8", errors="ignore")

            # Django models pattern
            class_pattern = r"class\s+(\w+)\s*\([^)]*Model[^)]*\):"
            matches = re.finditer(class_pattern, content)

            for match in matches:
                entities.append(
                    {
                        "name": match.group(1),
                        "type": "django_model",
                        "file": str(file_path.relative_to(file_path.parents[2])),
                    }
                )
        except:
            pass

        return entities

    def _parse_js_entities(self, file_path: Path) -> List[Dict[str, Any]]:
        """Parse JavaScript/TypeScript entities"""
        entities = []
        try:
            content = file_path.read_text(encoding="utf-8", errors="ignore")

            # Interface/Type definitions
            interface_pattern = r"(?:interface|type)\s+(\w+)"
            matches = re.finditer(interface_pattern, content)

            for match in matches:
                entities.append(
                    {
                        "name": match.group(1),
                        "type": "typescript_interface",
                        "file": str(file_path.name),
                    }
                )
        except:
            pass

        return entities[:50]  # Limit to prevent overwhelming output

    def _extract_api_endpoints(self, path: Path) -> List[Dict[str, Any]]:
        """Extract API endpoints from codebase"""
        endpoints = []

        # Django URL patterns
        for urls_file in path.glob("**/urls.py"):
            endpoints.extend(self._parse_django_urls(urls_file))

        # Express/API routes
        for js_file in list(path.glob("**/routes/**/*.js")) + list(
            path.glob("**/api/**/*.js")
        ):
            endpoints.extend(self._parse_js_routes(js_file))

        return endpoints

    def _parse_django_urls(self, file_path: Path) -> List[Dict[str, Any]]:
        """Parse Django URL configuration"""
        endpoints = []
        try:
            content = file_path.read_text(encoding="utf-8", errors="ignore")

            # URL pattern
            url_pattern = r"path\(['\"]([^'\"]+)['\"]"
            matches = re.finditer(url_pattern, content)

            for match in matches:
                endpoints.append(
                    {
                        "path": match.group(1),
                        "type": "django_url",
                        "file": str(file_path.name),
                    }
                )
        except:
            pass

        return endpoints[:30]  # Limit output

    def _parse_js_routes(self, file_path: Path) -> List[Dict[str, Any]]:
        """Parse JavaScript API routes"""
        endpoints = []
        try:
            content = file_path.read_text(encoding="utf-8", errors="ignore")

            # Express-style routes
            route_patterns = [
                r"router\.(get|post|put|delete|patch)\(['\"]([^'\"]+)['\"]",
                r"app\.(get|post|put|delete|patch)\(['\"]([^'\"]+)['\"]",
            ]

            for pattern in route_patterns:
                matches = re.finditer(pattern, content)
                for match in matches:
                    endpoints.append(
                        {
                            "method": match.group(1).upper(),
                            "path": match.group(2),
                            "type": "express_route",
                            "file": str(file_path.name),
                        }
                    )
        except:
            pass

        return endpoints[:30]  # Limit output

    def _extract_components(self, path: Path) -> List[str]:
        """Extract UI components"""
        components = []

        # React/Vue components
        component_patterns = ["**/*.jsx", "**/*.tsx", "**/*.vue"]

        for pattern in component_patterns:
            for comp_file in path.glob(pattern):
                if "node_modules" not in str(comp_file):
                    components.append(comp_file.stem)

        return list(set(components))[:50]  # Unique, limited

    def _extract_dependencies(self, path: Path) -> Dict[str, List[str]]:
        """Extract dependencies from package files"""
        deps = {"npm": [], "python": []}

        # NPM dependencies
        package_json = path / "package.json"
        if package_json.exists():
            try:
                with open(package_json, "r", encoding="utf-8") as f:
                    pkg = json.load(f)
                    all_deps = {
                        **pkg.get("dependencies", {}),
                        **pkg.get("devDependencies", {}),
                    }
                    deps["npm"] = list(all_deps.keys())[:30]  # Limit
            except:
                pass

        # Python dependencies
        requirements = path / "requirements.txt"
        if requirements.exists():
            try:
                with open(requirements, "r", encoding="utf-8") as f:
                    deps["python"] = [
                        line.split("==")[0].split(">=")[0].strip()
                        for line in f
                        if line.strip() and not line.startswith("#")
                    ][:30]
            except:
                pass

        return deps

    def _extract_database_models(self, path: Path) -> List[str]:
        """Extract database model names"""
        models = []

        for models_file in path.glob("**/models.py"):
            models.extend([e["name"] for e in self._parse_python_models(models_file)])

        return list(set(models))[:50]

    def _classify_vertical(self, platform_name: str) -> str:
        """Classify platform into vertical based on name"""
        name_lower = platform_name.lower()

        # Healthtech patterns
        if any(
            keyword in name_lower
            for keyword in ["memora", "clinic", "health", "medical"]
        ):
            return "Healthtech"

        # Agrotech patterns (check before arts to catch 'cora' correctly)
        if any(
            keyword in name_lower
            for keyword in ["farm", "agro", "agriculture", "crop", "cora"]
        ):
            return "Agrotech"

        # Arts & Culture patterns
        if any(
            keyword in name_lower for keyword in ["congo", "wave", "art", "culture"]
        ):
            return "Arts & Culture"

        # Legaltech patterns
        if any(keyword in name_lower for keyword in ["court", "legal", "law", "lens"]):
            return "Legaltech"

        # Uniontech patterns
        if any(
            keyword in name_lower
            for keyword in ["union", "worker", "labor", "eyes", "c3uo"]
        ):
            return "Uniontech"

        # Insurancetech patterns
        if any(
            keyword in name_lower
            for keyword in ["insurance", "sentry", "sentryiq", "policy", "claim"]
        ):
            return "Insurancetech"

        # Cybersecurity patterns
        if any(keyword in name_lower for keyword in ["cyber", "security"]):
            return "Cybersecurity"

        # Justice/Equity patterns
        if any(
            keyword in name_lower for keyword in ["abr", "racism", "equity", "insights"]
        ):
            return "Justice & Equity"

        # Trade/Commerce patterns
        if any(
            keyword in name_lower
            for keyword in ["trade", "shop", "quoter", "commerce", "export"]
        ):
            return "Trade & Commerce"

        return "Unknown"

    def _detect_ui_library(self, path: Path) -> str:
        """Detect UI component library used"""
        package_json = path / "package.json"
        if package_json.exists():
            try:
                with open(package_json, "r", encoding="utf-8") as f:
                    pkg = json.load(f)
                    deps = {
                        **pkg.get("dependencies", {}),
                        **pkg.get("devDependencies", {}),
                    }

                    if "@radix-ui/react-dialog" in deps or any(
                        "@radix-ui" in d for d in deps
                    ):
                        return "Radix UI"
                    elif "@mui/material" in deps or "@material-ui/core" in deps:
                        return "Material-UI"
                    elif "antd" in deps:
                        return "Ant Design"
                    elif "@chakra-ui/react" in deps:
                        return "Chakra UI"
            except:
                pass

        return "Unknown"

    def detect_cross_platform_patterns(self) -> Dict[str, Any]:
        """Detect patterns common across multiple platforms"""
        print(f"\n{'=' * 80}")
        print("DETECTING CROSS-PLATFORM PATTERNS")
        print(f"{'=' * 80}")

        all_entities = []
        all_dependencies = []
        all_frameworks = []
        vertical_distribution = Counter()

        for platform_name, analysis in self.portfolio_analysis["platforms"].items():
            all_entities.extend([e["name"] for e in analysis["entities"]])
            all_dependencies.extend(analysis["dependencies"].get("npm", []))
            all_dependencies.extend(analysis["dependencies"].get("python", []))
            all_frameworks.append(analysis["framework"])
            vertical_distribution[analysis["vertical"]] += 1

        # Find common entities (appearing in 3+ platforms)
        entity_counts = Counter(all_entities)
        common_entities = [
            entity for entity, count in entity_counts.items() if count >= 3
        ]

        # Find common dependencies
        dep_counts = Counter(all_dependencies)
        common_deps = [dep for dep, count in dep_counts.most_common(20)]

        # Framework distribution
        framework_counts = Counter(all_frameworks)

        patterns = {
            "common_entities": common_entities[:20],
            "common_dependencies": common_deps,
            "framework_distribution": dict(framework_counts),
            "vertical_distribution": dict(vertical_distribution),
            "total_unique_entities": len(set(all_entities)),
            "total_platforms": len(self.portfolio_analysis["platforms"]),
        }

        print(
            f"\n🔍 Common Entities (3+ platforms): {len(patterns['common_entities'])}"
        )
        for entity in patterns["common_entities"][:10]:
            print(f"  - {entity}")

        print(f"\n📦 Common Dependencies (top 10):")
        for dep in patterns["common_dependencies"][:10]:
            print(f"  - {dep}")

        print(f"\n🏗️ Framework Distribution:")
        for framework, count in patterns["framework_distribution"].items():
            print(f"  - {framework}: {count} platforms")

        print(f"\n🎯 Vertical Distribution:")
        for vertical, count in patterns["vertical_distribution"].items():
            print(f"  - {vertical}: {count} platforms")

        return patterns

    def generate_migration_manifest(
        self, platform_analysis: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate migration manifest for a platform"""
        manifest = {
            "legacy_platform": platform_analysis["name"],
            "target_vertical": platform_analysis["vertical"]
            .lower()
            .replace(" & ", "_")
            .replace(" ", "_"),
            "technology": {
                "framework": platform_analysis["framework"],
                "backend": platform_analysis["backend_tech"],
                "ui_library": platform_analysis["ui_library"],
            },
            "entities": [e["name"] for e in platform_analysis["entities"][:30]],
            "api_endpoints": [
                ep.get("path", "") for ep in platform_analysis["api_endpoints"][:20]
            ],
            "components": platform_analysis["components"][:20],
            "dependencies": platform_analysis["dependencies"],
            "database_models": platform_analysis["database_models"][:20],
            "migration_strategy": {
                "phase": "TBD",
                "priority": self._calculate_priority(platform_analysis),
                "estimated_weeks": self._estimate_migration_effort(platform_analysis),
                "backbone_dependencies": self._identify_backbone_deps(
                    platform_analysis
                ),
            },
            "backbone_mapping": {
                "uses_multi_org": True,
                "uses_ai_core": self._needs_ai_core(platform_analysis),
                "uses_compliance": True,
                "uses_billing": self._needs_billing(platform_analysis),
                "uses_notifications": True,
                "uses_analytics": True,
                "domain_specific_apps": self._suggest_django_apps(platform_analysis),
            },
        }

        return manifest

    def _calculate_priority(self, analysis: Dict[str, Any]) -> str:
        """Calculate migration priority"""
        # Healthtech = high priority
        if analysis["vertical"] == "Healthtech":
            return "HIGH"
        # Larger codebases with more entities = medium
        elif len(analysis["entities"]) > 20 or analysis["size_mb"] > 10:
            return "MEDIUM"
        else:
            return "LOW"

    def _estimate_migration_effort(self, analysis: Dict[str, Any]) -> int:
        """Estimate migration effort in weeks"""
        base_weeks = 4

        # Add weeks based on complexity
        if len(analysis["entities"]) > 30:
            base_weeks += 2
        if len(analysis["components"]) > 50:
            base_weeks += 1
        if len(analysis["api_endpoints"]) > 30:
            base_weeks += 1
        if analysis["size_mb"] > 20:
            base_weeks += 1

        return min(base_weeks, 8)  # Cap at 8 weeks

    def _identify_backbone_deps(self, analysis: Dict[str, Any]) -> List[str]:
        """Identify backbone dependencies needed"""
        deps = ["organizations", "compliance", "notifications", "analytics"]

        if self._needs_ai_core(analysis):
            deps.append("ai_core")
        if self._needs_billing(analysis):
            deps.append("billing")

        return deps

    def _needs_ai_core(self, analysis: Dict[str, Any]) -> bool:
        """Check if platform needs AI Core"""
        ai_keywords = [
            "ai",
            "ml",
            "intelligence",
            "cognitive",
            "prediction",
            "analysis",
        ]
        name_lower = analysis["name"].lower()
        return any(keyword in name_lower for keyword in ai_keywords)

    def _needs_billing(self, analysis: Dict[str, Any]) -> bool:
        """Check if platform needs billing module"""
        billing_keywords = [
            "subscription",
            "payment",
            "billing",
            "invoice",
            "shop",
            "quoter",
            "trade",
        ]
        name_lower = analysis["name"].lower()
        return any(keyword in name_lower for keyword in billing_keywords)

    def _suggest_django_apps(self, analysis: Dict[str, Any]) -> List[str]:
        """Suggest Django app structure based on analysis"""
        vertical = analysis["vertical"].lower().replace(" & ", "_").replace(" ", "_")
        name = analysis["name"].lower()

        apps = []

        # Vertical-specific app suggestions
        if "healthtech" in vertical:
            apps = ["health_records", "wellness", "assessment"]

        elif "agrotech" in vertical:
            if "cora" in name:
                apps = ["clinical_trials", "patient_management", "research"]
            else:
                apps = ["farms", "crops", "sensors", "supply_chain"]

        elif "arts" in vertical or "culture" in vertical:
            apps = ["artworks", "artists", "exhibitions", "collections", "events"]

        elif "legaltech" in vertical:
            apps = ["cases", "documents", "legal_research", "court_filing"]

        elif "uniontech" in vertical:
            apps = ["unions", "members", "campaigns", "grievances"]

        elif "insurancetech" in vertical:
            apps = ["policies", "claims", "underwriting", "risk_assessment", "quotes"]

        elif "cybersecurity" in vertical:
            apps = ["threats", "vulnerabilities", "incidents", "audits"]

        elif "justice" in vertical or "equity" in vertical:
            apps = ["incidents", "evidence", "campaigns", "policy"]

        elif "trade" in vertical or "commerce" in vertical:
            apps = ["products", "quotes", "orders", "exports"]

        return apps[:5]  # Limit to 5 apps

    def run_full_analysis(self):
        """Execute complete portfolio analysis"""
        print("\n" + "=" * 80)
        print("NZILA LEGACY PORTFOLIO ANALYSIS")
        print("=" * 80)

        # Step 1: Discover platforms
        self.discover_platforms()

        # Step 2: Analyze each platform
        for platform in self.platforms:
            analysis = self.analyze_platform(platform)
            self.portfolio_analysis["platforms"][platform["name"]] = analysis

        # Step 3: Detect cross-platform patterns
        patterns = self.detect_cross_platform_patterns()
        self.portfolio_analysis["cross_platform_patterns"] = patterns

        # Step 4: Generate migration manifests
        print(f"\n{'=' * 80}")
        print("GENERATING MIGRATION MANIFESTS")
        print(f"{'=' * 80}")

        manifests = {}
        for platform_name, analysis in self.portfolio_analysis["platforms"].items():
            manifest = self.generate_migration_manifest(analysis)
            manifests[platform_name] = manifest
            print(
                f"✓ Generated manifest for {platform_name} (Priority: {manifest['migration_strategy']['priority']}, Effort: {manifest['migration_strategy']['estimated_weeks']} weeks)"
            )

        self.portfolio_analysis["migration_manifests"] = manifests

        # Step 5: Calculate portfolio metrics
        self.portfolio_analysis["portfolio_metrics"] = (
            self._calculate_portfolio_metrics()
        )

        return self.portfolio_analysis

    def _calculate_portfolio_metrics(self) -> Dict[str, Any]:
        """Calculate overall portfolio metrics"""
        total_entities = sum(
            len(p["entities"]) for p in self.portfolio_analysis["platforms"].values()
        )
        total_components = sum(
            len(p["components"]) for p in self.portfolio_analysis["platforms"].values()
        )
        total_size_mb = sum(
            p["size_mb"] for p in self.portfolio_analysis["platforms"].values()
        )
        total_migration_weeks = sum(
            m["migration_strategy"]["estimated_weeks"]
            for m in self.portfolio_analysis["migration_manifests"].values()
        )

        # Calculate by vertical
        vertical_metrics = defaultdict(
            lambda: {"platforms": 0, "entities": 0, "weeks": 0}
        )
        for platform_name, analysis in self.portfolio_analysis["platforms"].items():
            vertical = analysis["vertical"]
            manifest = self.portfolio_analysis["migration_manifests"][platform_name]

            vertical_metrics[vertical]["platforms"] += 1
            vertical_metrics[vertical]["entities"] += len(analysis["entities"])
            vertical_metrics[vertical]["weeks"] += manifest["migration_strategy"][
                "estimated_weeks"
            ]

        return {
            "total_platforms": len(self.portfolio_analysis["platforms"]),
            "total_entities": total_entities,
            "total_components": total_components,
            "total_size_mb": round(total_size_mb, 2),
            "total_migration_weeks": total_migration_weeks,
            "backbone_weeks": 16,
            "total_with_backbone": total_migration_weeks + 16,
            "vertical_metrics": dict(vertical_metrics),
            "roi_without_backbone_weeks": len(self.portfolio_analysis["platforms"])
            * 24,  # 24 weeks per platform standalone
            "roi_percentage_saved": round(
                (
                    1
                    - (total_migration_weeks + 16)
                    / (len(self.portfolio_analysis["platforms"]) * 24)
                )
                * 100,
                1,
            ),
        }

    def save_results(self, output_file: str = "legacy_portfolio_analysis.json"):
        """Save analysis results to JSON file"""
        # Convert sets to lists for JSON serialization
        serializable_analysis = json.loads(
            json.dumps(
                self.portfolio_analysis,
                default=lambda x: list(x) if isinstance(x, set) else str(x),
            )
        )

        output_path = self.legacy_dir.parent / output_file
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(serializable_analysis, f, indent=2, ensure_ascii=False)

        print(f"\n✅ Analysis saved to: {output_path}")
        return output_path

    def print_summary_report(self):
        """Print executive summary report"""
        print("\n" + "=" * 80)
        print("PORTFOLIO ANALYSIS SUMMARY")
        print("=" * 80)

        metrics = self.portfolio_analysis["portfolio_metrics"]

        print(f"\n📊 PORTFOLIO OVERVIEW:")
        print(f"  Total Platforms: {metrics['total_platforms']}")
        print(f"  Total Entities: {metrics['total_entities']}")
        print(f"  Total Components: {metrics['total_components']}")
        print(f"  Total Codebase Size: {metrics['total_size_mb']:.2f} MB")

        print(f"\n⏱️ MIGRATION TIMELINE:")
        print(f"  Backbone Build: {metrics['backbone_weeks']} weeks")
        print(f"  Platform Migrations: {metrics['total_migration_weeks']} weeks")
        print(f"  Total Timeline: {metrics['total_with_backbone']} weeks")

        print(f"\n💰 ROI CALCULATION:")
        print(
            f"  Without Backbone: {metrics['roi_without_backbone_weeks']} weeks ({metrics['total_platforms']} platforms × 24 weeks)"
        )
        print(
            f"  With Backbone: {metrics['total_with_backbone']} weeks (16 backbone + {metrics['total_migration_weeks']} migrations)"
        )
        print(
            f"  Time Saved: {metrics['roi_without_backbone_weeks'] - metrics['total_with_backbone']} weeks ({metrics['roi_percentage_saved']}% faster)"
        )

        print(f"\n🎯 VERTICAL BREAKDOWN:")
        for vertical, stats in metrics["vertical_metrics"].items():
            print(f"  {vertical}:")
            print(f"    - Platforms: {stats['platforms']}")
            print(f"    - Entities: {stats['entities']}")
            print(f"    - Migration Time: {stats['weeks']} weeks")

        print(f"\n🏗️ FRAMEWORK DISTRIBUTION:")
        patterns = self.portfolio_analysis["cross_platform_patterns"]
        for framework, count in patterns["framework_distribution"].items():
            print(f"  {framework or 'Unknown'}: {count} platforms")

        print("\n" + "=" * 80)


if __name__ == "__main__":
    # Initialize analyzer
    legacy_dir = Path(__file__).parent / "legacy-codebases"
    analyzer = LegacyPortfolioAnalyzer(str(legacy_dir))

    # Run full analysis
    results = analyzer.run_full_analysis()

    # Save results
    analyzer.save_results("legacy_portfolio_analysis.json")

    # Print summary
    analyzer.print_summary_report()

    print(
        "\n✅ ANALYSIS COMPLETE! Review legacy_portfolio_analysis.json for detailed results."
    )
    print("📋 Next Steps:")
    print("  1. Review vertical classifications")
    print("  2. Validate migration priorities")
    print("  3. Start backbone build (16 weeks)")
    print("  4. Begin platform migrations sequentially")
