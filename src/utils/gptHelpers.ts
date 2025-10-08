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
"${draft.title}"

Context:
${draft.overview}

Return 5–10 events. Each must have date, event, short description, and significance (1=low,2=medium,3=high). 
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
