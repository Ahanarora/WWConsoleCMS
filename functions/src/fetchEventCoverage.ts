// -----------------------------------------------------
// Firebase Function: fetchEventCoverage (Gen 2)
// Region: asia-south1
// -----------------------------------------------------

import { onCall } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import axios from "axios";

// -----------------------------------------------------
// Global config (Gen-2)
// -----------------------------------------------------
setGlobalOptions({ region: "asia-south1" });

// Read env at module load (Gen-2 supported)
const SERPER_API_KEY = process.env.SERPER_API_KEY;

// -----------------------------------------------------
// Helper: ±2 day date window for Serper
// -----------------------------------------------------
function buildSerperDateTBS(dateStr?: string): string | null {
  if (!dateStr) return null;

  const base = new Date(dateStr);
  if (isNaN(base.getTime())) return null;

  const min = new Date(base);
  min.setDate(base.getDate() - 2);

  const max = new Date(base);
  max.setDate(base.getDate() + 2);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return `cdr:1,cd_min:${fmt(min)},cd_max:${fmt(max)}`;
}

// -----------------------------------------------------
// Main callable
// -----------------------------------------------------
export const fetchEventCoverage = onCall(async (request) => {
  console.log("🔐 ENV CHECK", {
    hasSerper: Boolean(process.env.SERPER_API_KEY),
    region: process.env.FUNCTION_REGION,
    node: process.version,
  });

  if (!SERPER_API_KEY) {
    console.error("❌ SERPER_API_KEY missing");
    return { sources: [] };
  }

  try {
    console.log("⚡ fetchEventCoverage invoked with:", request.data);

    const {
      title,
      event,
      description,
      date,
      region = "in",
      lang = "en",
    } = request.data ?? {};

    // Prefer title → event → description
    const query = (title || event || description || "").trim();
    if (!query) {
      console.warn("⚠️ Missing query input");
      return { sources: [] };
    }

    console.log("🔍 Serper query:", query);

    const payload: any = {
      q: query,
      num: 10,
      gl: region,
      hl: lang,
    };

    const tbs = buildSerperDateTBS(date);
    if (tbs) {
      payload.tbs = tbs;
      console.log("📅 Applying date window:", tbs);
    }

    const headers = {
      "X-API-KEY": SERPER_API_KEY,
      "Content-Type": "application/json",
    };

    // -------------------------------------------------
    // 1️⃣ Try Serper /news
    // -------------------------------------------------
    console.log("🌐 Calling Serper /news");

    let res = await axios.post(
      "https://google.serper.dev/news",
      payload,
      { headers, timeout: 10000 }
    );

    let items = res.data?.news ?? [];
    console.log("📰 /news results:", items.length);

    // -------------------------------------------------
    // 2️⃣ Fallback → /search
    // -------------------------------------------------
    if (items.length === 0) {
      console.log("🔁 No /news results — falling back to /search");

      const fallback = await axios.post(
        "https://google.serper.dev/search",
        {
          q: query,
          num: 10,
          gl: region,
          hl: lang,
        },
        { headers, timeout: 10000 }
      );

      items =
        fallback.data?.news ||
        fallback.data?.organic ||
        [];

      console.log("🔎 /search results:", items.length);
    }

    // -------------------------------------------------
    // Normalize + dedupe
    // -------------------------------------------------
    const normalizeLink = (url?: string) =>
      url?.replace(/^https?:\/\//, "").split("?")[0];

    const sources = Array.from(
      new Map(
        items
          .filter((n: any) => n?.link)
          .map((n: any) => [
            normalizeLink(n.link),
            {
              title: n.title || "",
              link: n.link,
              imageUrl: n.imageUrl || n.thumbnail || null,
              sourceName: n.source || n.domain || "Unknown",
              pubDate: n.date || null,
              provider: "serper",
            },
          ])
      ).values()
    );

    console.log("🧮 Unique sources returned:", sources.length);

    return { sources };
  } catch (err: any) {
    console.error("❌ fetchEventCoverage failed");

    if (err.response) {
      console.error("❌ Serper HTTP error", {
        status: err.response.status,
        data: err.response.data,
      });
    } else {
      console.error("❌ Runtime error", {
        message: err.message,
        stack: err.stack,
      });
    }

    // Never throw → prevents INTERNAL on client
    return { sources: [] };
  }
});
