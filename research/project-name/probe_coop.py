#!/usr/bin/env python3
"""Read-only domain/namespace screening. Never registers or changes resources."""
import argparse
import concurrent.futures
import datetime
import json
from pathlib import Path
import subprocess
import urllib.parse
from probe_names import probe


def domain_lookup(domain):
    command = ['gcloud', 'domains', 'registrations', 'get-register-parameters', domain, '--format=json', '--quiet']
    row = {'domain': domain, 'checked_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'command': command}
    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=60)
        row['exit_code'] = result.returncode
        if result.returncode == 0:
            row['response'] = json.loads(result.stdout)
        else:
            row['error'] = result.stderr[-2000:]
    except (subprocess.TimeoutExpired, ValueError) as exc:
        row['error'] = str(exc)
    return row


def namespace_entries(name):
    return [(name, surface, url) for surface, url in [
        ('github_account', f'https://api.github.com/users/{name}'),
        ('github_repositories', f'https://api.github.com/search/repositories?q={name}&per_page=100'),
        ('github_owner_repository', f'https://api.github.com/repos/jakub-plichcinski/{name}'),
        ('github_mcp_repository', f'https://api.github.com/repos/jakub-plichcinski/{name}-mcp'),
        ('npm_package', f'https://registry.npmjs.org/{name}'),
        ('npm_mcp_package', f'https://registry.npmjs.org/{name}-mcp'),
        ('npm_scope', f'https://registry.npmjs.org/-/org/{name}/user'),
        ('npm_scoped_package', f'https://registry.npmjs.org/@{name}%2Fmcp'),
        ('npm_search', f'https://registry.npmjs.org/-/v1/search?text={name}&size=100'),
        ('docker_namespace', f'https://hub.docker.com/v2/users/{name}/'),
        ('docker_image', f'https://hub.docker.com/v2/repositories/{name}/{name}/'),
        ('quay_org', f'https://quay.io/api/v1/organization/{name}'),
        ('quay_user', f'https://quay.io/api/v1/users/{name}'),
        ('quay_image', f'https://quay.io/api/v1/repository/{name}/{name}'),
        ('ghcr_image', f'https://ghcr.io/v2/{name}/{name}/tags/list'),
        ('mcp_registry', f'https://registry.modelcontextprotocol.io/v0.1/servers?search={name}&limit=100'),
        ('artifact_hub', f'https://artifacthub.io/api/v1/packages/search?ts_query_web={name}&limit=60&offset=0'),
        ('pypi_package', f'https://pypi.org/pypi/{name}/json'),
        ('crates_package', f'https://crates.io/api/v1/crates/{name}'),
    ]]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--domains', nargs='*', default=[])
    parser.add_argument('--names', nargs='*', default=[])
    parser.add_argument('--controls', action='store_true')
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    data = {'purpose': 'Read-only screening; availability can change; missing public records do not guarantee claimability.', 'domains': [], 'namespaces': []}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        data['domains'] = list(pool.map(domain_lookup, args.domains))
        entries = [entry for name in args.names for entry in namespace_entries(name)]
        if args.controls:
            entries += [
                ('control', 'github_account', 'https://api.github.com/users/octocat'),
                ('control', 'github_repositories', 'https://api.github.com/search/repositories?q=github-mcp-server&per_page=5'),
                ('control', 'npm_package', 'https://registry.npmjs.org/express/latest'),
                ('control', 'npm_scope', 'https://registry.npmjs.org/-/org/types/user'),
                ('control', 'npm_search', 'https://registry.npmjs.org/-/v1/search?text=express&size=5'),
                ('control', 'docker_namespace', 'https://hub.docker.com/v2/users/library/'),
                ('control', 'docker_image', 'https://hub.docker.com/v2/repositories/library/alpine/'),
                ('control', 'quay_org', 'https://quay.io/api/v1/organization/projectquay'),
                ('control', 'quay_user', 'https://quay.io/api/v1/users/smarterclayton'),
                ('control', 'mcp_registry', 'https://registry.modelcontextprotocol.io/v0.1/servers?search=github&limit=5'),
                ('control', 'artifact_hub', 'https://artifacthub.io/api/v1/packages/search?ts_query_web=postgresql&limit=5&offset=0'),
                ('control', 'pypi_package', 'https://pypi.org/pypi/requests/json'),
                ('control', 'crates_package', 'https://crates.io/api/v1/crates/serde'),
            ]
        data['namespaces'] = list(pool.map(probe, entries))
    Path(args.output).write_text(json.dumps(data, indent=2) + '\n')
    for row in data['domains']:
        print(row['domain'], json.dumps(row.get('response', row.get('error'))))
    for row in data['namespaces']:
        print(row['candidate'], row['surface'], row.get('http_status', row.get('error')), json.dumps(row.get('response_summary', {})))


if __name__ == '__main__':
    main()
