import { readPost, recordPublish, type Post, type Target } from "./frontmatter.js";
import { publishToSite } from "./targets/site.js";
import { publishToDevto } from "./targets/devto.js";
import { publishToLinkedIn } from "./targets/linkedin.js";
import { publishToMedium } from "./targets/medium.js";
import { publicAddress, DEFAULT_PORT } from "./address.js";

const ORDER: Target[] = ["site", "devto", "linkedin", "medium"];

export interface PublishOptions {
  targets?: Target[];
  dryRun?: boolean;
  force?: boolean;
  /** Where Medium should fetch the HTML from. Overrides the derived address for one run. */
  sourceUrl?: string;
}

export async function publishPost(path: string, opts: PublishOptions = {}): Promise<Post> {
  const post = readPost(path);
  if (post.meta.status !== "published" && !opts.force) {
    throw new Error(`${path} has status "${post.meta.status}" — set status: published (or pass --force)`);
  }

  const wanted = new Set(opts.targets ?? post.meta.targets ?? ORDER);
  for (const target of ORDER) {
    if (!wanted.has(target)) continue;
    if (post.meta.published?.[target] && !opts.force) {
      console.error(`✓ ${target}: already published → ${post.meta.published[target]!.url}`);
      continue;
    }
    if (opts.dryRun) {
      console.error(`· ${target}: would publish`);
      continue;
    }

    const canonical = post.meta.canonical_url ?? post.meta.published?.site?.url;

    // dev.to and LinkedIn publish a link to the article, so an address that stops resolving
    // leaves a broken post behind. Medium only needs somewhere to fetch the HTML from.
    if (target === "devto" || target === "linkedin") {
      if (!canonical) throw new Error(`${target} needs a canonical URL — publish to site first or set canonical_url`);
    }

    const mediumSource = opts.sourceUrl ?? canonical ?? `${publicAddress(DEFAULT_PORT).origin}/article/${post.meta.slug}`;

    console.error(`→ ${target}: publishing…`);
    const rec =
      target === "site" ? await publishToSite(post)
      : target === "devto" ? await publishToDevto(post, canonical)
      : target === "linkedin" ? await publishToLinkedIn(post, canonical!)
      : await publishToMedium(post, mediumSource, canonical);

    if (target === "site" && !post.meta.canonical_url) post.meta.canonical_url = rec.url;
    recordPublish(post, target, rec);
    console.error(`✓ ${target}: ${rec.url}`);
  }
  return post;
}
