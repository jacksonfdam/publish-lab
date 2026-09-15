# publish-lab

Write once in Markdown, publish to your own site, dev.to, LinkedIn and Medium — with Claude Code drafting the article and a small TypeScript CLI doing the fan-out.

```
/post "write about the DRAUGR Wasm experiment"     # Claude Code skill drafts posts/<slug>.md
…you edit, set status: published…
npm run dev -- publish posts/<slug>.md              # site → dev.to → LinkedIn → Medium
```

## Why it's shaped like this

Two platform realities drove the design:

- **Medium closed its API.** No new integration tokens are issued; existing ones still work. So Medium is handled either through a legacy token (if you have one) or through Medium's *Import a story* tool, which the CLI opens pre-filled with your canonical URL. That last click is manual on purpose — browser automation against the editor is fragile and against their ToS.
- **LinkedIn's API is real but partner-gated for refresh tokens.** A personal Developer app can create posts (`w_member_social`), but the token dies after ~60 days and you re-run the browser login. The CLI handles that: `npm run auth:linkedin`.

Everything else follows from "publish to your own site first, so the canonical URL exists before anything else goes out".

## Layout

```
posts/                      one Markdown file per article, front matter is the state
.claude/skills/post/        Claude Code skill: voice, structure, front matter schema, publish steps
src/cli.ts                  publish-post publish|status|teasers|serve|auth
src/publish.ts              orchestrates targets in order, writes URLs back into front matter
src/posts.ts                reads posts/, surfacing files whose front matter won't parse
src/teasers.ts              per-network limits, derived drafts, over-limit checks
src/server.ts               the one local server: posts at / and OAuth callbacks at /auth/
src/preview.ts              renders posts/ as HTML for that server
src/targets/{site,devto,linkedin,medium}.ts
src/linkedin/oauth.ts       LinkedIn authorize URL + code exchange, token cache in .tokens/
src/mcp.ts                  MCP tools: list_posts, read_post, create_post, post_status, publish_post
.github/workflows/publish.yml   optional: publish to dev.to on merge to main
```

## Setup

1. `npm install && cp .env.example .env`
2. **Site**: point `SITE_REPO_DIR` / `SITE_CONTENT_DIR` / `SITE_BASE_URL` at your Next.js/MDX repo. The site target copies the Markdown in, commits and pushes; Vercel builds it.
3. **dev.to**: Settings → Extensions → generate an API key → `DEVTO_API_KEY`.
4. **LinkedIn**: create an app at linkedin.com/developers/apps, add the products *Sign In with LinkedIn using OpenID Connect* and *Share on LinkedIn*, set the redirect URI to `http://localhost:4000/auth/linkedin/callback` — verbatim, in both the LinkedIn app and `.env` — then `npm run auth:linkedin`.
5. **Medium**: check medium.com/me/settings → Security and apps → Integration tokens. If you have one, put it in `MEDIUM_TOKEN`; otherwise leave it empty and use the import flow.
6. Claude Code picks up `.claude/skills/post` and `.mcp.json` automatically when you open the repo.

## Commands

```
npm run dev -- publish posts/x.md                 # all targets in post.targets
npm run dev -- publish posts/x.md --dry-run
npm run dev -- publish posts/x.md --targets linkedin
npm run dev -- publish posts/x.md --force          # re-publish / ignore status
npm run dev -- status posts/x.md
npm run dev -- teasers posts/x.md                 # character counts per network
npm run dev -- teasers posts/x.md --write         # derive the empty ones
npm run serve                                     # posts + authorization at http://localhost:4000
npm run auth:linkedin
npm run mcp                                       # stdio MCP server
```

### Importing into Medium

Without a `MEDIUM_TOKEN` the Medium target opens *Import a story*, which fetches a URL and scrapes it. Point it at `/article/<slug>`, never at `/post/<slug>` — the review page renders the front matter and every social teaser as tables, and the importer would pull all of it into the story.

`/article/<slug>` is the article and nothing else: the body, a description meta, an author meta. It emits `<link rel="canonical">` only when the post has a `canonical_url`, because a temporary tunnel address is not a canonical URL and an importer copies whatever it is told.

Medium needs somewhere to *fetch* from, which is not the same as a canonical claim, so the two are separate. `--source-url` points the importer at a tunnel for one run without writing anything into the front matter:

```
npm run dev -- publish posts/x.md --force --targets medium \
  --source-url https://<tunnel>/article/x
```

With no `--source-url` the fetch address falls back to `canonical_url`, then the site publish record, then `<public origin>/article/<slug>`. dev.to and LinkedIn still require a real canonical — they publish a link, so an address that stops resolving leaves a broken post.

Medium sets the imported story's canonical to whatever URL it fetched from. Importing from a tunnel means the story points at an address that dies with the tunnel; fix it in the story settings once the article has a real home.

### Writing a LinkedIn Article

LinkedIn has no write API for Articles. The long-form `/pulse` format is authored in their editor and nothing else — `w_member_social`, which the `linkedin` target uses, creates feed posts. So an Article is select-all, copy, paste from `/article/<slug>?for=linkedin`.

That view exists because two things are lost on the way in, and one of them is content:

- **Links inside headings are dropped.** A heading ending in `· [name](url)` keeps `· name` and gets the link back as a paragraph beneath it, where the editor preserves it.
- **The leading `# Title` is stripped**, because LinkedIn takes the title in its own field.

Inline code has no equivalent there and pastes as plain text. Tables do not survive; avoid them in a post you plan to put on LinkedIn.

