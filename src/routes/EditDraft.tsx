// ----------------------------------------
// src/routes/EditDraft.tsx
// ----------------------------------------

import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  fetchDraft,
  updateDraft,
  addTimelineEvent,
  updateTimelineEvent,
  deleteTimelineEvent,
} from "../utils/firestoreHelpers";
import type { Draft, TimelineEvent, AnalysisSection } from "../utils/firestoreHelpers";
import { generateTimeline, generateAnalysis } from "../utils/gptHelpers";
import { fetchEventCoverage } from "../api/fetchEventCoverage"; // ✅ updated import

export default function EditDraft() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showTimeline, setShowTimeline] = useState(true);
  const [showAnalysis, setShowAnalysis] = useState(true);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);

  const [newEvent, setNewEvent] = useState<Partial<TimelineEvent>>({
    date: "",
    event: "",
    description: "",
    significance: 1,
    imageUrl: "",
    sourceLink: "",
  });

  // ----------------------------
  // LOAD DRAFT
  // ----------------------------
  useEffect(() => {
    const load = async () => {
      try {
        if (!id) return;
        const data = await fetchDraft(id);
        setDraft(data);
      } catch (err) {
        console.error(err);
        alert("Failed to load draft.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  // ----------------------------
  // METADATA HANDLERS
  // ----------------------------
  const handleMetadataChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    if (!draft) return;
    const { name, value } = e.target;
    setDraft({ ...draft, [name]: value });
  };

  const saveMetadata = async () => {
    if (!draft || !id) return;
    try {
      setSaving(true);
      await updateDraft(id, draft);
      alert("✅ Metadata saved");
    } catch (err) {
      console.error(err);
      alert("❌ Failed to save metadata");
    } finally {
      setSaving(false);
    }
  };

  // ----------------------------
  // GPT HANDLERS
  // ----------------------------
  const handleGenerateTimeline = async () => {
    if (!draft || !id) return;
    setLoadingTimeline(true);
    try {
      const timeline = await generateTimeline(draft);
      await updateDraft(id, { timeline });
      const updated = await fetchDraft(id);
      setDraft(updated);
      alert("✅ Timeline generated successfully!");
    } catch (err: any) {
      console.error(err);
      alert("❌ Failed to generate timeline: " + err.message);
    } finally {
      setLoadingTimeline(false);
    }
  };

  const handleGenerateAnalysis = async () => {
    if (!draft || !id) return;
    setLoadingAnalysis(true);
    try {
      const analysis = await generateAnalysis(draft);
      await updateDraft(id, { analysis });
      const updated = await fetchDraft(id);
      setDraft(updated);
      alert("✅ Analysis generated successfully!");
    } catch (err: any) {
      console.error(err);
      alert("❌ Failed to generate analysis: " + err.message);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  // ----------------------------
  // TIMELINE HANDLERS
  // ----------------------------
  const handleAddEvent = async () => {
    if (!id) return;
    await addTimelineEvent(id, newEvent);
    const updated = await fetchDraft(id);
    setDraft(updated);
    setNewEvent({
      date: "",
      event: "",
      description: "",
      significance: 1,
      imageUrl: "",
      sourceLink: "",
    });
  };

  const handleUpdateEvent = async (index: number, field: keyof TimelineEvent, value: any) => {
    if (!id || !draft) return;

    const updatedTimeline = [...draft.timeline];
    updatedTimeline[index] = { ...updatedTimeline[index], [field]: value };

    // ✅ Update Firestore but do not refetch
    await updateTimelineEvent(id, index, updatedTimeline[index]);
    setDraft({ ...draft, timeline: updatedTimeline });
  };

  const handleDeleteEvent = async (index: number) => {
    if (!id) return;
    if (!window.confirm("Delete this event?")) return;
    await deleteTimelineEvent(id, index);
    const updated = await fetchDraft(id);
    setDraft(updated);
  };

  // ----------------------------
  // FETCH COVERAGE HANDLER (Serper)
  // ----------------------------
  const handleFetchCoverage = async (i: number, ev: TimelineEvent) => {
    if (!id || !draft) return;
    try {
      console.log("🔗 Fetching Serper coverage for:", ev.event);
      const result = await fetchEventCoverage(ev.event, ev.description, ev.date);

      if (result.sources?.length) {
        // ✅ Prepare updated event
      const normalizedSources = result.sources.map((s) => ({
  ...s,
  imageUrl: s.imageUrl ?? undefined, // 🔧 convert null → undefined
}));

const updatedEvent = {
  ...draft.timeline[i],
  sources: normalizedSources,
  imageUrl: normalizedSources[0]?.imageUrl || draft.timeline[i].imageUrl,
};


        // ✅ Update Firestore and local state simultaneously
        await updateTimelineEvent(id, i, updatedEvent);

        const updatedTimeline = [...draft.timeline];
        updatedTimeline[i] = updatedEvent;
        setDraft({ ...draft, timeline: updatedTimeline });

        alert(`✅ Found ${result.sources.length} sources for "${ev.event}"`);
      } else {
        alert("⚠️ No relevant sources found for this event");
      }

      console.log("📰 Sources:", result.sources);
    } catch (e: any) {
      console.error("❌ Error fetching coverage:", e);
      alert("❌ Failed to fetch coverage: " + e.message);
    }
  };

  // ----------------------------
  // RENDER
  // ----------------------------
  if (loading) return <div className="p-6">Loading...</div>;
  if (!draft) return <div className="p-6 text-red-500">Draft not found</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* HEADER */}
      <div className="flex justify-between mb-4">
        <h1 className="text-3xl font-bold">Edit Draft</h1>
        <button onClick={() => navigate("/drafts")} className="text-blue-600 hover:underline">
          ← Back
        </button>
      </div>

      {/* METADATA */}
      <div className="bg-white p-6 rounded-lg shadow space-y-4">
        <h2 className="text-xl font-semibold mb-4">Metadata</h2>
        {/* ... your existing metadata form ... */}
        <button
          onClick={saveMetadata}
          disabled={saving}
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {saving ? "Saving..." : "Save Metadata"}
        </button>
      </div>

      {/* TIMELINE */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Chronology of Events</h2>
          <div className="flex gap-3 items-center">
            <button
              onClick={handleGenerateTimeline}
              disabled={loadingTimeline}
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loadingTimeline ? "Generating…" : "🧠 Generate Timeline"}
            </button>
            <button
              onClick={() => setShowTimeline(!showTimeline)}
              className="text-sm text-blue-600 hover:underline"
            >
              {showTimeline ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {showTimeline && (
          <>
            {draft.timeline.length === 0 ? (
              <p className="text-gray-500 mb-3">No events yet.</p>
            ) : (
              <div className="space-y-4 mb-4">
                {draft.timeline.map((ev, i) => (
                  <div key={i} className="border p-3 rounded">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                      <input
                        value={ev.date}
                        onChange={(e) => handleUpdateEvent(i, "date", e.target.value)}
                        placeholder="Date"
                        className="border p-2 rounded"
                      />
                      <input
                        value={ev.event}
                        onChange={(e) => handleUpdateEvent(i, "event", e.target.value)}
                        placeholder="Event"
                        className="border p-2 rounded"
                      />
                      <input
                        value={ev.imageUrl || ""}
                        onChange={(e) => handleUpdateEvent(i, "imageUrl", e.target.value)}
                        placeholder="Image URL"
                        className="border p-2 rounded"
                      />
                      <input
                        value={ev.sourceLink || ""}
                        onChange={(e) => handleUpdateEvent(i, "sourceLink", e.target.value)}
                        placeholder="Source Link"
                        className="border p-2 rounded"
                      />
                    </div>

                    <textarea
                      value={ev.description}
                      onChange={(e) => handleUpdateEvent(i, "description", e.target.value)}
                      placeholder="Description"
                      rows={2}
                      className="border p-2 rounded w-full mb-2"
                    />

                    <label className="block text-sm text-gray-600 mb-1">Importance</label>
                    <select
                      value={ev.significance}
                      onChange={(e) =>
                        handleUpdateEvent(i, "significance", Number(e.target.value))
                      }
                      className="border p-2 rounded mb-2"
                    >
                      <option value={1}>Low</option>
                      <option value={2}>Medium</option>
                      <option value={3}>High</option>
                    </select>

                    {/* Buttons */}
                    <div className="flex gap-4 items-center mt-2">
                      <button
                        onClick={() => handleDeleteEvent(i)}
                        className="text-red-600 text-sm hover:underline"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => handleFetchCoverage(i, ev)}
                        className="text-blue-600 text-sm hover:underline"
                      >
                        🔗 Fetch Top Sources
                      </button>
                    </div>

                    {/* Top Sources */}
                    {ev.sources && ev.sources.length > 0 && (
                      <div className="mt-3 border-t pt-2">
                        <h4 className="text-sm font-semibold mb-2">Top Sources:</h4>
                        <div className="space-y-2">
                          {ev.sources.map((s: any, idx: number) => (
                            <div
                              key={idx}
                              className="flex items-center space-x-3 border p-2 rounded-md hover:bg-gray-50"
                            >
                              {s.imageUrl && (
                                <img
                                  src={s.imageUrl}
                                  alt={s.title}
                                  className="w-10 h-10 object-cover rounded"
                                  onError={(e) => {
                                    e.currentTarget.src = `${new URL(s.link).origin}/favicon.ico`;
                                  }}
                                />
                              )}
                              <div className="flex flex-col">
                                <a
                                  href={s.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 font-medium hover:underline"
                                >
                                  {s.title}
                                </a>
                                <span className="text-gray-500 text-xs">{s.sourceName}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ANALYSIS (unchanged) */}
      <div className="bg-white p-6 rounded-lg shadow">
        {/* existing analysis UI */}
      </div>
    </div>
  );
}
