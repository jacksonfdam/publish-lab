import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import open from "open";

const TOKEN_FILE = path.resolve(".tokens/linkedin.json");
const SCOPES = ["openid", "profile", "w_member_social"];

interface TokenFile {
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
  return authenticate();
}

export async function authenticate(): Promise<TokenFile> {
  const clientId = mustEnv("LINKEDIN_CLIENT_ID");
  const clientSecret = mustEnv("LINKEDIN_CLIENT_SECRET");
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI ?? "http://localhost:8000/auth/linkedin/callback";
  const port = Number(new URL(redirectUri).port || 8000);
  const state = crypto.randomBytes(16).toString("hex");

  const authUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
  authUrl.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: SCOPES.join(" "),
  }).toString();

  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://localhost:${port}`);
      if (url.pathname !== new URL(redirectUri).pathname) return void res.end();
      if (url.searchParams.get("state") !== state) {
        res.end("State mismatch");
        return reject(new Error("OAuth state mismatch"));
      }
      const err = url.searchParams.get("error");
      if (err) {
        res.end(`LinkedIn error: ${err}`);
        return reject(new Error(err));
      }
      res.end("Authentication successful — you can close this tab.");
      server.close();
      resolve(url.searchParams.get("code")!);
    });
    server.listen(port, () => {
      console.error(`Opening browser for LinkedIn login…`);
      open(authUrl.toString());
    });
  });

  const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
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
