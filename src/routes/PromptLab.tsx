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
}

export default function PromptLab() {
  const [prompts, setPrompts] = useState<PromptConfig>({
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
      prompt: "title", // 🔹 Default: use title as search term
    },
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load current settings from Firestore
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
                data?.gpt?.timelinePrompt || prompts.gpt.timelinePrompt,
              analysisPrompt:
                data?.gpt?.analysisPrompt || prompts.gpt.analysisPrompt,
            },
            serper: {
              prompt: data?.serper?.prompt || prompts.serper.prompt,
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

  // Save all prompt text to Firestore
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
        Edit the default text templates used by GPT and Serper for content generation.
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

      {/* Serper Prompt */}
      <div className="bg-white p-6 rounded-lg shadow space-y-4">
        <h2 className="text-xl font-semibold">Serper — Search Prompt</h2>
        <p className="text-sm text-gray-600">
          This text defines what query is sent to Serper for event coverage.
          If left as <code>title</code>, the draft’s event title will be used by default.
        </p>
        <textarea
          value={prompts.serper.prompt}
          onChange={(e) =>
            setPrompts({
              ...prompts,
              serper: { prompt: e.target.value },
            })
          }
          className="w-full border rounded p-3 h-24 text-sm"
          placeholder="Example: Find recent, credible articles about {{topic}}."
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
      >
        {saving ? "Saving…" : "💾 Save All Prompts"}
      </button>
    </div>
  );
}
