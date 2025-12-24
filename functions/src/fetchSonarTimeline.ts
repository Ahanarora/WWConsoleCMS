// -----------------------------------------------------
// Firebase Function: fetchSonarTimeline (Gen 2)
// Uses Perplexity Sonar to generate a chronological timeline
// PROMPTS ARE LOADED FROM Firestore (PromptLab)
// -----------------------------------------------------

import { onCall, HttpsError } from "firebase-functions/v2/https";
import axios from "axios";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { requireAdmin } from "./utils/requireAdmin";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = getFirestore();

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

interface SonarSourceItem {
  title: string;
  url: string;
  sourceName?: string;
  publishedAt?: string | null;
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

export const fetchSonarTimeline = onCall(
  { timeoutSeconds: 120 },
  async (request) => {
    requireAdmin(request);
    console.log("⚡ fetchSonarTimeline invoked with:", request.data);

    if (!PERPLEXITY_API_KEY) {
      console.error("❌ Missing PERPLEXITY_API_KEY");
      throw new HttpsError("failed-precondition", "Missing PERPLEXITY_API_KEY");
    }

    const { title, overview } = request.data || {};
    if (typeof title !== "string" || title.trim().length < 3 || title.length > 200) {
      throw new HttpsError("invalid-argument", "Title must be 3–200 characters.");
    }
    if (typeof overview === "string" && overview.length > 5000) {
      throw new HttpsError("invalid-argument", "Overview too long.");
    }

  // -------------------------------------------------
  // LOAD PROMPTS FROM FIRESTORE (PromptLab)
  // -------------------------------------------------

    const settingsSnap = await db.doc("settings/global").get();
    const sonarSettings = settingsSnap.data()?.sonar || {};

  const systemPrompt: string =
    sonarSettings.timelineSystemPrompt ||
    `
You are a meticulous news researcher.
You must:
- Use live web search.
- Produce an exhaustive but concise chronological timeline.
- Focus on distinct, factual events only.
- Avoid analysis or opinions.
- Deduplicate overlapping coverage.
- Always output clean, valid JSON only (no markdown, no comments).
- Event titles MUST summarize the core real-world action using neutral journalistic language.
`;

  const userPromptTemplate: string =
    sonarSettings.timelineUserPromptTemplate ||
    `
Generate a chronological news timeline.

Title: {{title}}

Summary / overview:
{{overview}}

IMPORTANT RULES:
- Maximum events: 10–20
- Keep descriptions under 5 lines each
- Merge micro-events where necessary
- DO NOT output anything except JSON.
`;

    const userPrompt = userPromptTemplate
      .replace("{{title}}", title)
      .replace("{{overview}}", overview || "(none provided)");

    const model = sonarSettings.model || "sonar";

  // -------------------------------------------------
  // HELPER: call Sonar
  // -------------------------------------------------

    async function callSonar(prompt: string, tokenLimit: number) {
      return axios.post(
        "https://api.perplexity.ai/chat/completions",
        {
          model,
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
          timeout: 180000,
        }
      );
    }

  // -------------------------------------------------
  // PRIMARY ATTEMPT
  // -------------------------------------------------

    let content: string | null = null;

  try {
      const start = Date.now();
      const response = await callSonar(userPrompt, 4096);
      const elapsed = Date.now() - start;

      console.log(`✅ Sonar responded in ${elapsed} ms`);
      content = response.data?.choices?.[0]?.message?.content || null;
    } catch (err: any) {
      console.error("❌ Sonar API error:", err?.message);
      throw new HttpsError("internal", "Sonar API error");
    }

    if (!content) {
      console.error("❌ Empty content from Sonar");
      throw new HttpsError("internal", "Empty response from Sonar");
    }

  // -------------------------------------------------
  // PARSE JSON (with retry)
  // -------------------------------------------------

    let parsed: SonarTimelineResult | null = null;

  try {
      parsed = JSON.parse(content);
    } catch {
      try {
        const retry = await callSonar(
          userPrompt + `
IMPORTANT OVERRIDE:
- No more than 12 events
- Short descriptions
- VALID JSON ONLY
`,
          3000
        );

        parsed = JSON.parse(
          retry.data?.choices?.[0]?.message?.content || ""
        );
      } catch {
        console.error("❌ JSON parse failed twice");
        throw new HttpsError("internal", "Failed to parse Sonar output");
      }
    }

    if (!parsed || !Array.isArray(parsed.events)) {
      console.error("❌ Invalid Sonar output shape");
      throw new HttpsError("internal", "Invalid Sonar output");
    }

  // -------------------------------------------------
  // SANITIZE
  // -------------------------------------------------

    const cleanEvents = parsed.events.map((ev) => ({
      date: ev.date ?? null,
      title: (ev.title || "").trim(),
      description: (ev.description || "").trim(),
      importance: ev.importance ?? 2,
      sources: (ev.sources || []).map((s) => ({
        title: s.title || "",
        url: s.url || "",
        sourceName: s.sourceName || "",
        publishedAt: s.publishedAt || null,
      })),
    }));

    console.log(`📚 Timeline events count: ${cleanEvents.length}`);
    return { events: cleanEvents };
  }
);