## Social teasers

Each post carries its own copy per network, so nothing gets improvised in someone else's editor at publish time:

| Field | Limit | Room left for the link |
| --- | --- | --- |
| `linkedin_teaser` | 3000 | none — the URL rides on the card |
| `medium_subtitle` | 120 | none — subtitles carry no link |
| `twitter_teaser` | 280 | 24 (X counts every URL as 23) |
| `threads_teaser` | 500 | 61 |
| `bluesky_teaser` | 300 | 61 |

Plus `hashtags` (one set, stored without the `#`) and `hero_prompt` for the cover image.

```
npm run dev -- teasers posts/x.md
Hello, lab: publishing this post from a Markdown file  [draft]
  ✓ linkedin_teaser   539/3000  I got tired of copy-pasting the same article into three edi…
    medium_subtitle      -/120  (empty)
```

The command exits non-zero when a field is over its limit, so it works as a gate. `--write` fills the empty fields with a draft derived from `description` and `tags`, and `--force` replaces fields that already have content.

Derived copy is a floor, not the finished thing — it exists so nothing ships empty. The `/post` skill writes the real version per network, and its output overwrites the derived draft.

Nothing here posts to X, Threads or Bluesky. Threads needs a reviewed Meta app and X charges for write access, so these fields are written to be copied out.

## The local server

One server does both jobs. There is no second web service to keep running:

```
npm run serve                    # http://localhost:4000
npm run dev -- serve --port 5000 --dir drafts
```

| Route | |
| --- | --- |
| `/` | Every post in `posts/` with status, targets and publish state |
| `/post/<slug>` | The rendered article, front matter, and the teasers with character counts |
| `/article/<slug>` | The same post with nothing around it, for Medium's importer to scrape |
| `/article/<slug>?for=linkedin` | The same page adjusted for pasting into LinkedIn's Article editor |
| `/auth/linkedin` | Starts the LinkedIn flow |
| `/auth/linkedin/callback` | Receives the code and writes `.tokens/linkedin.json` |

`npm run auth:linkedin` starts the same server, opens the browser and shuts down once the token lands. If the port is already taken because `npm run serve` is running, it says so and points you at `/auth/linkedin` on the public address — authorize there instead.

### Behind a proxy

The port the server binds and the address the browser sees are two different things. With a proxy mapping `https://publishlab.test` to a local port, the browser never sees the bind address, so the redirect URI cannot be derived from it:

```
PUBLIC_URL=https://publishlab.test npm run dev -- serve --port 8082

listening  127.0.0.1:8082  (posts)
proxied as https://publishlab.test — forward it to port 8082
posts      https://publishlab.test/
authorize  https://publishlab.test/auth/linkedin
callback   https://publishlab.test/auth/linkedin/callback  ← register this in the LinkedIn app
```

The outside address is resolved in this order:

1. `PUBLIC_URL`, when set — the origin your proxy exposes.
2. The origin of `LINKEDIN_REDIRECT_URI`, when that is set. Pointing it at `https://publishlab.test/auth/linkedin/callback` is enough on its own; `PUBLIC_URL` only matters when the two differ.
3. `http://localhost:<port>` otherwise.

The callback route is served on whatever path `LINKEDIN_REDIRECT_URI` names, defaulting to `/auth/linkedin/callback`, so a proxy that rewrites paths still lands on it. Whatever comes out is printed at startup — that exact string is what goes under **Authorized redirect URLs** in the LinkedIn app.

Only the bind is loopback-only. Exposing it further is the proxy's job, and LinkedIn also accepts a plain `http://localhost:4000` callback if you would rather skip the proxy entirely.

The index at `/` lists every post in `posts/` with its status and which targets already have a URL; `/post/<slug>` renders the body, shows the front matter above it, and puts every teaser in its own table with character counts — an over-limit one is marked in red. Files are read per request, so editing the Markdown and refreshing is the whole loop — no watcher, no restart.

Posts whose front matter doesn't parse get their own section with the error, which is usually the fastest way to find a missing `slug` or a broken YAML block.

The server binds to `127.0.0.1` only. These are unpublished drafts.

## MCP tools

`npm run mcp` (or `.mcp.json`, picked up automatically) exposes the pipeline over stdio:

| Tool | Does |
| --- | --- |
| `list_posts` | Everything in `posts/` with front matter and publish records, optionally filtered by `status`. Files whose front matter won't parse come back under `broken` instead of vanishing. |
| `read_post` | One post by slug: front matter plus body. |
| `create_post` | New draft from title/slug/description/tags. Fails on an existing slug — it never overwrites. |
| `post_status` | Front matter and publish records for one file path. |
| `publish_post` | Runs the publish fan-out. |

Slugs are validated against `^[a-z0-9]+(-[a-z0-9]+)*$` rather than sanitised: the slug becomes both the filename and the canonical URL, so a silently rewritten one breaks every link that was already published.

## Front matter

See `.claude/skills/post/references/frontmatter.md`. The important bits: `slug` never changes after first publish, `status: published` is the gate, and `published:` is written by the tool — don't edit it by hand.

## Known limits

- LinkedIn API creates feed posts (text + article card / image), not LinkedIn Articles.
- dev.to accepts max 4 tags, Medium 3; tags are truncated silently.
- Bump `LINKEDIN_VERSION` (YYYYMM) every few months; LinkedIn retires old versions.
- CI skips LinkedIn unless you supply the cached token as a secret.

## License

MIT. If you use it, credit + a shout-out + share your own experiments.
