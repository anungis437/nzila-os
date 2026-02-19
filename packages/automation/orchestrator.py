#!/usr/bin/env python3
"""
Migration Orchestrator — Main CLI for Nzila migration automation

Coordinates the entire migration process:
- Platform analysis
- Manifest generation
- Pattern extraction  
- Migration planning
- Azure resource provisioning
- Migration execution
- Progress tracking
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional

# Import configuration and constants
from config import get_config, MigrationConstants

# Use package-qualified imports — no sys.path manipulation needed
from generators.core.platform_analyzer import PlatformAnalyzer
from generators.core.manifest_generator import ManifestGenerator, ManifestConfig
from generators import (
    CodeGenerator, run_abr_generation, run_ue_generation,
    DependencyAnalyzer, analyze_abr_dependencies, analyze_ue_dependencies,
    ProgressTracker, MigrationPhase, init_tracking,
)


class MigrationOrchestrator:
    """Main orchestrator for platform migrations"""
    
    def __init__(self, workspace_root: Path):
        self.workspace_root = Path(workspace_root)
        # Use centralized config instead of hardcoded paths
        config = get_config()
        self.legacy_root = config.legacy_root
        self.data_dir = config.data_dir
        self.manifests_dir = config.manifests_dir
        self.template_root = self.workspace_root / "nzila-scripts-book-template"
        
        # Ensure directories exist
        self.data_dir.mkdir(exist_ok=True, parents=True)
        self.manifests_dir.mkdir(exist_ok=True, parents=True)
    
    def analyze_platforms(self, platform_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Analyze platforms and return profiles"""
        print("="*60)
        print("PLATFORM ANALYSIS")
        print("="*60)
        
        analyzer = PlatformAnalyzer(self.legacy_root)
        
        if platform_id:
            # Analyze single platform
            platform_path = self.legacy_root / platform_id
            if not platform_path.exists():
                print(f"Error: Platform not found: {platform_id}")
                return []
            
            profile = analyzer.analyze_platform(platform_path)
            profiles = [profile]
        else:
            # Analyze all platforms
            profiles = analyzer.analyze_all()
        
        # Export profiles
        output_file = self.data_dir / "platform_profiles.json"
        analyzer.export_profiles(profiles, output_file)
        
        return [self._profile_to_dict(p) for p in profiles]
    
    def _profile_to_dict(self, profile) -> Dict[str, Any]:
        """Convert profile dataclass to dict"""
        from dataclasses import asdict
        return asdict(profile)
    
    def generate_manifests(self, profiles: Optional[List[Dict[str, Any]]] = None):
        """Generate scripts-book manifests"""
        print("\n" + "="*60)
        print("MANIFEST GENERATION")
        print("="*60)
        
        # Load profiles if not provided
        if profiles is None:
            profiles_file = self.data_dir / "platform_profiles.json"
            if not profiles_file.exists():
                print("Error: No platform profiles found. Run analysis first.")
                return
            
            with open(profiles_file) as f:
                profiles = json.load(f)
        
        # Generate manifests
        config = ManifestConfig(
            owner_github="anungis437",
            azure_base_region="canadacentral",
            clerk_enabled=True,
            strict_parity=True
        )
        
        generator = ManifestGenerator(config)
        manifests = generator.generate_all_manifests(profiles, self.manifests_dir)
        generator.generate_readme(manifests, self.manifests_dir / "README.md")
    
    def create_migration_plan(self, strategy: str = "parallel"):
        """Create comprehensive migration plan"""
        print("\n" + "="*60)
        print("MIGRATION PLANNING")
        print("="*60)
        
        # Load profiles
        profiles_file = self.data_dir / "platform_profiles.json"
        if not profiles_file.exists():
            print("Error: No platform profiles found. Run analysis first.")
            return
        
        with open(profiles_file) as f:
            profiles = json.load(f)
        
        # Sort by complexity and dependencies
        sorted_profiles = self._sort_by_migration_order(profiles)
        
        if strategy == "parallel":
            plan = self._create_parallel_plan(sorted_profiles)
        else:
            plan = self._create_sequential_plan(sorted_profiles)
        
        # Save plan
        plan_file = self.workspace_root / "MIGRATION_PLAN.json"
        with open(plan_file, "w") as f:
            json.dump(plan, f, indent=2)
        
        # Generate markdown report
        self._generate_plan_report(plan, self.workspace_root / "MIGRATION_PLAN.md")
        
        print(f"\n✓ Migration plan saved: {plan_file}")
        print(f"✓ Report saved: {self.workspace_root / 'MIGRATION_PLAN.md'}")
    
    def _sort_by_migration_order(self, profiles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Sort platforms by optimal migration order"""
        # Use constants from MigrationConstants instead of hardcoded values
        priority_map = MigrationConstants.PLATFORM_PRIORITY
        complexity_scores = MigrationConstants.COMPLEXITY_SCORES
        
        def sort_key(p):
            platform_id = p["platform_id"]
            priority = priority_map.get(platform_id, 100)
            complexity_score = complexity_scores.get(p["complexity"], 2)
            return (priority, -complexity_score, -p["entity_count"])
        
        return sorted(profiles, key=sort_key)
    
    def _create_sequential_plan(self, profiles: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Create sequential migration plan"""
        total_weeks = sum(p["migration_estimate_weeks"] for p in profiles)
        
        plan = {
            "plan_id": "nzila-sequential-migration-2026",
            "strategy": "sequential",
            "total_platforms": len(profiles),
            "estimated_weeks": total_weeks,
            "phases": []
        }
        
        current_week = 0
        for i, profile in enumerate(profiles, 1):
            phase = {
                "phase": i,
                "name": profile["name"],
                "platform_id": profile["platform_id"],
                "start_week": current_week,
                "duration_weeks": profile["migration_estimate_weeks"],
                "end_week": current_week + profile["migration_estimate_weeks"],
                "complexity": profile["complexity"],
                "entities": profile["entity_count"]
            }
            plan["phases"].append(phase)
            current_week += profile["migration_estimate_weeks"]
        
        return plan
    
    def _create_parallel_plan(self, profiles: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Create parallel migration plan with intelligent batching"""
        # Group platforms into batches
        batches = self._create_migration_batches(profiles)
        
        total_weeks = sum(batch["duration_weeks"] for batch in batches)
        
        plan = {
            "plan_id": "nzila-parallel-migration-2026",
            "strategy": "parallel",
            "total_platforms": len(profiles),
            "estimated_weeks": total_weeks,
            "sequential_baseline": sum(p["migration_estimate_weeks"] for p in profiles),
            "time_savings": sum(p["migration_estimate_weeks"] for p in profiles) - total_weeks,
            "batches": batches
        }
        
        return plan
    
    def _create_migration_batches(self, profiles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Create intelligent batches for parallel migration"""
        batches = []
        
        # Batch 1: Foundation platforms (critical, sequential)
        foundation = [p for p in profiles if p["platform_id"] in ["union-eyes", "c3uo"]]
        if foundation:
            batches.append({
                "batch": 1,
                "name": "Foundation Platforms",
                "platforms": [p["platform_id"] for p in foundation],
                "duration_weeks": max((p["migration_estimate_weeks"] for p in foundation), default=0),
                "goal": "Establish migration patterns for Next.js and Django",
                "parallel": False
            })
        
        # Batch 2: High complexity platforms (parallel where possible)
        high_complexity = [p for p in profiles 
                          if p["complexity"] in ["HIGH", "EXTREME"] 
                          and p not in foundation]
        if high_complexity:
            # Group by similar tech stack
            nextjs_platforms = [p for p in high_complexity if p["tech_stack"]["framework"] == "Next.js"]
            django_platforms = [p for p in high_complexity if p["tech_stack"]["framework"] == "Django"]
            
            if nextjs_platforms:
                batches.append({
                    "batch": len(batches) + 1,
                    "name": "Next.js Platforms (Parallel)",
                    "platforms": [p["platform_id"] for p in nextjs_platforms],
                    "duration_weeks": max((p["migration_estimate_weeks"] for p in nextjs_platforms), default=0),
                    "goal": "Parallel migration of Next.js applications",
                    "parallel": True
                })
            
            if django_platforms:
                batches.append({
                    "batch": len(batches) + 1,
                    "name": "Django Platforms (Parallel)",
                    "platforms": [p["platform_id"] for p in django_platforms],
                    "duration_weeks": max((p["migration_estimate_weeks"] for p in django_platforms), default=0),
                    "goal": "Parallel migration of Django applications",
                    "parallel": True
                })
        
        # Batch 3: Medium/Low complexity (parallel)
        remaining = [p for p in profiles 
                    if p["complexity"] in ["MEDIUM", "LOW"] 
                    and p not in foundation]
        
        # Split into two parallel batches if more than 4 platforms
        if len(remaining) > 4:
            mid = len(remaining) // 2
            for i, batch_platforms in enumerate([remaining[:mid], remaining[mid:]], 1):
                batches.append({
                    "batch": len(batches) + 1,
                    "name": f"Standard Platforms Batch {i} (Parallel)",
                    "platforms": [p["platform_id"] for p in batch_platforms],
                    "duration_weeks": max((p["migration_estimate_weeks"] for p in batch_platforms), default=0),
                    "goal": "Parallel migration of standard complexity platforms",
                    "parallel": True
                })
        elif remaining:
            batches.append({
                "batch": len(batches) + 1,
                "name": "Standard Platforms (Parallel)",
                "platforms": [p["platform_id"] for p in remaining],
                "duration_weeks": max((p["migration_estimate_weeks"] for p in remaining), default=0),
                "goal": "Parallel migration of standard complexity platforms",
                "parallel": True
            })
        
        return batches
    
    def _generate_plan_report(self, plan: Dict[str, Any], output_file: Path):
        """Generate markdown report for migration plan"""
        lines = [
            f"# Nzila Migration Plan\n\n",
            f"**Strategy**: {plan['strategy'].upper()}\n",
            f"**Total Platforms**: {plan['total_platforms']}\n",
            f"**Estimated Duration**: {plan['estimated_weeks']} weeks\n\n"
        ]
        
        if plan["strategy"] == "parallel":
            lines.append(f"**Sequential Baseline**: {plan['sequential_baseline']} weeks\n")
            lines.append(f"**Time Savings**: {plan['time_savings']} weeks ({round(plan['time_savings']/plan['sequential_baseline']*100)}% reduction)\n\n")
            
            lines.append("## Migration Batches\n\n")
            for batch in plan["batches"]:
                lines.append(f"### Batch {batch['batch']}: {batch['name']}\n\n")
                lines.append(f"- **Duration**: {batch['duration_weeks']} weeks\n")
                lines.append(f"- **Execution**: {('Parallel' if batch['parallel'] else 'Sequential')}\n")
                lines.append(f"- **Goal**: {batch['goal']}\n")
                lines.append(f"- **Platforms**:\n")
                for platform_id in batch['platforms']:
                    lines.append(f"  - `{platform_id}`\n")
                lines.append("\n")
        else:
            lines.append("## Migration Phases (Sequential)\n\n")
            for phase in plan["phases"]:
                lines.append(f"### Phase {phase['phase']}: {phase['name']}\n\n")
                lines.append(f"- **Platform**: `{phase['platform_id']}`\n")
                lines.append(f"- **Weeks {phase['start_week']+1}-{phase['end_week']}** ({phase['duration_weeks']} weeks)\n")
                lines.append(f"- **Complexity**: {phase['complexity']}\n")
                lines.append(f"- **Entities**: {phase['entities']}\n\n")
        
        with open(output_file, "w") as f:
            f.writelines(lines)
    
    def apply_template(self, platform_id: str, dry_run: bool = False):
        """Apply scripts-book template to a platform"""
        print(f"\n{'DRY RUN: ' if dry_run else ''}Applying template to {platform_id}")
        
        # Check if manifest exists
        manifest_file = self.manifests_dir / f"{platform_id}.manifest.json"
        if not manifest_file.exists():
            print(f"Error: No manifest found for {platform_id}")
            print("Run 'generate-manifests' first")
            return
        
        # Check if template directory exists
        if not self.template_root.exists():
            print(f"Error: Template not found at {self.template_root}")
            return
        
        # Copy manifest to target repo (would be the new repo location)
        target_repo = self.workspace_root.parent / f"{platform_id}-platform"
        print(f"Target repository: {target_repo}")
        
        if dry_run:
            print("Dry run - would execute:")
            print(f"  1. Create directory: {target_repo}")
            print(f"  2. Copy manifest to: {target_repo / 'scripts-book.manifest.json'}")
            print(f"  3. Run: pnpm sb:apply --target {target_repo}")
        else:
            print("Template application requires manual steps:")
            print(f"  1. Create target repo: {target_repo}")
            print(f"  2. Copy manifest: {manifest_file} → {target_repo / 'scripts-book.manifest.json'}")
            print(f"  3. Apply template:")
            print(f"     cd {self.template_root}")
            print(f"     pnpm sb:apply --target {target_repo}")
    
    def generate_code(self, platform: str = "all"):
        """Generate Django models/serializers/views from legacy schemas"""
        print("="*60)
        print("CODE GENERATION")
        print("="*60)

        results = []
        if platform in ("abr", "all"):
            results.extend(run_abr_generation(self.workspace_root))
        if platform in ("ue", "all"):
            results.extend(run_ue_generation(self.workspace_root))

        total_models = sum(r.model_count for r in results)
        total_fields = sum(r.field_count for r in results)
        print(f"\nGenerated {total_models} models with {total_fields} fields")
        return results

    def analyze_dependencies(self, platform: str = "all"):
        """Analyze npm/pnpm dependencies and classify for migration"""
        print("="*60)
        print("DEPENDENCY ANALYSIS")
        print("="*60)

        reports = []
        if platform in ("abr", "all"):
            reports.append(analyze_abr_dependencies(self.workspace_root))
        if platform in ("ue", "all"):
            reports.append(analyze_ue_dependencies(self.workspace_root))

        for report in reports:
            print(f"\n{report.platform}: {report.total_packages} packages")
            for cat, count in sorted(report.categories.items()):
                print(f"  {cat}: {count}")
        return reports

    def track_progress(self, dashboard: bool = False,
                       platform: Optional[str] = None):
        """Initialize or display migration progress tracking"""
        tracker = init_tracking(self.workspace_root)

        if dashboard:
            print(tracker.generate_dashboard(platform))
        else:
            for pid, p in tracker.platforms.items():
                p.compute_overall()
                print(f"{p.platform_name}: {p.overall_progress:.1f}% overall")

        return tracker

    def status(self):
        """Show migration status"""
        print("="*60)
        print("MIGRATION STATUS")
        print("="*60)
        
        # Check for analysis
        profiles_file = self.data_dir / "platform_profiles.json"
        if profiles_file.exists():
            with open(profiles_file) as f:
                profiles = json.load(f)
            print(f"✓ Platform Analysis: {len(profiles)} platforms analyzed")
        else:
            print("✗ Platform Analysis: Not completed")
            return
        
        # Check for manifests
        if self.manifests_dir.exists():
            manifests = list(self.manifests_dir.glob("*.manifest.json"))
            print(f"✓ Manifests Generated: {len(manifests)} manifests")
        else:
            print("✗ Manifests: Not generated")
        
        # Check for migration plan
        plan_file = self.workspace_root / "MIGRATION_PLAN.json"
        if plan_file.exists():
            with open(plan_file) as f:
                plan = json.load(f)
            print(f"✓ Migration Plan: {plan['strategy']} strategy, {plan['estimated_weeks']} weeks")
        else:
            print("✗ Migration Plan: Not created")
        
        print("\nQuick Statistics:")
        print(f"  Total Entities: {sum(p['entity_count'] for p in profiles):,}")
        print(f"  Total Size: {sum(p['size_mb'] for p in profiles):.2f} MB")
        print(f"  Avg Complexity: {sum(1 for p in profiles if p['complexity'] in ['HIGH', 'EXTREME']) / len(profiles) * 100:.0f}% high/extreme")


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Nzila Migration Orchestrator")
    parser.add_argument("--workspace", default=".", help="Workspace root directory")
    
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")
    
    # Analyze command
    analyze_parser = subparsers.add_parser("analyze", help="Analyze platforms")
    analyze_parser.add_argument("--platform", help="Specific platform ID")
    analyze_parser.add_argument("--all", action="store_true", help="Analyze all platforms")
    
    # Generate manifests command
    subparsers.add_parser("generate-manifests", help="Generate scripts-book manifests")
    
    # Create plan command
    plan_parser = subparsers.add_parser("plan", help="Create migration plan")
    plan_parser.add_argument("--strategy", choices=["sequential", "parallel"], 
                            default="parallel", help="Migration strategy")
    
    # Apply template command
    apply_parser = subparsers.add_parser("apply-template", help="Apply scripts-book template")
    apply_parser.add_argument("--platform", required=True, help="Platform ID")
    apply_parser.add_argument("--dry-run", action="store_true", help="Preview without executing")
    
    # Code generation command
    codegen_parser = subparsers.add_parser("generate-code", help="Generate Django code from legacy schemas")
    codegen_parser.add_argument("--platform", choices=["abr", "ue", "all"], default="all")

    # Dependency analysis command
    deps_parser = subparsers.add_parser("analyze-deps", help="Analyze npm/pnpm dependencies")
    deps_parser.add_argument("--platform", choices=["abr", "ue", "all"], default="all")

    # Progress tracking command
    progress_parser = subparsers.add_parser("progress", help="Show migration progress")
    progress_parser.add_argument("--dashboard", action="store_true", help="Show full Markdown dashboard")
    progress_parser.add_argument("--platform", choices=["abr", "ue"], help="Filter to platform")

    # Status command
    subparsers.add_parser("status", help="Show migration status")
    
    # Full automated workflow
    subparsers.add_parser("full-setup", help="Run full automated setup (analyze + manifests + plan)")
    
    args = parser.parse_args()
    
    # Initialize orchestrator
    orchestrator = MigrationOrchestrator(Path(args.workspace).absolute())
    
    # Execute command
    if args.command == "analyze":
        platform_id = args.platform if hasattr(args, 'platform') else None
        profiles = orchestrator.analyze_platforms(platform_id)
    
    elif args.command == "generate-manifests":
        orchestrator.generate_manifests()
    
    elif args.command == "plan":
        orchestrator.create_migration_plan(args.strategy)
    
    elif args.command == "apply-template":
        orchestrator.apply_template(args.platform, args.dry_run)
    
    elif args.command == "generate-code":
        orchestrator.generate_code(args.platform)

    elif args.command == "analyze-deps":
        orchestrator.analyze_dependencies(args.platform)

    elif args.command == "progress":
        orchestrator.track_progress(
            dashboard=args.dashboard,
            platform=getattr(args, 'platform', None)
        )

    elif args.command == "status":
        orchestrator.status()
    
    elif args.command == "full-setup":
        print("Running full automated setup...\n")
        profiles = orchestrator.analyze_platforms()
        orchestrator.generate_manifests(profiles)
        orchestrator.create_migration_plan("parallel")
        orchestrator.status()
        print("\n✓ Full setup complete!")
    
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
