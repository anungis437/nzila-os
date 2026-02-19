"""
Fix all ForeignKey related_name clashes by generating unique names.
Pattern: {model_snake}_{field_snake}_set

This fixes the massive error explosion from all models using related_name='organizations'
"""
import re
from pathlib import Path
from typing import List, Tuple


def to_snake_case(name: str) -> str:
    """Convert PascalCase or camelCase to snake_case"""
    s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', name)
    return re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).lower()


def fix_fk_related_names(file_path: Path) -> Tuple[int, List[str]]:
    """
    Fix all ForeignKey related_name clashes in a models.py file.
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
        
        # Find ForeignKey definitions
        fk_match = re.search(r"(\w+)\s*=\s*models\.ForeignKey\((.*?related_name='(\w+)'.*?\))", line)
        if fk_match and current_class:
            field_name = fk_match.group(1)
            full_fk = fk_match.group(2)
            old_related_name = fk_match.group(3)
            
            # Generate new unique related_name
            model_snake = to_snake_case(current_class)
            field_snake = to_snake_case(field_name)
            new_related_name = f"{model_snake}_{field_snake}_set"
            
            # Replace in the line
            new_line = line.replace(f"related_name='{old_related_name}'", 
                                   f"related_name='{new_related_name}'")
            modified_lines.append(new_line)
            changes.append(f"{current_class}.{field_name}: '{old_related_name}' → '{new_related_name}'")
            i += 1
            continue
        
        modified_lines.append(line)
        i += 1
    
    if changes:
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
                count, change_list = fix_fk_related_names(models_file)
                if count > 0:
                    platform_changes += count
                    print(f"\n{app}/models.py: {count} changes")
                    for change in change_list[:5]:  # Show first 5
                        print(f"  • {change}")
                    if len(change_list) > 5:
                        print(f"  ... and {len(change_list) - 5} more")
        
        print(f"\n{platform_name} Total: {platform_changes} changes")
        total_changes += platform_changes
    
    print(f"\n{'='*60}")
    print(f"✅ GRAND TOTAL: {total_changes} related_name fixes")
    print('='*60)


if __name__ == "__main__":
    main()
