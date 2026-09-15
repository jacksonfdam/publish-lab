# Front matter schema (posts/*.md)

```yaml
---
title: "Running Linux machine images on-device with Compose Multiplatform and Wasm"
slug: draugr-wasm-linux-on-device          # kebab-case, ≤ 60 chars, never changes after first publish
description: "How DRAUGR boots a Linux image inside a KMP app via WebAssembly, and what broke along the way."  # ≤ 160 chars
tags: [kotlin, multiplatform, webassembly, android]   # 3–4, lowercase, alphanumeric only
status: draft                              # idea | draft | review | published
cover: https://…/cover.png                 # optional, absolute URL
canonical_url:                             # filled by the CLI after publishing to site; set manually if it already lives elsewhere
targets: [site, devto, linkedin, medium]   # optional; default is all four
linkedin_teaser: |
  600–1100 chars, plain text, ≤ 3 hashtags at the end. No URL — the CLI adds it.
medium_subtitle: "Shown under the title on Medium. ≤ 120 chars."
twitter_teaser: "≤ 280 chars. Leave ~24 for the link: X counts every URL as 23."
threads_teaser: "≤ 500 chars. Leave ~61 for the link — Threads counts the real URL."
bluesky_teaser: "≤ 300 chars. Leave ~61 for the link — Bluesky counts the real URL."
hashtags: [kotlin, webassembly, android]   # no '#', one set shared across networks
hero_prompt: "Prompt for the cover image. No length limit."
published: {}                              # written by the CLI: { site: {url,date}, devto: {url,id,date}, … }
---
```

## Teaser limits

| Field | Limit | Room for the link |
| --- | --- | --- |
| `linkedin_teaser` | 3000 | none — the URL goes on the card |
| `medium_subtitle` | 120 | none — subtitles carry no link |
| `twitter_teaser` | 280 | 24 |
| `threads_teaser` | 500 | 61 |
| `bluesky_teaser` | 300 | 61 |

`npm run dev -- teasers posts/<slug>.md` prints every field with its character count and exits non-zero if anything is over. `--write` fills the empty ones with a mechanical draft derived from `description` — a floor, not the finished copy.

The article body starts after the front matter with the `# Title` heading repeated (Medium and dev.to need it in the body).
