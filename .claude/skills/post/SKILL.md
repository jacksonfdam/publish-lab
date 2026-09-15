---
name: post
description: Draft and publish technical articles for Jackson's blog, dev.to, LinkedIn and Medium from a topic, a project README, or rough notes. Use this whenever the user wants to write a post, article, write-up, blog entry, LinkedIn post, tutorial, lab recipe, or "share what I built" — even if they only say "turn this into a post" or "write about X". Also use it to revise an existing post in posts/ or to publish one.
---

# /post — draft → review → publish

Every article is a Markdown file in `posts/<slug>.md` with front matter. This skill owns the whole lifecycle:

1. **Draft** — write the article + LinkedIn teaser into `posts/<slug>.md` with `status: draft`.
2. **Review** — the user edits; when happy they (or you, on request) set `status: published`.
3. **Publish** — run `npm run dev -- publish posts/<slug>.md` (or the `publish_post` MCP tool). Order is site → dev.to → LinkedIn → Medium; publish URLs are written back into front matter.

## Inputs you may receive

- A topic or one-line idea → research the repo/project it refers to first (`README`, key source files) before writing.
- A project README or a folder path → the article is a lab write-up of that project.
- Rough notes / a Slack dump → structure them; keep every technical fact, drop the chatter.
- An existing `posts/*.md` → revise in place, keep the slug and any `published` records.

Ask at most one clarifying question and only if the target audience or the project is genuinely unclear. Otherwise pick a sensible angle and state it in one line at the top of your reply.

## Drafting

Read `references/voice.md` before writing the first draft in a session. Then:

- Front matter: follow `references/frontmatter.md` exactly. Generate `slug` from the title (kebab-case, ≤ 60 chars). Use 3–4 `tags`, lowercase, no spaces (dev.to rejects others; Medium keeps the first 3).
- Structure: hook (why this matters, 2–4 sentences) → what we're building / the problem → the recipe (numbered, copy-pasteable, one command or snippet per step) → what actually happened (gotchas, measurements, screenshots as `![alt](url)`) → what to try next → credits/shout-outs → repo link and the standard footer from `voice.md`.
- Length: 900–1600 words for a lab write-up; 400–700 for a "one trick" post. Never pad.
- Code blocks always have a language tag. Commands show expected output when it matters.
- `linkedin_teaser`: 600–1100 characters, plain text, no Markdown, no hashtag walls (≤ 3 hashtags at the end). Open with the concrete result or the surprising part, not "Excited to share". End with a question or a pointer to the repo. The CLI attaches the canonical URL automatically — do not paste the URL into the teaser.
- `description`: ≤ 160 characters, used as meta description and the LinkedIn card subtitle.
- Social teasers: write each one for its own network rather than pasting the same sentence five times. Limits and link budgets are in `references/frontmatter.md`.
  - `medium_subtitle` — the second half of the headline. It completes the title, it does not repeat it.
  - `twitter_teaser` — one claim, the sharpest one in the article. No thread, no "a 🧵", no build-up.
  - `threads_teaser` — conversational, two or three short lines, ends on something someone can reply to.
  - `bluesky_teaser` — drier and more technical than Threads; that audience reads the code.
  - `hashtags` — 3–5, stored without the `#`, reused across networks. Not the same list as `tags` unless it happens to be right.
  - `hero_prompt` — a prompt for the cover image: subject, composition, palette, and what to leave out. No text or logos in the image.
- Run `npm run dev -- teasers posts/<slug>.md` after writing. It prints character counts and exits non-zero on anything over its limit. If you are short on time, `--write` derives drafts from `description`, but derived copy is a placeholder — replace it.

Write the file, then reply with: the angle in one line, the file path, and 2–3 things the user should double-check (claims you couldn't verify, numbers to fill in, image placeholders).

## Publishing

Only when the user asks to publish, or says the draft is final:

1. Confirm `status: published` in front matter (set it if they said "publish").
2. Run `npm run dev -- publish posts/<slug>.md --dry-run` and show the plan.
3. Run it for real. If LinkedIn auth fails with 401, run `npm run auth:linkedin` and retry — tokens expire every ~60 days. That opens the browser against the local server on port 4000; if `npm run serve` is already holding the port, authorize at `http://localhost:4000/auth/linkedin` instead.
4. Medium: unless `MEDIUM_TOKEN` is set, the CLI opens Medium's import tool in the browser; tell the user to click **Import** and then **Publish** there — that step is manual by design.
5. Report the URLs written into `published:`.

A LinkedIn **Article** is not one of the targets — the API only creates feed posts. When the user asks for an Article, point them at `/article/<slug>?for=linkedin` on the running server and tell them it is a copy-paste into LinkedIn's editor, with the title going in LinkedIn's own field.

Never publish a post whose `status` is not `published` unless the user explicitly says `--force`.
