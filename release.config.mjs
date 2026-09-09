/**
 * semantic-release configuration — the single SemVer authority for KAIROS.
 *
 * Design (see .github/AI_CI_RELEASE_REDESIGN.md):
 * - `main` is the only permanent integration/release branch; no permanent
 *   `dev`/`next` branch. Prereleases are dispatched from validated refs via a
 *   generated config that extends this one (see .github/workflows/release.yml).
 * - The version is computed exactly once here; npm publish, container tags,
 *   Helm chart, git tag, and the GitHub Release all consume that version.
 * - `@semantic-release/npm` is intentionally NOT used: npm publication stays a
 *   manual OIDC trusted-publishing step in the release workflow, publishing the
 *   tgz built and consumer-tested by `prepare:publish` below.
 *
 * Phase responsibilities:
 * - prepare: bump workspace package.json, re-sync skills/compose/helm, then
 *   build + pack + consumer-test the .tgz (`npm run prepare:publish`).
 * - publish: emit version/channel/type to $GITHUB_OUTPUT for downstream jobs.
 *   The git tag and the GitHub Release (with notes) are created by
 *   `@semantic-release/github` and semantic-release core.
 */

/** @type {import('semantic-release').GlobalConfig} */
const config = {
  branches: ['main'],
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    '@semantic-release/github',
    [
      '@semantic-release/exec',
      {
        // Lodash-template placeholders (${nextRelease.*}) are substituted by
        // the exec plugin, not by this module.
        prepareCmd:
          'npm version ${nextRelease.version} --no-git-tag-version --allow-same-version && npm run version:sync && npm run prepare:publish',
        publishCmd: [
          'echo "version=${nextRelease.version}" >> "$GITHUB_OUTPUT"',
          'echo "channel=${nextRelease.channel}" >> "$GITHUB_OUTPUT"',
          'echo "type=${nextRelease.type}" >> "$GITHUB_OUTPUT"',
        ].join(' && '),
      },
    ],
  ],
};

export default config;
