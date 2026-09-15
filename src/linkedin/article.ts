/**
 * LinkedIn's Article editor is not a browser. Two things it silently drops on paste cost
 * real content, so the Markdown is adjusted before it is rendered for copying.
 */

/** `### 1 — The bridge · [name](url)` → heading without the link, plus the link beneath it. */
const LINKED_HEADING = /^(#{1,6})\s+(.*?)\s*\[([^\]]+)\]\(([^)\s]+)\)\s*$/gm;

/** A leading `# Title`, which LinkedIn takes in its own field rather than in the body. */
const LEADING_H1 = /^\s*#\s+.*(?:\r?\n)+/;

export function forLinkedInArticle(markdown: string): string {
  return markdown
    .replace(LEADING_H1, "")
    .replace(LINKED_HEADING, (_m, hashes: string, before: string, text: string, url: string) => {
      const heading = `${hashes} ${before} ${text}`.replace(/\s+/g, " ").trim();
      // The link survives as a paragraph; inside a heading it would paste as plain text.
      return `${heading}\n\n[${text}](${url})`;
    });
}
