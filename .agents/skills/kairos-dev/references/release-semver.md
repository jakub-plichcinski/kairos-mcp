---
name: kmcp-dev-release-semver
description: >-
  kairos-mcp: deterministic semver release. Inspect commits since last stable v*
  tag; recommend patch/minor/major with evidence; user confirms; release/* branch,
  npm run release:<type>, PR to main, no manual v* tag (CI tags after merge).
  Triggers: bump version, bump RC, bump prerelease, pre release, cut release, version-bump PR,
  release branch, next version, semver bump, release:rc, release:minor, release:patch,
  release:major, release:pre, npm version, version bump, bump to rc, bump to beta.
---

# Version bump and release (kairos-mcp)

**Repository:** `kairos-mcp`. **Skill index:** [`.agents/skills/README.md`](https://github.com/jakub-plichcinski/kairos-mcp/blob/main/.agents/skills/README.md).
**Tag automation:** `.github/workflows/release-tag-on-version-bump.yml` (see
**[`.github/workflows/README.md`](https://github.com/jakub-plichcinski/kairos-mcp/blob/main/.github/workflows/README.md)**).
**Build/test after merge:** [`kmcp-dev-build-test`](build-test.md).

Releases work **with or without** stepping through every narrative below.

- **Minimal path:** `npm version <type> --no-git-tag-version` or **`npm run release:<type>`**, then **`npm run version:sync`** when you did not use a **`release:*`** script → branch, commit, push, open PR yourself. (Each **`release:*`** script already runs **`version:sync`** for you.)
- **Full skill path:** judgment on semver → confirmation → scripted branch + PR + explicit “no local tag” reminder.

---

## 1. Choose next version type (evidence first)

Inspect commits since the latest **stable** tag (or all commits when none):

```bash
STABLE_TAG=$(git tag --sort=-v:refname | rg '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -n 1)
[ -n "$STABLE_TAG" ] && git log "${STABLE_TAG}..HEAD" --oneline || git log --oneline
```

Deliver before any bump:

1. **Verified facts** — commit categories, API/MCP schema surface changes, release-note signals.
2. **Inference** — why **`patch`**, **`minor`**, or **`major`** (or prerelease).
3. **Uncertainty** — what would change the call.

| Signal | Type | npm target |
|--------|------|------------|
| `BREAKING CHANGE` / `feat!:` / `fix!:` | **major** | `release:major` |
| `feat:` (backward-compatible) | **minor** | `release:minor` |
| `fix:` / `docs:` / `chore:` / `refactor:` / `ci:` / `test:` | **patch** | `release:patch` / `release:bug` |
| Prerelease ask | **rc** / **beta** / **pre** | `release:rc` / `release:beta` / `release:pre` |

**Pre-release vs beta — these are not interchangeable:**

| User says | Script | Suffix | When to use |
|-----------|--------|--------|-------------|
| "pre release" | `release:pre` | `-pre.N` | General pre-release on `main` (e.g. feature preview, early access) |
| "beta" | `release:beta` | `-beta.N` | Beta on non-main branches only (see §5); requires merged PR to trigger auto-tag |
| "RC" | `release:rc` | `-rc.N` | Release candidate, close to stable |

Never substitute `beta` when the user says "pre release". They are distinct flavors in this project's semver scheme.

“Next RC” without level → recommend level first; prefer **`minor`** when new capability ships, **`major`** when contract likely breaks; ask only if still ambiguous.

Never present a bump as fact without commit evidence.

---

## 2. User confirmation

One-line format:

`Recommended: <patch|minor|major> because <impact>.`

Confirm semver level and prerelease flavor if any. After confirmation, run **§3** without re-asking.

---

## 3. Automated steps (post-confirmation)

From **repo root**, in order.

### 3.1 Sync main

```bash
git fetch origin main
git checkout main
git pull origin main
```

### 3.2 Release branch + npm target

```bash
git checkout -b release/next
npm run release:<type>
```

`<type>`: `major` | `minor` | `patch` | `bug` | `rc` | `pre` | `beta`.

```bash
VERSION=$(node -p "require('./package.json').version")
git branch -m release/next "release/$VERSION"
```

### 3.3 Commit, push, PR

```bash
git add package.json package-lock.json src/embed-docs/mem/ .agents/skills/ compose.yaml helm/kairos-mcp/
git commit -m "release: $VERSION"
git push -u origin "release/$VERSION"
gh pr create --base main --head "release/$VERSION" \
  --title "release: $VERSION" \
  --body "Version bump to $VERSION."
```

Present the **PR URL** clearly. Optional:

```bash
gh pr view --json url -q .url
```

**Do not create or push `refs/tags/v*`.** Tags are created after merge when Integration succeeds; **pre-push** blocks manual tags.

---

## 4. What `version:sync` does

Each **`release:*`** script runs **`npm run version:sync`**, which chains three
syncs and is why the staging set above includes `compose.yaml` and
`helm/kairos-mcp/`:

1. **`version:sync-skills`** — `scripts/build-sync-skill-versions.mjs` (below).
2. **`compose:sync-app-tag`** — updates the `jakub-plichcinski/kairos-mcp:` image tag in **`compose.yaml`**.
3. **`helm:sync-app-version`** — `scripts/helm-sync-app-version.mjs` updates **`helm/kairos-mcp/Chart.yaml`** and **`helm/kairos-mcp/values.yaml`**.

### `version:sync-skills`

Implementation: **`scripts/build-sync-skill-versions.mjs`** (also **`prebuild`**).

1. **`src/embed-docs/mem/*.md`** — frontmatter **`version:`** ← **`package.json`** (including prerelease).
2. **`.agents/skills/<top-level>/SKILL.md`** (immediate children of **`.agents/skills/`**) — metadata **`version:`** and optional **`references/KAIROS.md`** frontmatter, using the **greater** of **`package.json`** version and latest **stable** `vX.Y.Z` tag (see script for edge cases).

**Scope:** Only **`.agents/skills/<name>/`** direct children (e.g. **`kairos`**); **`kairos-dev`** has no version field and is skipped.

**Check:** **`npm run version:check-skills`** (also pre-commit when relevant paths staged).

---

## 5. Beta release on a non-main branch

The auto-release workflow (`release-tag-on-version-bump.yml`) has three trigger paths:

| Trigger | When | Branches |
|---------|------|----------|
| `workflow_run` | Integration/Integration Simple succeed | `main`, `ci/**` |
| `pull_request` (closed) | `release/*beta*` PR merged | **any** target branch |
| `workflow_dispatch` | Manual trigger | any ref (beta only) |

**Non-main branches only allow beta versions** (version must contain `-beta.`).

### 5.1 Automatic path: PR merge triggers release

When a `release/*beta*` branch PR is merged into **any** branch (e.g. `next/v4.8`),
the workflow fires automatically via the `pull_request` trigger. No manual steps needed.

The workflow:
1. Verifies the PR was merged (not just closed).
2. Verifies the head branch matches `release/*beta*`.
3. Checks out the target branch, creates and pushes the tag.
4. Dispatches the Release workflow.

### 5.2 Create the version bump PR targeting the non-main branch

```bash
# From the target branch (e.g. next/v4.8)
git checkout next/v4.8
git pull origin next/v4.8
git checkout -b release/<version>       # e.g. release/4.8.0-beta.1
npm run release:beta                     # bumps to next -beta.N
VERSION=$(node -p "require('./package.json').version")
git branch -m release/beta "release/$VERSION"
git add package.json package-lock.json src/embed-docs/mem/ .agents/skills/ compose.yaml helm/kairos-mcp/
git commit -m "release: $VERSION"
git push -u origin "release/$VERSION"
gh pr create --base next/v4.8 --head "release/$VERSION" \
  --title "release: $VERSION" \
  --body "Version bump to $VERSION."
```

After merge, the release workflow triggers automatically.

### 5.3 Fallback: manual `workflow_dispatch`

If the automatic trigger fails or you need to re-release from a branch without a new PR:

```bash
gh workflow run release-tag-on-version-bump.yml \
  --ref <branch> -f ref=<branch>
# Example:
gh workflow run release-tag-on-version-bump.yml \
  --ref next/v4.8 -f ref=next/v4.8
```

### 5.4 Verify

```bash
# Check the tag workflow run
gh run list --workflow=release-tag-on-version-bump.yml --limit 3
# Check the release workflow run
gh run list --workflow=release.yml --limit 3
# Verify the release
gh release view v<version>
```

**Do not create or push `refs/tags/v*` locally.** Tags are created by the
workflow; pre-push hooks block manual tags.

---

## 6. Edge cases

- **Dirty tree** — stash or commit unrelated work first.
- **Existing `release/*`** — confirm reuse vs delete with the user.
- **Prerelease → stable** — often **`npm run release:patch`** from an `-rc` line (npm semantics apply).
- **`version:check-skills` fails** — `git fetch --tags`; **`npm run version:sync-skills`**; re-stage **`skills/`**, **`src/embed-docs/mem/`**, version files; re-run check.
- **New skill under `skills/<dir>/`** — ensure **`version:`** metadata line exists where the script expects.

---

## Related

- **[`kmcp-dev-build-test`](build-test.md)** — validate after large release merges.
- **[`kmcp-dev-bugfix-ship`](bugfix-ship.md)** — if a release uncovers a production defect.
