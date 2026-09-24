#!/usr/bin/env python3
"""Read-only public namespace probes. A missing record does not prove claimability."""
import concurrent.futures
import datetime
import hashlib
import json
import sys
import urllib.error
import urllib.request

def probe(entry):
    name, surface, url = entry
    result = {"candidate": name, "surface": surface, "url": url,
              "checked_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat()}
    request = urllib.request.Request(url, headers={"User-Agent": "ProjectNameResearch/1.0", "Accept": "application/json"})
    try:
        response = urllib.request.urlopen(request, timeout=20)
    except urllib.error.HTTPError as exc:
        response = exc
    except Exception as exc:
        result["error"] = str(exc)
        return result
    with response:
        body = response.read(1000000)
        result.update({"http_status": response.code, "final_url": response.url,
                       "content_type": response.headers.get("Content-Type"),
                       "body_sha256": hashlib.sha256(body).hexdigest()})
    try:
        data = json.loads(body)
        if isinstance(data, dict):
            keep = ["error", "errorCode", "title", "description", "message", "detail",
                    "login", "name", "ldhName", "orgname", "username",
                    "count", "total_count", "incomplete_results", "available", "valid", "namespace"]
            result["response_summary"] = {key: data[key] for key in keep if key in data}
            if isinstance(data.get("items"), list):
                result["items"] = [{key: item.get(key) for key in ("full_name", "html_url", "description")}
                                   for item in data["items"][:10]]
            if "results" in data:
                result["results_count"] = len(data["results"]) if isinstance(data["results"], list) else None
            if "servers" in data:
                result["servers_count"] = len(data["servers"])
            if "packages" in data:
                result["packages_count"] = len(data["packages"])
            if "objects" in data:
                result["objects_count"] = len(data["objects"])
        else:
            result["json_type"] = type(data).__name__
    except (ValueError, TypeError):
        result["body_excerpt"] = body[:300].decode("utf-8", errors="replace")
    return result

def entries(names):
    for name in names:
        for surface, url in [
            ("domain_com_rdap", f"https://rdap.verisign.com/com/v1/domain/{name}.com"),
            ("github_account", f"https://api.github.com/users/{name}"),
            ("npm_package", f"https://registry.npmjs.org/{name}"),
        ]:
            yield name, surface, url


tasks = [
    ("tacitloom", "github_repositories", "https://api.github.com/search/repositories?q=tacitloom&per_page=20"),
    ("tacitloom", "github_owner_repository", "https://api.github.com/repos/jakub-plichcinski/tacitloom"),
    ("tacitloom", "github_mcp_repository", "https://api.github.com/repos/jakub-plichcinski/tacitloom-mcp"),
    ("tacitloom", "npm_search", "https://registry.npmjs.org/-/v1/search?text=tacitloom&size=20"),
    ("tacitloom", "docker_image", "https://hub.docker.com/v2/repositories/tacitloom/tacitloom/"),
    ("tacitloom", "quay_image", "https://quay.io/api/v1/repository/tacitloom/tacitloom"),
    ("tacitloom", "mcp_registry", "https://registry.modelcontextprotocol.io/v0.1/servers?search=tacitloom&limit=100"),
    ("tacitloom", "artifact_hub", "https://artifacthub.io/api/v1/packages/search?ts_query_web=tacitloom&limit=20&offset=0"),
    ("tacitloom", "domain_net_rdap", "https://rdap.verisign.com/net/v1/domain/tacitloom.net"),
    ("tacitloom", "domain_app_rdap", "https://pubapi.registry.google/rdap/domain/tacitloom.app"),
    ("control", "github_account", "https://api.github.com/users/octocat"),
    ("control", "npm_package", "https://registry.npmjs.org/express"),
    ("control", "docker_namespace", "https://hub.docker.com/v2/users/library/"),
    ("control", "quay_org", "https://quay.io/api/v1/organization/projectquay"),
    ("control", "quay_user", "https://quay.io/api/v1/users/smarterclayton"),
    ("control", "pypi_package", "https://pypi.org/pypi/requests/json"),
    ("control", "crates_package", "https://crates.io/api/v1/crates/serde"),
    ("control", "domain_com_rdap", "https://rdap.verisign.com/com/v1/domain/google.com"),
    ("control", "domain_dev_rdap", "https://pubapi.registry.google/rdap/domain/web.dev"),
    ("control", "domain_org_rdap", "https://rdap.publicinterestregistry.org/rdap/domain/wikipedia.org"),
    ("control", "domain_ai_rdap", "https://rdap.identitydigital.services/rdap/domain/claude.ai")
]
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
    rows = list(executor.map(probe, tasks))
print(json.dumps({"observations": rows}, indent=2))
