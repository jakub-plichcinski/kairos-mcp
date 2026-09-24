# Project name research

Status: research completed with a conditional recommendation: [Tacitloom](RECOMMENDATION.md). Started 2026-09-09 UTC.
Source snapshot: `5fe75d74dd5a5bf4ee18cde7c7c48154424f080c`.

## Objective

Choose a distinctive new name from the project's purpose, independently of its current name. Check a coherent public namespace before recommending it. Naming research only; no product changes, registrations, purchases, or renames.

## Product grounding

An MCP service that turns reusable know-how into persistent, discoverable procedures and guides agents through ordered, validated steps. It includes a CLI, browser UI, REST API, reusable skills, npm distribution, Docker Hub and Quay images, and Helm deployment. The name should suggest retained know-how becoming dependable action, without implying a foundation model or promising infallibility.

Sources at the snapshot above: [README](https://github.com/jakub-plichcinski/kairos-mcp/blob/5fe75d74dd5a5bf4ee18cde7c7c48154424f080c/README.md), [contributor principles](https://github.com/jakub-plichcinski/kairos-mcp/blob/5fe75d74dd5a5bf4ee18cde7c7c48154424f080c/CONTRIBUTING.md), [business examples](https://github.com/jakub-plichcinski/kairos-mcp/blob/5fe75d74dd5a5bf4ee18cde7c7c48154424f080c/docs/business/README.md), [package manifest](https://github.com/jakub-plichcinski/kairos-mcp/blob/5fe75d74dd5a5bf4ee18cde7c7c48154424f080c/package.json), [image publishing](https://github.com/jakub-plichcinski/kairos-mcp/blob/5fe75d74dd5a5bf4ee18cde7c7c48154424f080c/.github/workflows/publish-container.yml), [Helm chart](https://github.com/jakub-plichcinski/kairos-mcp/blob/5fe75d74dd5a5bf4ee18cde7c7c48154424f080c/helm/kairos-mcp/Chart.yaml).

## Acceptance checks

- Memorable, pronounceable, reasonably easy to spell; lowercase ASCII slug.
- Avoid crowded mythology, generic AI branding, and collisions with related software.
- Domains: prioritize exact .com plus .dev and .org; inspect .io and .ai.
- npm: unscoped package, brand organization scope, and MCP package variant.
- GitHub: global user/organization namespace; distinguish an organization from its local team and repository names. Check repository collisions separately.
- Docker Hub and Quay: namespace and repository path, not merely image search.
- Derived and additional surfaces: GHCR, Helm/Artifact Hub, MCP Registry, agent skills, CLI, PyPI, crates.io, and obvious public brand/trademark conflicts.
- Record exact URLs, timestamps, and observations. No indexed result, HTTP 404, and confirmed registration availability are different claims. Treat blocked checks as unknown.

## Progress

1. Research branch created before writing artifacts.
2. Product purpose and existing distribution surfaces inspected.
3. Twelve independent candidates screened; strongest three received extended checks.
4. Finalist checked across domains, GitHub, npm, Docker Hub, Quay, MCP Registry, Artifact Hub, PyPI, and crates.io, with positive controls.
5. Recommendation and unresolved registration checks are preserved in [RECOMMENDATION.md](RECOMMENDATION.md). No product changes or registrations.
