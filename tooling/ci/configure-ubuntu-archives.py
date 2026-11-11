#!/usr/bin/env python3
"""Select official HTTPS Ubuntu archives on disposable GitHub-hosted runners.

APT's mirror+file transport can retain the failing Azure mirror even after
reporting fallback URLs. Preserve suites, components and Signed-By directives;
only replace Ubuntu archive transport URIs. Never change package trust policy.
"""
import json
import os
from pathlib import Path


def configure() -> None:
    if os.environ.get('GITHUB_ACTIONS') != 'true' or os.environ.get('RUNNER_OS') != 'Linux':
        raise SystemExit('This operation is restricted to Linux GitHub Actions runners')
    if os.geteuid() != 0:
        raise SystemExit('APT source configuration requires the runner root account')
    release = dict(
        line.split('=', 1) for line in Path('/etc/os-release').read_text().splitlines()
        if '=' in line
    )
    if release.get('ID', '').strip('"') != 'ubuntu':
        raise SystemExit('An Ubuntu runner is required')

    replacements = {
        'mirror+file:/etc/apt/apt-mirrors.txt': 'https://archive.ubuntu.com/ubuntu',
        'mirror+file:/etc/apt/apt-security-mirrors.txt': 'https://security.ubuntu.com/ubuntu',
        'http://azure.archive.ubuntu.com/ubuntu': 'https://archive.ubuntu.com/ubuntu',
        'https://azure.archive.ubuntu.com/ubuntu': 'https://archive.ubuntu.com/ubuntu',
        'http://archive.ubuntu.com/ubuntu': 'https://archive.ubuntu.com/ubuntu',
        'http://security.ubuntu.com/ubuntu': 'https://security.ubuntu.com/ubuntu',
    }
    paths = [Path('/etc/apt/sources.list')]
    paths += sorted(Path('/etc/apt/sources.list.d').glob('*.list'))
    paths += sorted(Path('/etc/apt/sources.list.d').glob('*.sources'))
    changed = []
    official_found = False
    for path in paths:
        if not path.is_file():
            continue
        original = path.read_text()
        updated = original
        for before, after in replacements.items():
            updated = updated.replace(before, after)
        active_lines = [line for line in updated.splitlines() if not line.lstrip().startswith('#')]
        if any('azure.archive.ubuntu.com' in line or 'mirror+file:/etc/apt/apt-' in line for line in active_lines):
            raise SystemExit('An unconverted Ubuntu mirror remains; refusing partial configuration')
        official_found |= any(
            'https://archive.ubuntu.com/ubuntu' in line or 'https://security.ubuntu.com/ubuntu' in line
            for line in active_lines
        )
        if updated != original:
            path.write_text(updated)
            changed.append(str(path))
    if not official_found:
        raise SystemExit('No official Ubuntu archive source was configured')
    print(json.dumps({'configured': 'official-ubuntu-https-archives', 'filesChanged': changed,
                      'signaturePolicyChanged': False, 'testSelectionChanged': False}))


if __name__ == '__main__':
    configure()
