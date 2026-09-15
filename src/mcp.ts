#!/usr/bin/env node
/**
 * Thin MCP server exposing the same publish pipeline to Claude Code / Claude Desktop.
 * Register in .mcp.json (Claude Code) or claude_desktop_config.json:
 *   { "mcpServers": { "publish-lab": { "command": "npx", "args": ["tsx", "src/mcp.ts"], "cwd": "<repo>" } } }
 */
import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readPost } from "./frontmatter.js";
import { publishPost } from "./publish.js";
import { listPosts, findPostBySlug, createPost, POSTS_DIR } from "./posts.js";

const server = new McpServer({ name: "publish-lab", version: "0.1.0" });

server.tool(
  "post_status",
  "Read a post's front matter and publish records",
  { file: z.string().describe("Path to the Markdown post") },
  async ({ file }) => ({ content: [{ type: "text", text: JSON.stringify(readPost(file).meta, null, 2) }] }),
);

server.tool(
  "publish_post",
  "Publish a Markdown post to site → dev.to → LinkedIn → Medium. Requires status: published in front matter unless force=true.",
  {
    file: z.string(),
    targets: z.array(z.enum(["site", "devto", "linkedin", "medium"])).optional(),
    dryRun: z.boolean().optional(),
    force: z.boolean().optional(),
  },
  async ({ file, targets, dryRun, force }) => {
    const post = await publishPost(file, { targets, dryRun, force });
    return { content: [{ type: "text", text: JSON.stringify(post.meta.published, null, 2) }] };
  },
);

server.tool(
  "list_posts",
  `Every Markdown post in ${POSTS_DIR}, with front matter and publish records. Files whose front matter does not parse are reported under "broken".`,
  {
    status: z.enum(["idea", "draft", "review", "published"]).optional().describe("Only return posts in this state"),
    dir: z.string().optional().describe(`Directory to scan (default ${POSTS_DIR})`),
  },
  async ({ status, dir }) => {
    const { posts, broken } = listPosts(dir);
    const filtered = status ? posts.filter((p) => p.meta.status === status) : posts;
    return json({ posts: filtered.map((p) => ({ path: p.path, ...p.meta })), broken });
  },
);

server.tool(
  "read_post",
  "Read one post by slug: full front matter plus the Markdown body.",
  {
    slug: z.string().describe("The post's slug, as listed by list_posts"),
    dir: z.string().optional(),
  },
  async ({ slug, dir }) => {
    const post = findPostBySlug(slug, dir);
    if (!post) throw new Error(`No post with slug "${slug}"`);
    return json({ path: post.path, meta: post.meta, body: post.body });
  },
);

server.tool(
  "create_post",
  "Create a new draft. Fails if the slug is already taken — it never overwrites an existing post.",
  {
    title: z.string(),
    slug: z.string().describe("Lowercase words separated by single hyphens. Becomes the filename and the canonical URL."),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    targets: z.array(z.enum(["site", "devto", "linkedin", "medium"])).optional(),
    body: z.string().optional().describe("Markdown body. Defaults to a single H1 with the title."),
    dir: z.string().optional(),
  },
  async ({ dir, ...input }) => {
    const post = createPost(input, dir);
    return json({ path: post.path, meta: post.meta });
  },
);

function json(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

await server.connect(new StdioServerTransport());
