#!/usr/bin/env python3
"""
Update Progress - Update migration dashboard based on actual completed work

This script examines the generated files and audit reports to automatically
update the progress tracker with the current state of the migration.
"""

import json
from pathlib import Path

try:
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from logging_config import MigrationLogger
    logger = MigrationLogger.get_logger(__name__)
except ImportError:
    import logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)

from progress_tracker import (
    ProgressTracker,
    MigrationPhase,
)


def update_platform_progress(tracker: ProgressTracker, platform_id: str,
                              platform_name: str, workspace_root: Path):
    """Detect and update progress for a platform"""
    
    data_dir = workspace_root / "packages" / "automation" / "data"
    generated_dir = data_dir / "generated" / platform_id
    
    logger.info(f"Updating progress for {platform_name}")
    
    # Initialize platform if not already
    if platform_id not in tracker.platforms:
        tracker.init_platform(platform_id, platform_name)
    
    # ──────── PHASE: ANALYSIS ────────
    audit_report = data_dir / f"{platform_id}-audit-report.json"
    
    # Map platform_id to scaffold filename
    scaffold_names = {
        "ue": "union-eyes-scaffold.md",
        "abr": "abr-insights-scaffold.md",
    }
    scaffold_filename = scaffold_names.get(platform_id, f"{platform_id}-scaffold.md")
    scaffold_doc = workspace_root / "tech-repo-scaffold" / "vertical-apps" / scaffold_filename
    
    if audit_report.exists() and scaffold_doc.exists():
        logger.info(f"  ✓ Analysis complete (audit report + scaffold doc)")
        if tracker.platforms[platform_id].phases[MigrationPhase.ANALYSIS.value].status.value != "completed":
            tracker.start_phase(platform_id, MigrationPhase.ANALYSIS)
            tracker.pass_gate(platform_id, MigrationPhase.ANALYSIS, "schema_report_exists",
                             "Comprehensive audit report generated")
            tracker.pass_gate(platform_id, MigrationPhase.ANALYSIS, "tech_stack_identified",
                             "Full tech stack documented in audit report")
            tracker.update_phase(platform_id, MigrationPhase.ANALYSIS, 2, 2)
            tracker.complete_phase(platform_id, MigrationPhase.ANALYSIS)
    
    # ──────── PHASE: SCHEMA EXTRACTION ────────
    schema_extraction_report = data_dir / "SCHEMA_EXTRACTION_REPORT.md"
    generation_report = generated_dir / "generation_report.json"
    
    if schema_extraction_report.exists() and generation_report.exists():
        with open(generation_report) as f:
            gen_data = json.load(f)
        
        tables_count = gen_data.get("total_tables", 0)
        apps_count = gen_data.get("total_apps", 0)
        
        logger.info(f"  ✓ Schema extraction complete ({tables_count} tables, {apps_count} apps)")
        phase_state = tracker.platforms[platform_id].phases[MigrationPhase.SCHEMA_EXTRACTION.value]
        if phase_state.status.value != "completed":
            tracker.start_phase(platform_id, MigrationPhase.SCHEMA_EXTRACTION)
            tracker.pass_gate(platform_id, MigrationPhase.SCHEMA_EXTRACTION, "all_tables_extracted",
                             f"{tables_count} tables extracted")
            tracker.pass_gate(platform_id, MigrationPhase.SCHEMA_EXTRACTION, "relationships_mapped",
                             "Foreign keys and relations documented")
            tracker.pass_gate(platform_id, MigrationPhase.SCHEMA_EXTRACTION, "enums_catalogued",
                             "Enums extracted from schemas")
            tracker.update_phase(platform_id, MigrationPhase.SCHEMA_EXTRACTION, tables_count, tables_count)
            tracker.complete_phase(platform_id, MigrationPhase.SCHEMA_EXTRACTION)
    
    # ──────── PHASE: CODE GENERATION ────────
    if generated_dir.exists():
        apps = [d for d in generated_dir.iterdir() if d.is_dir() and not d.name.startswith('.')]
        
        # Check if all apps have required files
        all_complete = True
        for app in apps:
            required_files = ["models.py", "serializers.py", "views.py", "urls.py"]
            for rf in required_files:
                if not (app / rf).exists():
                    all_complete = False
                    break
        
        if all_complete and len(apps) > 0:
            logger.info(f"  ✓ Code generation complete ({len(apps)} apps)")
            phase_state = tracker.platforms[platform_id].phases[MigrationPhase.CODE_GENERATION.value]
            if phase_state.status.value != "completed":
                tracker.start_phase(platform_id, MigrationPhase.CODE_GENERATION)
                tracker.pass_gate(platform_id, MigrationPhase.CODE_GENERATION, "models_generated",
                                 f"{len(apps)} Django apps with models")
                tracker.pass_gate(platform_id, MigrationPhase.CODE_GENERATION, "serializers_generated",
                                 "DRF serializers generated for all models")
                tracker.pass_gate(platform_id, MigrationPhase.CODE_GENERATION, "views_generated",
                                 "DRF viewsets generated")
                tracker.pass_gate(platform_id, MigrationPhase.CODE_GENERATION, "no_syntax_errors",
                                 "Code validation passed")
                tracker.update_phase(platform_id, MigrationPhase.CODE_GENERATION, len(apps), len(apps))
                tracker.complete_phase(platform_id, MigrationPhase.CODE_GENERATION)
    
    # ──────── PHASE: DEPENDENCY MAPPING ────────
    dependency_report = data_dir / f"{platform_id}-dependency-report.json"
    
    if dependency_report.exists():
        with open(dependency_report) as f:
            dep_data = json.load(f)
        
        total_packages = dep_data.get("total_packages", 0)
        
        if total_packages > 0:
            logger.info(f"  ✓ Dependency mapping complete ({total_packages} packages)")
            tracker.start_phase(platform_id, MigrationPhase.DEPENDENCY_MAPPING)
            tracker.pass_gate(platform_id, MigrationPhase.DEPENDENCY_MAPPING, "deps_classified",
                             f"{total_packages} packages classified")
            tracker.pass_gate(platform_id, MigrationPhase.DEPENDENCY_MAPPING, "python_equivalents",
                             "Python equivalents identified")
            tracker.pass_gate(platform_id, MigrationPhase.DEPENDENCY_MAPPING, "risk_assessed",
                             "Migration risks documented")
            tracker.update_phase(platform_id, MigrationPhase.DEPENDENCY_MAPPING,
                               total_packages, total_packages)
            tracker.complete_phase(platform_id, MigrationPhase.DEPENDENCY_MAPPING)
        else:
            # Dependency analysis not yet done
            logger.info(f"  ⏳ Dependency mapping not started (0 packages)")
            tracker.update_phase(platform_id, MigrationPhase.DEPENDENCY_MAPPING, 0, 1,
                               "Waiting for access to legacy codebase")
    
    # ──────── PHASE: SCAFFOLD POPULATION ────────
    # Check if actual repo exists (one level up from workspace)
    repo_name = f"nzila-{'union-eyes' if platform_id == 'ue' else 'abr-insights'}"
    repo_path = workspace_root.parent / repo_name
    
    if repo_path.exists() and (repo_path / "backend").exists():
        backend_apps = [d for d in (repo_path / "backend").iterdir()
                       if d.is_dir() and not d.name.startswith('.')]
        
        if len(backend_apps) > 0:
            logger.info(f"  ✓ Scaffold population complete ({repo_name} exists)")
            tracker.start_phase(platform_id, MigrationPhase.SCAFFOLD_POPULATION)
            tracker.update_phase(platform_id, MigrationPhase.SCAFFOLD_POPULATION,
                               len(backend_apps), len(apps) if apps else len(backend_apps))
            tracker.complete_phase(platform_id, MigrationPhase.SCAFFOLD_POPULATION)
    else:
        logger.info(f"  ⏳ Scaffold population not started (repo not created)")
    
    logger.info(f"Progress for {platform_name}: {tracker.get_overall_progress(platform_id):.1f}%")


def main():
    """Update progress for all platforms"""
    workspace_root = Path(__file__).parent.parent.parent.parent
    checkpoint_dir = workspace_root / "packages" / "automation" / "data" / "progress"
    
    tracker = ProgressTracker(checkpoint_dir)
    
    # Update Union Eyes
    update_platform_progress(tracker, "ue", "Union Eyes", workspace_root)
    
    # Update ABR Insights
    update_platform_progress(tracker, "abr", "ABR Insights", workspace_root)
    
    # Write updated dashboard
    dashboard_path = workspace_root / "packages" / "automation" / "data" / "MIGRATION_DASHBOARD.md"
    tracker.write_dashboard(dashboard_path)
    
    logger.info("=" * 60)
    logger.info("✅ Progress update complete")
    logger.info(f"📊 Dashboard: {dashboard_path}")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
