// src/utils/gptHelpers.ts
import { Draft, TimelineEvent, AnalysisSection } from "./firestoreHelpers";

const API_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-5-nano"; // your current OpenAI model

/** Generic OpenAI call returning parsed JSON */
async function callOpenAI(prompt: string, schemaDescription: string) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OpenAI API key (VITE_OPENAI_API_KEY)");

  const body = {
    model: MODEL,
    messages: [
      {
        role: "system",
        content: `You are a precise news editor. 
Always respond ONLY with valid JSON matching this schema: ${schemaDescription}.
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
    console.error("Raw model output:", text);
    throw new Error("Invalid JSON returned by model");
  }
}

/** Generate Timeline events */
export async function generateTimeline(draft: Draft): Promise<TimelineEvent[]> {
  const schema = `
{
  "timeline": [
    { "date": "YYYY-MM-DD", "event": "string", "description": "string",
      "significance": 1|2|3, "imageUrl": null, "sourceLink": null }
  ]
}`;

  const prompt = `
You are a news editor.
Create a concise chronological timeline of key developments for the topic:
"${draft.title}" Make your descriptions factual, data rich and in pointers

Context:
${draft.overview}

Return 10-15 events. Each must have date, event, short description, and significance (1=low,2=medium,3=high). 
Use ISO date format (YYYY-MM-DD). Return only valid JSON.`;

  const result = await callOpenAI(prompt, schema);
  return result.timeline;
}

/** Generate Analysis (stakeholders, FAQs, future questions) */
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
1. stakeholders - list of key people/institutions and their roles.
2. faqs - questions readers might have with concise factual answers.
3. future - forward-looking questions with reasoned answers.

Keep all answers < 50 words. Return only valid JSON.`;

  const result = await callOpenAI(prompt, schema);
  return result.analysis;
}

/** Generate contextual explainers from overview */
export async function generateContexts(overview: string): Promise<{ term: string; explainer: string }[]> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OpenAI API key (VITE_OPENAI_API_KEY)");

  const prompt = `
You are a news editor.
From the following overview, identify up to 8 complex or significant terms or phrases that readers may not immediately understand.
Return a JSON array where each item has:
- "term": the key term or phrase (2–4 words max)
- "explainer": a short, clear, factual, 1–2 line explanation (under 25 words).

Overview:
${overview}

Respond with JSON only, no extra text.
`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-5-nano", // cost-efficient contextual model
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim() || "[]";

  try {
    return JSON.parse(text);
  } catch (err) {
    console.error("⚠️ GPT Context JSON parse error:", text);
    return [];
  }
}
/** 🧠 Generate explainers for a given event's manual terms */
export async function generateExplainersForEvent(
  event: { event: string; description: string; contexts: { term: string; explainer?: string }[] }
): Promise<{ term: string; explainer: string }[]> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OpenAI API key (VITE_OPENAI_API_KEY)");

  const terms = event.contexts?.map((c) => c.term).filter(Boolean);
  if (!terms?.length) return [];

  const prompt = `
You are a concise factual news explainer.
For the following event, generate a one-line definition for each listed term.
Keep tone neutral, factual, and under 25 words per explainer.

Event: ${event.event}
Description: ${event.description}

Terms:
${terms.join(", ")}

Return ONLY valid JSON:
[
  {"term": "string", "explainer": "string"}
]
`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-5-nano",
      temperature: 0.3,
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
    console.warn("⚠️ Invalid JSON for event explainer");
    return [];
  }
}
