import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

// npm exec supplies the same pinned distribution used by the producer and validator.
const bin = process.env.PATH.split(delimiter).map(dir => join(dir, 'renovate')).find(existsSync);
assert.ok(bin, 'Run through npm run lint:renovate to use the pinned Renovate distribution');
const root = dirname(dirname(realpathSync(bin)));
const load = path => import(pathToFileURL(join(root, 'dist', path)).href);
const { extractPackageFile } = await load('modules/manager/custom/regex/index.js');
const { compile } = await load('util/template/index.js');
const manager = JSON.parse(readFileSync('renovate.json', 'utf8')).customManagers[0];
const packageFile = 'helm/kairos-mcp/values.yaml';
const extract = text => extractPackageFile(text, packageFile, manager).deps;
const digest = `sha256:${'b'.repeat(64)}`;

function update(text, depIndex, changes) {
  const deps = extract(text);
  const dep = deps[depIndex];
  const replacement = compile(manager.autoReplaceStringTemplate, { ...dep, ...changes }, false);
  const updated = text.replace(dep.replaceString, replacement);
  const after = extract(updated);
  assert.deepEqual(after.map(d => d.depName), deps.map(d => d.depName), 'Replacement must preserve every image key and dependency identity');
  assert.equal(after[depIndex].currentValue, changes.newValue);
  assert.equal(after[depIndex].currentDigest, changes.newDigest);
  assert.deepEqual(after.filter((_, i) => i !== depIndex), deps.filter((_, i) => i !== depIndex));
  return updated;
}

test('pinned Renovate preserves inline YAML keys through digest pins and upgrades', () => {
  const names = ['python', 'docker.io/percona/percona-pgbackrest', 'bitnami/kubectl'];
  const prefixes = ['image: "', 'pgBackRestImage:   "', 'kubectlImage:\t"'];
  let text = names.map((name, i) => `${prefixes[i]}${name}:1.2"`).join('\n');
  for (let i = 0; i < names.length; i++) {
    text = update(text, i, { newValue: '1.2', newDigest: digest });
    text = update(text, i, { newValue: '2.0', newDigest: `sha256:${'c'.repeat(64)}` });
  }
  assert.equal(text, names.map((name, i) => `${prefixes[i]}${name}:2.0@sha256:${'c'.repeat(64)}"`).join('\n'));
});

test('pinned Renovate can pin every inline image in the real Helm values file', () => {
  let text = readFileSync(packageFile, 'utf8');
  const deps = extract(text);
  assert.ok(deps.length > 3);
  for (let i = 0; i < deps.length; i++) {
    text = update(text, i, { newValue: deps[i].currentValue, newDigest: digest });
  }
});
