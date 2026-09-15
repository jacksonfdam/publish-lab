import fs from "node:fs";
import path from "node:path";
import { readPost, type Post } from "./frontmatter.js";

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
