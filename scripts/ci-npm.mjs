// npm dist-tag does not perform the CLI publish command's OIDC exchange. Use the
// same package-scoped, short-lived exchange without storing a token on disk.
export async function promoteNpmTag(packageName, version, channel, request = fetch, env = process.env) {
  if (!env.ACTIONS_ID_TOKEN_REQUEST_URL || !env.ACTIONS_ID_TOKEN_REQUEST_TOKEN) throw new Error('npm promotion requires GitHub OIDC');
  const url = new URL(env.ACTIONS_ID_TOKEN_REQUEST_URL);
  if (url.protocol !== 'https:') throw new Error('Invalid OIDC issuer URL');
  url.searchParams.set('audience', 'npm:registry.npmjs.org');
  const identity = await request(url, { headers: { Authorization: `Bearer ${env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}` }, signal: AbortSignal.timeout(60000) });
  if (!identity.ok) throw new Error(`OIDC identity request: HTTP ${identity.status}`);
  const { value } = await identity.json();
  if (!value) throw new Error('OIDC identity token is missing');
  const exchange = await request(`https://registry.npmjs.org/-/npm/v1/oidc/token/exchange/package/${encodeURIComponent(packageName)}`, {
    method: 'POST', headers: { Authorization: `Bearer ${value}` }, signal: AbortSignal.timeout(60000),
  });
  if (!exchange.ok) throw new Error(`npm OIDC exchange: HTTP ${exchange.status}`);
  const { token } = await exchange.json();
  if (!token) throw new Error('npm OIDC exchange token is missing');
  const result = await request(`https://registry.npmjs.org/-/package/${encodeURIComponent(packageName)}/dist-tags/${encodeURIComponent(channel)}`, {
    method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(version), signal: AbortSignal.timeout(60000),
  });
  if (!result.ok) throw new Error(`npm channel promotion: HTTP ${result.status}`);
}
