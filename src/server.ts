import http from "node:http";
import crypto from "node:crypto";
import open from "open";
import { listPosts, findPostBySlug, POSTS_DIR } from "./posts.js";
import { renderIndex, renderPost, renderArticle, page, esc } from "./preview.js";
import { publicAddress, DEFAULT_PORT, type PublicAddress } from "./address.js";
import {
  buildLinkedInAuthUrl,
  completeLinkedInAuth,
  type TokenFile,
} from "./linkedin/oauth.js";

export interface ServeOptions {
  port?: number;
  dir?: string;
}

export interface RunningServer {
  server: http.Server;
  /** The port actually bound. Behind a proxy this is not the port the browser talks to. */
  port: number;
  /** The outside address — what to open in a browser. */
  url: string;
  address: PublicAddress;
  /** Resolves when a provider finishes its flow through the callback route. */
  nextToken(): Promise<TokenFile>;
}

/**
 * One local server for the whole lab: it reads the Markdown in `posts/` and it catches the
 * OAuth callbacks. A second throwaway server for the callback is what made the redirect URI
 * a string that had to agree with a port nobody could see.
 */
export function startServer(opts: ServeOptions = {}): Promise<RunningServer> {
  const port = opts.port ?? DEFAULT_PORT;
  const dir = opts.dir ?? POSTS_DIR;
  const address = publicAddress(port);
  const { redirectUri, callbackPath } = address;
  // Only for resolving the incoming request path; the browser never sees this.
  const base = `http://localhost:${port}`;

  const states = new Set<string>();
  let resolveToken: ((t: TokenFile) => void) | undefined;
  let rejectToken: ((e: Error) => void) | undefined;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", base);

    try {
      if (url.pathname === "/") return send(res, 200, renderIndex(listPosts(dir), dir));

      if (url.pathname.startsWith("/post/")) {
        const slug = decodeURIComponent(url.pathname.slice("/post/".length));
        const post = findPostBySlug(slug, dir);
        if (!post) return send(res, 404, page("Not found", `<p>No post with slug <code>${esc(slug)}</code>.</p>`));
        return send(res, 200, await renderPost(post));
      }

      if (url.pathname.startsWith("/article/")) {
        const slug = decodeURIComponent(url.pathname.slice("/article/".length));
        const post = findPostBySlug(slug, dir);
        if (!post) return send(res, 404, page("Not found", `<p>No post with slug <code>${esc(slug)}</code>.</p>`));
        const flavour = url.searchParams.get("for") === "linkedin" ? "linkedin" : undefined;
        return send(res, 200, await renderArticle(post, flavour));
      }

      if (url.pathname === "/auth/linkedin") {
        const state = crypto.randomBytes(16).toString("hex");
        states.add(state);
        res.writeHead(302, { location: buildLinkedInAuthUrl(redirectUri, state) });
        return void res.end();
      }

      if (url.pathname === callbackPath) return void (await handleCallback(url, res));

      send(res, 404, page("Not found", "<p>Nothing here.</p>"));
    } catch (e) {
      send(res, 500, page("Error", `<pre>${esc((e as Error).message)}</pre>`));
    }
  });

  async function handleCallback(url: URL, res: http.ServerResponse): Promise<void> {
    const fail = (message: string): void => {
      send(res, 400, page("Authorization failed", `<p>${esc(message)}</p>`));
      rejectToken?.(new Error(message));
    };

    const error = url.searchParams.get("error");
    if (error) return fail(`LinkedIn returned ${error}: ${url.searchParams.get("error_description") ?? "no description"}`);

    const state = url.searchParams.get("state");
    if (!state || !states.delete(state)) return fail("OAuth state mismatch — start again at /auth/linkedin");

    const code = url.searchParams.get("code");
    if (!code) return fail("LinkedIn sent no authorization code");

    try {
      const token = await completeLinkedInAuth(code, redirectUri);
      send(res, 200, page("Authorized", "<p>LinkedIn token saved. You can close this tab.</p>"));
      resolveToken?.(token);
    } catch (e) {
      fail((e as Error).message);
    }
  }

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    // Loopback only: unpublished drafts and an OAuth callback have no business on the network.
    server.listen(port, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve({
        server,
        port,
        url: address.origin,
        address,
        nextToken: () =>
          new Promise<TokenFile>((res2, rej2) => {
            resolveToken = res2;
            rejectToken = rej2;
          }),
      });
    });
  });
}

/** Runs the browser flow on a short-lived server and returns the token. */
export async function authorize(opts: ServeOptions = {}): Promise<TokenFile> {
  const port = opts.port ?? DEFAULT_PORT;

  let running: RunningServer;
  try {
    running = await startServer(opts);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "EADDRINUSE") {
      const { origin } = publicAddress(port);
      throw new Error(
        `Port ${port} is already in use — if that is \`publish-post serve\`, authorize in the browser instead: ${origin}/auth/linkedin`,
      );
    }
    throw e;
  }

  const token = running.nextToken();
  console.error(`Opening browser for LinkedIn login… (${running.url}/auth/linkedin)`);
  await open(`${running.url}/auth/linkedin`);

  try {
    return await token;
  } finally {
    running.server.close();
  }
}

function send(res: http.ServerResponse, code: number, html: string): void {
  res.writeHead(code, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
}

export { publicAddress, DEFAULT_PORT, type PublicAddress };
