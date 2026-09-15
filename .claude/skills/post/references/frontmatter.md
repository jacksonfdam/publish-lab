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
published: {}                              # written by the CLI: { site: {url,date}, devto: {url,id,date}, … }
---
```

The article body starts after the front matter with the `# Title` heading repeated (Medium and dev.to need it in the body).
