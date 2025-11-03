// -----------------------------------------------------
// Firebase Function: fetchEventCoverage (Gen 2)
// Region: asia-south1 (Mumbai)
// -----------------------------------------------------
import { onCall } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import axios from "axios";
import * as dotenv from "dotenv";

dotenv.config();

// ✅ default all functions to asia-south1
setGlobalOptions({ region: "asia-south1" });

const SERPER_API_KEY = process.env.SERPER_API_KEY;

// -----------------------------------------------------
// Main Function
// -----------------------------------------------------
export const fetchEventCoverage = onCall(async (request) => {
  console.log("⚡ Invoked with data:", request.data);

  try {
    if (!SERPER_API_KEY) throw new Error("Missing SERPER_API_KEY");

    const {
      title,
      event,
      description,
      region = "in",
      lang = "en",
    } = request.data ?? {};

    // ✅ prefer title → fallback to event → fallback to description
    const queryBase = title || event || description;
    if (!queryBase) throw new Error("Missing search input (title/event)");

    const query = queryBase.trim();
    console.log("🔍 Query used for Serper:", query);

    // -----------------------
    // 🌐 SERPER API CALL
    // -----------------------
    console.log("🌐 Attempting Serper API call...");

    const start = Date.now();
    const res = await axios.post(
      "https://google.serper.dev/news",
      {
        q: query,
        num: 10,
        gl: region,
        hl: lang,
        // removing tbs for broader searches
      },
      {
        headers: {
          "X-API-KEY": SERPER_API_KEY,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    const elapsed = Date.now() - start;
    console.log(`✅ Serper API reached successfully in ${elapsed} ms`);
    console.log("🔢 HTTP Status:", res.status);
    console.log("🔑 Response keys:", Object.keys(res.data || {}));
    console.log(
      "📰 Sample (first 2):",
      JSON.stringify(res.data?.news?.slice(0, 2), null, 2)
    );

    // -----------------------
    // 🗞️ Map and deduplicate
    // -----------------------
    const news = res.data?.news ?? [];
    const articles = news.map((n: any) => ({
      title: n.title,
      link: n.link,
      imageUrl: n.imageUrl || n.thumbnail || null,
      sourceName: n.source || "Unknown",
      pubDate: n.date || null,
    }));

    const unique = Array.from(
      new Map(articles.map((a: any) => [a.link, a])).values()
    );

    console.log(`🧮 Raw count: ${articles.length}, Unique count: ${unique.length}`);
    return { sources: unique };
  } catch (err: any) {
    console.error("❌ Error type:", err.name);
    console.error("❌ Error message:", err.message);
    if (err.response) {
      console.error("❌ HTTP error status:", err.response.status);
      console.error("❌ Response data:", JSON.stringify(err.response.data, null, 2));
    }
    return { sources: [] };
  }
});


