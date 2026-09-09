---
name: kmcp-dev-release-semver
description: >-
  kairos-mcp: releases via semantic-release dispatch. Conventional commits since the
  last tag decide the SemVer level (feat=minor, fix=patch, breaking=major); dispatch
  the Release workflow from main (stable) or a CI-green branch (prerelease); no local
  tags, no version-bump PRs, no manual version choice.
  Triggers: cut release, release, ship release, prerelease, beta release, rc, next
  version, bump version, semver bump, version bump, publish release, dispatch release,
  release workflow, release:type, npm version.
---

# Releases (kairos-mcp)

**Repository:** `kairos-mcp`. **Skill index:** [`.agents/skills/README.md`](https://github.com/jakub-plichcinski/kairos-mcp/blob/main/.agents/skills/README.md).
**Release workflow:** `.github/workflows/release.yml` (see **[`.github/workflows/README.md`](https://github.com/jakub-plichcinski/kairos-mcp/blob/main/.github/workflows/README.md)**).
**Build/test after merge:** [`kmcp-dev-build-test`](build-test.md).

The version is computed by **semantic-release** (`release.config.mjs`) from commit history — the user chooses **when** to release and whether it is stable or a prerelease; nobody chooses the number. Humans never edit `package.json` version for releases and never create `refs/tags/v*` (the pre-push hook blocks manual tags; the Release workflow pushes the tag).

---

## 1. Evidence first (what would release)

Inspect commits since the latest tag:

```bash
TAG=$(git tag --sort=-v:refname | rg '^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$' | head -n 1)
[ -n "$TAG" ] && git log "${TAG}..HEAD" --oneline || git log --oneline
```

| Signal | Level |
|--------|-------|
| `BREAKING CHANGE` / `feat!:` / `fix!:` | **major** |
| `feat:` | **minor** |
| `fix:` | **patch** |
| `docs:` / `chore:` / `refactor:` / `ci:` / `test:` / `perf:` | no release on its own |
| prerelease ask | same level, suffixed `-<channel>.N` |

Deliver before any dispatch:

1. **Verified facts** — commit categories since the last tag, API/MCP schema surface changes.
2. **Inference** — why **patch**/**minor**/**major** (or prerelease).
3. **Uncertainty** — what would change the call.

Never present a level as fact without commit evidence. Only `feat:`/`fix:`/breaking commits are releasable — if history is chore/docs-only, say so: the dispatch will end "nothing to release" (green no-op).

---

## 2. User confirmation

One-line format:

`Recommended release: <patch|minor|major>[ as <channel> prerelease] because <impact>.`

---

## 3. Dispatch the Release workflow

### 3.1 Stable (from main)

1. Merge conventional-commit PRs to **main**; wait for **Integration** green on the main head.
2. Dispatch:

```bash
gh workflow run release.yml --ref main -f release-type=stable
```

### 3.2 Prerelease (from a CI-green branch)

Integration triggers automatically only for PRs/pushes to main, so validate the branch first, then dispatch Release from the same ref:

```bash
gh workflow run integration.yml --ref <branch>
gh run list --workflow=integration.yml --limit 1   # wait for success
gh workflow run release.yml --ref <branch> -f release-type=prerelease -f channel=beta
```

The channel (default `beta`) becomes the version suffix, the npm dist-tag, and an image tag — never `latest`.

### 3.3 Preview without publishing

```bash
gh workflow run release.yml --ref main -f release-type=stable -f dry-run=true
```

Dry-run shows the next version only; nothing is prepared or published.

---

## 4. What the workflow does

- **validate** — ref rules (stable ⇒ main; prerelease ⇒ non-main branch), `.trivyignore` expiry, and a **green Integration run on the exact head SHA**. Dispatch controls timing, never validation.
- **release** — semantic-release computes the version once, bumps and syncs the workspace, consumer-tests the packed tgz, publishes npm via OIDC trusted publishing (dist-tag `latest`/channel), pushes the git tag, and creates the GitHub Release.
- **publish-container / publish-helm** — one image build for every alias on Docker Hub **and** Quay (single digest, cosign, SBOM, Trivy gate); Helm chart version/appVersion/image tag = the release version, pushed to `oci://quay.io/<namespace>`.
- **finalize** — SBOMs attached to the GitHub Release plus a run summary.

One version propagates everywhere: npm, both registries, the chart, `v<version>` tag, GitHub Release.

---

## 5. Verify

```bash
gh run list --workflow=release.yml --limit 3
gh release view v<version>
npm dist-tag ls @jakub-plichcinski/kairos-mcp
```

---

## 6. Edge cases

- **Nothing to release** — only chore/docs commits since the last tag: the run ends green with a "nothing to release" summary; add a `feat:`/`fix:` or skip.
- **Run failed after the tag existed** — re-dispatch with `republish=true`: it falls back to the latest tag reachable from HEAD and tolerates already-published npm/chart versions (both immutable). Investigate the original failure first; always tell the user republish re-uses the existing tag.
- **Wrong ref** — stable dispatched from a non-main branch (or prerelease from main): `validate` fails fast; re-dispatch from the correct ref.
- **Channel name** — must be lowercase letters/digits/hyphens and never `latest`.
- **Version in `package.json` looks stale** — that is the last synced baseline, not the next version; semantic-release decides the next version from tags + commits.

---

## Related

- **[`kmcp-dev-build-test`](build-test.md)** — validate after large release merges.
- **[`kmcp-dev-bugfix-ship`](bugfix-ship.md)** — if a release uncovers a production defect.
