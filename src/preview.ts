import http from "node:http";
import { marked } from "marked";
import { listPosts, findPostBySlug, POSTS_DIR, type PostListing } from "./posts.js";
import { TEASER_LIMITS, checkTeasers, type TeaserField } from "./teasers.js";
import type { Post } from "./frontmatter.js";

const STATUS_ORDER = ["idea", "draft", "review", "published"] as const;

// Rendered in their own table below, with character counts.
const TEASER_FIELDS = new Set([...Object.keys(TEASER_LIMITS), "hashtags", "hero_prompt"]);

export interface PreviewOptions {
  port?: number;
  dir?: string;
}

/**
 * Serves `posts/` as HTML on localhost so a draft can be read before it is published
 * anywhere. Files are read per request: edit the Markdown, refresh, done.
 */
export function startPreviewServer(opts: PreviewOptions = {}): Promise<http.Server> {
  const port = opts.port ?? 4000;
  const dir = opts.dir ?? POSTS_DIR;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");

    try {
      if (url.pathname === "/") return send(res, 200, renderIndex(listPosts(dir), dir));

      const slug = url.pathname.startsWith("/post/") ? decodeURIComponent(url.pathname.slice("/post/".length)) : null;
      if (slug) {
        const post = findPostBySlug(slug, dir);
        if (!post) return send(res, 404, page("Not found", `<p>No post with slug <code>${esc(slug)}</code>.</p>`));
        return send(res, 200, await renderPost(post));
      }

      send(res, 404, page("Not found", "<p>Nothing here.</p>"));
    } catch (e) {
      send(res, 500, page("Error", `<pre>${esc((e as Error).message)}</pre>`));
    }
  });

  return new Promise((resolve) => {
    // Localhost only: these are unpublished drafts, they have no business on the network.
    server.listen(port, "127.0.0.1", () => {
      console.log(`preview  http://localhost:${port}  (${dir})`);
      resolve(server);
    });
  });
}

function renderIndex({ posts, broken }: PostListing, dir: string): string {
  const sorted = [...posts].sort(
    (a, b) => STATUS_ORDER.indexOf(b.meta.status) - STATUS_ORDER.indexOf(a.meta.status) || a.meta.slug.localeCompare(b.meta.slug),
  );

  const rows = sorted
    .map((p) => {
      const published = Object.keys(p.meta.published ?? {});
      const targets = (p.meta.targets ?? [])
        .map((t) => `<span class="chip${published.includes(t) ? " done" : ""}">${esc(t)}</span>`)
        .join("");
      return `<li>
        <a href="/post/${encodeURIComponent(p.meta.slug)}">${esc(p.meta.title)}</a>
        <span class="status ${esc(p.meta.status)}">${esc(p.meta.status)}</span>
        <div class="chips">${targets}</div>
      </li>`;
    })
    .join("");

  const brokenList = broken.length
    ? `<h2>Will not parse</h2><ul class="broken">${broken
        .map((b) => `<li><code>${esc(b.path)}</code><br><span>${esc(b.error)}</span></li>`)
        .join("")}</ul>`
    : "";

  const body = posts.length || broken.length ? `<ul class="posts">${rows}</ul>${brokenList}` : `<p>No Markdown files in <code>${esc(dir)}</code>.</p>`;

  return page("publish-lab", body);
}

