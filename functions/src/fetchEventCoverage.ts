import * as functions from "firebase-functions/v2";
import axios from "axios";
import * as cheerio from "cheerio";
import "./firebaseAdmin";

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
}

export const fetchEventCoverage = functions.https.onCall(
  async (request: functions.https.CallableRequest<FetchEventCoverageData>) => {
    const { event, description = "", date } = request.data || {};

    if (!event) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Event title is required."
      );
    }

    // 1️⃣ Build search query
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
      // 2️⃣ Fetch the RSS feed XML
      const { data: xml } = await axios.get(feedUrl, {
        timeout: 10000,
      });

      const $ = cheerio.load(xml, { xmlMode: true });
      const items: SourceItem[] = [];

      $("item").each((_, el) => {
        const title = $(el).find("title").text().trim();
        const link = $(el).find("link").text().trim();
        const sourceName = $(el).find("source").text().trim() || "Unknown";
        const pubDate = $(el).find("pubDate").text().trim();

        if (title && link) {
          items.push({ title, link, sourceName, pubDate });
        }
      });

      if (items.length === 0) {
        functions.logger.warn("No results found for", { event, query });
        return { sources: [] };
      }

      // 3️⃣ Scoring logic
      const scoreRelevance = (item: SourceItem): number => {
        const text = `${item.title} ${item.sourceName}`.toLowerCase();
        const words = `${event} ${description}`
          .toLowerCase()
          .split(" ")
          .filter((w) => w.length > 3);

        let score = 0;
        for (const w of words) if (text.includes(w)) score++;

        // Temporal weighting
        if (eventDate && item.pubDate) {
          const pub = new Date(item.pubDate);
          const diffDays = Math.abs(
            (pub.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (diffDays <= 2) score += 3; // strong
          else if (diffDays <= 5) score += 1; // mild
        }

        return score;
      };

      // 4️⃣ Rank and pick top 5
      const ranked = items
        .map((it) => ({ ...it, score: scoreRelevance(it) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      // 5️⃣ Attempt to extract OpenGraph image for each link
      for (const item of ranked) {
        try {
          const { data: html } = await axios.get(item.link, { timeout: 8000 });
          const $page = cheerio.load(html);
          const ogImage =
            $page('meta[property="og:image"]').attr("content") ||
            $page('meta[name="twitter:image"]').attr("content");
          if (ogImage) item.imageUrl = ogImage;
        } catch (err) {
          functions.logger.warn("Failed to fetch image for", item.link);
          item.imageUrl = null;
        }
      }

      // 6️⃣ Return
      functions.logger.info("✅ Fetched coverage", {
        event,
        sources: ranked.length,
      });

      return { sources: ranked };
    } catch (err: any) {
      functions.logger.error("❌ Coverage fetch error", {
        event,
        message: err.message,
      });
      throw new functions.https.HttpsError(
        "internal",
        "Failed to fetch event coverage: " + err.message
      );
    }
  }
);
