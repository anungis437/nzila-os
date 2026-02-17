"""
Export Manager Module

Manages export of analytics data in various formats.
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional


class ExportManager:
    """Manage analytics exports."""
    
    def __init__(self, base_path: Optional[str] = None):
        self.base_path = Path(base_path) if base_path else Path(__file__).parent.parent
        self.exports_path = self.base_path / "exports"
        self.exports_path.mkdir(exist_ok=True)
        
    def export_to_json(self, data: Dict[str, Any], filename: str) -> str:
        """Export data to JSON."""
        output_path = self.exports_path / filename
        with open(output_path, 'w') as f:
            json.dump(data, f, indent=2)
        return str(output_path)
    
    def export_to_markdown(self, content: str, filename: str) -> str:
        """Export content to Markdown."""
        output_path = self.exports_path / filename
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return str(output_path)
    
    def export_to_csv(self, data: List[Dict], filename: str) -> str:
        """Export data to CSV."""
        import csv
        
        output_path = self.exports_path / filename
        
        if not data:
            return str(output_path)
        
        fieldnames = list(data[0].keys())
        
        with open(output_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(data)
        
        return str(output_path)
    
    def export_investor_dashboard(self) -> str:
        """Export investor dashboard."""
        from .metric_collector import collect_all_metrics
        from .report_builder import ReportBuilder
        
        data = collect_all_metrics()
        builder = ReportBuilder()
        investor_data = builder.build_investor_dashboard(data)
        
        return self.export_to_json(investor_data, "investor_dashboard.json")
    
    def export_board_report(self, format: str = "markdown") -> str:
        """Export board report."""
        from .report_builder import generate_board_report
        
        if format == "markdown":
            content = generate_board_report()
            filename = "board_report.md"
            return self.export_to_markdown(content, filename)
        else:
            raise ValueError(f"Unsupported format: {format}")
    
    def export_portfolio_summary(self) -> str:
        """Export portfolio summary."""
        from .metric_collector import collect_all_metrics
        
        data = collect_all_metrics()
        summary = {
            "generated_at": datetime.now().isoformat(),
            "portfolio": {
                "total_platforms": data.get("portfolio", {}).get("total_platforms"),
                "total_verticals": data.get("portfolio", {}).get("total_verticals"),
                "total_entities": data.get("portfolio", {}).get("total_entities"),
                "engineering_investment": data.get("portfolio", {}).get("engineering_investment")
            },
            "financial": {
                "arr_2026": data.get("financial", {}).get("arr_target_2026"),
                "arr_2030": data.get("financial", {}).get("arr_target_2030"),
                "series_a": data.get("financial", {}).get("series_a_target")
            }
        }
        
        return self.export_to_json(summary, "portfolio_summary.json")
    
    def list_exports(self) -> List[Dict[str, str]]:
        """List all exports."""
        exports = []
        for f in self.exports_path.iterdir():
            exports.append({
                "filename": f.name,
                "size": f.stat().st_size,
                "modified": datetime.fromtimestamp(f.stat().st_mtime).isoformat()
            })
        return exports


def main():
    """CLI entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Export Nzila Analytics")
    parser.add_argument(
        "--template",
        choices=["board_report", "investor_dashboard", "portfolio_summary"],
        default="portfolio_summary",
        help="Export template"
    )
    parser.add_argument(
        "--format",
        choices=["json", "markdown", "csv"],
        default="json",
        help="Output format"
    )
    
    args = parser.parse_args()
    
    manager = ExportManager()
    
    if args.template == "board_report":
        output = manager.export_board_report(args.format)
    elif args.template == "investor_dashboard":
        output = manager.export_investor_dashboard()
    else:
        output = manager.export_portfolio_summary()
    
    print(f"Export created: {output}")


if __name__ == "__main__":
    main()
