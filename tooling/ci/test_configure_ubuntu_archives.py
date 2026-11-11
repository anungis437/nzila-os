import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

spec = importlib.util.spec_from_file_location(
    'configure_ubuntu_archives', Path(__file__).with_name('configure-ubuntu-archives.py'))
archives = importlib.util.module_from_spec(spec)
spec.loader.exec_module(archives)


class ArchiveConfigurationTests(unittest.TestCase):
    def test_rewrites_only_complete_transport_tokens(self):
        original = ('Types: deb\nURIs: mirror+file:/etc/apt/apt-mirrors.txt\n'
                    'Suites: noble noble-updates\nComponents: main universe\n'
                    'Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg\n')
        expected = original.splitlines()
        expected[1] = 'URIs: https://archive.ubuntu.com/ubuntu'
        self.assertEqual(archives.rewrite_source_text(original), '\n'.join(expected) + '\n')

    def test_hostname_mentions_in_other_urls_and_comments_are_unchanged(self):
        for value in (
            'https://evil.example/?next=http://azure.archive.ubuntu.com/ubuntu',
            'http://azure.archive.ubuntu.com.evil.example/ubuntu',
            'http://azure.archive.ubuntu.com@evil.example/ubuntu',
            '# http://azure.archive.ubuntu.com/ubuntu',
            'https://packages.microsoft.com/repos/azure-cli',
        ):
            with self.subTest(value=value):
                self.assertEqual(archives.rewrite_source_text(value), value)

    def make_fixture(self, directory):
        root = Path(directory)
        (root / 'etc/apt/sources.list.d').mkdir(parents=True)
        (root / 'etc/os-release').write_text('ID=ubuntu\nVERSION_CODENAME=noble\n')
        (root / 'etc/hosts').write_text('127.0.0.1 localhost\n::1 localhost6\n')
        (root / 'etc/apt/sources.list.d/ubuntu.sources').write_text(
            'Types: deb\nURIs: mirror+file:/etc/apt/apt-mirrors.txt\n'
            'Suites: noble noble-updates noble-security\nComponents: main universe\n'
            'Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg\n')
        return root

    @staticmethod
    def dns_response(url, timeout):
        query = parse_qs(urlsplit(url).query)
        hostname = query['name'][0]
        if query.get('cd') != ['false'] or query.get('edns_client_subnet') != ['0.0.0.0/0']:
            raise AssertionError('DNS validation and privacy parameters must remain enabled')
        return io.BytesIO(json.dumps({'Status': 0, 'CD': False, 'TC': False,
                                    'Answer': [{'name': hostname + '.', 'type': 1,
                                                'TTL': 60, 'data': '185.125.190.81'}]}).encode())

    def fixture_patches(self, root):
        stack = contextlib.ExitStack()
        stack.enter_context(patch.object(archives, 'Path', side_effect=lambda p: root / str(p).lstrip('/')))
        stack.enter_context(patch.object(archives.os, 'geteuid', return_value=0))
        stack.enter_context(patch.dict(os.environ, {'GITHUB_ACTIONS': 'true', 'RUNNER_OS': 'Linux',
                                                   'RUNNER_ENVIRONMENT': 'github-hosted'}))
        stack.enter_context(patch.object(archives, 'urlopen', side_effect=self.dns_response))
        stack.enter_context(contextlib.redirect_stdout(io.StringIO()))
        return stack

    def test_preserves_other_hosts_and_is_idempotent(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self.make_fixture(directory)
            with self.fixture_patches(root):
                archives.configure()
                first = (root / 'etc/hosts').read_text()
                archives.configure()
                self.assertEqual((root / 'etc/hosts').read_text(), first)
                self.assertTrue(first.startswith('127.0.0.1 localhost\n::1 localhost6\n'))
                self.assertEqual(first.count('# BEGIN NZILA_CI_UBUNTU'), 1)
                self.assertIn('185.125.190.81 archive.ubuntu.com', first)
                self.assertIn('Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg',
                              (root / 'etc/apt/sources.list.d/ubuntu.sources').read_text())

    def test_refuses_private_dns_answers_without_writing_hosts(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self.make_fixture(directory)
            before = (root / 'etc/hosts').read_bytes()
            response = {'Status': 0, 'CD': False, 'Answer': [
                {'name': 'archive.ubuntu.com.', 'type': 1, 'TTL': 60, 'data': '10.1.2.3'}]}
            with self.fixture_patches(root), patch.object(
                    archives, 'urlopen', return_value=io.BytesIO(json.dumps(response).encode())):
                with self.assertRaises(SystemExit):
                    archives.configure()
            self.assertEqual((root / 'etc/hosts').read_bytes(), before)

    def test_refuses_existing_unowned_archive_host_entries(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self.make_fixture(directory)
            hosts = root / 'etc/hosts'
            hosts.write_text('127.0.0.1 localhost\n185.125.190.82 archive.ubuntu.com\n')
            before = hosts.read_bytes()
            with self.fixture_patches(root), self.assertRaises(SystemExit):
                archives.configure()
            self.assertEqual(hosts.read_bytes(), before)

    def test_refuses_self_hosted_and_non_ci_execution(self):
        for values in ({'GITHUB_ACTIONS': 'false'}, {'RUNNER_ENVIRONMENT': 'self-hosted'}):
            with patch.dict(os.environ, {'GITHUB_ACTIONS': 'true', 'RUNNER_OS': 'Linux',
                                         'RUNNER_ENVIRONMENT': 'github-hosted', **values}):
                with self.assertRaises(SystemExit):
                    archives.configure()


if __name__ == '__main__':
    unittest.main()
