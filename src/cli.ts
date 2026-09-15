#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import { readPost, type Target } from "./frontmatter.js";
import { publishPost } from "./publish.js";
import { authenticate } from "./linkedin/oauth.js";

const program = new Command()
  .name("publish-post")
  .description("Publish a Markdown post to your site, dev.to, LinkedIn and Medium");

program
  .command("publish <file>")
  .description("Publish a post (order: site → dev.to → LinkedIn → Medium)")
  .option("-t, --targets <list>", "comma-separated subset: site,devto,linkedin,medium")
  .option("--dry-run", "show what would happen")
  .option("--force", "ignore status and re-publish already-published targets")
  .action(async (file: string, o: { targets?: string; dryRun?: boolean; force?: boolean }) => {
    const targets = o.targets?.split(",").map((s) => s.trim()) as Target[] | undefined;
    await publishPost(file, { targets, dryRun: o.dryRun, force: o.force });
  });

program
  .command("status <file>")
  .description("Show front matter and where the post has been published")
  .action((file: string) => {
    const p = readPost(file);
    console.log(`${p.meta.title}  [${p.meta.status}]`);
    for (const [t, r] of Object.entries(p.meta.published ?? {})) console.log(`  ${t.padEnd(9)} ${r.url}`);
  });

program
  .command("auth <provider>")
  .description("Run the OAuth flow (currently: linkedin)")
  .action(async (provider: string) => {
    if (provider !== "linkedin") throw new Error(`Unknown provider ${provider}`);
    await authenticate();
  });

program.parseAsync().catch((e: Error) => {
  console.error(`✗ ${e.message}`);
  process.exit(1);
});
