import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import type { Post, PublishRecord } from "../frontmatter.js";

/**
 * Publishes to your own site by committing the Markdown into the site repo and pushing.
 * Assumes the site (Next.js/MDX on Vercel, etc.) builds from `SITE_CONTENT_DIR`.
 * Swap this for an HTTP call if your site exposes a publish endpoint instead.
 */
export async function publishToSite(post: Post): Promise<PublishRecord> {
  const repo = mustEnv("SITE_REPO_DIR");
  const contentDir = process.env.SITE_CONTENT_DIR ?? "content/posts";
  const baseUrl = mustEnv("SITE_BASE_URL").replace(/\/$/, "");

  const dest = path.join(repo, contentDir, `${post.meta.slug}.md`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(post.path, dest);

  const rel = path.relative(repo, dest);
  execSync(`git add "${rel}"`, { cwd: repo, stdio: "inherit" });
  execSync(`git commit -m "post: ${post.meta.title}" || true`, { cwd: repo, stdio: "inherit", shell: "/bin/bash" });
  execSync("git push", { cwd: repo, stdio: "inherit" });

  return { url: `${baseUrl}/${post.meta.slug}`, date: new Date().toISOString() };
}

function mustEnv(k: string): string {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env ${k} (see .env.example)`);
  return v;
}
