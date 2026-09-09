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

if __name__ == "__main__":
    tasks = list(entries(sys.argv[1:]))
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        rows = list(executor.map(probe, tasks))
    print(json.dumps({"purpose": "Public record checks; not registration guarantees", "observations": rows}, indent=2))
