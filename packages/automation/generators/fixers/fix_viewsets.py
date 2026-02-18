#!/usr/bin/env python3
"""
Quick fix for generated Django ViewSet files
Makes them working stubs by commenting out invalid imports
"""

from pathlib import Path
import re

SERVICES_API_DIR = Path(r"D:\APPS\nzila-union-eyes\backend\services\api")

def fix_viewset_file(file_path: Path):
    """Fix a single ViewSet file"""
    print(f"Fixing {file_path.name}...")
    
    content = file_path.read_text(encoding='utf-8')
    
    # Comment out ALL from ... import lines (they all have issues)
    content = re.sub(
        r'^from [^\n]+\bmodels\b[^\n]*$',
        r'# \g<0>  # TODO: Import correct models',
        content,
        flags=re.MULTILINE
    )
    
    content = re.sub(
        r'^from [^\n]+\bserializers\b[^\n]*$',
        r'# \g<0>  # TODO: Create and import serializers',
        content,
        flags=re.MULTILINE
    )
    
    # Add stub list method if not present
    if 'def list(self, request)' not in content:
        # Find the get_queryset method and add list method after it
        if 'def get_queryset(self)' in content:
            content = content.replace(
                '        return super().get_queryset()',
                '''        return super().get_queryset()
    
    def list(self, request):
        """List all records - STUB implementation"""
        return Response({
            'status': 'stub',
            'message': 'API endpoint not yet implemented',
            'data': []
        }, status=status.HTTP_200_OK)'''
            )
    
    file_path.write_text(content, encoding='utf-8')
    print(f"  ✅ Fixed {file_path.name}")

def main():
    """Fix all ViewSet files"""
    print("🔧 Fixing generated ViewSet files...\n")
    
    viewset_files = list(SERVICES_API_DIR.glob("*_views.py"))
    
    for file_path in viewset_files:
        fix_viewset_file(file_path)
    
    print(f"\n✅ Fixed {len(viewset_files)} ViewSet files")

if __name__ == "__main__":
    main()
