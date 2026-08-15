/**
 * Browser OIDC login redirect + PKCE state shared by auth middleware and /auth/logout.
 *
 * OIDC state is stored via the shared oidcStateStore (Redis when configured,
 * in-memory fallback otherwise) so that login works across instances.
 * See src/services/oidc-state-store.ts for details.
 */
import type { Response } from 'express';
import crypto from 'crypto';
import { KEYCLOAK_URL, KEYCLOAK_REALM, KEYCLOAK_CLIENT_ID, AUTH_CALLBACK_BASE_URL } from '../config.js';
import { oidcStateStore } from '../services/oidc-state-store.js';
import { structuredLogger } from '../utils/structured-logger.js';


export function buildOidcAuthorizationUrl(state: string, codeChallenge: string): string {
  if (!AUTH_CALLBACK_BASE_URL) {
    throw new Error('AUTH_CALLBACK_BASE_URL is required for OIDC login URL');
  }
  const base = KEYCLOAK_URL.replace(/\/$/, '');
  const redirectUri = `${AUTH_CALLBACK_BASE_URL.replace(/\/$/, '')}/auth/callback`;
  const params = new URLSearchParams({
    client_id: KEYCLOAK_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid profile email',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    prompt: 'login'
  });
  return `${base}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/auth?${params.toString()}`;
}

/**
 * RP-initiated OIDC logout URL. After the IdP clears the SSO session it redirects to
 * postLogoutRedirectUri (must be registered as a valid post-logout redirect for the client).
 */
export function buildOidcEndSessionRedirectUrl(postLogoutRedirectUri: string, idTokenHint: string | null): string | null {
  if (!KEYCLOAK_URL || !KEYCLOAK_REALM || !KEYCLOAK_CLIENT_ID) {
    return null;
  }
  const base = KEYCLOAK_URL.replace(/\/$/, '');
  const u = new URL(`${base}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/logout`);
  u.searchParams.set('client_id', KEYCLOAK_CLIENT_ID);
  u.searchParams.set('post_logout_redirect_uri', postLogoutRedirectUri);
  if (idTokenHint) {
    u.searchParams.set('id_token_hint', idTokenHint);
  }
  return u.toString();
}

/** Allocate PKCE state and redirect the browser to the IdP authorization endpoint. */
export function redirectBrowserToOidcLogin(res: Response): boolean {
  if (!AUTH_CALLBACK_BASE_URL) {
    return false;
  }
  const state = crypto.randomBytes(16).toString('base64url');
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url').replace(/=/g, '');
  // Fire-and-forget: the Redis write completes well before the browser-driven
  // redirect chain reaches the IdP and returns to /auth/callback.
  oidcStateStore.set(state, { codeVerifier, createdAt: Date.now() }).catch(err => {
    structuredLogger.error(`[oidc-state] Failed to store OIDC state: ${err instanceof Error ? err.message : String(err)}`);
  });
  res.redirect(302, buildOidcAuthorizationUrl(state, codeChallenge));
  return true;
}

/** Register PKCE state and return the authorization URL (for JSON login_url). */
export function createOidcLoginUrlForApiResponse(): string {
  const state = crypto.randomBytes(16).toString('base64url');
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url').replace(/=/g, '');
  oidcStateStore.set(state, { codeVerifier, createdAt: Date.now() }).catch(err => {
    structuredLogger.error(`[oidc-state] Failed to store OIDC state: ${err instanceof Error ? err.message : String(err)}`);
  });
  return buildOidcAuthorizationUrl(state, codeChallenge);
}

/**
 * Same as {@link createOidcLoginUrlForApiResponse} but returns undefined when OIDC login URLs are not
 * configured or URL construction fails (never throws).
 */
export function safeCreateOidcLoginUrlForApiResponse(): string | undefined {
  if (!AUTH_CALLBACK_BASE_URL) return undefined;
  try {
    return createOidcLoginUrlForApiResponse();
  } catch {
    return undefined;
  }
}
