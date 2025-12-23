// ----------------------------------------
// src/utils/gptHelpers.ts
// ----------------------------------------

import { Draft, TimelineEvent, AnalysisSection } from "./firestoreHelpers";

/** ✅ Always use OpenAI endpoint */
const API_URL = "https://api.openai.com/v1/chat/completions";

/** ✅ Model to use — cheap, fast, and reliable */
const MODEL = "gpt-4o-mini";

/** Generic chat completion call returning parsed JSON */
async function callOpenAI(prompt: string, schemaDescription: string) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) throw new Error("❌ Missing VITE_OPENAI_API_KEY in .env");

  const body = {
    model: MODEL,
    messages: [
      {
        role: "system",
        content: `You are a precise news editor.
Always respond ONLY with valid JSON matching this schema:
${schemaDescription}
Do not include markdown, code fences, or commentary.`,
      },
      { role: "user", content: prompt },
    ],
  };

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error: ${res.status} ${text}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty response from model");

  try {
    return JSON.parse(text);
  } catch (err) {
    console.error("⚠️ Raw model output:", text);
    throw new Error("Invalid JSON returned by model");
  }
}

/** 🧭 Generate Timeline events */
export async function generateTimeline(draft: Draft): Promise<TimelineEvent[]> {
  const schema = `
{
  "timeline": [
    { "date": "YYYY-MM-DD", "event": "string", "description": "string",
      "significance": 1|2|3, "sourceLink": null }
  ]
}`;

  const prompt = `
You are a news editor.
Create a concise chronological timeline of key developments for the topic:
"${draft.title}"
Make descriptions factual, data-rich, and written as short bullet summaries.

Context:
${draft.overview}

Return 10–15 events.
Each must have:
- date (ISO format)
- event
- short description
- significance (1=low,2=medium,3=high)

Return only valid JSON.
`;

  const result = await callOpenAI(prompt, schema);
  return result.timeline;
}

/** 🧩 Generate Analysis (stakeholders, FAQs, future questions) */
export async function generateAnalysis(draft: Draft): Promise<AnalysisSection> {
  const schema = `
{
  "analysis": {
    "stakeholders": [{ "name": "string", "detail": "string" }],
    "faqs": [{ "question": "string", "answer": "string" }],
    "future": [{ "question": "string", "answer": "string" }]
  }
}`;

  const prompt = `
You are a political analyst creating structured insights for the theme "${draft.title}".

Context:
${draft.overview}

Return three sections:
1. stakeholders – list of key people/institutions and their roles.
2. faqs – common reader questions with concise factual answers.
3. future – forward-looking questions with short, reasoned answers.

Keep all answers under 50 words.
Return only valid JSON.
`;

  const result = await callOpenAI(prompt, schema);
  return result.analysis;
}

/** 🧠 Generate contextual explainers from overview */
export async function generateContexts(
  overview: string
): Promise<{ term: string; explainer: string }[]> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) throw new Error("❌ Missing API key");

  const prompt = `
You are a clear and factual news editor.
From the following overview, identify up to 8 important or complex terms that a reader might not immediately understand.

Return JSON only:
[
  { "term": "term or phrase", "explainer": "short, clear, factual, under 25 words" }
]

Overview:
${overview}
`;

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim() || "[]";
  console.log("🧠 Raw GPT overview context output:", text);

  try {
    return JSON.parse(text);
  } catch {
    console.warn("⚠️ GPT Context JSON parse error:", text);
    return [];
  }
}

/** 🧩 Generate explainers for a given event's manual terms */
export async function generateExplainersForEvent(
  event: {
    event: string;
    description: string;
    contexts: { term: string; explainer?: string }[];
  }
): Promise<{ term: string; explainer: string }[]> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) throw new Error("❌ Missing API key");

  const terms = event.contexts?.map((c) => c.term).filter(Boolean);
  if (!terms?.length) return [];

  const prompt = `
You are a concise factual explainer.
For the given event, write a short (under 25 words) neutral definition for each listed term.

Event title: ${event.event}
Event description: ${event.description}

Terms to explain:
${terms.map((t) => `- ${t}`).join("\n")}

Return ONLY valid JSON:
[
  {"term": "string", "explainer": "string"}
]
`;

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim() || "[]";
  console.log("🧠 Raw GPT event explainer output:", text);

  try {
    const parsed = JSON.parse(text);
    return parsed.filter((p: any) => p.term && p.explainer);
  } catch {
    console.warn("⚠️ Invalid JSON for event explainer:", text);
    return [];
  }
}

// ------------------------------------------------------
// ✨ NEW GPT Context Generators for Timeline + Analysis
// ------------------------------------------------------

/** 🕒 Generate contextual explainers for an entire timeline event */
export async function generateContextsForTimelineEvent(
  event: TimelineEvent
): Promise<{ term: string; explainer: string }[]> {
  const prompt = `
You are a concise factual news explainer.
Given the event below, identify key proper nouns, organizations, or technical terms a general reader may not know.
For each, write a short (under 20 words) neutral explanation.

Event Title: ${event.event}
Event Description: ${event.description}

Return ONLY valid JSON:
[
  {"term": "string", "explainer": "string"}
]
`;

  const schema = `[{"term": "string", "explainer": "string"}]`;
  return await callOpenAI(prompt, schema);
}

/** 🧠 Generate contextual explainers for analysis sections (stakeholders, FAQs, future) */
export async function generateContextsForAnalysis(
  sectionKey: string,
  items: any[]
): Promise<{ term: string; explainer: string }[]> {
  const prompt = `
You are a concise factual explainer for a news analysis section.
Section: ${sectionKey}

For each entry below, suggest short (under 20 words) neutral explainers for key names or entities readers may not know.

Entries:
${JSON.stringify(items, null, 2)}

Return ONLY valid JSON:
[
  {"term": "string", "explainer": "string"}
]
`;

  const schema = `[{"term": "string", "explainer": "string"}]`;
  return await callOpenAI(prompt, schema);
}

/** 🧩 Generate Phased Timeline (AI groups events into broader phases) */
export async function generatePhasedTimeline(
  draft: Draft
): Promise<{ title: string; description?: string; events: TimelineEvent[] }[]> {
  const schema = `
{
  "phases": [
    {
      "title": "string",
      "description": "string",
      "events": [
        { "date": "YYYY-MM-DD", "event": "string", "description": "string", "significance": 1|2|3 }
      ]
    }
  ]
}`;

  const prompt = `
You are a news timeline editor.

From the overview and known chronology, organize key events into 3–5 major *phases* of the story.
Each phase should have:
- a clear title (like "Trump rolls out tariffs and chaos ensues")
- a 1–2 sentence description summarizing that phase
- a chronological subset of key events under it

Topic: ${draft.title}

Context:
${draft.overview}

Return valid JSON matching the schema above.
`;

  const result = await callOpenAI(prompt, schema);
  return result.phases;
}
