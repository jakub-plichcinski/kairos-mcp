# Canonical CI / Release Redesign — AI Coder Handoff

## Goal

Replace the current ad-hoc `.github` release cycle with a professional, standards-based CI/CD model for:

- npm package
- OCI container published to Quay
- Helm chart published as OCI
- GitHub Releases

This document is the implementation brief. Treat the current `.github` workflows as legacy behavior to classify and replace, not as an architecture to preserve.

## Core design rules

1. **`main` is the only permanent integration/release branch.**
2. **PR/topic branches validate changes but do not require a permanent `dev` or `next` branch.**
3. **Calculate the release version once, then publish every artifact from that exact version.**
4. **For now, stable and prerelease publication are manually triggered GitHub Actions workflows.**
5. **Design the release path so approved security fixes can later be released automatically with the same pipeline and safety gates.**

Use `semantic-release` as the SemVer/version authority. Do not independently bump npm, image, Helm, and GitHub release versions.

## Branch / release model

Use a GitHub-Flow-style model:

```text
short-lived topic branch
        |
        v
       PR
        |
        +-- full CI validation
        +-- build/package/container/chart tests
        +-- no stable publication
        |
        v
      main
        |
        +-- manual stable release action -> X.Y.Z
        |
        +-- manual prerelease action when needed -> X.Y.Z-<channel>.N
```

There is **no permanent `dev` or `next` branch**. Avoid creating two competing definitions of current code.

Normal feature/fix branches are short-lived and merge directly to `main` through reviewed PRs.

If a future exceptional release train genuinely needs a temporary branch, use an explicitly temporary branch such as `release/3.0` and delete it after the release train. Do not make that the normal development path.

### Current release triggers

Publication remains intentionally manual for now via `workflow_dispatch`:

- **stable release**: manually dispatch against `main`
- **prerelease**: manually dispatch against an explicitly selected commit/ref that has passed required validation

The implementation must prevent a manual dispatch from bypassing validation or releasing arbitrary untrusted code.

### Future security-release automation

A major design goal is eventually allowing security dependency/fix PRs to move from trusted detection -> validation -> merge -> release automatically so security fixes reach users quickly.

Do **not** create a separate security-release implementation now unless requested. Instead, build the normal release pipeline so future automation can safely invoke the same reusable release path.

Future automation must still preserve:

- required CI/security checks
- trusted change provenance
- explicit policy for which security changes qualify
- least-privilege credentials
- immutable artifacts
- one version authority
- rollback/audit visibility

Security automation should remove human latency, not remove release correctness gates.

## Conventional Commits / version calculation

Use commit history as semantic-release input:

- `fix:` -> PATCH
- `feat:` -> MINOR
- `feat!:` or `BREAKING CHANGE:` -> MAJOR

`semantic-release` determines the next version, creates the git tag/release notes, and provides the canonical version to downstream publication steps.

The manual release action chooses **when** to release; humans should not manually calculate or edit the version.

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
  +-- package-consumer tests against generated .tgz
  +-- container build
  +-- container tests / smoke tests
  +-- helm lint
  +-- helm template
  +-- schema / manifest validation
  +-- ephemeral Kubernetes install test where practical
  |
  v
ALL VALIDATION PASSES

Manual release/prerelease dispatch
  |
  +-- verify eligible main/ref + required validation
  +-- semantic-release determines VERSION exactly once
  |
  +-- npm publish
  +-- container publish to Quay
  +-- Helm OCI publish
  +-- git tag
  +-- GitHub Release / prerelease
```

No publishing job may run unless the complete required validation graph succeeds.

## npm canonical workflow

Use `semantic-release` with npm publishing.

Preferred authentication: npm Trusted Publishing / GitHub Actions OIDC rather than a long-lived `NPM_TOKEN`, where supported by package/account configuration.

Stable example:

```text
@scope/package@1.6.0
npm dist-tag: latest
```

Prerelease example:

```text
@scope/package@1.7.0-beta.3
npm dist-tag: beta
```

The prerelease channel should be an explicit workflow input or narrowly defined policy, not coupled to a permanent branch name.

Required validation before publication:

```bash
npm ci
npm run lint
npm test
npm run build
npm pack
```

The packed `.tgz` must be tested as a consumer package. Do not rely only on tests executed from the source checkout. This catches missing `files`, bad exports, generated-file omissions, packaging mistakes, and runtime resolution problems.

Preserve the repository's package-consumer-testing intent, but ensure the packed artifact itself is the test subject.

## Container / Quay canonical workflow

Use maintained Docker GitHub Actions:

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

Prerelease example:

```text
1.8.0-beta.4
beta
```

Important invariant:

**Build one image artifact and attach all aliases to the same digest. Never rebuild separately for each tag.**

Production/deployment references should prefer the immutable digest or full immutable SemVer tag, not `latest`.

Enable provenance and SBOM generation for release images where supported.

## Helm canonical workflow

Use Helm OCI publishing rather than maintaining a traditional `index.yaml` repository for the new architecture.

`Chart.yaml` release values must derive from the single semantic-release version:

```yaml
version: 1.7.0
appVersion: "1.7.0"
```

Prerelease:

```yaml
version: 1.8.0-beta.4
appVersion: "1.8.0-beta.4"
```

Publish via OCI to the chosen registry namespace, preferably aligned with the application's registry strategy.

Validation before publication:

```bash
helm lint
helm template
helm package
```

Also add Kubernetes/schema validation and an ephemeral install/smoke test if practical.

Do not invent a Helm `latest` tag. Helm OCI release identity should follow chart SemVer.

## Version propagation

The version emitted by semantic-release is canonical for all artifacts:

```text
VERSION=1.8.0

