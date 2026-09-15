import type { Post, PostMeta } from "./frontmatter.js";

export type TeaserField =
  | "linkedin_teaser"
  | "medium_subtitle"
  | "twitter_teaser"
  | "threads_teaser"
  | "bluesky_teaser";

export const TEASER_LIMITS: Record<TeaserField, number> = {
  linkedin_teaser: 3000,
  medium_subtitle: 120,
  twitter_teaser: 280,
  threads_teaser: 500,
  bluesky_teaser: 300,
};

/**
 * Characters held back for the canonical URL pasted in alongside the teaser.
 * X rewrites every link to 23 characters no matter how long it is; Threads and Bluesky
 * count the real thing, so those reserve a realistic URL. LinkedIn attaches the article
 * as a card rather than as text, and a Medium subtitle never carries a link.
 */
const LINK_BUDGET: Record<TeaserField, number> = {
  linkedin_teaser: 0,
  medium_subtitle: 0,
  twitter_teaser: 24,
  threads_teaser: 61,
  bluesky_teaser: 61,
};

export interface TeaserViolation {
  field: TeaserField;
  length: number;
  limit: number;
}

export function checkTeasers(meta: PostMeta): TeaserViolation[] {
  const out: TeaserViolation[] = [];
  for (const field of Object.keys(TEASER_LIMITS) as TeaserField[]) {
    const value = meta[field];
    if (typeof value !== "string") continue;
    const length = [...value.trim()].length;
    if (length > TEASER_LIMITS[field]) out.push({ field, length, limit: TEASER_LIMITS[field] });
  }
  return out;
}

/**
 * A mechanical first draft from what the post already declares. It exists so no field
 * ships empty, not to write well — the /post skill overwrites these with real copy.
 */
export function deriveTeasers(post: Post): Partial<PostMeta> {
  const { title, description, tags } = post.meta;
  const source = (description ?? title).trim();

  const draft: Partial<PostMeta> = {
    hashtags: (tags ?? []).map(toHashtag).filter((t) => t.length > 0),
    hero_prompt: heroPrompt(post.meta),
  };

  for (const field of ["medium_subtitle", "twitter_teaser", "threads_teaser", "bluesky_teaser"] as const) {
    draft[field] = truncate(source, TEASER_LIMITS[field] - LINK_BUDGET[field]);
  }

  return draft;
}

/** Fills only the fields the post is missing, unless `force`. Returns the field names it set. */
export function applyTeasers(post: Post, draft: Partial<PostMeta>, force = false): string[] {
  const written: string[] = [];

  for (const [key, value] of Object.entries(draft) as [keyof PostMeta, unknown][]) {
    if (value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;

    const current = post.meta[key];
    const empty = current === undefined || (typeof current === "string" && current.trim() === "") || (Array.isArray(current) && current.length === 0);
    if (!empty && !force) continue;

    (post.meta as unknown as Record<string, unknown>)[key] = value;
    written.push(key);
  }

  return written;
}

function heroPrompt(meta: PostMeta): string {
  const subject = meta.description?.trim() || meta.title.trim();
  const motifs = (meta.tags ?? []).join(", ");
  return [
    `Editorial hero image for a technical article titled "${meta.title.trim()}".`,
    subject === meta.title.trim() ? "" : subject,
    motifs ? `Visual motifs: ${motifs}.` : "",
    "Wide 16:9, flat vector illustration, restrained two-colour palette on an off-white ground,",
    "generous negative space. No text, no logos, no faces, no UI screenshots.",
  ]
    .filter(Boolean)
    .join(" ");
}

function toHashtag(tag: string): string {
  return tag.replace(/[^a-zA-Z0-9]/g, "");
}

/** Cuts on a word boundary so a teaser never ends mid-word. */
function truncate(text: string, limit: number): string {
  const chars = [...text];
  if (limit <= 1) return "";
  if (chars.length <= limit) return text;

  const hard = chars.slice(0, limit - 1).join("");
  const lastSpace = hard.lastIndexOf(" ");
  const cut = lastSpace > limit * 0.6 ? hard.slice(0, lastSpace) : hard;
  return `${cut.replace(/[\s,;:.—-]+$/, "")}…`;
}
