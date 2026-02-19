"""
Fix all Organizations FK references to use auth_core.Organizations
"""
import re
from pathlib import Path

# Platforms to fix
platforms = [
    ("C:/APPS/nzila-union-eyes/backend", [
        "ai_core", "analytics", "bargaining", "billing", "compliance",
        "content", "core", "grievances", "notifications", "unions"
    ]),
    ("D:/APPS/nzila-abr-insights/backend", [
        "ai_core", "analytics", "billing", "compliance",
        "content", "core", "notifications"
    ])
]

def fix_organizations_fk(file_path: Path) -> tuple[int, int]:
    """
    Fix Organizations FK references in a file.
    Returns (replacements_made, lines_changed)
    """
    content = file_path.read_text(encoding='utf-8')
    
    # Pattern 1: ForeignKey('Organizations'
    pattern1 = r"ForeignKey\('Organizations'"
    replacement1 = r"ForeignKey('auth_core.Organizations'"
    
    # Pattern 2: ForeignKey("Organizations"
    pattern2 = r'ForeignKey\("Organizations"'
    replacement2 = r'ForeignKey("auth_core.Organizations"'
    
    new_content = content
    count = 0
    
    new_content, n1 = re.subn(pattern1, replacement1, new_content)
    count += n1
    
    new_content, n2 = re.subn(pattern2, replacement2, new_content)
    count += n2
    
    if count > 0:
        file_path.write_text(new_content, encoding='utf-8')
        lines_changed = new_content.count('\n') - content.count('\n')
        return count, lines_changed
    
    return 0, 0

def main():
    total_replacements = 0
    total_files = 0
    
    for base_path, apps in platforms:
        print(f"\nProcessing {base_path}")
        for app in apps:
            models_file = Path(base_path) / app / "models.py"
            if models_file.exists():
                replacements, _ = fix_organizations_fk(models_file)
                if replacements > 0:
                    total_replacements += replacements
                    total_files += 1
                    print(f"  {app}/models.py: {replacements} replacements")
            else:
                print(f"  {app}/models.py: NOT FOUND")
    
    print(f"\n✅ Total: {total_replacements} replacements in {total_files} files")

if __name__ == "__main__":
    main()
