#!/usr/bin/env python3
"""Select official HTTPS Ubuntu archives on disposable GitHub-hosted runners.

APT's mirror+file transport can retain the failing Azure mirror even after
reporting fallback URLs. Preserve suites, components and Signed-By directives;
only replace Ubuntu archive transport URIs. Never change package trust policy.
"""
import json
import ipaddress
import os
import re
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen


def rewrite_source_text(text: str) -> str:
    transports = {
        'mirror+file:/etc/apt/apt-mirrors.txt': 'https://archive.ubuntu.com/ubuntu',
        'mirror+file:/etc/apt/apt-security-mirrors.txt': 'https://security.ubuntu.com/ubuntu',
        'http://azure.archive.ubuntu.com/ubuntu': 'https://archive.ubuntu.com/ubuntu',
        'https://azure.archive.ubuntu.com/ubuntu': 'https://archive.ubuntu.com/ubuntu',
        'http://archive.ubuntu.com/ubuntu': 'https://archive.ubuntu.com/ubuntu',
        'http://security.ubuntu.com/ubuntu': 'https://security.ubuntu.com/ubuntu',
    }
    transports.update({before + '/': after + '/' for before, after in list(transports.items())})
    # Only a whole whitespace-delimited APT URI can match. A hostname inside
    # a query, userinfo, unrelated URL or another hostname is never rewritten.
    return ''.join(
        line if line.lstrip().startswith('#')
        else re.sub(r'\S+', lambda match: transports.get(match.group(0), match.group(0)), line)
        for line in text.splitlines(keepends=True)
    )


def configure_archive_resolution() -> list[dict]:
    """Keep normal TLS/GPG trust while avoiding the runner's failing resolver."""
    resolutions = []
    for hostname in ('archive.ubuntu.com', 'security.ubuntu.com'):
        query = urlencode({'name': hostname, 'type': 'A', 'cd': 'false',
                           'edns_client_subnet': '0.0.0.0/0'})
        # Default urllib HTTPS validation is deliberately retained. The public
        # query contains only these fixed package-host names, never job data.
        with urlopen('https://dns.google/resolve?' + query, timeout=30) as response:
            data = json.loads(response.read(65536))
        if data.get('Status') != 0 or data.get('CD') is not False or data.get('TC'):
            raise SystemExit('Validated public DNS did not return a complete answer')
        answers = [answer for answer in data.get('Answer', [])
                   if answer.get('type') == 1 and answer.get('name', '').rstrip('.') == hostname]
        addresses = sorted({str(ipaddress.ip_address(answer['data'])) for answer in answers})
        if not addresses or any(not ipaddress.ip_address(address).is_global
                                or ipaddress.ip_address(address).version != 4 for address in addresses):
            raise SystemExit('Only public IPv4 archive addresses are accepted')
        if any(int(answer.get('TTL', 0)) <= 0 for answer in answers):
            raise SystemExit('A current public DNS answer is required')
        resolutions.append({'hostname': hostname, 'addresses': addresses,
                            'minimumTtl': min(int(answer['TTL']) for answer in answers)})

    hosts = Path('/etc/hosts')
    original = hosts.read_text()
    retained = re.sub(r'(?ms)^# BEGIN NZILA_CI_UBUNTU\n.*?^# END NZILA_CI_UBUNTU\n?', '', original)
    names = {item['hostname'] for item in resolutions}
    if any(names.intersection(line.split('#', 1)[0].split()[1:]) for line in retained.splitlines()):
        raise SystemExit('An unowned Ubuntu hosts entry requires review')
    lines = ['# BEGIN NZILA_CI_UBUNTU']
    lines += [address + ' ' + item['hostname'] for item in resolutions for address in item['addresses']]
    lines += ['# END NZILA_CI_UBUNTU']
    hosts.write_text(retained.rstrip('\n') + '\n' + '\n'.join(lines) + '\n')
    return resolutions


def configure() -> None:
    if (os.environ.get('GITHUB_ACTIONS') != 'true' or os.environ.get('RUNNER_OS') != 'Linux'
            or os.environ.get('RUNNER_ENVIRONMENT') != 'github-hosted'):
        raise SystemExit('This operation is restricted to disposable Linux GitHub-hosted runners')
    if os.geteuid() != 0:
        raise SystemExit('APT source configuration requires the runner root account')
    release = dict(
        line.split('=', 1) for line in Path('/etc/os-release').read_text().splitlines()
        if '=' in line
    )
    if release.get('ID', '').strip('"') != 'ubuntu':
        raise SystemExit('An Ubuntu runner is required')

    paths = [Path('/etc/apt/sources.list')]
    paths += sorted(Path('/etc/apt/sources.list.d').glob('*.list'))
    paths += sorted(Path('/etc/apt/sources.list.d').glob('*.sources'))
    changed = []
    official_found = False
    for path in paths:
        if not path.is_file():
            continue
        original = path.read_text()
        updated = rewrite_source_text(original)
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
    resolutions = configure_archive_resolution()
    print(json.dumps({'configured': 'official-ubuntu-https-archives', 'filesChanged': changed,
                      'archiveResolution': resolutions, 'signaturePolicyChanged': False,
                      'tlsVerificationChanged': False, 'testSelectionChanged': False}))


if __name__ == '__main__':
    configure()
