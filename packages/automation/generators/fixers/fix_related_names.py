#!/usr/bin/env python3
"""
Fix Django model ForeignKey/OneToOneField related_name clashes
"""

import re
import sys
from pathlib import Path
from typing import Set, Dict, List


def extract_model_name(file_path: Path) -> str:
    """Extract model name from class definition"""
    content = file_path.read_text(encoding='utf-8')
    # Find first class that inherits from models.Model
    match = re.search(r'class\s+(\w+)\(models\.Model\)', content)
    return match.group(1) if match else None


def find_foreign_keys(content: str) -> List[Dict]:
    """Find all ForeignKey and OneToOneField declarations"""
    # Pattern to match ForeignKey/OneToOneField (with or without related_name)
    pattern = r'(\s+)(\w+)\s*=\s*models\.(ForeignKey|OneToOneField)\(\s*["\']?(\w+)["\']?([^)]*)\)'
    
    matches = []
    for match in re.finditer(pattern, content):
        indent, field_name, field_type, related_model, params = match.groups()
        
        # Always process (we'll update existing related_names too)
        matches.append({
            'full_match': match.group(0),
            'indent': indent,
            'field_name': field_name,
            'field_type': field_type,
            'related_model': related_model,
            'params': params,
            'start': match.start(),
            'end': match.end(),
            'has_related_name': 'related_name' in params
        })
    
    return matches


def generate_related_name(model_name: str, field_name: str) -> str:
    """Generate a unique related_name"""
    # Convert CamelCase model name to snake_case
    snake_case = re.sub(r'(?<!^)(?=[A-Z])', '_', model_name).lower()
    return f"{snake_case}_{field_name}_set"


def fix_model_file(file_path: Path, model_name: str) -> bool:
    """Fix ForeignKey/OneToOneField in a single model file"""
    content = file_path.read_text(encoding='utf-8')
    original_content = content
    
    # Find all ForeignKeys without related_name
    foreign_keys = find_foreign_keys(content)
    
    if not foreign_keys:
        return False
    
    # Process matches in reverse order to preserve positions
    for fk in reversed(foreign_keys):
        indent = fk['indent']
        field_name = fk['field_name']
        field_type = fk['field_type']
        related_model = fk['related_model']
        params = fk['params'].strip()
        
        # Generate related_name
        related_name = generate_related_name(model_name, field_name)
        
        # Build new field declaration
        if params and not params.startswith(','):
            params = ', ' + params
        
        new_declaration = (
            f"{indent}{field_name} = models.{field_type}("
            f"'{related_model}', related_name='{related_name}'{params})"
        )
        
        # Replace in content
        content = content[:fk['start']] + new_declaration + content[fk['end']:]
    
    # Write back if changed
    if content != original_content:
        file_path.write_text(content, encoding='utf-8')
        return True
    
    return False


def fix_app_models(app_dir: Path) -> int:
    """Fix all models in a single app"""
    models_file = app_dir / "models.py"
    
    if not models_file.exists():
        return 0
    
    # Extract model name from file (use app name if multiple models)
    # For simplicity, we'll use the app name capitalized
    app_name = app_dir.name
    model_name = ''.join(word.capitalize() for word in app_name.split('_'))
    
    # Actually, we need to handle multiple models per file
    # Let's parse the file to find all model classes
    content = models_file.read_text(encoding='utf-8')
    
    # Find all model classes
    model_pattern = r'class\s+(\w+)\(models\.Model\):'
    models_in_file = re.findall(model_pattern, content)
    
    if not models_in_file:
        return 0
    
    # Group ForeignKeys by model class
    # This is complex, so let's use a simpler approach:
    # Generate related_name based on the file name and field name
    
    fixed = False
    for model_name in models_in_file:
        # Find the model class and its fields
        class_pattern = rf'class\s+{model_name}\(models\.Model\):.*?(?=\nclass\s|\Z)'
        class_match = re.search(class_pattern, content, re.DOTALL)
        
        if not class_match:
            continue
        
        class_content = class_match.group(0)
        class_start = class_match.start()
        
        # Find ForeignKeys in this class
        foreign_keys = find_foreign_keys(class_content)
        
        if not foreign_keys:
            continue
        
        # Process matches in reverse order
        for fk in reversed(foreign_keys):
            indent = fk['indent']
            field_name = fk['field_name']
            field_type = fk['field_type']
            related_model = fk['related_model']
            params = fk['params'].strip()
            
            # Generate unique related_name
            related_name = generate_related_name(model_name, field_name)
            
            # Remove existing related_name if present
            if fk['has_related_name']:
                # Remove old related_name parameter
                params = re.sub(r',?\s*related_name\s*=\s*["\'][^"\']*["\']', '', params)
                params = params.strip()
            
            # Build new field declaration
            if params:
                if not params.startswith(','):
                    params = ', ' + params
            else:
                params = ''
            
            new_declaration = (
                f"{indent}{field_name} = models.{field_type}("
                f"'{related_model}', related_name='{related_name}'{params})"
            )
            
            # Calculate absolute position
            abs_start = class_start + fk['start']
            abs_end = class_start + fk['end']
            
            # Replace in content
            content = content[:abs_start] + new_declaration + content[abs_end:]
            
            # Adjust class_start for subsequent replacements
            length_diff = len(new_declaration) - (abs_end - abs_start)
            class_start += length_diff
            
            fixed = True
    
    if fixed:
        models_file.write_text(content, encoding='utf-8')
        return len(models_in_file)
    
    return 0


def fix_backend(backend_dir: Path):
    """Fix all Django apps in a backend directory"""
    print(f"\n🔧 Fixing ForeignKey related_names in: {backend_dir}")
    
    total_models = 0
    total_apps = 0
    
    # Find all Django apps (directories with models.py)
    for app_dir in backend_dir.iterdir():
        if not app_dir.is_dir():
            continue
        
        if app_dir.name in ['config', 'venv', '__pycache__', '.git', 'migrations', 'settings', 'apps']:
            continue
        
        models_file = app_dir / "models.py"
        if not models_file.exists():
            continue
        
        print(f"  Processing: {app_dir.name}")
        models_fixed = fix_app_models(app_dir)
        
        if models_fixed > 0:
            print(f"    ✓ Fixed {models_fixed} model(s)")
            total_models += models_fixed
            total_apps += 1
    
    print(f"\n✅ Fixed {total_models} models across {total_apps} apps")
    return total_models


def main():
    """Main entry point"""
    # Default to both platforms
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
    print(f"✅ Total models fixed: {total}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