npm:       @scope/package@1.8.0
container: quay.io/<org>/<image>:1.8.0
helm:      oci://quay.io/<org>/<chart>:1.8.0
git:       v1.8.0
GitHub:    v1.8.0 release
```

Prerelease example:

```text
VERSION=1.9.0-beta.2
```

Propagate the exact value unchanged everywhere.

Avoid workflows that edit version files and then trigger other workflows that independently infer or bump versions.

## GitHub Actions architecture

Prefer a small number of workflows with explicit responsibilities, reusable workflows/actions where repetition exists, and clear dependency graphs.

Suggested conceptual split:

### `ci.yml`

Triggered on PRs and relevant pushes.

- lint / formatting
- types
- unit/integration tests
- build
- npm packed-artifact consumer test
- container build/test
- Helm validation/test
- no publication

### `release.yml`

Initially `workflow_dispatch` only.

Inputs should distinguish stable vs prerelease and, for prerelease, an explicit prerelease channel if needed.

Responsibilities:

- validate the selected release ref is eligible
- require/verify successful CI
- semantic-release determines version
- publish npm, Quay image, Helm OCI, git tag, and GitHub Release from one version
- stable releases are only allowed from `main`
- prereleases must never mutate or masquerade as stable releases

Design the release implementation as reusable jobs/workflows where appropriate so future trusted security automation invokes this same path rather than introducing another release mechanism.

### Independent security/dependency workflows

Keep only where they have independent value:

- CodeQL
- Dependabot
- carefully designed Dependabot/security auto-merge when policy permits
- future security-release orchestration

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

Before deleting anything, classify every workflow into:

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
- protected `main`
- required CI status checks before merge
- GitHub Environments/approvals for publication credentials where useful during the manual-release phase

The architecture must make later security-release automation possible without granting broad credentials to normal PR workflows.

## Release correctness requirements

The implementation is incomplete unless these properties hold:

1. One semantic version is calculated once per release.
2. npm, image, Helm, Git tag, and GitHub Release all use exactly that version.
3. Failed validation cannot publish any artifact.
4. PR/topic branches never create stable releases.
5. Stable releases originate only from `main`.
6. No permanent `dev`/`next` integration branch is required.
7. Stable releases use npm `latest`; prereleases use an explicit non-`latest` dist-tag/channel.
8. Container aliases point to one identical digest for a release.
9. Helm uses OCI SemVer identity.
10. The packed npm artifact is consumer-tested before publication.
11. Re-running a workflow cannot silently create a different artifact under the same immutable version.
12. Manual dispatch controls release timing, not version calculation or validation bypass.
13. Future security automation can invoke the same release path rather than duplicating release logic.

## Migration approach

Implement incrementally on this branch/PR:

1. Inventory current workflows and document what each function becomes.
2. Add semantic-release configuration and required dependencies.
3. Build the new CI validation workflow.
4. Add packed npm consumer tests.
5. Add container build/test with BuildKit caching.
6. Add Helm validation/install testing.
7. Implement unified manual `workflow_dispatch` release/prerelease workflow and version propagation.
8. Configure npm trusted publishing / Quay authentication mechanism as available.
9. Test prerelease publication manually without introducing a permanent prerelease branch.
10. Test stable publication semantics from `main` in a safe/non-destructive manner before enabling production publication.
11. Remove superseded legacy workflows only after replacement coverage is proven.
12. Update `.github/workflows/README.md` to describe the new architecture.
13. Leave a documented extension point for future automated security releases.

Commit each meaningful implementation step to this PR branch. The repository branch is the working state; do not leave material work only in chat or temporary files.

## Canonical upstream references

Verify current syntax against official upstream docs during implementation:

- semantic-release: https://semantic-release.gitbook.io/semantic-release/
- semantic-release GitHub: https://github.com/semantic-release/semantic-release
- npm Trusted Publishing: https://docs.npmjs.com/trusted-publishers/
- GitHub publishing Docker images: https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images
- Docker GitHub Actions / attestations: https://docs.docker.com/build/ci/github-actions/
- Helm OCI registries: https://helm.sh/docs/topics/registries/
- GitHub artifact attestations: https://docs.github.com/en/actions/security-for-github-actions/using-artifact-attestations/

## Non-goals

- Do not preserve historical release mechanisms just to reduce diff size.
- Do not introduce a custom versioning script when semantic-release provides the required semantics.
- Do not independently version npm, image, and chart.
- Do not introduce a permanent `dev` or `next` branch merely to produce prereleases.
- Do not automatically publish ordinary feature branches.
- Do not build a second release pipeline specifically for security automation.
- Do not rely on `latest` for immutable deployment identity.

## Definition of done

The PR can leave draft state only when the repository has a tested, understandable architecture where developers work through short-lived PR branches into `main`, CI fully validates artifacts, and an explicitly dispatched release/prerelease workflow can reproducibly publish npm, Quay, Helm OCI, Git tag, and GitHub Release artifacts from one automatically determined SemVer version.

The resulting design must also provide a safe, reusable foundation for later automated security releases without reintroducing a parallel release mechanism.