import type { Post, PublishRecord } from "../frontmatter.js";

/** dev.to Articles API — https://developers.forem.com/api/v1#tag/articles */
export async function publishToDevto(post: Post, canonicalUrl?: string): Promise<PublishRecord> {
  const key = process.env.DEVTO_API_KEY;
  if (!key) throw new Error("Missing DEVTO_API_KEY");

  const res = await fetch("https://dev.to/api/articles", {
    method: "POST",
    headers: { "api-key": key, "Content-Type": "application/json", Accept: "application/vnd.forem.api-v1+json" },
    body: JSON.stringify({
      article: {
        title: post.meta.title,
        body_markdown: post.body,
        published: true,
        description: post.meta.description,
        tags: (post.meta.tags ?? []).slice(0, 4).map((t) => t.toLowerCase().replace(/[^a-z0-9]/g, "")),
        canonical_url: canonicalUrl,
        main_image: post.meta.cover,
      },
    }),
  });
  if (!res.ok) throw new Error(`dev.to ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { id: number; url: string };
  return { url: data.url, id: String(data.id), date: new Date().toISOString() };
}
