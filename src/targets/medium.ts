import open from "open";
import type { Post, PublishRecord } from "../frontmatter.js";

/**
 * Two paths:
 *  1. MEDIUM_TOKEN set → legacy API (only works for tokens issued before Medium closed the API).
 *  2. Otherwise → open Medium's "Import a story" tool pre-filled with the canonical URL.
 *     Medium fetches the page and sets rel=canonical itself; you click "Import" and publish.
 */
export async function publishToMedium(post: Post, canonicalUrl: string): Promise<PublishRecord> {
  const token = process.env.MEDIUM_TOKEN;
  if (!token) {
    const importUrl = `https://medium.com/p/import?url=${encodeURIComponent(canonicalUrl)}`;
    console.error(`Medium API unavailable — opening import tool:\n  ${importUrl}`);
    await open(importUrl);
    return { url: importUrl, id: "manual-import", date: new Date().toISOString() };
  }

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" };
  const me = await fetch("https://api.medium.com/v1/me", { headers });
  if (!me.ok) throw new Error(`Medium /me ${me.status}: ${await me.text()}`);
  const { data: { id: userId } } = (await me.json()) as { data: { id: string } };

  const res = await fetch(`https://api.medium.com/v1/users/${userId}/posts`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: post.meta.title,
      contentFormat: "markdown",
      content: `# ${post.meta.title}\n\n${post.body}`,
      tags: (post.meta.tags ?? []).slice(0, 3),
      canonicalUrl,
      publishStatus: "draft",
      license: "cc-40-by",
      notifyFollowers: false,
    }),
  });
  if (!res.ok) throw new Error(`Medium ${res.status}: ${await res.text()}`);
  const { data } = (await res.json()) as { data: { id: string; url: string } };
  return { url: data.url, id: data.id, date: new Date().toISOString() };
}
