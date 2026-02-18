#!/usr/bin/env python3
"""
Fix cross-app ForeignKey references in Django models
Updates 'ModelName' to 'app_name.ModelName' when needed
"""

import re
import sys
from pathlib import Path
from typing import Dict, Set, List


def extract_models_from_app(app_dir: Path) -> Set[str]:
    """Extract all model class names from an app's models.py"""
    models_file = app_dir / "models.py"
    
    if not models_file.exists():
        return set()
    
    content = models_file.read_text(encoding='utf-8')
    
    # Find all model classes (inherit from models.Model)
    pattern = r'class\s+(\w+)\(models\.Model\):'
    models = set(re.findall(pattern, content))
    
    # Also handle abstract base classes
    pattern_base = r'class\s+(\w+)\(BaseModel\)|class\s+(\w+)\(TenantModel\)'
    for match in re.finditer(pattern_base, content):
        model_name = match.group(1) or match.group(2)
        if model_name:
            models.add(model_name)
    
    return models


def build_model_registry(backend_dir: Path) -> Dict[str, str]:
    """
    Build a registry of model_name -> app_name
    
    Returns:
        dict: {'Organizations': 'core', 'Users': 'auth_core', ...}
    """
    registry = {}
    
    for app_dir in backend_dir.iterdir():
        if not app_dir.is_dir():
            continue
        
        if app_dir.name in ['config', 'venv', '__pycache__', '.git', 'migrations', 'settings', 'apps', 'staticfiles']:
            continue
        
        app_name = app_dir.name
        models_in_app = extract_models_from_app(app_dir)
        
        for model in models_in_app:
            if model in registry:
                print(f"   ⚠️  Warning: {model} exists in both {registry[model]} and {app_name}")
            registry[model] = app_name
    
    return registry


def fix_foreignkey_references(models_file: Path, current_app: str, registry: Dict[str, str]) -> int:
    """Fix ForeignKey references to use app-qualified names"""
    content = models_file.read_text(encoding='utf-8')
    lines = content.split('\n')
    
    fixed_count = 0
    new_lines = []
    
    # Pattern to match ForeignKey/OneToOneField with model reference
    fk_pattern = r"^(\s+\w+\s*=\s*models\.(?:ForeignKey|OneToOneField)\s*\(\s*)['\"](\w+)['\"](.*)$"
    
    for line in lines:
        match = re.match(fk_pattern, line)
        
        if not match:
            new_lines.append(line)
            continue
        
        prefix, model_name, suffix = match.groups()
        
        # Check if model is in registry
        if model_name not in registry:
            # Model not found - might be a typo or external model
            new_lines.append(line)
            continue
        
        target_app = registry[model_name]
        
        # Check if it's a cross-app reference
        if target_app != current_app:
            # Need to qualify with app name
            new_line = f"{prefix}'{target_app}.{model_name}'{suffix}"
            new_lines.append(new_line)
            fixed_count += 1
        else:
            # Same app, keep as is (Django allows unqualified)
            new_lines.append(line)
    
    # Write back if changes were made
    if fixed_count > 0:
        models_file.write_text('\n'.join(new_lines), encoding='utf-8')
    
    return fixed_count


def fix_app(app_dir: Path, registry: Dict[str, str]) -> int:
    """Fix all ForeignKey references in an app"""
    models_file = app_dir / "models.py"
    
    if not models_file.exists():
        return 0
    
    app_name = app_dir.name
    
    try:
        return fix_foreignkey_references(models_file, app_name, registry)
    except Exception as e:
        print(f"    ❌ Error: {e}")
        return 0


def fix_backend(backend_dir: Path):
    """Fix cross-app references in all apps"""
    print(f"\n🔍 Building model registry...")
    registry = build_model_registry(backend_dir)
    
    print(f"   Found {len(registry)} models across all apps\n")
    
    print(f"🔧 Fixing cross-app ForeignKey references: {backend_dir}")
    
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
        count = fix_app(app_dir, registry)
        
        if count > 0:
            print(f"    ✓ Fixed {count} cross-app reference(s)")
            total += count
            apps_fixed += 1
    
    print(f"\n✅ Fixed {total} cross-app references across {apps_fixed} apps")
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
    print(f"✅ Total cross-app references fixed: {total}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
