import * as functions from "firebase-functions/v2";
import "./firebaseAdmin"; // initialize admin once for side-effect
import Parser from "rss-parser";

const parser = new Parser();

interface FetchEventCoverageData {
  event: string;
  description?: string;
  date?: string; // event date from Firestore
}

export const fetchEventCoverage = functions.https.onCall(
  { region: "asia-south1" },
  async (request: functions.https.CallableRequest<FetchEventCoverageData>) => {
    const { event, description = "", date } = request.data || {};

    // 🚀 Log the incoming request
    functions.logger.info("fetchEventCoverage called", { event, description, date });

    if (!event) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Event title is required."
      );
    }

    let eventDate: Date | null = null;
    if (date) {
      try {
        eventDate = new Date(date);
      } catch {
        eventDate = null;
      }
    }

    try {
      // Build query for Google News RSS
      const query = encodeURIComponent(event + " " + description);
      const feedUrl = `https://news.google.com/rss/search?q=${query}&hl=en-IN&gl=IN&ceid=IN:en`;

      const feed = await parser.parseURL(feedUrl);

      if (!feed.items || feed.items.length === 0) {
        functions.logger.warn("No RSS results for query", { event, query });
        return { imageUrl: null, sourceLink: null };
      }

      // --- Scoring function for relevance + date proximity
      const scoreRelevance = (item: any, query: string): number => {
        const text = (
          (item.title || "") +
          " " +
          (item.contentSnippet || "")
        ).toLowerCase();
        const words = query
          .toLowerCase()
          .split(" ")
          .filter((w) => w.length > 3);
        const baseScore = words.filter((w) => text.includes(w)).length;

        // --- Temporal weighting (±2 days strong match)
        let timeScore = 0;
        if (eventDate && item.pubDate) {
          const pub = new Date(item.pubDate);
          const diffDays = Math.abs(
            (pub.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (diffDays <= 2) timeScore = 3; // strong match
          else if (diffDays <= 5) timeScore = 1; // weak match
        }

        return baseScore + timeScore;
      };

      // --- Select best-matching RSS item
      let bestItem: any = null;
      let bestScore = 0;

      for (const item of feed.items) {
        const score = scoreRelevance(item, event + " " + description);
        if (score > bestScore) {
          bestItem = item;
          bestScore = score;
        }
      }

      if (!bestItem) {
        functions.logger.info("No relevant match found", { event, query });
        return { imageUrl: null, sourceLink: null };
      }

      // --- Extract image
      let imageUrl: string | null = null;
      if (bestItem.enclosure?.url) {
        imageUrl = bestItem.enclosure.url;
      } else if (bestItem["media:content"]?.url) {
        imageUrl = bestItem["media:content"].url;
      } else if (bestItem.content?.includes("<img")) {
        const match = bestItem.content.match(/<img.*?src="(.*?)"/);
        if (match) imageUrl = match[1];
      }

      // --- Log what we found
      functions.logger.info("✅ Coverage fetched", {
        event,
        query,
        bestTitle: bestItem.title,
        pubDate: bestItem.pubDate,
        bestScore,
        imageUrl,
        sourceLink: bestItem.link,
      });

      return {
        imageUrl,
        sourceLink: bestItem.link || null,
      };
    } catch (err: any) {
      functions.logger.error("❌ Error fetching coverage", {
        event,
        message: err.message,
      });
      throw new functions.https.HttpsError(
        "internal",
        "Failed to fetch coverage: " + err.message
      );
    }
  }
);