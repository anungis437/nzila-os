#!/usr/bin/env python3
"""
Audit Report Generator — Creates comprehensive platform audit reports
combining schema analysis, dependency mapping, and migration planning.

Generates detailed JSON audit reports for Union Eyes and ABR Insights.
"""

import json
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime
from dataclasses import dataclass, asdict

try:
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from logging_config import MigrationLogger
    logger = MigrationLogger.get_logger(__name__)
except ImportError:
    import logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)


class AuditReportGenerator:
    """Generate comprehensive audit reports for platform migrations"""
    
    def __init__(self, workspace_root: Path):
        self.workspace_root = Path(workspace_root)
        self.data_dir = self.workspace_root / "packages" / "automation" / "data"
        
    def load_schema_report(self, platform: str) -> Dict[str, Any]:
        """Load schema extraction data"""
        report_path = self.data_dir / "SCHEMA_EXTRACTION_REPORT.md"
        if not report_path.exists():
            logger.warning(f"Schema report not found: {report_path}")
            return {}
        
        # Parse markdown report for platform-specific data
        # This is a placeholder - would need full markdown parser
        return {"status": "found", "path": str(report_path)}
    
    def load_generation_report(self, platform: str) -> Dict[str, Any]:
        """Load model generation report"""
        report_path = self.data_dir / "generated" / platform / "generation_report.json"
        if report_path.exists():
            with open(report_path) as f:
                return json.load(f)
        return {}
    
    def load_dependency_report(self, platform: str) -> Dict[str, Any]:
        """Load dependency analysis report"""
        report_path = self.data_dir / f"{platform}-dependency-report.json"
        if report_path.exists():
            with open(report_path) as f:
                return json.load(f)
        return {}
    
    def generate_audit_report(self, platform: str, platform_name: str,
                             complexity: str, estimate_weeks: str,
                             total_entities: int, size_mb: float) -> Dict[str, Any]:
        """Generate comprehensive audit report for a platform"""
        
        logger.info(f"Generating audit report for {platform_name}...")
        
        # Load existing data
        schema_data = self.load_schema_report(platform)
        gen_data = self.load_generation_report(platform)
        dep_data = self.load_dependency_report(platform)
        
        # Build report
        report = {
            "platform_id": platform,
            "platform_name": platform_name,
            "audit_date": datetime.now().strftime("%Y-%m-%d"),
            "auditor": "Nzila Platform Analyzer V2",
            "version": "1.0.0",
            "executive_summary": {
                "total_entities": total_entities,
                "codebase_size_mb": size_mb,
                "complexity_score": complexity,
                "migration_estimate_weeks": estimate_weeks,
                "schema_extraction_complete": bool(gen_data),
                "models_generated": gen_data.get("total_tables", 0),
                "apps_generated": gen_data.get("total_apps", 0),
            },
            "schema_extraction": {
                "status": "complete" if gen_data else "pending",
                "tables_count": gen_data.get("total_tables", 0),
                "generated_models_location": f"packages/automation/data/generated/{platform}/",
                "report": gen_data
            },
            "dependencies": dep_data,
            "generated_timestamp": datetime.now().isoformat(),
        }
        
        return report
    
    def write_report(self, platform: str, report: Dict[str, Any], output_path: Optional[Path] = None):
        """Write audit report to file"""
        if output_path is None:
            output_path = self.data_dir / f"{platform}-audit-report.json"
        
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, 'w') as f:
            json.dump(report, f, indent=2)
        
        logger.info(f"Audit report written: {output_path}")
        return output_path
    
    def update_existing_report(self, platform: str, updates: Dict[str, Any]):
        """Update an existing audit report with new data"""
        report_path = self.data_dir / f"{platform}-audit-report.json"
        
        if not report_path.exists():
            logger.error(f"Report not found: {report_path}")
            return
        
        with open(report_path) as f:
            report = json.load(f)
        
        # Deep merge updates
        def deep_merge(base, updates):
            for key, value in updates.items():
                if isinstance(value, dict) and key in base:
                    deep_merge(base[key], value)
                else:
                    base[key] = value
            return base
        
        report = deep_merge(report, updates)
        report["last_updated"] = datetime.now().isoformat()
        
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)
        
        logger.info(f"Updated audit report: {report_path}")


def main():
    """CLI entry point"""
    import argparse
    parser = argparse.ArgumentParser(description="Audit Report Generator")
    parser.add_argument("--platform", choices=["ue", "abr", "all"], default="all")
    parser.add_argument("--workspace", type=Path,
                        default=Path(__file__).parent.parent.parent)
    parser.add_argument("--update", action="store_true",
                        help="Update existing reports with fresh data")
    
    args = parser.parse_args()
    
    generator = AuditReportGenerator(args.workspace)
    
    if args.update:
        # Update existing reports with latest generation data
        if args.platform in ("ue", "all"):
            gen_data = generator.load_generation_report("ue")
            if gen_data:
                generator.update_existing_report("ue", {
                    "schema_extraction": {
                        "status": "complete",
                        "tables_count": gen_data.get("total_tables", 0),
                        "report": gen_data
                    }
                })
        
        if args.platform in ("abr", "all"):
            gen_data = generator.load_generation_report("abr")
            if gen_data:
                generator.update_existing_report("abr", {
                    "schema_extraction": {
                        "status": "complete",
                        "tables_count": gen_data.get("total_tables", 0),
                        "report": gen_data
                    }
                })
    else:
        logger.info("Audit reports already exist. Use --update to refresh them with latest data.")


if __name__ == "__main__":
    main()
