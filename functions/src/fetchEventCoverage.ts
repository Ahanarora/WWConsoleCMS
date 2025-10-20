// functions/src/fetchEventCoverage.ts
import * as functions from "firebase-functions/v2";
import Parser from "rss-parser";
import axios from "axios";
import * as cheerio from "cheerio";
import OpenAI from "openai";
import "./firebaseAdmin";

interface FetchEventCoverageData {
  event: string;
  description?: string;
  date?: string;
  keywords?: string[];
}

interface SourceItem {
  title: string;
  link: string;
  sourceName: string;
  imageUrl?: string | null;
  pubDate?: string;
  score?: number;
}

/* ---------- Indian RSS feeds ---------- */
const FEEDS = [
  "https://www.thehindu.com/news/national/feeder/default.rss",
  "https://indianexpress.com/feed/",
  "https://www.hindustantimes.com/rss/topnews/rssfeed.xml",
  "https://www.livemint.com/rss/news",
  "https://feeds.feedburner.com/ndtvnews-top-stories",
  "https://www.business-standard.com/rss/latest.rss",
  "https://www.indiatoday.in/rss/home",
  "https://scroll.in/rss",
  "https://www.moneycontrol.com/rss/latestnews.xml",
  "https://theprint.in/feed/"
];

/* ---------- Utility helpers ---------- */
const tokenize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2);

const countMatches = (tokens: string[], keywords: string[]) => {
  let score = 0;
  for (const w of keywords) {
    const freq = tokens.filter((t) => t === w).length;
    score += freq;
  }
  return score;
};

