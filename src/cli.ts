#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import { readPost, writePost, type Target } from "./frontmatter.js";
import { publishPost } from "./publish.js";
import { startServer, authorize, DEFAULT_PORT } from "./server.js";
import { TEASER_LIMITS, checkTeasers, deriveTeasers, applyTeasers, type TeaserField } from "./teasers.js";

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
  .command("teasers <file>")
  .description("Show the per-network teasers with character counts, or derive the missing ones")
  .option("--write", "fill in every empty teaser field with a mechanical draft")
  .option("--force", "with --write, overwrite fields that already have content")
  .action((file: string, o: { write?: boolean; force?: boolean }) => {
    const post = readPost(file);

    if (o.write) {
      const written = applyTeasers(post, deriveTeasers(post), o.force);
      if (written.length) {
        writePost(post);
        console.log(`wrote ${written.join(", ")}`);
      } else {
        console.log("nothing to write — every field already has content (use --force to replace it)");
      }
    }

    console.log(`${post.meta.title}  [${post.meta.status}]`);

    const over = new Map(checkTeasers(post.meta).map((v) => [v.field, v]));
    for (const field of Object.keys(TEASER_LIMITS) as TeaserField[]) {
      const value = post.meta[field]?.trim();
      const count = value ? `${[...value].length}/${TEASER_LIMITS[field]}` : `-/${TEASER_LIMITS[field]}`;
      const mark = over.has(field) ? "✗" : value ? "✓" : " ";
      console.log(`  ${mark} ${field.padEnd(16)} ${count.padStart(9)}  ${preview(value)}`);
    }

    const tags = post.meta.hashtags ?? [];
    console.log(`  ${tags.length ? "✓" : " "} ${"hashtags".padEnd(16)} ${String(tags.length).padStart(9)}  ${tags.map((t) => `#${t}`).join(" ")}`);
    console.log(`  ${post.meta.hero_prompt ? "✓" : " "} ${"hero_prompt".padEnd(16)} ${"".padStart(9)}  ${preview(post.meta.hero_prompt?.trim())}`);

    if (over.size) {
      for (const v of over.values()) console.error(`✗ ${v.field} is ${v.length - v.limit} characters over the ${v.limit} limit`);
      process.exitCode = 1;
    }
  });

program
  .command("serve")
  .alias("preview")
  .description("One local server: read drafts at / and authorize providers at /auth/<provider>")
  .option("-p, --port <port>", "port to listen on", String(DEFAULT_PORT))
  .option("-d, --dir <dir>", "directory holding the Markdown posts", "posts")
  .action(async (o: { port: string; dir: string }) => {
    const running = await startServer({ port: parsePort(o.port), dir: o.dir });
    console.log(`serving  ${running.url}  (${o.dir})`);
    console.log(`authorize  ${running.url}/auth/linkedin`);
  });

program
  .command("auth <provider>")
  .description("Run the OAuth flow (currently: linkedin)")
  .option("-p, --port <port>", "port the callback server listens on", String(DEFAULT_PORT))
  .action(async (provider: string, o: { port: string }) => {
    if (provider !== "linkedin") throw new Error(`Unknown provider ${provider}`);
    await authorize({ port: parsePort(o.port) });
  });

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Invalid port ${value}`);
  return port;
}

function preview(value?: string): string {
  if (!value) return "(empty)";
  const oneLine = value.replace(/\s+/g, " ");
  return oneLine.length > 60 ? `${oneLine.slice(0, 59)}…` : oneLine;
}

program.parseAsync().catch((e: Error) => {
  console.error(`✗ ${e.message}`);
  process.exit(1);
});
