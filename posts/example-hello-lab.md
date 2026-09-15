---
title: "Hello, lab: publishing this post from a Markdown file"
slug: hello-lab-markdown-publishing
description: "A dry run of the publish pipeline — one Markdown file, four destinations, URLs written back into front matter."
tags: [automation, typescript, writing, devrel]
status: draft
targets: [site, devto, linkedin, medium]
linkedin_teaser: |
  I got tired of copy-pasting the same article into three editors, so I wrote one Markdown file and let a small CLI do the rest: my site first (canonical), then dev.to, then a LinkedIn post, then Medium via its import tool.

  The interesting part wasn't the code — it was discovering that Medium quietly stopped issuing API tokens, and that LinkedIn only gives refresh tokens to approved partners. Both shaped the design more than any library did.

  Write-up and repo in the link. What does your publishing flow look like?

  #devrel #automation
published: {}
---

# Hello, lab: publishing this post from a Markdown file

This is a placeholder article used to smoke-test the pipeline. Replace it with a real one via `/post`.

## Recipe

1. `cp .env.example .env` and fill in the keys.
2. `npm run auth:linkedin`
3. `npm run dev -- publish posts/example-hello-lab.md --dry-run`

> This project is open source under a permissive license. If you use it, I only ask for credit, a shout-out, and that you share your own experiments — that's how the lab grows.
