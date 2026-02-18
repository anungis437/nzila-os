#!/usr/bin/env python3
"""
Service Transformer - Phase 1
Transforms TypeScript service files from Drizzle ORM to Django REST API calls

This is the first implementation focused on governance-service.ts as the pilot transformation.
"""

import re
from pathlib import Path
from typing import Dict, List, Tuple
import json

FRONTEND_DIR = Path(r"D:\APPS\nzila-union-eyes\frontend")
SERVICES_DIR = FRONTEND_DIR / "services"
OUTPUT_DIR = Path(r"D:\APPS\nzila-automation\packages\automation\data")


class ServiceTransformer:
    """Transforms TypeScript services from Drizzle ORM to Django API"""
    
    def __init__(self, service_name: str):
        self.service_name = service_name
        self.service_file = SERVICES_DIR / f"{service_name}.ts"
        self.original_content = ""
        self.transformed_content = ""
        self.transformation_log = []
        
    def load_service(self):
        """Load the original service file"""
        if not self.service_file.exists():
            raise FileNotFoundError(f"Service file not found: {self.service_file}")
            
        self.original_content = self.service_file.read_text(encoding='utf-8')
        print(f"✅ Loaded {self.service_file.name} ({len(self.original_content)} chars)")
        
    def analyze_imports(self) -> Dict:
        """Analyze database and schema imports"""
        imports = {
            'db_import': None,
            'schema_imports': [],
            'drizzle_imports': [],
        }
        
        # Find db import
        db_match = re.search(r"import\s*{\s*db\s*}\s*from\s*['\"]@/db['\"];?", self.original_content)
        if db_match:
            imports['db_import'] = db_match.group(0)
            
        # Find schema imports
        schema_pattern = r"import\s*{([^}]+)}\s*from\s*['\"]@/db/schema/([^'\"]+)['\"]"
        for match in re.finditer(schema_pattern, self.original_content):
            imports['schema_imports'].append({
                'full': match.group(0),
                'entities': [e.strip() for e in match.group(1).split(',')],
                'path': match.group(2),
            })
            
        # Find drizzle-orm imports
        drizzle_match = re.search(r"import\s*{([^}]+)}\s*from\s*['\"]drizzle-orm['\"]", self.original_content)
        if drizzle_match:
            imports['drizzle_imports'] = [f.strip() for f in drizzle_match.group(1).split(',')]
            
        return imports
        
    def identify_drizzle_patterns(self) -> List[Dict]:
        """Identify Drizzle ORM operation patterns"""
        patterns = []
        
        # Pattern 1: db.insert(...).values(...).returning()
        insert_pattern = r'await\s+db\.insert\((\w+)\)\.values\(([^)]+)\)(?:\.returning\(\))?'
        for match in re.finditer(insert_pattern, self.original_content):
            patterns.append({
                'type': 'insert',
                'table': match.group(1),
                'full_match': match.group(0),
                'start': match.start(),
                'end': match.end(),
            })
            
        # Pattern 2: db.select().from(...).where(...)
        select_pattern = r'await\s+db\s*\.select\(\)\.from\((\w+)\)(?:\.where\([^)]+\))?'
        for match in re.finditer(select_pattern, self.original_content):
            patterns.append({
                'type': 'select',
                'table': match.group(1),
                'full_match': match.group(0),
                'start': match.start(),
                'end': match.end(),
            })
            
        # Pattern 3: db.update(...).set(...).where(...)
        update_pattern = r'await\s+db\.update\((\w+)\)\.set\(([^)]+)\)(?:\.where\([^)]+\))?'
        for match in re.finditer(update_pattern, self.original_content):
            patterns.append({
                'type': 'update',
                'table': match.group(1),
                'full_match': match.group(0),
                'start': match.start(),
                'end': match.end(),
            })
            
        # Pattern 4: db.delete().from(...)
        delete_pattern = r'await\s+db\.delete\((\w+)\)(?:\.where\([^)]+\))?'
        for match in re.finditer(delete_pattern, self.original_content):
            patterns.append({
                'type': 'delete',
                'table': match.group(1),
                'full_match': match.group(0),
                'start': match.start(),
                'end': match.end(),
            })
            
        return sorted(patterns, key=lambda x: x['start'])
        
    def transform_imports(self, imports: Dict) -> str:
        """Transform imports to use API client"""
        new_imports = []
        
        # Remove db import
        content = self.original_content
        if imports['db_import']:
            content = content.replace(imports['db_import'], '')
            self.transformation_log.append(f"Removed: {imports['db_import']}")
            
        # Remove schema imports
        for schema_import in imports['schema_imports']:
            content = content.replace(schema_import['full'], '')
            self.transformation_log.append(f"Removed: {schema_import['full'][:50]}...")
            
        # Remove drizzle-orm imports
        drizzle_import = re.search(r"import\s*{[^}]+}\s*from\s*['\"]drizzle-orm['\"];?", content)
        if drizzle_import:
            content = content.replace(drizzle_import.group(0), '')
            self.transformation_log.append(f"Removed drizzle-orm import")
            
        # Add API client import at the top (after initial comments)
        # Find the first import line
        first_import = re.search(r'^import\s', content, re.MULTILINE)
        if first_import:
            insert_pos = first_import.start()
            api_import = "import * as api from '@/lib/api/django-client';\n"
            content = content[:insert_pos] + api_import + content[insert_pos:]
            self.transformation_log.append(f"Added: API client import")
        else:
            # No imports found, add after initial comments
            comment_end = 0
            for line in content.split('\n'):
                if line.strip().startswith('//') or line.strip().startswith('/*') or line.strip() == '':
                    comment_end += len(line) + 1
                else:
                    break
            api_import = "\nimport * as api from '@/lib/api/django-client';\n\n"
            content = content[:comment_end] + api_import + content[comment_end:]
            self.transformation_log.append(f"Added: API client import at position {comment_end}")
            
        return content
        
    def generate_transformation_plan(self) -> Dict:
        """Generate detailed transformation plan"""
        imports = self.analyze_imports()
        patterns = self.identify_drizzle_patterns()
        
        plan = {
            'service_name': self.service_name,
            'file_size': len(self.original_content),
            'imports_to_remove': len(imports['schema_imports']) + (1 if imports['db_import'] else 0),
            'drizzle_operations': len(patterns),
            'operations_by_type': {},
            'transformation_steps': [],
        }
        
        # Count operations by type
        for pattern in patterns:
            op_type = pattern['type']
            plan['operations_by_type'][op_type] = plan['operations_by_type'].get(op_type, 0) + 1
            
        # Generate transformation steps
        plan['transformation_steps'] = [
            "1. Remove database imports (db, schema, drizzle-orm)",
            "2. Add Django API client import",
            "3. Transform INSERT operations to API create calls",
            "4. Transform SELECT operations to API list/get calls",
            "5. Transform UPDATE operations to API update calls",
            "6. Transform DELETE operations to API delete calls",
            "7. Update error handling for API responses",
            "8. Test service functions with Django backend",
        ]
        
        return plan
        
    def create_backup(self):
        """Create backup of original file"""
        backup_file = OUTPUT_DIR / f"{self.service_name}.ts.backup"
        backup_file.write_text(self.original_content, encoding='utf-8')
        print(f"✅ Backup created: {backup_file}")
        
    def save_transformation_log(self, plan: Dict):
        """Save transformation log"""
        log = {
            'service': self.service_name,
            'timestamp': '2026-02-18',
            'plan': plan,
            'transformations': self.transformation_log,
        }
        
        log_file = OUTPUT_DIR / f"{self.service_name}_transformation.json"
        log_file.write_text(json.dumps(log, indent=2), encoding='utf-8')
        print(f"✅ Transformation log: {log_file}")
        
    def transform(self, dry_run: bool = True):
        """Execute transformation"""
        print(f"\n{'='*80}")
        print(f"🔄 Transforming: {self.service_name}")
        print(f"{'='*80}\n")
        
        # Load service
        self.load_service()
        
        # Generate plan
        plan = self.generate_transformation_plan()
        
        print(f"📊 Transformation Plan:")
        print(f"   File size: {plan['file_size']:,} characters")
        print(f"   Imports to remove: {plan['imports_to_remove']}")
        print(f"   Drizzle operations: {plan['drizzle_operations']}")
        for op_type, count in plan['operations_by_type'].items():
            print(f"     - {op_type.upper()}: {count}")
        print()
        
        if dry_run:
            print("🔍 DRY RUN MODE - No files will be modified")
            print("\n📋 Transformation Steps:")
            for step in plan['transformation_steps']:
                print(f"   {step}")
                
            # Create backup and log even in dry run
            self.create_backup()
            self.save_transformation_log(plan)
            
            # Show preview of import transformation
            imports = self.analyze_imports()
            preview = self.transform_imports(imports)
            
            # Show first 50 lines of preview
            preview_lines = preview.split('\n')[:50]
            print("\n📄 Preview (first 50 lines):")
            print("```typescript")
            print('\n'.join(preview_lines))
            print("```")
            
            return plan
        else:
            print("⚠️  LIVE MODE - Files will be modified")
            print("   Creating backup first...")
            self.create_backup()
            
            # Execute transformation
            imports = self.analyze_imports()
            self.transformed_content = self.transform_imports(imports)
            
            # Save transformed file
            transformed_file = OUTPUT_DIR / f"{self.service_name}.transformed.ts"
            transformed_file.write_text(self.transformed_content, encoding='utf-8')
            print(f"✅ Transformed file: {transformed_file}")
            
            # Save log
            self.save_transformation_log(plan)
            
            return plan


def main():
    """Main execution"""
    print("🚀 Service Transformer - Phase 1")
    print("="*80)
    
    # Start with governance-service (74 operations)
    transformer = ServiceTransformer('governance-service')
    
    # Dry run first
    plan = transformer.transform(dry_run=True)
    
    print(f"\n{'='*80}")
    print("✅ Transformation plan generated")
    print(f"{'='*80}")
    print("\nNext steps:")
    print("1. Review the transformation plan and preview")
    print("2. Run with dry_run=False to apply changes")
    print("3. Test transformed service with Django backend")
    print("4. Apply to remaining Phase 1 services")


if __name__ == "__main__":
    main()
