import * as functions from "firebase-functions/v2";
import axios from "axios";
import * as cheerio from "cheerio";
import "./firebaseAdmin";

// -------------------------
// 🔹 Type Definitions
// -------------------------
interface FetchEventCoverageData {
  event: string;
  description?: string;
  date?: string;
}

interface SourceItem {
  title: string;
  link: string;
  sourceName: string;
  imageUrl?: string | null;
  pubDate?: string;
  score?: number;
}

// -------------------------
// 🔹 Main Function
// -------------------------
export const fetchEventCoverage = functions.https.onCall(
  async (request: functions.https.CallableRequest<FetchEventCoverageData>) => {
    const { event, description = "", date } = request.data || {};

    // 🧩 Step 0 — Validation
    if (!event) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Event title is required."
      );
    }

    // 🧠 Step 1 — Build RSS query
    const query = encodeURIComponent(`${event} ${description}`);
    const feedUrl = `https://news.google.com/rss/search?q=${query}&hl=en-IN&gl=IN&ceid=IN:en`;

    let eventDate: Date | null = null;
    if (date) {
      try {
        eventDate = new Date(date);
      } catch {
        eventDate = null;
      }
    }

    try {
      // 🛰️ Step 2 — Fetch the RSS XML
      const { data: xml } = await axios.get(feedUrl, { timeout: 10000 });
      functions.logger.info("✅ RSS feed fetched successfully", {
        event,
        feedUrl,
      });

      // Parse the XML
      const $ = cheerio.load(xml, { xmlMode: true });
      const totalItems = $("item").length;
      functions.logger.info("📰 Total <item> entries found in RSS", {
        count: totalItems,
      });

      const items: SourceItem[] = [];

      $("item").each((_, el) => {
        const title = $(el).find("title").text().trim();
        const link = $(el).find("link").text().trim();
        const sourceName = $(el).find("source").text().trim() || "Unknown";
        const pubDate = $(el).find("pubDate").text().trim();
        if (title && link) items.push({ title, link, sourceName, pubDate });
      });

      if (items.length === 0) {
        functions.logger.warn("⚠️ No results found for event", { event, query });
        return { sources: [] };
      }

      // ✅ DEBUG LOG #3 — show few raw titles
      functions.logger.info("📋 Raw RSS item titles before scoring", {
        titles: items.slice(0, 5).map((i) => i.title),
      });

      // 🧮 Step 3 — Scoring logic
      const scoreRelevance = (item: SourceItem): number => {
        const text = `${item.title} ${item.sourceName}`.toLowerCase();
        const words = `${event} ${description}`
          .toLowerCase()
          .split(" ")
          .filter((w) => w.length > 3);

        let score = 0;
        for (const w of words) if (text.includes(w)) score++;

        if (eventDate && item.pubDate) {
          const pub = new Date(item.pubDate);
          const diffDays = Math.abs(
            (pub.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (diffDays <= 2) score += 3;
          else if (diffDays <= 5) score += 1;
        }
        return score;
      };

      // 🏆 Step 4 — Rank top 5
      const ranked = items
        .map((it) => ({ ...it, score: scoreRelevance(it) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      // ✅ DEBUG LOG #4 — show scores
      functions.logger.info("🏅 Ranked item scores", {
        ranked: ranked.map((r) => ({
          title: r.title,
          score: r.score,
          source: r.sourceName,
        })),
      });

      // 🖼️ Step 5 — Fetch images
      for (const item of ranked) {
        try {
          const { data: html } = await axios.get(item.link, { timeout: 8000 });
          const $page = cheerio.load(html);
          const ogImage =
            $page('meta[property="og:image"]').attr("content") ||
            $page('meta[name="twitter:image"]').attr("content");

          if (ogImage) {
            item.imageUrl = ogImage;
            // ✅ DEBUG LOG #5 — image found
            functions.logger.info("🖼️ Image found for", {
              title: item.title,
              imageUrl: item.imageUrl,
            });
          } else {
            item.imageUrl = null;
          }
        } catch {
          functions.logger.warn("⚠️ Failed to fetch image for", item.link);
          item.imageUrl = null;
        }
      }

      // ✅ DEBUG LOG #6 — Final summary
      functions.logger.info("📦 Returning fetched sources", {
        total: ranked.length,
        event,
      });

      return { sources: ranked };
    } catch (err: any) {
      // 🧯 Step 6 — Error handling
      functions.logger.error("❌ Coverage fetch error", {
        event,
        message: err.message,
      });
      functions.logger.error("❌ Stack trace", err);
      throw new functions.https.HttpsError(
        "internal",
        "Failed to fetch event coverage: " + err.message
      );
    }
  }
);
