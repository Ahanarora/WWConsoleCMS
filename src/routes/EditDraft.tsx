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
import {
  generateTimeline,
  generateAnalysis,
  generateExplainersForEvent,
  generateContextsForTimelineEvent,
  generateContextsForAnalysis,
} from "../utils/gptHelpers";

import { fetchEventCoverage } from "../api/fetchEventCoverage";
import { renderLinkedText } from "../utils/renderLinkedText.tsx";



export default function EditDraft() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const [selectionMap, setSelectionMap] = useState<
  Record<number, { start: number; end: number }>
>({});


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

  const ensureDraftShape = (data: Draft): Draft => ({
    ...data,
    timeline: data.timeline || [],
    phases: data.phases || [],
  });

  // ----------------------------
  // LOAD DRAFT
  // ----------------------------
  useEffect(() => {
    const load = async () => {
      try {
        if (!id) return;
        const data = await fetchDraft(id);
        setDraft(data ? ensureDraftShape(data) : null);
      } catch (err) {
        console.error(err);
        alert("Failed to load draft.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  

  // Warn user if there are unsaved changes
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (unsaved) {
      e.preventDefault();
      e.returnValue = "";
    }
  };
  window.addEventListener("beforeunload", handleBeforeUnload);
  return () => window.removeEventListener("beforeunload", handleBeforeUnload);
}, [unsaved]);

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
      setUnsaved(false);
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
      await updateDraft(id, { phases: draft.phases || [] });
      if (draft.type === "Story") {
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
      setDraft(updated ? ensureDraftShape(updated) : null);
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
      setDraft(updated ? ensureDraftShape(updated) : null);
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
    if (updated) {
      setDraft(ensureDraftShape(updated));
    }
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
    setDraft({ ...draft, timeline: updatedTimeline });
    setUnsaved(true);
  };

  const handleDeleteEvent = async (index: number) => {
    if (!id) return;
    if (!window.confirm("Delete this event?")) return;
    await deleteTimelineEvent(id, index);
    const updated = await fetchDraft(id);
    if (!updated) return;

    const phases = (updated.phases || [])
      .filter((p) => p.startIndex !== index)
      .map((p) => {
        const shiftedStart =
          p.startIndex > index ? p.startIndex - 1 : p.startIndex;
        let shiftedEnd =
          typeof p.endIndex === "number"
            ? p.endIndex > index
              ? p.endIndex - 1
              : p.endIndex
            : undefined;

        if (typeof shiftedEnd === "number" && shiftedEnd < shiftedStart) {
          shiftedEnd = shiftedStart;
        }

        return {
          ...p,
          startIndex: shiftedStart,
          endIndex: shiftedEnd,
        };
      });

    updated.phases = phases;

    setDraft(ensureDraftShape(updated));
    setUnsaved(true);
  };

  // ----------------------------
  // FETCH COVERAGE HANDLER (Serper)
  // ----------------------------
  const handleFetchCoverage = async (i: number, ev: TimelineEvent) => {
    if (!id || !draft) return;

    const eventTitle = ev.event?.trim();
    if (!eventTitle) {
      alert("Please add an event title before fetching coverage.");
      return;
    }

    const description = ev.description ?? "";

    try {
      console.log("🔗 Fetching Serper coverage for:", eventTitle);
      const result = await fetchEventCoverage(eventTitle, description, ev.date || "");

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
        {unsaved && (
  <p className="text-yellow-600 text-sm mt-1">⚠️ You have unsaved changes</p>
)}

        <div className="flex gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-blue-600 hover:underline"
          >
            ← Back
          </button>
          <button
            onClick={handlePublish}
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

       {/* ⭐ Tiny Pin to Featured */}
<div className="flex items-center gap-3 md:col-span-2 mt-2">
  <input
    type="checkbox"
    id="isPinnedFeatured"
    checked={draft.isPinnedFeatured || false}
    onChange={async (e) => {
      const checked = e.target.checked;
      setDraft({ ...draft, isPinnedFeatured: checked });

      if (id) {
        try {
          await updateDraft(id, { isPinnedFeatured: checked });
        } catch (err) {
          console.error("❌ Failed to update isPinnedFeatured:", err);
        }
      }
    }}
    className="w-4 h-4"
  />

  <label htmlFor="isPinnedFeatured" className="text-sm text-gray-800">
    Pin as Featured
  </label>

  {/* Category selector only when pinned */}
  {draft.isPinnedFeatured && (
    <select
      value={draft.pinnedCategory || "All"}
      onChange={async (e) => {
        const val = e.target.value;
        setDraft({ ...draft, pinnedCategory: val });

        if (id) {
          try {
            await updateDraft(id, { pinnedCategory: val });
          } catch (err) {
            console.error("❌ Failed to update pinnedCategory:", err);
          }
        }
      }}
      className="border p-1 rounded text-sm"
    >
      <option value="All">All Categories</option>
      <option value={draft.category}>{draft.category}</option>
    </select>
  )}
</div>


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

        {/* 🧭 Depth Toggle Setting */}
<div className="flex items-center gap-2 mt-4">
  <input
    type="checkbox"
    id="disableDepthToggle"
    checked={draft.disableDepthToggle || false}
    onChange={async (e) => {
      const checked = e.target.checked;
      setDraft({ ...draft, disableDepthToggle: checked });
      if (id) {
        try {
          await updateDraft(id, { disableDepthToggle: checked });
          console.log("✅ disableDepthToggle updated to:", checked);
        } catch (err) {
          console.error("❌ Failed to update disableDepthToggle:", err);
          alert("❌ Failed to update disableDepthToggle.");
        }
      }
    }}
    className="w-4 h-4"
  />
  <label htmlFor="disableDepthToggle" className="text-sm text-gray-700">
    Disable Depth Toggle in App
  </label>
</div>


        {/* 🧠 Context Explainers for Overview */}
<div className="mt-6">
  <h3 className="text-lg font-semibold mb-2">Context Explainers (Overview)</h3>
  <p className="text-sm text-gray-500 mb-3">
    Add terms that will be highlighted in the overview for reader context.
  </p>

  {(draft.contexts || []).map((ctx, i) => (
    <div key={i} className="flex gap-2 items-center mb-2">
      <input
        type="text"
        value={ctx.term}
        onChange={(e) => {
          const updated = [...(draft.contexts || [])];
          updated[i].term = e.target.value;
          setDraft({ ...draft, contexts: updated });
        }}
        placeholder="Term"
        className="border p-2 rounded flex-1"
      />
      <input
        type="text"
        value={ctx.explainer}
        onChange={(e) => {
          const updated = [...(draft.contexts || [])];
          updated[i].explainer = e.target.value;
          setDraft({ ...draft, contexts: updated });
        }}
        placeholder="Explainer"
        className="border p-2 rounded flex-[2]"
      />
      <button
        onClick={() => {
          const updated = (draft.contexts || []).filter((_, j) => j !== i);
          setDraft({ ...draft, contexts: updated });
        }}
        className="text-red-500 text-sm hover:underline"
      >
        ✖
      </button>
    </div>
  ))}

  <button
    onClick={() =>
      setDraft({
        ...draft,
        contexts: [...(draft.contexts || []), { term: "", explainer: "" }],
      })
    }
    className="text-blue-600 text-sm hover:underline"
  >
    ➕ Add new context term
  </button>
</div>

{/* ✨ GPT Auto-suggest */}
<button
  onClick={async () => {
    if (!draft.overview) {
      alert("Please write an overview first!");
      return;
    }
    try {
      const confirm = window.confirm("Use GPT to suggest contextual explainers?");
      if (!confirm) return;

      // Optional loading flag
      setSaving(true);
      const { generateContexts } = await import("../utils/gptHelpers");
      const suggested = await generateContexts(draft.overview);

      if (!suggested || suggested.length === 0) {
        alert("No terms found.");
        return;
      }

      const merged = [...(draft.contexts || []), ...suggested];
      setDraft({ ...draft, contexts: merged });
      alert(`✅ Added ${suggested.length} suggested context terms.`);
    } catch (err: any) {
      console.error("❌ GPT error:", err);
      alert("Failed to fetch GPT suggestions. Check console.");
    } finally {
      setSaving(false);
    }
  }}
  className="text-purple-600 text-sm hover:underline mt-2"
>
  ✨ Suggest Contexts with GPT
</button>


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

      {/* 💾 Save Timeline */}
<button
  onClick={async () => {
    if (!id || !draft) return;
    try {
      setSaving(true);
      await updateDraft(id, {
        timeline: draft.timeline,
        phases: draft.phases || [],
      });
      setUnsaved(false);
      alert("✅ Timeline saved successfully!");
    } catch (err) {
      console.error("❌ Timeline save failed:", err);
      alert("❌ Failed to save timeline.");
    } finally {
      setSaving(false);
    }
  }}
  className="px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm"
>
  💾 Save Timeline
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
            <div key={i} className="mb-6">
              {/* Insert Phase button BEFORE this event */}
              <button
                className="text-purple-600 text-xs hover:underline mb-2"
                onClick={() => {
                  const newPhase = {
                    title: "New Phase",
                    startIndex: i,
                    endIndex: i,
                  };
                  const phases = [...(draft.phases || []), newPhase];
                  setDraft({ ...draft, phases });
                  setUnsaved(true);
                }}
              >
                ➕ Insert Phase Here
              </button>

              {/* PHASE EDITOR */}
{(draft.phases || [])
  .filter((p) => p.startIndex === i)
  .map((phase) => {
    const realIdx = (draft.phases || []).indexOf(phase);
    const timelineLength = draft.timeline.length;
    const lastPossible = Math.max(
      phase.startIndex,
      timelineLength > 0 ? timelineLength - 1 : phase.startIndex
    );
    const currentEndValue = Math.min(
      Math.max(phase.startIndex, phase.endIndex ?? phase.startIndex),
      lastPossible
    );
    const startEventLabel =
      draft.timeline[phase.startIndex]?.event ||
      `Event ${phase.startIndex + 1}`;

    return (
      <div
        key={`phase-${realIdx}`}
        className="border border-purple-300 bg-purple-50 p-3 rounded mb-3"
      >
        {/* TITLE INPUT */}
        <input
          value={phase.title || ""}
          onChange={(e) => {
            const phases = [...(draft.phases || [])];
            phases[realIdx] = { ...phase, title: e.target.value };
            setDraft({ ...draft, phases });
            setUnsaved(true);
          }}
          className="border p-2 rounded w-full"
          placeholder="Phase title"
        />

        <p className="text-xs text-gray-600 mt-1">
          Starts at event #{phase.startIndex + 1}: {startEventLabel}
        </p>

        <label className="text-xs text-gray-600 mt-2 block">
          End this phase after event
          <select
            className="border p-2 rounded w-full mt-1 text-sm"
            value={currentEndValue}
            onChange={(e) => {
              const nextValue = Number(e.target.value);
              const safeValue = Math.max(phase.startIndex, nextValue);
              const phases = [...(draft.phases || [])];
              phases[realIdx] = { ...phase, endIndex: safeValue };
              setDraft({ ...draft, phases });
              setUnsaved(true);
            }}
          >
            {draft.timeline.map((ev, idx) => (
              <option
                key={`phase-${realIdx}-end-${idx}`}
                value={idx}
                disabled={idx < phase.startIndex}
              >
                #{idx + 1} · {ev.event || `Event ${idx + 1}`}
              </option>
            ))}
          </select>
        </label>

        {/* DELETE PHASE */}
        <button
          className="text-red-600 text-xs mt-1 hover:underline"
          onClick={() => {
            const phases = (draft.phases || []).filter(
              (_, idx) => idx !== realIdx
            );
            setDraft({ ...draft, phases });
            setUnsaved(true);
          }}
        >
          ✖ Remove Phase
        </button>
      </div>
    );
  })}


              <div className="border p-3 rounded">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                <input
                  value={ev.date || ""}
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
  value={ev.description || ""}
  onChange={(e) => {
    handleUpdateEvent(i, "description", e.target.value);
  }}
  onSelect={(e) => {
    const target = e.target as HTMLTextAreaElement;
    setSelectionMap((prev) => ({
      ...prev,
      [i]: {
        start: target.selectionStart,
        end: target.selectionEnd,
      },
    }));
  }}
  placeholder="Description"
  rows={2}
  className="border p-2 rounded w-full mb-2"
/>

{/* 🔗 Link selected text */}
<button
  onClick={() => {
    let targetId = prompt(
      "Enter linked story/theme ID (e.g. story/abc123 or theme/xyz456):"
    );
    if (!targetId) return;

    // ✅ Clean user input: remove accidental '@' or brackets
    targetId = targetId.replace(/^@+/, "").replace(/\[|\]|\(|\)/g, "");

    const sel = selectionMap[i];
    if (!sel || sel.start === sel.end) {
      alert("Select a term in the description box first, then click Link.");
      return;
    }

    const { start, end } = sel;
    const description = ev.description ?? "";
    const selectedText = description.substring(start, end);

    // ✅ Correct markdown format
    const linkedText = `[${selectedText}](@${targetId})`;

    const newDesc =
      description.substring(0, start) +
      linkedText +
      description.substring(end);

    const updatedTimeline = [...draft.timeline];
    updatedTimeline[i] = { ...ev, description: newDesc };
    setDraft({ ...draft, timeline: updatedTimeline });
    setUnsaved(true);
  }}
  className="text-blue-600 text-xs hover:underline mb-2"
>
  🔗 Link selected text
</button>

{/* Preview of description with clickable links */}
<div className="text-sm text-gray-700 mt-2">
{renderLinkedText(ev.description ?? "")}
</div>

              {/* 🧠 Context Explainers for this Event */}
<div className="mt-2">
  <h4 className="text-sm font-medium mb-1">Context Explainers</h4>
  {(ev.contexts || []).map((ctx, j) => (
    <div key={j} className="flex gap-2 items-center mb-1">
      <input
        type="text"
        value={ctx.term}
        onChange={(e) => {
          const newContexts = [...(ev.contexts || [])];
          newContexts[j].term = e.target.value;
          handleUpdateEvent(i, "contexts", newContexts);
        }}
        placeholder="Term"
        className="border p-1 rounded flex-1"
      />
      <input
        type="text"
        value={ctx.explainer}
        onChange={(e) => {
          const newContexts = [...(ev.contexts || [])];
          newContexts[j].explainer = e.target.value;
          handleUpdateEvent(i, "contexts", newContexts);
        }}
        placeholder="Explainer"
        className="border p-1 rounded flex-[2]"
      />
      <button
        onClick={() => {
          const newContexts = (ev.contexts || []).filter((_, k) => k !== j);
          handleUpdateEvent(i, "contexts", newContexts);
        }}
        className="text-red-600 text-xs hover:underline"
      >
        ✖
      </button>
    </div>
  ))}
  <button
    onClick={() => {
      const newContexts = [...(ev.contexts || []), { term: "", explainer: "" }];
      handleUpdateEvent(i, "contexts", newContexts);
    }}
    className="text-blue-600 text-xs hover:underline"
  >
    ➕ Add term
  </button>
</div>

{/* ✨ GPT Context Auto-Suggest for this Event */}
<button
  onClick={async () => {
    try {
      setSaving(true);
      const suggested = await generateContextsForTimelineEvent(ev);
      if (!suggested?.length) {
        alert("No contextual terms found for this event.");
        return;
      }

      const merged = [...(ev.contexts || []), ...suggested];
      handleUpdateEvent(i, "contexts", merged);
      alert(`✅ Added ${suggested.length} contextual explainers for this event.`);
    } catch (err) {
      console.error("GPT error (event contexts):", err);
      alert("❌ Failed to generate contexts for this event.");
    } finally {
      setSaving(false);
    }
  }}
  className="text-purple-600 text-xs hover:underline mt-1 block"
>
  ✨ Suggest Contexts with GPT
</button>


{/* ✨ GPT Explainer Generator for this event */}
<button
  onClick={async () => {
    const eventTitle = ev.event?.trim();
    const eventDescription = ev.description?.trim();

    if (!eventTitle || !eventDescription) {
      alert("Please add an event title and description first.");
      return;
    }

    const eventData = {
      event: eventTitle,
      description: eventDescription,
      contexts: ev.contexts || [],
    };

    if (!eventData.contexts.length) {
      alert("Please add at least one term first.");
      return;
    }

    try {
      setSaving(true);
      const { generateExplainersForEvent } = await import("../utils/gptHelpers");
      const suggested = await generateExplainersForEvent(eventData);

      if (!suggested.length) {
        alert("No explainers returned.");
        return;
      }

      // Merge GPT explainers into event’s contexts
      const merged = (eventData.contexts || []).map((ctx) => {
        const found = suggested.find(
          (s) => s.term.toLowerCase() === ctx.term.toLowerCase()
        );
        return found ? { ...ctx, explainer: found.explainer } : ctx;
      });

      handleUpdateEvent(i, "contexts", merged);
      alert(`✅ Added ${suggested.length} explainers.`);
    } catch (err: any) {
      console.error("GPT error:", err);
      alert("Failed to generate explainers for this event.");
    } finally {
      setSaving(false);
    }
  }}
  className="text-purple-600 text-xs hover:underline mt-2 block"
>
  ✨ Generate Explainers for this Event
</button>

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
                <button
  onClick={async () => {
    if (!id) return;
    try {
      setSaving(true);
      await updateTimelineEvent(id, i, draft.timeline[i]);
      setUnsaved(false);
      alert("✅ Event saved!");
    } catch (err) {
      console.error(err);
      alert("❌ Failed to save event.");
    } finally {
      setSaving(false);
    }
  }}
  className="text-green-600 text-sm hover:underline"
>
  💾 Save Event
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

                    {/* ✨ GPT Suggest Contexts for Analysis Section */}
<button
  onClick={async () => {
    const sectionItems = draft.analysis?.[sectionKey] || [];
    if (!sectionItems.length) {
      alert("No items to analyze yet.");
      return;
    }

    try {
      setSaving(true);
      const suggested = await generateContextsForAnalysis(sectionKey, sectionItems);
      if (!suggested?.length) {
        alert("No contextual terms found.");
        return;
      }

      const mergedContexts = [...(draft.contexts || []), ...suggested];
      setDraft({ ...draft, contexts: mergedContexts });
      alert(`✅ Added ${suggested.length} contextual explainers from ${sectionKey}.`);
    } catch (err) {
      console.error("GPT error (analysis contexts):", err);
      alert("❌ Failed to generate analysis contexts.");
    } finally {
      setSaving(false);
    }
  }}
  className="text-purple-600 text-xs hover:underline mt-1 block"
>
  ✨ Suggest Contexts with GPT
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
            setUnsaved(false);
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
