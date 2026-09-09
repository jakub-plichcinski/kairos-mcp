# Canonical CI / Release Redesign — AI Coder Handoff

## Goal

Replace the current ad-hoc `.github` release cycle with a professional, standards-based CI/CD model for:

- npm package
- OCI container published to Quay
- Helm chart published as OCI
- GitHub Releases

This document is the implementation brief. The current `.github` workflows should be treated as legacy behavior to migrate away from, not as the architecture to preserve.

## Core design rule

**Calculate the release version once, then publish every artifact from that same version.**

Do not independently bump npm, image, Helm, and GitHub release versions.

Use `semantic-release` as the release/version authority.

## Branch / release model

Recommended canonical model:

| Branch | CI | Version | npm | Quay | Helm OCI | GitHub Release |
|---|---|---|---|---|---|---|
| `feature/*` / PRs | full validation | none | none | none | none | none |
| `next` | full validation + publish | `X.Y.Z-next.N` | dist-tag `next` | immutable prerelease tag + optional `next` alias | `X.Y.Z-next.N` | prerelease |
| `main` | full validation + publish | stable `X.Y.Z` | dist-tag `latest` | immutable SemVer + convenience aliases | `X.Y.Z` | stable release |

Do **not** publish public prereleases from every arbitrary non-main branch. Use one designated prerelease/integration branch such as `next`.

### Conventional Commits

Use commit history as release input:

- `fix:` -> PATCH
- `feat:` -> MINOR
- `feat!:` or `BREAKING CHANGE:` -> MAJOR

`semantic-release` determines the next version, creates the git tag, release notes, and GitHub release state.

## Target pipeline

```text
PR / push
  |
  +-- install dependencies
  +-- lint / formatting checks
  +-- type checks
  +-- unit tests
  +-- build
  +-- npm pack
  +-- package-consumer tests against the generated .tgz
  +-- container build
  +-- container tests / smoke tests
  +-- helm lint
  +-- helm template
  +-- schema / manifest validation
  +-- ephemeral Kubernetes install test where practical
  |
  v
ALL VALIDATION PASSES
  |
  v
semantic-release determines VERSION exactly once
  |
  +-- npm publish
  +-- container publish to Quay
  +-- Helm OCI publish
  +-- git tag
  +-- GitHub Release
```

No publishing job may run unless the complete required validation graph succeeds.

## npm canonical workflow

Use `semantic-release` with npm publishing.

Preferred authentication: npm Trusted Publishing / GitHub Actions OIDC rather than a long-lived `NPM_TOKEN`, where supported by the package/account configuration.

Stable:

```text
@scope/package@1.6.0
npm dist-tag: latest
```

Prerelease:

```text
@scope/package@1.7.0-next.3
npm dist-tag: next
```

Required validation before publication:

```bash
npm ci
npm run lint
npm test
npm run build
npm pack
```

The packed `.tgz` must be tested as a consumer package. Do not rely only on tests executed from the source checkout. This catches missing `files`, bad exports, generated-file omissions, packaging mistakes, and runtime resolution problems.

The repository already has package-consumer testing history; preserve the intent but redesign it so the packed artifact is the test subject.

## Container / Quay canonical workflow

Use the maintained Docker GitHub Actions stack:

- `docker/setup-buildx-action`
- `docker/login-action`
- `docker/metadata-action`
- `docker/build-push-action`

Use BuildKit and caching.

Stable image tags may include:

```text
1.7.0
1.7
1
latest
```

Prerelease:

```text
1.8.0-next.4
next
```

Important invariant:

**Build one image artifact and attach all aliases to the same digest. Never rebuild separately for each tag.**

Production/deployment references should prefer the immutable digest or full immutable SemVer tag, not `latest`.

Enable provenance and SBOM generation for release images where supported, e.g. BuildKit / `build-push-action` attestations.

## Helm canonical workflow

Use Helm OCI publishing rather than introducing or maintaining a traditional `index.yaml` chart repository for a new architecture.

`Chart.yaml` release values must be derived from the single semantic-release version:

```yaml
version: 1.7.0
appVersion: "1.7.0"
```

Prerelease example:

```yaml
version: 1.8.0-next.4
appVersion: "1.8.0-next.4"
```

Publish via OCI to the chosen registry namespace, preferably alongside the application's registry strategy.

Validation before publication:

```bash
helm lint
helm template
helm package
```

Also add Kubernetes/schema validation and an ephemeral install/smoke test if practical.

Do not invent a Helm `latest` tag. Helm OCI release identity should follow the chart SemVer.

## Version propagation

The version emitted by semantic-release is the canonical release version for all artifacts:

```text
VERSION=1.8.0

npm:       @scope/package@1.8.0
container: quay.io/<org>/<image>:1.8.0
helm:      oci://quay.io/<org>/<chart>:1.8.0
git:       v1.8.0
GitHub:    v1.8.0 release
```