/* ---------- Main callable function ---------- */
export const fetchEventCoverage = functions.https.onCall(
  { region: "asia-south1", timeoutSeconds: 120, memory: "512MiB" },
  async (request: functions.https.CallableRequest<FetchEventCoverageData>) => {
    functions.logger.info("🟡 fetchEventCoverage invoked", { data: request.data });

    const { event, description = "", date, keywords = [] } = request.data || {};
    if (!event) {
      throw new functions.https.HttpsError("invalid-argument", "Event title is required.");
    }

    /* ---------- Optional event date ---------- */
    let eventDate: Date | null = null;
    if (date) {
      try {
        eventDate = new Date(date);
      } catch {
        eventDate = null;
      }
    }

    const parser = new Parser({
      customFields: { item: ["media:thumbnail", "enclosure", "description"] }
    });

    try {
      /* ---------- Fetch & parse feeds ---------- */
      const results = await Promise.allSettled(FEEDS.map((url) => parser.parseURL(url)));
      const allItems: SourceItem[] = [];

      for (const res of results) {
        if (res.status !== "fulfilled") continue;
        const feed = res.value;
        const feedTitle = feed.title || "Unknown Source";

        for (const i of feed.items) {
          const title = i.title?.trim() || "";
          const link = i.link?.trim() || "";
          if (!title || !link) continue;

          const image =
            i["media:thumbnail"]?.url ||
            i.enclosure?.url ||
            (i.description?.match(/<img[^>]+src=\"([^\">]+)/)?.[1] ?? undefined);

          allItems.push({
            title,
            link,
            sourceName: feedTitle,
            imageUrl: image || `${new URL(link).origin}/favicon.ico`,
            pubDate: i.pubDate || undefined
          });
        }
      }

      if (allItems.length === 0) {
        functions.logger.warn("⚠️ No feed results found.");
        return { sources: [] };
      }

      /* ---------- Keyword scoring ---------- */
      const allKeywords = [
        ...tokenize(event),
        ...tokenize(description),
        ...keywords.map((k) => k.toLowerCase())
      ];
      const uniqKeywords = Array.from(new Set(allKeywords));

      const scoreRelevance = (item: SourceItem): number => {
        const titleTokens = tokenize(item.title);
        const descTokens = tokenize(item.title + " " + (item as any).description || "");

        let score = 0;
        score += countMatches(titleTokens, uniqKeywords) * 3;
        score += countMatches(descTokens, uniqKeywords);

        const joinedTitle = titleTokens.join(" ");
        for (const phrase of uniqKeywords) if (joinedTitle.includes(phrase)) score += 2;

        if (eventDate && item.pubDate) {
          const pub = new Date(item.pubDate);
          const diffDays = Math.abs((pub.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays <= 2) score += 2;
          else if (diffDays <= 5) score += 1;
        }

        if (/thehindu|livemint|business-standard|hindustantimes|indianexpress/i.test(item.link))
          score += 3;
        if (/ndtv|moneycontrol|indiatoday|scroll|theprint/i.test(item.link))
          score += 2;

        return score;
      };

      const scored = Array.from(new Map(allItems.map((i) => [i.link, i])).values()).map((i) => ({
        ...i,
        score: scoreRelevance(i)
      }));

      /* ---------- Semantic embeddings layer ---------- */
      const apiKey = process.env.OPENAI_API_KEY;
      let usedSemantic = false;

      if (apiKey) {
        try {
          const openai = new OpenAI({ apiKey });
          const queryText = `${event} ${description}`;
          const queryEmbedding = (
            await openai.embeddings.create({
              model: "text-embedding-3-small",
              input: queryText
            })
          ).data[0].embedding;

          const topCandidates = scored.slice(0, 40);
          const texts = topCandidates.map((i) => i.title);

          const resp = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: texts
          });

          const cosine = (a: number[], b: number[]) => {
            const dot = a.reduce((s, x, i) => s + x * b[i], 0);
            const normA = Math.sqrt(a.reduce((s, x) => s + x * x, 0));
            const normB = Math.sqrt(b.reduce((s, x) => s + x * x, 0));
            return dot / (normA * normB);
          };

          const semScored = topCandidates.map((i, idx) => {
            const semSim = cosine(queryEmbedding, resp.data[idx].embedding);
            const combined = i.score * 0.7 + semSim * 30;
            return { ...i, score: combined };
          });

          semScored.sort((a, b) => (b.score || 0) - (a.score || 0));
          scored.splice(0, topCandidates.length, ...semScored);

          usedSemantic = true;
          functions.logger.info("✅ Semantic Layer Active", { count: semScored.length });
        } catch (e: any) {
          functions.logger.warn("⚠️ Semantic fallback failed", e.message);
        }
      } else {
        functions.logger.warn("⚠️ No OpenAI key found; using keyword-only scoring.");
      }

      /* ---------- Final ranking ---------- */
      const sorted = scored.sort((a, b) => (b.score || 0) - (a.score || 0));
      const topCutoffIndex = Math.ceil(sorted.length * 0.15);
      const ranked = sorted
        .slice(0, topCutoffIndex)
        .filter((i) => i.score && i.score > 5)
        .slice(0, 5);

      /* ---------- Image fallback ---------- */
      for (const item of ranked) {
        if (item.imageUrl && !item.imageUrl.includes("favicon")) continue;
        try {
          const { data: html } = await axios.get(item.link, {
            timeout: 8000,
            headers: { "User-Agent": "Mozilla/5.0" }
          });
          const $ = cheerio.load(html);
          const ogImage =
            $('meta[property="og:image"]').attr("content") ||
            $('meta[name="twitter:image"]').attr("content") ||
            $("img").first().attr("src");
          if (ogImage) item.imageUrl = ogImage;
        } catch {
          functions.logger.warn("⚠️ Failed to fetch OG image", item.link);
        }
      }

      functions.logger.info(
        usedSemantic
          ? "✅ Returning hybrid (semantic + keyword) results"
          : "✅ Returning keyword-only results",
        { count: ranked.length, sample: ranked.map((r) => ({ title: r.title, score: r.score })) }
      );

      return { sources: ranked };
    } catch (err: any) {
      functions.logger.error("💥 fetchEventCoverage failed", { message: err.message, stack: err.stack });
      throw new functions.https.HttpsError("internal", "Failed to fetch event coverage: " + err.message);
    }
  }
);
