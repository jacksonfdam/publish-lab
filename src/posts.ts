import fs from "node:fs";
import path from "node:path";
import { readPost, writePost, type Post, type PostMeta, type Target } from "./frontmatter.js";

export const POSTS_DIR = process.env.POSTS_DIR ?? "posts";

export interface BrokenPost {
  path: string;
  error: string;
}

export interface PostListing {
  posts: Post[];
  broken: BrokenPost[];
}

/**
 * Reads every Markdown file in `dir`. Posts whose front matter does not parse are
 * returned separately instead of being dropped — a post that cannot be read is the
 * single most useful thing the preview server and the MCP server can tell you about.
 */
export function listPosts(dir: string = POSTS_DIR): PostListing {
  if (!fs.existsSync(dir)) return { posts: [], broken: [] };

  const posts: Post[] = [];
  const broken: BrokenPost[] = [];

  for (const name of fs.readdirSync(dir).sort()) {
    if (!name.endsWith(".md")) continue;
    const file = path.join(dir, name);
    try {
      posts.push(readPost(file));
    } catch (e) {
      broken.push({ path: file, error: (e as Error).message });
    }
  }

  return { posts, broken };
}

export function findPostBySlug(slug: string, dir: string = POSTS_DIR): Post | undefined {
  return listPosts(dir).posts.find((p) => p.meta.slug === slug);
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface NewPost {
  title: string;
  slug: string;
  description?: string;
  tags?: string[];
  targets?: Target[];
  body?: string;
}

/**
 * Writes a new draft. Refuses to touch an existing slug: drafting is the skill's job and
 * an overwrite here would silently destroy an article someone is in the middle of writing.
 */
export function createPost(input: NewPost, dir: string = POSTS_DIR): Post {
  // The slug becomes the filename, so anything outside the kebab alphabet is rejected
  // rather than sanitised — a silently renamed slug breaks the canonical URL later.
  if (!SLUG.test(input.slug)) throw new Error(`Invalid slug "${input.slug}": use lowercase words separated by single hyphens`);

  const path_ = path.join(dir, `${input.slug}.md`);
  if (fs.existsSync(path_)) throw new Error(`${path_} already exists`);

  // An explicit `undefined` reaches the YAML dumper and throws, so optional fields are
  // only set when they have a value.
  const meta: PostMeta = {
    title: input.title,
    slug: input.slug,
    tags: input.tags ?? [],
    status: "draft",
    targets: input.targets ?? ["site", "devto", "linkedin", "medium"],
    published: {},
  };
  if (input.description) meta.description = input.description;

  const post: Post = { path: path_, meta, body: input.body ?? `# ${input.title}\n` };
  fs.mkdirSync(dir, { recursive: true });
  writePost(post);
  return post;
}