For prerelease:

```text
VERSION=1.9.0-next.2
```

The exact value is propagated unchanged everywhere.

Avoid workflows that edit version files and then trigger other workflows that independently infer or bump versions.

## GitHub Actions architecture

Prefer a small number of workflows with explicit responsibilities, reusable workflows/actions where repetition exists, and clear dependency graphs.

Suggested conceptual split:

1. `ci.yml`
   - PR and branch validation
   - lint, types, tests, build
   - npm packed-artifact consumer test
   - container build/test
   - Helm validation/test
   - no publishing

2. `release.yml`
   - only designated release branches (`main`, `next`)
   - depends on or repeats immutable validated build inputs as needed for secure release boundaries
   - semantic-release determines release
   - publishes npm, Quay image, Helm OCI and GitHub Release from one version

3. Security/dependency workflows only where they have independent value
   - CodeQL
   - Dependabot
   - carefully designed Dependabot auto-merge if policy permits

Do not retain separate workflows merely because they currently exist.

## Existing `.github` state to replace

Current release responsibility is fragmented across workflows including at least:

- `helm-chart.yml`
- `helm-version-bump.yml`
- `publish-container.yml`
- `publish-npm.yml`
- `release-tag-on-version-bump.yml`
- `release.yml`

There are also integration, dependency, auto-fix, rebase, CodeQL, and Dependabot workflows.

Before deleting anything, classify each existing workflow into:

- preserve function in new CI
- replace completely
- security workflow retained independently
- obsolete / delete

The objective is architectural simplification, not a one-for-one rewrite of legacy YAML.

## Security / supply-chain requirements

Prefer:

- least-privilege `permissions:` per job/workflow
- GitHub OIDC / trusted publishing instead of long-lived registry credentials where supported
- pinned or trusted maintained actions
- dependency caching with deterministic lockfiles
- artifact provenance / attestations where supported
- container SBOM
- immutable release artifacts
- no secrets exposed to fork PR workflows
- protected `main` / `next` release branches
- required CI status checks before merge
- GitHub Environments for publication credentials where useful

## Release correctness requirements

The implementation is incomplete unless these properties hold:

1. One semantic version is calculated once per release.
2. npm, image, Helm, Git tag, and GitHub Release all use exactly that version.
3. Failed validation cannot publish any artifact.
4. PRs and feature branches never create stable releases.
5. Stable releases originate only from `main`.
6. Prereleases originate only from the designated prerelease branch (`next` unless intentionally renamed).
7. A stable release uses npm `latest`; prerelease uses npm `next`.
8. Container aliases point to one identical digest for a release.
9. Helm uses OCI SemVer identity.
10. The packed npm artifact is consumer-tested before publication.
11. Re-running a workflow cannot silently create a different artifact under the same immutable version.

## Migration approach

Implement incrementally on this branch/PR:

1. Inventory current workflows and document what each function becomes.
2. Add semantic-release configuration and required dependencies.
3. Build the new CI validation workflow.
4. Add packed npm consumer tests.
5. Add container build/test with BuildKit caching.
6. Add Helm validation/install testing.
7. Implement unified release workflow and version propagation.
8. Configure npm trusted publishing / Quay credentials or OIDC-compatible mechanism as available.
9. Test prerelease flow on `next` before enabling stable release.
10. Remove superseded legacy workflows only after replacement coverage is proven.
11. Update `.github/workflows/README.md` to describe the new architecture rather than legacy mechanics.

Commit each meaningful implementation step to this PR branch. The branch is the working state; do not leave material work only in chat or temporary local files.

## Canonical upstream references

AI coder should verify current syntax against official upstream docs during implementation:

- semantic-release: https://semantic-release.gitbook.io/semantic-release/
- semantic-release GitHub: https://github.com/semantic-release/semantic-release
- npm Trusted Publishing: https://docs.npmjs.com/trusted-publishers/
- GitHub publishing Docker images: https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images
- Docker GitHub Actions / attestations: https://docs.docker.com/build/ci/github-actions/
- Helm OCI registries: https://helm.sh/docs/topics/registries/
- GitHub artifact attestations: https://docs.github.com/en/actions/security-for-github-actions/using-artifact-attestations/

## Non-goals

- Do not preserve historical release mechanisms just to reduce diff size.
- Do not introduce a custom versioning script when semantic-release already provides the required semantics.
- Do not independently version npm, image, and chart.
- Do not publish prereleases from every feature branch.
- Do not rely on `latest` for immutable deployment identity.

## Definition of done

The PR can leave draft state only when the repository has a tested, understandable CI/release architecture where a developer can merge conventional commits through the designated branches and obtain reproducible npm, Quay, Helm OCI, Git tag, and GitHub Release artifacts from one automatically determined SemVer version.