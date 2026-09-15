import { LINKEDIN_CALLBACK_PATH } from "./linkedin/oauth.js";

export const DEFAULT_PORT = 4000;

export interface PublicAddress {
  /** What the browser and LinkedIn see. Differs from the bind address behind a proxy. */
  origin: string;
  /** Path the callback route is served on, taken from the redirect URI when one is set. */
  callbackPath: string;
  redirectUri: string;
  proxied: boolean;
}

/**
 * Where this server is reachable from outside, which is not where it listens. A proxy that
 * terminates TLS for something like `https://publishlab.test` and forwards to a local port
 * means the browser never sees the bind address, so the redirect URI cannot be derived from
 * it. `PUBLIC_URL` declares the outside address; otherwise `LINKEDIN_REDIRECT_URI` implies
 * one, and a plain local run falls back to localhost on the bound port.
 */
export function publicAddress(port: number): PublicAddress {
  const configuredRedirect = process.env.LINKEDIN_REDIRECT_URI?.trim();
  const configuredPublic = process.env.PUBLIC_URL?.trim();
  const local = `http://localhost:${port}`;

  let origin = local;
  let callbackPath = LINKEDIN_CALLBACK_PATH;

  if (configuredPublic) origin = new URL(configuredPublic).origin;

  if (configuredRedirect) {
    const parsed = new URL(configuredRedirect);
    callbackPath = parsed.pathname;
    if (!configuredPublic) origin = parsed.origin;
  }

  return { origin, callbackPath, redirectUri: `${origin}${callbackPath}`, proxied: origin !== local };
}
