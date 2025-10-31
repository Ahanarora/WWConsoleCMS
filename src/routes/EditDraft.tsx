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
  publishDraft,
  publishStory,
} from "../utils/firestoreHelpers";
import type { Draft, TimelineEvent } from "../utils/firestoreHelpers";
import { generateTimeline, generateAnalysis } from "../utils/gptHelpers";
import { fetchEventCoverage } from "../api/fetchEventCoverage";

export default function EditDraft() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [imageOptions, setImageOptions] = useState<string[]>([]);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [selectedEventIndex, setSelectedEventIndex] = useState<number | null>(null);


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
  // PUBLISH HANDLER
  // ----------------------------
  const handlePublish = async () => {
    if (!id || !draft) return;
    setPublishing(true);
    try {
      if (draft.category === "Story") {
        await publishStory(id);
        alert("✅ Story published successfully!");
      } else {
        await publishDraft(id);
        alert("✅ Theme published successfully!");
      }
    } catch (err: any) {
      console.error(err);
      alert("❌ Publish failed: " + err.message);
    } finally {
      setPublishing(false);
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
        const normalizedSources = result.sources.map((s) => ({
          ...s,
          imageUrl: s.imageUrl ?? null,
        }));

        const updatedEvent = {
          ...draft.timeline[i],
          sources: normalizedSources,
          imageUrl: normalizedSources[0]?.imageUrl || draft.timeline[i].imageUrl,
        };

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
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold">Edit Draft</h1>
        <div className="flex gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-blue-600 hover:underline"
          >
            ← Back
          </button>
          <button
            onClick={async () => {
              try {
                setPublishing(true);
                await publishDraft(id!);
                alert(
                  `✅ ${draft?.type === "Story" ? "Story" : "Theme"} published successfully!`
                );
              } catch (err: any) {
                console.error("❌ Error publishing:", err);
                alert("❌ Failed to publish draft. Check console for details.");
              } finally {
                setPublishing(false);
              }
            }}
            disabled={publishing}
            className="bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 disabled:opacity-50"
          >
            {publishing
              ? "Publishing…"
              : draft?.type === "Story"
                ? "✅ Publish Story"
                : "✅ Publish Theme"}
          </button>

        </div>
      </div>

      {/* METADATA */}
      <div className="bg-white p-6 rounded-lg shadow space-y-4">
        <h2 className="text-xl font-semibold mb-4">Metadata</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Title */}
          <input
            name="title"
            value={draft.title}
            onChange={handleMetadataChange}
            placeholder="Title"
            className="border p-2 rounded"
          />

          {/* Category */}
          <input
            name="category"
            value={draft.category}
            onChange={handleMetadataChange}
            placeholder="Category (e.g. Politics, Economy)"
            className="border p-2 rounded"
          />

          {/* Subcategory */}
          <input
            name="subcategory"
            value={draft.subcategory}
            onChange={handleMetadataChange}
            placeholder="Subcategory (e.g. Geopolitical Conflict)"
            className="border p-2 rounded"
          />

          {/* Image URL */}
          <input
            name="imageUrl"
            value={draft.imageUrl || ""}
            onChange={handleMetadataChange}
            placeholder="Main Thumbnail / Cover Image URL"
            className="border p-2 rounded md:col-span-2"
          />

          {/* Live thumbnail preview */}
          {draft.imageUrl && (
            <div className="md:col-span-2 flex justify-start items-center gap-4">
              <img
                src={draft.imageUrl}
                alt="Cover"
                className="w-48 h-32 object-cover rounded border"
                onError={(e) => {
                  const url = draft.imageUrl ?? "";
                  try {
                    if (url.startsWith("http")) {
                      const origin = new URL(url).origin;
                      e.currentTarget.src = `${origin}/favicon.ico`;
                    } else {
                      e.currentTarget.src =
                        "https://via.placeholder.com/150x100?text=No+Image";
                    }
                  } catch {
                    e.currentTarget.src =
                      "https://via.placeholder.com/150x100?text=No+Image";
                  }
                }}
              />
              <p className="text-gray-600 text-sm">
                Preview of your main thumbnail
              </p>
            </div>
          )}

          {/* Overview */}
          <textarea
            name="overview"
            value={draft.overview}
            onChange={handleMetadataChange}
            placeholder="Overview"
            rows={3}
            className="border p-2 rounded md:col-span-2"
          />
        </div>

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
      {/* 🧠 Generate Timeline */}
      <button
        onClick={handleGenerateTimeline}
        disabled={loadingTimeline}
        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loadingTimeline ? "Generating…" : "🧠 Generate Timeline"}
      </button>

      {/* ➕ Add Event */}
      <button
        onClick={async () => {
          const newItem = {
            date: "",
            event: "",
            description: "",
            significance: 1,
            imageUrl: "",
            sourceLink: "",
            sources: [],
          };
          const updatedTimeline = [...(draft.timeline || []), newItem];
          setDraft({ ...draft, timeline: updatedTimeline });

          // ✅ Optional Enhancement: Auto-save to Firestore
          if (id) {
            try {
              await updateDraft(id, { timeline: updatedTimeline });
              console.log("✅ New event added and saved to Firestore.");
            } catch (err) {
              console.error("❌ Failed to save new event:", err);
              alert("❌ Failed to save new event.");
            }
          }
        }}
        className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
      >
        ➕ Add Event
      </button>

      {/* 👁️ Toggle Show/Hide */}
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
                  onChange={(e) =>
                    handleUpdateEvent(i, "date", e.target.value)
                  }
                  placeholder="Date"
                  className="border p-2 rounded"
                />
                <input
                  value={ev.event}
                  onChange={(e) =>
                    handleUpdateEvent(i, "event", e.target.value)
                  }
                  placeholder="Event"
                  className="border p-2 rounded"
                />
                <input
                  value={ev.imageUrl || ""}
                  onChange={(e) =>
                    handleUpdateEvent(i, "imageUrl", e.target.value)
                  }
                  placeholder="Image URL"
                  className="border p-2 rounded"
                />
                {/* 🔗 Multiple Source Links */}
