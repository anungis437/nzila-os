#!/usr/bin/env python3
"""
Union Eyes Service Analyzer
Analyzes all service files to identify database operations and map them to Django API endpoints
"""

import os
import re
import json
from pathlib import Path
from typing import Dict, List, Set
from collections import defaultdict

UE_FRONTEND = Path(r"D:\APPS\nzila-union-eyes\frontend")
OUTPUT_DIR = Path(r"D:\APPS\nzila-automation\packages\automation\data")


class ServiceAnalyzer:
    """Analyzes TypeScript services for database operations"""
    
    def __init__(self):
        self.service_files = []
        self.db_operations = defaultdict(list)
        self.schema_imports = defaultdict(set)
        self.service_patterns = {
            'select': r'\.select\(',
            'insert': r'\.insert\(',
            'update': r'\.update\(',
            'delete': r'\.delete\(',
            'from': r'\.from\(',
            'where': r'\.where\(',
            'orderBy': r'\.orderBy\(',
            'limit': r'\.limit\(',
            'eq': r'\.eq\(',
            'and': r'\.and\(',
            'or': r'\.or\(',
            'sql': r'sql`',
        }
        
    def analyze_services_directory(self):
        """Scan all service files"""
        services_dir = UE_FRONTEND / "services"
        
        if not services_dir.exists():
            print(f"❌ Services directory not found: {services_dir}")
            return
            
        print(f"📂 Scanning services directory: {services_dir}")
        
        for ts_file in services_dir.rglob("*.ts"):
            if ts_file.stem == "index":
                continue
            self.service_files.append(ts_file)
            
        print(f"✅ Found {len(self.service_files)} service files")
        
    def extract_db_patterns(self, file_path: Path) -> Dict:
        """Extract database operation patterns from a service file"""
        
        try:
            content = file_path.read_text(encoding='utf-8')
        except Exception as e:
            print(f"⚠️  Could not read {file_path.name}: {e}")
            return {}
            
        patterns_found = {}
        
        # Find database imports
        db_import_match = re.search(r'import\s*{\s*db\s*}\s*from\s*["\']@/db["\']', content)
        if db_import_match:
            patterns_found['has_db_import'] = True
        else:
            patterns_found['has_db_import'] = False
            
        # Find schema imports
        schema_imports = re.findall(
            r'import\s*{([^}]+)}\s*from\s*["\']@/db/schema/([^"\']+)["\']',
            content
        )
        if schema_imports:
            patterns_found['schema_imports'] = [
                {
                    'tables': [t.strip() for t in tables.split(',')],
                    'schema_file': schema_path
                }
                for tables, schema_path in schema_imports
            ]
        else:
            patterns_found['schema_imports'] = []
            
        # Find database operations
        operations_found = {}
        for op_name, pattern in self.service_patterns.items():
            matches = re.findall(pattern, content)
            if matches:
                operations_found[op_name] = len(matches)
                
        patterns_found['operations'] = operations_found
        
        # Find function exports
        function_exports = re.findall(
            r'export\s+(?:async\s+)?function\s+(\w+)',
            content
        )
        patterns_found['exported_functions'] = function_exports
        
        # Find class exports
        class_exports = re.findall(
            r'export\s+class\s+(\w+)',
            content
        )
        patterns_found['exported_classes'] = class_exports
        
        return patterns_found
        
    def analyze_all_services(self):
        """Analyze all service files and generate report"""
        
        results = {
            'total_files': len(self.service_files),
            'files_with_db': 0,
            'files_without_db': 0,
            'total_operations': 0,
            'services': []
        }
        
        for service_file in self.service_files:
            relative_path = service_file.relative_to(UE_FRONTEND)
            
            patterns = self.extract_db_patterns(service_file)
            
            if patterns.get('has_db_import'):
                results['files_with_db'] += 1
            else:
                results['files_without_db'] += 1
                
            total_ops = sum(patterns.get('operations', {}).values())
            results['total_operations'] += total_ops
            
            service_info = {
                'file': str(relative_path),
                'name': service_file.stem,
                'has_db_import': patterns.get('has_db_import', False),
                'schema_imports': patterns.get('schema_imports', []),
                'operations': patterns.get('operations', {}),
                'total_operations': total_ops,
                'exported_functions': patterns.get('exported_functions', []),
                'exported_classes': patterns.get('exported_classes', []),
            }
            
            results['services'].append(service_info)
            
        # Sort by total operations (highest first)
        results['services'].sort(key=lambda x: x['total_operations'], reverse=True)
        
        return results
        
    def generate_report(self, results: Dict):
        """Generate analysis report"""
        
        print("\n" + "="*80)
        print("🔍 UNION EYES SERVICE ANALYSIS REPORT")
        print("="*80)
        
        print(f"\n📊 Overview:")
        print(f"   Total service files: {results['total_files']}")
        print(f"   Files with database access: {results['files_with_db']}")
        print(f"   Files without database access: {results['files_without_db']}")
        print(f"   Total database operations: {results['total_operations']}")
        
        print(f"\n🔥 Top 20 Services by Database Operations:")
        for i, svc in enumerate(results['services'][:20], 1):
            if svc['total_operations'] > 0:
                print(f"   {i:2d}. {svc['name']:40s} - {svc['total_operations']:4d} ops")
                
        # Schema usage analysis
        schema_usage = defaultdict(int)
        for svc in results['services']:
            for schema_import in svc['schema_imports']:
                schema_usage[schema_import['schema_file']] += 1
                
        if schema_usage:
            print(f"\n📦 Most Used Schemas:")
            sorted_schemas = sorted(schema_usage.items(), key=lambda x: x[1], reverse=True)
            for schema, count in sorted_schemas[:15]:
                print(f"   {schema:50s} - {count:3d} services")
                
        # Operation type breakdown
        operation_totals = defaultdict(int)
        for svc in results['services']:
            for op, count in svc['operations'].items():
                operation_totals[op] += count
                
        if operation_totals:
            print(f"\n⚙️  Operation Type Breakdown:")
            sorted_ops = sorted(operation_totals.items(), key=lambda x: x[1], reverse=True)
            for op, count in sorted_ops:
                print(f"   {op:15s} - {count:5d} occurrences")
                
        # Save detailed JSON report
        output_file = OUTPUT_DIR / "ue_service_analysis.json"
        output_file.write_text(json.dumps(results, indent=2), encoding='utf-8')
        print(f"\n💾 Detailed report saved to: {output_file}")
        
        # Generate migration priority list
        self.generate_migration_plan(results)
        
    def generate_migration_plan(self, results: Dict):
        """Generate prioritized migration plan"""
        
        plan = {
            'phase_1_critical': [],
            'phase_2_high': [],
            'phase_3_medium': [],
            'phase_4_low': [],
            'no_migration_needed': []
        }
        
        for svc in results['services']:
            ops = svc['total_operations']
            
            if ops == 0:
                plan['no_migration_needed'].append(svc['name'])
            elif ops >= 50:
                plan['phase_1_critical'].append({
                    'name': svc['name'],
                    'operations': ops,
                    'file': svc['file']
                })
            elif ops >= 20:
                plan['phase_2_high'].append({
                    'name': svc['name'],
                    'operations': ops,
                    'file': svc['file']
                })
            elif ops >= 5:
                plan['phase_3_medium'].append({
                    'name': svc['name'],
                    'operations': ops,
                    'file': svc['file']
                })
            else:
                plan['phase_4_low'].append({
                    'name': svc['name'],
                    'operations': ops,
                    'file': svc['file']
                })
                
        # Save migration plan
        plan_file = OUTPUT_DIR / "ue_migration_plan.json"
        plan_file.write_text(json.dumps(plan, indent=2), encoding='utf-8')
        
        print(f"\n📋 Migration Plan Summary:")
        print(f"   Phase 1 (Critical, 50+ ops): {len(plan['phase_1_critical'])} services")
        print(f"   Phase 2 (High, 20-49 ops):   {len(plan['phase_2_high'])} services")
        print(f"   Phase 3 (Medium, 5-19 ops):  {len(plan['phase_3_medium'])} services")
        print(f"   Phase 4 (Low, 1-4 ops):      {len(plan['phase_4_low'])} services")
        print(f"   No migration needed:         {len(plan['no_migration_needed'])} services")
        print(f"\n💾 Migration plan saved to: {plan_file}")


def main():
    """Main execution"""
    print("🚀 Union Eyes Service Analyzer")
    print("="*80)
    
    analyzer = ServiceAnalyzer()
    
    # Step 1: Scan services directory
    analyzer.analyze_services_directory()
    
    if not analyzer.service_files:
        print("❌ No service files found!")
        return
        
    # Step 2: Analyze all services
    print("\n🔍 Analyzing service files...")
    results = analyzer.analyze_all_services()
    
    # Step 3: Generate report
    analyzer.generate_report(results)
    
    print("\n✅ Analysis complete!")


if __name__ == "__main__":
    main()
