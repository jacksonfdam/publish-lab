import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const TOKEN_FILE = path.resolve(".tokens/linkedin.json");

/** Route the local server exposes. The redirect URI is this path on whatever port it bound. */
export const LINKEDIN_CALLBACK_PATH = "/auth/linkedin/callback";
const SCOPES = ["openid", "profile", "w_member_social"];

export interface TokenFile {
  access_token: string;
  expires_at: number; // epoch ms
  person_urn: string;
}

/**
 * Member tokens last ~60 days. LinkedIn only issues refresh tokens to approved partners,
 * so a personal app simply re-runs the browser flow when the token expires.
 */
export async function getLinkedInToken(): Promise<TokenFile> {
  if (fs.existsSync(TOKEN_FILE)) {
    const t = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8")) as TokenFile;
    if (t.expires_at - Date.now() > 24 * 3600 * 1000) return t;
    console.error("LinkedIn token expired or expiring — re-authenticating.");
  }
  // Imported lazily: the server imports this module, so a static import would be a cycle.
  const { authorize } = await import("../server.js");
  return authorize();
}

export function buildLinkedInAuthUrl(redirectUri: string, state: string): string {
  const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: mustEnv("LINKEDIN_CLIENT_ID"),
    redirect_uri: redirectUri,
    state,
    scope: SCOPES.join(" "),
  }).toString();
  return url.toString();
}

/** Trades the authorization code for a token and writes it to `.tokens/linkedin.json`. */
export async function completeLinkedInAuth(code: string, redirectUri: string): Promise<TokenFile> {
  const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: mustEnv("LINKEDIN_CLIENT_ID"),
      client_secret: mustEnv("LINKEDIN_CLIENT_SECRET"),
    }),
  });
  if (!tokenRes.ok) throw new Error(`LinkedIn token exchange ${tokenRes.status}: ${await tokenRes.text()}`);
  const tok = (await tokenRes.json()) as { access_token: string; expires_in: number };

  const me = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${tok.access_token}` },
  });
  if (!me.ok) throw new Error(`LinkedIn userinfo ${me.status}: ${await me.text()}`);
  const { sub } = (await me.json()) as { sub: string };

  const file: TokenFile = {
    access_token: tok.access_token,
    expires_at: Date.now() + tok.expires_in * 1000,
    person_urn: `urn:li:person:${sub}`,
  };
  fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true });
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(file, null, 2), { mode: 0o600 });
  console.error(`LinkedIn token saved to ${TOKEN_FILE} (valid ~${Math.round(tok.expires_in / 86400)} days).`);
  return file;
}

function mustEnv(k: string): string {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env ${k} (see .env.example)`);
  return v;
}
