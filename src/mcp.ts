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

await server.connect(new StdioServerTransport());
