#!/usr/bin/env python3
"""
Fix Django ForeignKey/OneToOneField related_name using line-by-line parsing
More robust than complex regex-based approach
"""

import sys
from pathlib import Path
from typing import Dict, List


def snake_case(name: str) -> str:
    """Convert CamelCase to snake_case"""
    import re
    name = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', name)
    return re.sub('([a-z0-9])([A-Z])', r'\1_\2', name).lower()


def fix_models_simple(models_file: Path) -> int:
    """Fix ForeignKey related_names using simple line-by-line regex"""
    content = models_file.read_text(encoding='utf-8')
    lines = content.split('\n')
    
    # Track current model class
    current_model = None
    fixed_count = 0
    new_lines = []
    
    import re
    
    for i, line in enumerate(lines):
        # Detect model class
        class_match = re.match(r'class\s+(\w+)\(models\.Model\):', line)
        if class_match:
            current_model = class_match.group(1)
            new_lines.append(line)
            continue
        
        # Skip if not in a model or if line doesn't have ForeignKey
        if not current_model or 'ForeignKey' not in line and 'OneToOneField' not in line:
            new_lines.append(line)
            continue
        
        # Try to match and fix ForeignKey/OneToOneField
        # Pattern: field_name = models.ForeignKey(...)
        fk_pattern = r'^(\s+)(\w+)\s*=\s*models\.(ForeignKey|OneToOneField)\((.*)\)$'
        match = re.match(fk_pattern, line)
        
        if not match:
            new_lines.append(line)
            continue
        
        indent, field_name, field_type, params = match.groups()
        
        # Parse parameters
        # Simple approach: remove existing related_name if present
        if 'related_name' in params:
            # Remove old related_name
            params = re.sub(r',?\s*related_name\s*=\s*["\'][^"\']*["\']', '', params)
            params = params.strip(',').strip()
        
        # Generate new related_name
        model_snake = snake_case(current_model)
        related_name = f"{model_snake}_{field_name}_set"
        
        # Build new line
        # Insert related_name after the first parameter (target model)
        parts = params.split(',', 1)
        target_model = parts[0].strip()
        rest_params = parts[1].strip() if len(parts) > 1 else ''
        
        if rest_params:
            new_line = (
                f"{indent}{field_name} = models.{field_type}("
                f"{target_model}, related_name='{related_name}', {rest_params})"
            )
        else:
            new_line = (
                f"{indent}{field_name} = models.{field_type}("
                f"{target_model}, related_name='{related_name}')"
            )
        
        new_lines.append(new_line)
        fixed_count += 1
    
    # Write back
    if fixed_count > 0:
        models_file.write_text('\n'.join(new_lines), encoding='utf-8')
    
    return fixed_count


def fix_app(app_dir: Path) -> int:
    """Fix models in a single Django app"""
    models_file = app_dir / "models.py"
    
    if not models_file.exists():
        return 0
    
    try:
        return fix_models_simple(models_file)
    except Exception as e:
        print(f"    ❌ Error: {e}")
        return 0


def fix_backend(backend_dir: Path):
    """Fix all apps in backend"""
    print(f"\n🔧 Fixing ForeignKey related_names: {backend_dir}")
    
    total = 0
    apps_fixed = 0
    
    for app_dir in sorted(backend_dir.iterdir()):
        if not app_dir.is_dir():
            continue
        
        if app_dir.name in ['config', 'venv', '__pycache__', '.git', 'migrations', 'settings', 'apps', 'staticfiles']:
            continue
        
        if not (app_dir / "models.py").exists():
            continue
        
        print(f"  Processing: {app_dir.name}")
        count = fix_app(app_dir)
        
        if count > 0:
            print(f"    ✓ Fixed {count} ForeignKey field(s)")
            total += count
            apps_fixed += 1
    
    print(f"\n✅ Fixed {total} fields across {apps_fixed} apps")
    return total


def main():
    ue_backend = Path(r"D:\APPS\nzila-union-eyes\backend")
    abr_backend = Path(r"D:\APPS\nzila-abr-insights\backend")
    
    if "--platform" in sys.argv:
        idx = sys.argv.index("--platform")
        platform = sys.argv[idx + 1] if idx + 1 < len(sys.argv) else "all"
        
        if platform == "ue":
            backends = [ue_backend]
        elif platform == "abr":
            backends = [abr_backend]
        else:
            backends = [ue_backend, abr_backend]
    else:
        backends = [ue_backend, abr_backend]
    
    total = 0
    for backend in backends:
        if backend.exists():
            total += fix_backend(backend)
        else:
            print(f"❌ Backend not found: {backend}")
    
    print(f"\n{'='*60}")
    print(f"✅ Total ForeignKey fields fixed: {total}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
