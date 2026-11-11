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
import time
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import URLError


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
        # Default HTTPS validation remains enabled for both public resolvers.
        # A transient upstream SERVFAIL never becomes an accepted DNS answer.
        addresses = []
        last_status = 'no response'
        for attempt in range(3):
            for endpoint in ('https://dns.google/resolve?',
                             'https://cloudflare-dns.com/dns-query?'):
                try:
                    request = Request(endpoint + query, headers={'Accept': 'application/dns-json'})
                    with urlopen(request, timeout=30) as response:
                        data = json.loads(response.read(65536))
                except (URLError, TimeoutError):
                    last_status = 'transport failure'
                    continue
                last_status = str({key: data.get(key) for key in ('Status', 'CD', 'TC')})
                if data.get('Status') != 0 or data.get('CD') is not False or data.get('TC'):
                    continue
                answers = [answer for answer in data.get('Answer', [])
                           if answer.get('type') == 1 and answer.get('name', '').rstrip('.') == hostname]
                addresses = sorted({str(ipaddress.ip_address(answer['data'])) for answer in answers})
                if not addresses:
                    continue
                if any(not ipaddress.ip_address(address).is_global
                       or ipaddress.ip_address(address).version != 4 for address in addresses):
                    raise SystemExit('Only public IPv4 archive addresses are accepted')
                if any(int(answer.get('TTL', 0)) <= 0 for answer in answers):
                    addresses = []
                    continue
                break
            if addresses:
                break
            if attempt < 2:
                time.sleep(2 ** attempt)
        if not addresses:
            raise SystemExit('Validated public DNS unavailable for ' + hostname + ': ' + last_status)
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
        active_tokens = {token for line in updated.splitlines()
                         if not line.lstrip().startswith('#') for token in line.split()}
        obsolete_transports = {
            'mirror+file:/etc/apt/apt-mirrors.txt',
            'mirror+file:/etc/apt/apt-security-mirrors.txt',
            'http://azure.archive.ubuntu.com/ubuntu',
            'https://azure.archive.ubuntu.com/ubuntu',
        }
        obsolete_transports |= {uri + '/' for uri in list(obsolete_transports)}
        if active_tokens.intersection(obsolete_transports):
            raise SystemExit('An unconverted Ubuntu mirror remains; refusing partial configuration')
        official_transports = {'https://archive.ubuntu.com/ubuntu',
                               'https://security.ubuntu.com/ubuntu'}
        official_transports |= {uri + '/' for uri in list(official_transports)}
        official_found |= bool(active_tokens.intersection(official_transports))
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
