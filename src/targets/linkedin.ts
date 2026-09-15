import type { Post, PublishRecord } from "../frontmatter.js";
import { getLinkedInToken } from "../linkedin/oauth.js";

/**
 * LinkedIn Posts API (versioned): POST https://api.linkedin.com/rest/posts
 * Docs: https://learn.microsoft.com/linkedin/marketing/community-management/shares/posts-api
 * Creates a feed post with the teaser as commentary and the canonical URL as an article card.
 */
export async function publishToLinkedIn(post: Post, canonicalUrl: string): Promise<PublishRecord> {
  const token = await getLinkedInToken();
  const version = process.env.LINKEDIN_VERSION ?? "202509";

  const commentary = post.meta.linkedin_teaser ?? `${post.meta.title}\n\n${post.meta.description ?? ""}`.trim();

  const body = {
    author: token.person_urn,
    commentary,
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    content: {
      article: {
        source: canonicalUrl,
        title: post.meta.title,
        description: post.meta.description?.slice(0, 250),
      },
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByViewer: false,
  };

  const res = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "LinkedIn-Version": version,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`LinkedIn ${res.status}: ${await res.text()}`);

  const urn = res.headers.get("x-restli-id") ?? "";
  // urn:li:share:123 → https://www.linkedin.com/feed/update/urn:li:share:123
  return { url: urn ? `https://www.linkedin.com/feed/update/${urn}` : "", id: urn, date: new Date().toISOString() };
}
