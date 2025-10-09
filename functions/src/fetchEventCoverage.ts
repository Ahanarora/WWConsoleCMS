import { onCall, HttpsError } from "firebase-functions/v2/https";
import Parser from "rss-parser";

const parser = new Parser({
  customFields: {
    item: ["media:content", "enclosure"],
  },
});

// ----------------------
// Helper 1: Simple similarity score
// ----------------------
function textSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\W+/));
  const wordsB = new Set(b.toLowerCase().split(/\W+/));
  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
  const denominator = Math.sqrt(wordsA.size * wordsB.size);
  return denominator ? intersection / denominator : 0;
}

// ----------------------
// Helper 2: Extract image
// ----------------------
function extractImage(item: any): string | null {
  return (
    item["media:content"]?.url ||
    item.enclosure?.url ||
    null
  );
}

// ----------------------
// Main Function (v2 syntax)
// ----------------------
export const fetchEventCoverage = onCall(
  { region: "asia-south1", timeoutSeconds: 15, memory: "256MiB" },
  async (request: { data: { eventText: string; description?: string } }) => {
    const { eventText, description } = request.data;

    if (!eventText || typeof eventText !== "string") {
      throw new HttpsError("invalid-argument", "Missing or invalid 'eventText'");
    }

    const searchQuery = `${eventText} ${description || ""} site:(bbc.com OR reuters.com OR indianexpress.com OR aljazeera.com OR thehindu.com)`;
    const feedUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(
      searchQuery
    )}&hl=en-IN&gl=IN&ceid=IN:en`;

    try {
      const feed = await parser.parseURL(feedUrl);
      if (!feed.items?.length) return { imageUrl: null, sourceLink: null };

      const filtered = feed.items.filter(
        (i) =>
          i.title &&
          !i.title.toLowerCase().includes("how to watch") &&
          !i.title.toLowerCase().includes("live stream") &&
          !i.link?.includes("youtube.com") &&
          !i.link?.includes("sport")
      );

      if (!filtered.length) return { imageUrl: null, sourceLink: null };

      const scored = filtered.map((item) => ({
        ...item,
        score: textSimilarity(
          (item.title || "") + " " + (item.contentSnippet || ""),
          eventText + " " + (description || "")
        ),
      }));

      scored.sort((a, b) => b.score - a.score);

      const best = scored[0];
      const imageUrl = extractImage(best);
      const sourceLink = best.link || null;

      return { imageUrl, sourceLink };
    } catch (err: any) {
      console.error("RSS fetch error:", err.message);
      throw new HttpsError("internal", "Failed to fetch RSS coverage");
    }
  }
);
