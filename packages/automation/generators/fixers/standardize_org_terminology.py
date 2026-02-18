#!/usr/bin/env python3
"""
Standardize Terminology: Tenant → Organization

Replaces all occurrences of "tenant" terminology with "organization"
across generated Django code to enforce consistent naming conventions.

Changes:
- TenantModel → OrganizationModel
- multi-tenant → multi-organization
- tenant_id → organization_id
- tenant → organization (in field names, comments, docstrings)
"""

import re
from pathlib import Path
from typing import List, Tuple
import argparse


def standardize_file(file_path: Path) -> Tuple[bool, int]:
    """
    Standardize tenant→organization terminology in a single file.
    
    Returns:
        (changed, replacement_count)
    """
    try:
        content = file_path.read_text(encoding='utf-8')
        original_content = content
        replacements = 0
        
        # Pattern replacements (order matters!)
        patterns = [
            # Class names
            (r'\bTenantModel\b', 'OrganizationModel'),
            
            # Docstrings and comments
            (r'multi-tenant', 'multi-organization'),
            (r'Multi-tenant', 'Multi-organization'),
            (r'Multi-Tenant', 'Multi-Organization'),
            
            # Field names (be careful with context)
            (r'\btenant_id\b', 'organization_id'),
            (r'\btenant\b', 'organization'),
            (r'\bTenant\b', 'Organization'),
            
            # Variable names in comments
            (r'# tenant', '# organization'),
            (r'# Tenant', '# Organization'),
        ]
        
        for pattern, replacement in patterns:
            new_content, count = re.subn(pattern, replacement, content)
            if count > 0:
                content = new_content
                replacements += count
        
        if content != original_content:
            file_path.write_text(content, encoding='utf-8')
            return True, replacements
        
        return False, 0
    
    except Exception as e:
        print(f"  ⚠️  Error processing {file_path}: {e}")
        return False, 0


def standardize_platform(platform: str, workspace_root: Path) -> int:
    """Standardize all files for a platform."""
    
    platform_path = workspace_root / "packages" / "automation" / "data" / "generated" / platform
    
    if not platform_path.exists():
        print(f"  ⚠️  Platform not found: {platform_path}")
        return 0
    
    print(f"\n🔧 Standardizing {platform.upper()} terminology: tenant → organization")
    print(f"   Path: {platform_path}")
    
    total_files = 0
    total_replacements = 0
    changed_files = []
    
    # Find all Python files
    for py_file in platform_path.rglob("*.py"):
        changed, count = standardize_file(py_file)
        if changed:
            total_files += 1
            total_replacements += count
            rel_path = py_file.relative_to(platform_path)
            changed_files.append((rel_path, count))
    
    # Report results
    if changed_files:
        print(f"\n   ✓ Updated {total_files} file(s), {total_replacements} replacement(s):")
        for file_path, count in changed_files:
            print(f"     • {file_path} ({count} changes)")
    else:
        print(f"   ✓ No changes needed (already standardized)")
    
    return total_replacements


def main():
    """CLI entry point"""
    parser = argparse.ArgumentParser(
        description="Standardize tenant→organization terminology"
    )
    parser.add_argument(
        "--platform",
        choices=["ue", "abr", "all"],
        default="all",
        help="Platform to standardize (default: all)"
    )
    parser.add_argument(
        "--workspace",
        type=Path,
        default=Path(__file__).parent.parent.parent.parent,
        help="Workspace root directory"
    )
    
    args = parser.parse_args()
    
    print("=" * 70)
    print("TERMINOLOGY STANDARDIZATION: Tenant → Organization")
    print("=" * 70)
    
    total_replacements = 0
    
    if args.platform in ("ue", "all"):
        total_replacements += standardize_platform("ue", args.workspace)
    
    if args.platform in ("abr", "all"):
        total_replacements += standardize_platform("abr", args.workspace)
    
    print("\n" + "=" * 70)
    print(f"✅ Standardization complete: {total_replacements} total replacements")
    print("=" * 70)
    
    # Also update the generated repos if they exist
    print("\n🔄 Updating production repositories...")
    
    repos_updated = 0
    for repo_name in ["nzila-union-eyes", "nzila-abr-insights"]:
        repo_path = Path("D:/APPS") / repo_name / "backend"
        if repo_path.exists():
            print(f"\n   Updating {repo_name}...")
            platform = "ue" if "union" in repo_name else "abr"
            
            file_count = 0
            for py_file in repo_path.rglob("*.py"):
                changed, _ = standardize_file(py_file)
                if changed:
                    file_count += 1
            
            if file_count > 0:
                print(f"   ✓ Updated {file_count} file(s) in {repo_name}")
                repos_updated += 1
    
    if repos_updated > 0:
        print(f"\n✅ Updated {repos_updated} production repo(s)")
    else:
        print(f"\n   No production repos found to update")


if __name__ == "__main__":
    main()