async function renderPost(post: Post): Promise<string> {
  const rows = Object.entries(post.meta)
    .filter(([k]) => !TEASER_FIELDS.has(k))
    .filter(([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0) && !(isPlainObject(v) && Object.keys(v).length === 0))
    .map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(format(v))}</td></tr>`)
    .join("");

  const html = await marked.parse(post.body);

  return page(
    post.meta.title,
    `<p class="back"><a href="/">← all posts</a></p>
     <table class="meta">${rows}</table>
     ${renderTeasers(post)}
     <article>${html}</article>`,
  );
}

/**
 * Character counts are the point here: a teaser that is four characters over its limit
 * looks fine in the front matter table and gets rejected by the network.
 */
function renderTeasers(post: Post): string {
  const over = new Set(checkTeasers(post.meta).map((v) => v.field));

  const rows = (Object.keys(TEASER_LIMITS) as TeaserField[])
    .map((field) => {
      const value = post.meta[field]?.trim();
      const count = value ? `${[...value].length}/${TEASER_LIMITS[field]}` : `–/${TEASER_LIMITS[field]}`;
      const cls = over.has(field) ? " over" : value ? "" : " empty";
      return `<tr class="teaser${cls}">
        <th>${esc(field)}<span class="count">${esc(count)}</span></th>
        <td>${value ? esc(value) : "&mdash;"}</td>
      </tr>`;
    })
    .join("");

  const tags = post.meta.hashtags ?? [];
  const tagRow = `<tr class="teaser${tags.length ? "" : " empty"}"><th>hashtags</th><td>${
    tags.length ? tags.map((t) => `<span class="chip">#${esc(t)}</span>`).join(" ") : "&mdash;"
  }</td></tr>`;

  const heroRow = `<tr class="teaser${post.meta.hero_prompt ? "" : " empty"}"><th>hero_prompt</th><td>${
    post.meta.hero_prompt ? esc(post.meta.hero_prompt.trim()) : "&mdash;"
  }</td></tr>`;

  return `<h2 class="section">Teasers</h2><table class="meta teasers">${rows}${tagRow}${heroRow}</table>`;
}

function format(v: unknown): string {
  if (Array.isArray(v)) return v.join(", ");
  if (isPlainObject(v)) return JSON.stringify(v);
  return String(v);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function send(res: http.ServerResponse, code: number, html: string): void {
  res.writeHead(code, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
}

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root { color-scheme: light dark; --fg: #1a1a1a; --dim: #6b7280; --line: #e5e7eb; --bg: #fbfbfa; --card: #fff; --accent: #5319e7; }
  @media (prefers-color-scheme: dark) {
    :root { --fg: #e8e8e6; --dim: #9ca3af; --line: #2c2c2e; --bg: #141416; --card: #1c1c1f; --accent: #a78bfa; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 2.5rem 1.25rem 6rem; background: var(--bg); color: var(--fg);
         font: 16px/1.65 ui-sans-serif, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 44rem; margin: 0 auto; }
  h1 { font-size: 1.35rem; letter-spacing: -0.01em; margin: 0 0 1.75rem; }
  a { color: var(--accent); }
  code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.875em; }
  pre { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 1rem; overflow-x: auto; }
  ul.posts { list-style: none; margin: 0; padding: 0; }
  ul.posts li { border: 1px solid var(--line); background: var(--card); border-radius: 10px;
                padding: 0.9rem 1rem; margin-bottom: 0.6rem; }
  ul.posts a { font-weight: 600; text-decoration: none; }
  ul.posts a:hover { text-decoration: underline; }
  .status { float: right; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em;
            color: var(--dim); border: 1px solid var(--line); border-radius: 999px; padding: 0.1rem 0.5rem; }
  .status.published { color: #0e8a16; border-color: #0e8a16; }
  .chips { margin-top: 0.5rem; display: flex; flex-wrap: wrap; gap: 0.3rem; }
  .chip { font-size: 0.7rem; color: var(--dim); border: 1px solid var(--line); border-radius: 4px; padding: 0.05rem 0.4rem; }
  .chip.done { color: #0e8a16; border-color: #0e8a16; }
  ul.broken li { margin-bottom: 0.6rem; }
  ul.broken span { color: #d73a4a; font-size: 0.85rem; }
  table.meta { width: 100%; border-collapse: collapse; margin-bottom: 2.5rem; font-size: 0.85rem; }
  table.meta th { text-align: left; color: var(--dim); font-weight: 500; width: 9rem; vertical-align: top;
                  padding: 0.35rem 0.75rem 0.35rem 0; }
  table.meta td { padding: 0.35rem 0; border-bottom: 1px solid var(--line); word-break: break-word; }
  article img { max-width: 100%; }
  article blockquote { margin: 1.5rem 0; padding-left: 1rem; border-left: 3px solid var(--line); color: var(--dim); }
  .back { font-size: 0.85rem; margin-bottom: 1.5rem; }
  h2.section { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em;
               color: var(--dim); margin: 0 0 0.75rem; }
  table.teasers { margin-bottom: 2.5rem; }
  table.teasers td { white-space: pre-wrap; }
  table.teasers .count { display: block; font-variant-numeric: tabular-nums; font-size: 0.75rem; opacity: 0.7; }
  tr.teaser.empty td, tr.teaser.empty th { opacity: 0.45; }
  tr.teaser.over th .count { color: #d73a4a; opacity: 1; font-weight: 600; }
  tr.teaser.over td { color: #d73a4a; }
  .back a { text-decoration: none; }
</style>
</head>
<body><main><h1>${esc(title)}</h1>${body}</main></body>
</html>`;
}
