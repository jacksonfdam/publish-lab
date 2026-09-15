import fs from "node:fs";
import matter from "gray-matter";

export type Target = "site" | "devto" | "linkedin" | "medium";

export interface PublishRecord {
  url: string;
  id?: string;
  date: string; // ISO
}

export interface PostMeta {
  title: string;
  slug: string;
  description?: string;
  tags?: string[];
  status: "idea" | "draft" | "review" | "published";
  canonical_url?: string;
  cover?: string;
  linkedin_teaser?: string;
  medium_subtitle?: string;
  twitter_teaser?: string;
  threads_teaser?: string;
  bluesky_teaser?: string;
  hashtags?: string[];
  hero_prompt?: string;
  targets?: Target[];
  published?: Partial<Record<Target, PublishRecord>>;
}

export interface Post {
  path: string;
  meta: PostMeta;
  body: string;
}

export function readPost(path: string): Post {
  const raw = fs.readFileSync(path, "utf8");
  const parsed = matter(raw);
  const meta = parsed.data as PostMeta;
  if (!meta.title) throw new Error(`${path}: front matter needs a title`);
  if (!meta.slug) throw new Error(`${path}: front matter needs a slug`);
  meta.status ??= "draft";
  meta.tags ??= [];
  meta.targets ??= ["site", "devto", "linkedin", "medium"];
  meta.published ??= {};
  return { path, meta, body: parsed.content };
}

export function writePost(post: Post): void {
  const out = matter.stringify(post.body, post.meta);
  fs.writeFileSync(post.path, out);
}

export function recordPublish(post: Post, target: Target, rec: PublishRecord): void {
  post.meta.published ??= {};
  post.meta.published[target] = rec;
  writePost(post);
}
