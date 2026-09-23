import { GitHub, report } from './ci-automation.mjs';

const api = new GitHub();
const checks = [
  ['renovate.yml', 3 * 60], ['npm-audit-fix.yml', 3 * 60],
  ['automerge-dependabot.yml', 40], ['release.yml', 3 * 60],
];
const issues = await api.pages('/issues?state=open&creator=github-actions%5Bbot%5D');
const drafts = (await api.pages('/releases')).filter(r => r.draft && /^v\d+\./.test(r.tag_name));
const failures = [];
for (const [file, maxMinutes] of checks) {
  const { workflow_runs: runs } = await api.request(`/actions/workflows/${file}/runs?branch=main&per_page=100`);
  const completed = runs.filter(r => r.status === 'completed' && ['schedule', 'workflow_run'].includes(r.event))
    .sort((a, b) => b.id - a.id)[0];
  const stale = !completed || Date.now() - Date.parse(completed.updated_at) > maxMinutes * 60000;
  const incomplete = file === 'release.yml' && drafts.some(r => Date.now() - Date.parse(r.created_at) > 3 * 60 * 60 * 1000);
  const failed = stale || incomplete || completed.conclusion !== 'success';
  const key = `<!-- automation-incident:${file} -->`;
  const existing = issues.find(issue => !issue.pull_request && issue.body?.includes(key));
  const reason = incomplete ? 'Incomplete release requires recovery' : stale ? 'Scheduled automation is stale or missing' : `Latest run: ${completed?.conclusion}`;
  if (failed) {
    failures.push({ workflow: file, reason, run: completed?.html_url });
    const body = `${key}\n${reason}.\n\nLatest completed scheduled/event run: ${completed?.html_url ?? 'none'}.\n\nAutomation remains fail-closed. Inspect the workflow summary; restore credentials or infrastructure, then allow the next scheduled reconciliation to retry. Do not bypass validation.`;
    if (!existing) await api.request('/issues', { method: 'POST', body: { title: `Automation incident: ${file}`, body } });
    else if (existing.body !== body) await api.request(`/issues/${existing.number}`, { method: 'PATCH', body: { body } });
  } else if (existing) {
    await api.request(`/issues/${existing.number}`, { method: 'PATCH', body: { state: 'closed', state_reason: 'completed' } });
  }
}
report({ healthy: failures.length === 0, failures });
if (failures.length) process.exitCode = 1;
