// ----------------------------------------
// src/routes/PromptLab.tsx
// ----------------------------------------

import React, { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

interface PromptConfig {
  gpt: {
    timelinePrompt: string;
    analysisPrompt: string;
  };
  serper: {
    prompt: string;
  };
  sonar: {
    model: string;
    timelineSystemPrompt: string;
    timelineUserPromptTemplate: string;
  };
}

export default function PromptLab() {
  const DEFAULT_PROMPTS: PromptConfig = {
    gpt: {
      timelinePrompt: `You are a precise news editor.
Given a topic, generate a concise chronological timeline of 10–15 key events.
Each event must include:
- date (YYYY-MM-DD)
- short event title
- 1–2 sentence factual description
- significance (1=low, 2=medium, 3=high)
Return only valid JSON with key "timeline".`,
      analysisPrompt: `You are a political analyst creating structured insights.
Given a topic and overview, produce three sections:
1. stakeholders – list key people/institutions and their roles.
2. faqs – questions readers might have with concise answers.
3. future – forward-looking questions with reasoned answers.
Keep all responses factual, under 50 words each. Return valid JSON with key "analysis".`,
    },
    serper: {
      prompt: "title",
    },
    sonar: {
      model: "sonar",
      timelineSystemPrompt: `You are a meticulous news researcher.
You must:
- Use live web search.
- Produce an exhaustive but concise chronological timeline.
- Focus on distinct, real-world events (not analysis).
- Include both major and important minor events if they move the story.
- Deduplicate overlapping coverage.
- Attach multiple reliable sources per event.
- Prefer recognized and reliable outlets across geographies.
- Output VALID JSON ONLY, no commentary, no markdown.`,
      timelineUserPromptTemplate: `Generate a chronological news timeline.

Title: {{title}}

Summary / overview:
{{overview}}

IMPORTANT RULES:
- Maximum events: 10–20
- Keep descriptions under 5 lines each
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
}`,
    },
  };

  const [prompts, setPrompts] = useState<PromptConfig>(DEFAULT_PROMPTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const ref = doc(db, "settings", "global");
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const data = snap.data() as any;
          setPrompts({
            gpt: {
              timelinePrompt:
                data?.gpt?.timelinePrompt ?? DEFAULT_PROMPTS.gpt.timelinePrompt,
              analysisPrompt:
                data?.gpt?.analysisPrompt ?? DEFAULT_PROMPTS.gpt.analysisPrompt,
            },
            serper: {
              prompt: data?.serper?.prompt ?? DEFAULT_PROMPTS.serper.prompt,
            },
            sonar: {
              model: data?.sonar?.model ?? DEFAULT_PROMPTS.sonar.model,
              timelineSystemPrompt:
                data?.sonar?.timelineSystemPrompt ??
                DEFAULT_PROMPTS.sonar.timelineSystemPrompt,
              timelineUserPromptTemplate:
                data?.sonar?.timelineUserPromptTemplate ??
                DEFAULT_PROMPTS.sonar.timelineUserPromptTemplate,
            },
          });
        }
      } catch (err) {
        console.error("❌ Failed to load prompts:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      const ref = doc(db, "settings", "global");
      await setDoc(ref, prompts, { merge: true });
      alert("✅ Prompts saved successfully!");
    } catch (err) {
      console.error(err);
      alert("❌ Failed to save prompts");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold">🧠 Prompt Editor</h1>
      <p className="text-gray-600 mb-4">
        Edit the default text templates used by GPT, Sonar, and Serper.
      </p>

      {/* GPT Timeline Prompt */}
      <div className="bg-white p-6 rounded-lg shadow space-y-4">
        <h2 className="text-xl font-semibold">GPT — Timeline Prompt</h2>
        <textarea
          value={prompts.gpt.timelinePrompt}
          onChange={(e) =>
            setPrompts({
              ...prompts,
              gpt: { ...prompts.gpt, timelinePrompt: e.target.value },
            })
          }
          className="w-full border rounded p-3 h-40 text-sm"
        />
      </div>

      {/* GPT Analysis Prompt */}
      <div className="bg-white p-6 rounded-lg shadow space-y-4">
        <h2 className="text-xl font-semibold">GPT — Analysis Prompt</h2>
        <textarea
          value={prompts.gpt.analysisPrompt}
          onChange={(e) =>
            setPrompts({
              ...prompts,
              gpt: { ...prompts.gpt, analysisPrompt: e.target.value },
            })
          }
          className="w-full border rounded p-3 h-40 text-sm"
        />
      </div>

      {/* Sonar Timeline Prompts */}
      <div className="bg-white p-6 rounded-lg shadow space-y-4">
        <h2 className="text-xl font-semibold">
          Perplexity Sonar — Timeline Prompts
        </h2>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Model</label>
          <input
            value={prompts.sonar.model}
            onChange={(e) =>
              setPrompts({
                ...prompts,
                sonar: { ...prompts.sonar, model: e.target.value },
              })
            }
            className="w-full border rounded p-2 text-sm"
            placeholder="sonar (recommended)"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Timeline System Prompt
          </label>
          <textarea
            value={prompts.sonar.timelineSystemPrompt}
            onChange={(e) =>
              setPrompts({
                ...prompts,
                sonar: {
                  ...prompts.sonar,
                  timelineSystemPrompt: e.target.value,
                },
              })
            }
            className="w-full border rounded p-3 h-40 text-sm"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Timeline User Prompt Template
          </label>
          <p className="text-sm text-gray-600">
            Use placeholders: <code>{"{{title}}"}</code> and{" "}
            <code>{"{{overview}}"}</code>.
          </p>
          <textarea
            value={prompts.sonar.timelineUserPromptTemplate}
            onChange={(e) =>
              setPrompts({
                ...prompts,
                sonar: {
                  ...prompts.sonar,
                  timelineUserPromptTemplate: e.target.value,
                },
              })
            }
            className="w-full border rounded p-3 h-56 text-sm"
          />
        </div>
      </div>

      {/* Serper Prompt */}
      <div className="bg-white p-6 rounded-lg shadow space-y-4">
        <h2 className="text-xl font-semibold">Serper — Search Prompt</h2>
        <textarea
          value={prompts.serper.prompt}
          onChange={(e) =>
            setPrompts({
              ...prompts,
              serper: { prompt: e.target.value },
            })
          }
          className="w-full border rounded p-3 h-24 text-sm"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
      >
        {saving ? "Saving…" : "💾 Save All Prompts"}
      </button>
    </div>
  );
}
