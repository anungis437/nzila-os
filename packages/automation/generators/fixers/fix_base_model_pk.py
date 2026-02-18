#!/usr/bin/env python3
"""Fix BaseModel across all backends: add UUID primary key."""
import glob
import os

OLD = (
    'class BaseModel(models.Model):\n'
    '    """Abstract base with standard audit fields."""\n'
    '    created_at = models.DateTimeField(auto_now_add=True)\n'
    '    updated_at = models.DateTimeField(auto_now=True)'
)

NEW = (
    'class BaseModel(models.Model):\n'
    '    """Abstract base with standard audit fields."""\n'
    '    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)\n'
    '    created_at = models.DateTimeField(auto_now_add=True)\n'
    '    updated_at = models.DateTimeField(auto_now=True)'
)

count = 0
for base in [r'D:\APPS\nzila-union-eyes\backend', r'D:\APPS\nzila-abr-insights\backend']:
    for f in glob.glob(os.path.join(base, '*', 'models.py')):
        with open(f, 'r', encoding='utf-8') as fh:
            content = fh.read()
        if OLD in content:
            content = content.replace(OLD, NEW)
            with open(f, 'w', encoding='utf-8') as fh:
                fh.write(content)
            count += 1
            print(f'  Fixed: {os.path.relpath(f, base)}')
        else:
            # Check if already has UUID id
            if 'id = models.UUIDField(primary_key=True' in content:
                print(f'  Already has UUID: {os.path.relpath(f, base)}')

print(f'\nTotal: {count} files fixed')
