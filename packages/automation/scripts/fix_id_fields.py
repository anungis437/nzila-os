"""
Fix models with id = models.TextField() to proper UUID primary keys.
Django requires id fields to be primary keys.
"""
import re
from pathlib import Path
from typing import List, Tuple


def fix_id_fields(file_path: Path) -> Tuple[int, List[str]]:
    """
    Fix id fields that are not primary keys.
    Returns (changes_made, list_of_changes)
    """
    content = file_path.read_text(encoding='utf-8')
    lines = content.splitlines()
    
    changes = []
    current_class = None
    modified_lines = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        
        # Track current class
        class_match = re.match(r'^class (\w+)\(', line)
        if class_match:
            current_class = class_match.group(1)
        
        # Find problematic id field definitions
        # Pattern: id = models.TextField(...) or id = models.CharField(...)
        id_match = re.match(r'^(\s+)id = models\.(TextField|CharField)\((.*)\)', line)
        if id_match and current_class:
            indent = id_match.group(1)
            field_type = id_match.group(2)
            args = id_match.group(3)
            
            # Replace with proper UUID primary key
            new_line = f"{indent}id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)"
            modified_lines.append(new_line)
            changes.append(f"{current_class}: {field_type} → UUIDField(primary_key=True)")
            i += 1
            continue
        
        modified_lines.append(line)
        i += 1
    
    if changes:
        # Check if uuid is imported
        has_uuid_import = any('import uuid' in line for line in modified_lines)
        if not has_uuid_import:
            # Add uuid import after django imports
            for idx, line in enumerate(modified_lines):
                if 'from django.db import models' in line:
                    modified_lines.insert(idx + 1, 'import uuid')
                    break
        
        file_path.write_text('\n'.join(modified_lines) + '\n', encoding='utf-8')
    
    return len(changes), changes


def main():
    # Platform configurations
    platforms = [
        ("Union Eyes", "C:/APPS/nzila-union-eyes/backend", [
            "ai_core", "analytics", "bargaining", "billing", "compliance",
            "content", "core", "grievances", "notifications", "unions", "auth_core"
        ]),
        ("ABR Insights", "D:/APPS/nzila-abr-insights/backend", [
            "ai_core", "analytics", "billing", "compliance",
            "content", "core", "notifications", "auth_core"
        ])
    ]
    
    total_changes = 0
    
    for platform_name, base_path, apps in platforms:
        print(f"\n{'='*60}")
        print(f"Processing {platform_name}")
        print('='*60)
        
        platform_changes = 0
        for app in apps:
            models_file = Path(base_path) / app / "models.py"
            if models_file.exists():
                count, change_list = fix_id_fields(models_file)
                if count > 0:
                    platform_changes += count
                    print(f"\n{app}/models.py: {count} changes")
                    for change in change_list[:10]:  # Show first 10
                        print(f"  • {change}")
                    if len(change_list) > 10:
                        print(f"  ... and {len(change_list) - 10} more")
        
        print(f"\n{platform_name} Total: {platform_changes} changes")
        total_changes += platform_changes
    
    print(f"\n{'='*60}")
    print(f"✅ GRAND TOTAL: {total_changes} id field fixes")
    print('='*60)


if __name__ == "__main__":
    main()