<div className="space-y-2">
  <label className="text-sm font-medium text-gray-700">Sources</label>

  {(ev.sources || []).map((src, j) => (
    <div key={j} className="flex gap-2 items-center">
      <input
        value={src.link}
        onChange={(e) => {
          const newSources = [...(ev.sources || [])];
          newSources[j].link = e.target.value;
          handleUpdateEvent(i, "sources", newSources);
        }}
        placeholder={`Source link #${j + 1}`}
        className="border p-2 rounded w-full"
      />
      <button
        onClick={() => {
          const newSources = (ev.sources || []).filter((_, idx) => idx !== j);
          handleUpdateEvent(i, "sources", newSources);
        }}
        className="text-red-600 text-sm hover:underline"
      >
        ✖
      </button>
    </div>
  ))}

  <button
    onClick={() => {
      const newSources = [...(ev.sources || []), { title: "", link: "", sourceName: "" }];
      handleUpdateEvent(i, "sources", newSources);
    }}
    className="text-blue-600 text-sm hover:underline"
  >
    ➕ Add another link
  </button>
</div>

              </div>

              <textarea
                value={ev.description}
                onChange={(e) =>
                  handleUpdateEvent(i, "description", e.target.value)
                }
                placeholder="Description"
                rows={2}
                className="border p-2 rounded w-full mb-2"
              />

              <label className="block text-sm text-gray-600 mb-1">
                Importance
              </label>
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
                              e.currentTarget.src = `${new URL(
                                s.link
                              ).origin}/favicon.ico`;
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
                          <span className="text-gray-500 text-xs">
                            {s.sourceName}
                          </span>
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

      {/* ANALYSIS */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Analysis</h2>
          <button
            onClick={handleGenerateAnalysis}
            disabled={loadingAnalysis}
            className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
          >
            {loadingAnalysis ? "Generating…" : "🧠 Generate Analysis"}
          </button>
        </div>

        {showAnalysis && (
          <div className="space-y-4">
            {["stakeholders", "faqs", "future"].map((sectionKey) => {
              const analysis = draft.analysis as Record<string, any>;
              const section = analysis?.[sectionKey] || [];
              const labels: Record<string, string> = {
                stakeholders: "Stakeholders",
                faqs: "FAQs",
                future: "Future Questions",
              };

              return (
                <details key={sectionKey} className="border rounded-lg p-3 group">
                  <summary className="cursor-pointer font-semibold text-blue-700 select-none flex justify-between items-center">
                    {labels[sectionKey]}
                    <span className="text-gray-500 group-open:rotate-90 transition-transform">
                      ▶
                    </span>
                  </summary>

                  <div className="mt-2 space-y-3">
                    {/* ➕ Add button */}
                    <button
                      onClick={() => {
                        const updated = { ...draft };
                        const list = analysis?.[sectionKey] || [];
                        const newItem =
                          sectionKey === "stakeholders"
                            ? { name: "", detail: "" }
                            : { question: "", answer: "" };
                        updated.analysis = {
                          ...analysis,
                          [sectionKey]: [...list, newItem],
                        };
                        setDraft(updated);
                      }}
                      className="text-sm text-green-700 hover:underline"
                    >
                      ➕ Add {labels[sectionKey].slice(0, -1)}
                    </button>

                    {/* Items list */}
                    {section.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        No {labels[sectionKey]} yet.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {section.map((item: any, idx: number) => (
                          <li
                            key={idx}
                            className="p-3 bg-gray-50 rounded-md border text-sm space-y-2"
                          >
                            {sectionKey === "stakeholders" ? (
                              <>
                                <input
                                  type="text"
                                  value={item.name}
                                  onChange={(e) => {
                                    const updated = { ...draft };
                                    (
                                      (updated.analysis as Record<string, any>)[
                                      sectionKey
                                      ][idx]
                                    ).name = e.target.value;
                                    setDraft(updated);
                                  }}
                                  placeholder="Name"
                                  className="w-full border p-1 rounded"
                                />
                                <textarea
                                  value={item.detail}
                                  onChange={(e) => {
                                    const updated = { ...draft };
                                    (
                                      (updated.analysis as Record<string, any>)[
                                      sectionKey
                                      ][idx]
                                    ).detail = e.target.value;
                                    setDraft(updated);
                                  }}
                                  placeholder="Detail"
                                  className="w-full border p-1 rounded"
                                />
                              </>
                            ) : (
                              <>
                                <input
                                  type="text"
                                  value={item.question}
                                  onChange={(e) => {
                                    const updated = { ...draft };
                                    (
                                      (updated.analysis as Record<string, any>)[
                                      sectionKey
                                      ][idx]
                                    ).question = e.target.value;
                                    setDraft(updated);
                                  }}
                                  placeholder="Question"
                                  className="w-full border p-1 rounded"
                                />
                                <textarea
                                  value={item.answer}
                                  onChange={(e) => {
                                    const updated = { ...draft };
                                    (
                                      (updated.analysis as Record<string, any>)[
                                      sectionKey
                                      ][idx]
                                    ).answer = e.target.value;
                                    setDraft(updated);
                                  }}
                                  placeholder="Answer"
                                  className="w-full border p-1 rounded"
                                />
                              </>
                            )}

                            {/* ❌ Delete button */}
                            <button
                              onClick={() => {
                                const updated = { ...draft };
                                const list = [...(analysis?.[sectionKey] || [])];
                                list.splice(idx, 1);
                                updated.analysis = {
                                  ...analysis,
                                  [sectionKey]: list,
                                };
                                setDraft(updated);
                              }}
                              className="text-xs text-red-600 hover:underline"
                            >
                              Delete
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        )}

              {/* 💾 Save button */}
      <button
        onClick={async () => {
          if (!id) return;
          try {
            await updateDraft(id, { analysis: draft.analysis });
            alert("✅ Analysis saved successfully!");
          } catch (err: any) {
            console.error(err);
            alert("❌ Failed to save analysis: " + err.message);
          }
        }}
        className="mt-4 bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
      >
        💾 Save Analysis
         </button>
    </div>
  </div>
);
}
