// -----------------------------------------------------
// Firebase Function: fetchSonarTimeline (Gen 2)
// Uses Perplexity Sonar to generate a chronological timeline
// -----------------------------------------------------

import { onCall } from "firebase-functions/v2/https";
import axios from "axios";
import * as dotenv from "dotenv";

dotenv.config();

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

interface SonarSourceItem {
  title: string;
  url: string;
  sourceName?: string;
  publishedAt?: string | null;
  imageUrl?: string | null;
}

interface SonarTimelineEvent {
  date?: string | null;
  title: string;
  description: string;
  importance?: 1 | 2 | 3;
  sources: SonarSourceItem[];
}

interface SonarTimelineResult {
  events: SonarTimelineEvent[];
}

export const fetchSonarTimeline = onCall(async (request) => {
  console.log("⚡ fetchSonarTimeline invoked with:", request.data);

  if (!PERPLEXITY_API_KEY) {
    console.error("❌ Missing PERPLEXITY_API_KEY");
    throw new Error("Missing PERPLEXITY_API_KEY");
  }

  const { title, overview } = request.data || {};
  if (!title) {
    throw new Error("Title is required for timeline generation");
  }

  // -----------------------
  // PROMPTS
  // -----------------------

  const systemPrompt = `
You are a meticulous news researcher.
You must:
- Use live web search.
- Produce an exhaustive but concise chronological timeline.
- Focus on distinct, factual events only.
- Avoid analysis or opinions.
- Deduplicate overlapping coverage.
- Always output clean, valid JSON only (no markdown, no comments).
`;

  const userPrompt = `
Generate a chronological news timeline.

Title: ${title}

Summary / overview:
${overview || "(none provided)"}

IMPORTANT RULES:
- Maximum events: 10–20
- Keep descriptions under 5 lines each
- STRICT token budget: DO NOT exceed ~3500 total tokens
- Merge micro-events where necessary
- DO NOT use ellipses (...). DO NOT include trailing commas.
- DO NOT output anything except JSON.

JSON FORMAT (MANDATORY):
{
  "events": [
    {
      "date": "YYYY-MM-DD or null",
      "title": "string",
      "description": "string",
      "importance": 1,
      "sources": [
        {
          "title": "string",
          "url": "string",
          "sourceName": "string",
          "publishedAt": "YYYY-MM-DD or null",
          "imageUrl": "string or null"
        }
      ]
    }
  ]
}

If data is uncertain, use null. ALWAYS return valid JSON.
`;

  // -----------------------
  // HELPER: make Sonar request
  // -----------------------

  async function callSonar(prompt: string, tokenLimit: number) {
    return axios.post(
      "https://api.perplexity.ai/chat/completions",
      {
        model: "sonar",       // switched from sonar-pro → sonar
        temperature: 0.1,
        max_tokens: tokenLimit,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 180000, // 3 min timeout
      }
    );
  }

  // -----------------------
  // PRIMARY ATTEMPT
  // -----------------------
  let content: string | null = null;

  try {
    const start = Date.now();
    const response = await callSonar(userPrompt, 4096);

    const elapsed = Date.now() - start;
    console.log(`✅ Perplexity Sonar responded in ${elapsed} ms`);
    console.log("🔑 Keys:", Object.keys(response.data || {}));

    content = response.data?.choices?.[0]?.message?.content || null;
  } catch (err: any) {
    console.error("❌ Sonar API error:", err?.message);
    if (err.response) {
      console.error("❌ HTTP status:", err.response.status);
      console.error("❌ Response data:", JSON.stringify(err.response.data, null, 2));
    }
    return { events: [] };
  }

  if (!content) {
    console.error("❌ Empty content from Sonar");
    return { events: [] };
  }

  console.log("RAW_SONAR_OUTPUT_SNIPPET:", content.slice(0, 500));

  // -----------------------
  // ATTEMPT JSON PARSE
  // -----------------------

  let parsed: SonarTimelineResult | null = null;

  try {
    parsed = JSON.parse(content);
  } catch (err) {
    console.error("❌ Failed to parse JSON from Sonar, retrying with smaller output…");
    console.error("Parse error:", err);
    console.error("Offending snippet:", content.slice(0, 300));

    // SECOND ATTEMPT: shorter output, stricter instructions
    try {
      const retryPrompt = userPrompt + `
IMPORTANT OVERRIDE:
- STRICT LIMIT: No more than 12 events.
- Descriptions under 3 lines.
- Output MUST be parseable JSON.
- ABSOLUTELY NO text outside JSON.
`;

      const retry = await callSonar(retryPrompt, 3000);
      const retryContent = retry.data?.choices?.[0]?.message?.content || "";

      console.log("RAW_RETRY_OUTPUT_SNIPPET:", retryContent.slice(0, 500));

      parsed = JSON.parse(retryContent);
    } catch (parseErr) {
      console.error("❌ RETRY also failed to parse JSON:", parseErr);
      return { events: [] };
    }
  }

  if (!parsed || !Array.isArray(parsed.events)) {
    console.error("❌ Parsed JSON missing events[]");
    return { events: [] };
  }

  // -----------------------
  // SANITIZATION
  // -----------------------

  const cleanEvents = parsed.events.map((ev, index) => ({
    date: ev.date ?? null,
    title: (ev.title || "").trim(),
    description: (ev.description || "").trim(),
    importance: ev.importance ?? 2,
    sources: (ev.sources || []).map((s) => ({
      title: s.title || "",
      url: s.url || "",
      sourceName: s.sourceName || "",
      publishedAt: s.publishedAt || null,
      imageUrl: s.imageUrl || null,
    })),
  }));

  console.log(`📚 Timeline events count: ${cleanEvents.length}`);

  return { events: cleanEvents };
});
