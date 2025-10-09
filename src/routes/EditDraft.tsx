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
import { fetchEventCoverage } from "../utils/fetchCoverage"; // ✅ new import

export default function EditDraft() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Collapse toggles
  const [showTimeline, setShowTimeline] = useState(true);
  const [showAnalysis, setShowAnalysis] = useState(true);

  // GPT loading
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);

  // Temp state for new timeline event
  const [newEvent, setNewEvent] = useState<Partial<TimelineEvent>>({
    date: "",
    event: "",
    description: "",
    significance: 1,
    imageUrl: "",
    sourceLink: "",
  });

  // Load draft from Firestore
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
      await updateDraft(id, {
        title: draft.title,
        overview: draft.overview,
        category: draft.category,
        subcategory: draft.subcategory,
        tags: draft.tags,
        imageUrl: draft.imageUrl,
        sources: draft.sources,
        status: draft.status,
        slug: draft.slug,
        editorNotes: draft.editorNotes,
      });
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

  const handleUpdateEvent = async (
    index: number,
    field: keyof TimelineEvent,
    value: any
  ) => {
    if (!id || !draft) return;
    const updatedEvent = { ...draft.timeline[index], [field]: value };
    await updateTimelineEvent(id, index, updatedEvent);
    const updated = await fetchDraft(id);
    setDraft(updated);
  };

  const handleDeleteEvent = async (index: number) => {
    if (!id) return;
    if (!window.confirm("Delete this event?")) return;
    await deleteTimelineEvent(id, index);
    const updated = await fetchDraft(id);
    setDraft(updated);
  };

  // ----------------------------
  // ANALYSIS HANDLERS
  // ----------------------------
  const handleAnalysisChange = (
    section: keyof AnalysisSection,
    index: number,
    field: string,
    value: string
  ) => {
    if (!draft) return;
    const updatedSection = [...draft.analysis[section]];
    updatedSection[index] = { ...updatedSection[index], [field]: value };
    setDraft({
      ...draft,
      analysis: { ...draft.analysis, [section]: updatedSection },
    });
  };

  const handleAddAnalysisItem = (section: keyof AnalysisSection) => {
    if (!draft) return;
    const newItem =
      section === "stakeholders"
        ? { name: "", detail: "" }
        : { question: "", answer: "" };
    setDraft({
      ...draft,
      analysis: {
        ...draft.analysis,
        [section]: [...draft.analysis[section], newItem],
      },
    });
  };

  const handleDeleteAnalysisItem = (
    section: keyof AnalysisSection,
    index: number
  ) => {
    if (!draft) return;
    const filtered = draft.analysis[section].filter((_, i) => i !== index);
    setDraft({
      ...draft,
      analysis: { ...draft.analysis, [section]: filtered },
    });
  };

  const saveAnalysis = async () => {
    if (!id || !draft) return;
    try {
      await updateDraft(id, { analysis: draft.analysis });
      alert("✅ Analysis saved");
    } catch (err) {
      console.error(err);
      alert("❌ Failed to save analysis");
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;
  if (!draft) return <div className="p-6 text-red-500">Draft not found</div>;

  // ----------------------------
  // RENDER
  // ----------------------------
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex justify-between mb-4">
        <h1 className="text-3xl font-bold">Edit Draft</h1>
        <button
          onClick={() => navigate("/drafts")}
          className="text-blue-600 hover:underline"
        >
          ← Back
        </button>
      </div>

      {/* METADATA */}
      <div className="bg-white p-6 rounded-lg shadow space-y-4">
        <h2 className="text-xl font-semibold mb-4">Metadata</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            name="title"
            value={draft.title}
            onChange={handleMetadataChange}
            placeholder="Title"
            className="border p-2 rounded"
          />
          <input
            name="category"
            value={draft.category}
            onChange={handleMetadataChange}
            placeholder="Category"
            className="border p-2 rounded"
          />
          <input
            name="subcategory"
            value={draft.subcategory}
            onChange={handleMetadataChange}
            placeholder="Subcategory"
            className="border p-2 rounded"
          />
          <input
            name="imageUrl"
            value={draft.imageUrl}
            onChange={handleMetadataChange}
            placeholder="Main Image URL"
            className="border p-2 rounded"
          />
          <textarea
            name="overview"
            value={draft.overview}
            onChange={handleMetadataChange}
            placeholder="Overview"
            rows={3}
            className="border p-2 rounded md:col-span-2"
          />

          <select
            name="status"
            value={draft.status}
            onChange={handleMetadataChange}
            className="border p-2 rounded"
          >
            <option value="draft">Draft</option>
            <option value="review">In Review</option>
            <option value="published">Published</option>
          </select>
          <input
            name="slug"
            value={draft.slug}
            onChange={handleMetadataChange}
            placeholder="Slug"
            className="border p-2 rounded"
          />
          <textarea
            name="editorNotes"
            value={draft.editorNotes || ""}
            onChange={handleMetadataChange}
            placeholder="Editor Notes"
            rows={2}
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
                      <input
                        value={ev.sourceLink || ""}
                        onChange={(e) =>
                          handleUpdateEvent(i, "sourceLink", e.target.value)
                        }
                        placeholder="Source Link"
                        className="border p-2 rounded"
                      />
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
                        handleUpdateEvent(
                          i,
                          "significance",
                          Number(e.target.value)
                        )
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
                        onClick={async () => {
                          try {
                            const { imageUrl, sourceLink } =
                              await fetchEventCoverage(
                                ev.event,
                                ev.description
                              );
                            await handleUpdateEvent(
                              i,
                              "imageUrl",
                              imageUrl || ""
                            );
                            await handleUpdateEvent(
                              i,
                              "sourceLink",
                              sourceLink || ""
                            );
                            alert("✅ Auto-filled image & source link");
                          } catch (err) {
                            console.error(err);
                            alert("❌ Failed to fetch coverage");
                          }
                        }}
                        className="text-blue-600 text-sm hover:underline"
                      >
                        🔍 Auto-fetch Coverage
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t pt-3 mt-3">
              <h3 className="text-md font-semibold mb-2">Add Event</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                <input
                  value={newEvent.date}
                  onChange={(e) =>
                    setNewEvent({ ...newEvent, date: e.target.value })
                  }
                  placeholder="Date"
                  className="border p-2 rounded"
                />
                <input
                  value={newEvent.event}
                  onChange={(e) =>
                    setNewEvent({ ...newEvent, event: e.target.value })
                  }
                  placeholder="Event"
                  className="border p-2 rounded"
                />
              </div>
              <textarea
                value={newEvent.description}
                onChange={(e) =>
                  setNewEvent({ ...newEvent, description: e.target.value })
                }
                placeholder="Description"
                rows={2}
                className="border p-2 rounded w-full mb-2"
              />
              <select
                value={newEvent.significance}
                onChange={(e) =>
                  setNewEvent({
                    ...newEvent,
                    significance: Number(e.target.value),
                  })
                }
                className="border p-2 rounded mb-2"
              >
                <option value={1}>Low</option>
                <option value={2}>Medium</option>
                <option value={3}>High</option>
              </select>
              <button
                onClick={handleAddEvent}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Add Event
              </button>
            </div>
          </>
        )}
      </div>

      {/* ANALYSIS */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Analysis Sections</h2>
          <div className="flex gap-3 items-center">
            <button
              onClick={handleGenerateAnalysis}
              disabled={loadingAnalysis}
              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {loadingAnalysis ? "Generating…" : "🤖 Generate Analysis"}
            </button>
            <button
              onClick={() => setShowAnalysis(!showAnalysis)}
              className="text-sm text-blue-600 hover:underline"
            >
              {showAnalysis ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {showAnalysis && (
          <div className="space-y-6">
            {/* Stakeholders */}
            <div>
              <h3 className="text-lg font-semibold mb-2">Stakeholders</h3>
              {draft.analysis.stakeholders.map((s, i) => (
                <div key={i} className="border p-3 rounded mb-2">
                  <input
                    value={s.name}
                    onChange={(e) =>
                      handleAnalysisChange(
                        "stakeholders",
                        i,
                        "name",
                        e.target.value
                      )
                    }
                    placeholder="Name"
                    className="border p-2 rounded w-full mb-2"
                  />
                  <textarea
                    value={s.detail}
                    onChange={(e) =>
                      handleAnalysisChange(
                        "stakeholders",
                        i,
                        "detail",
                        e.target.value
                      )
                    }
                    placeholder="Details"
                    className="border p-2 rounded w-full"
                  />
                  <button
                    onClick={() =>
                      handleDeleteAnalysisItem("stakeholders", i)
                    }
                    className="text-red-600 text-sm hover:underline mt-2"
                  >
                    Delete
                  </button>
                </div>
              ))}
              <button
                onClick={() => handleAddAnalysisItem("stakeholders")}
                className="text-blue-600 text-sm hover:underline"
              >
                + Add Stakeholder
              </button>
            </div>

            {/* FAQs */}
            <div>
              <h3 className="text-lg font-semibold mb-2">FAQs</h3>
              {draft.analysis.faqs.map((f, i) => (
                <div key={i} className="border p-3 rounded mb-2">
                  <input
                    value={f.question}
                    onChange={(e) =>
                      handleAnalysisChange("faqs", i, "question", e.target.value)
                    }
                    placeholder="Question"
                    className="border p-2 rounded w-full mb-2"
                  />
                  <textarea
                    value={f.answer}
                    onChange={(e) =>
                      handleAnalysisChange("faqs", i, "answer", e.target.value)
                    }
                    placeholder="Answer"
                    className="border p-2 rounded w-full"
                  />
                  <button
                    onClick={() => handleDeleteAnalysisItem("faqs", i)}
                    className="text-red-600 text-sm hover:underline mt-2"
                  >
                    Delete
                  </button>
                </div>
              ))}
              <button
                onClick={() => handleAddAnalysisItem("faqs")}
                className="text-blue-600 text-sm hover:underline"
              >
                + Add FAQ
              </button>
            </div>

            {/* Future Outlook */}
            <div>
              <h3 className="text-lg font-semibold mb-2">Future Outlook</h3>
              {draft.analysis.future.map((q, i) => (
                <div key={i} className="border p-3 rounded mb-2">
                  <input
                    value={q.question}
                    onChange={(e) =>
                      handleAnalysisChange("future", i, "question", e.target.value)
                    }
                    placeholder="Question"
                    className="border p-2 rounded w-full mb-2"
                  />
                  <textarea
                    value={q.answer}
                    onChange={(e) =>
                      handleAnalysisChange("future", i, "answer", e.target.value)
                    }
                    placeholder="Answer"
                    className="border p-2 rounded w-full"
                  />
                  <button
                    onClick={() => handleDeleteAnalysisItem("future", i)}
                    className="text-red-600 text-sm hover:underline mt-2"
                  >
                    Delete
                  </button>
                </div>
              ))}
              <button
                onClick={() => handleAddAnalysisItem("future")}
                className="text-blue-600 text-sm hover:underline"
              >
                + Add Future Question
              </button>
            </div>

            <button
              onClick={saveAnalysis}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Save Analysis
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
