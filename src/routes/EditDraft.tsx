// src/routes/EditDraft.tsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchDraft, updateDraft } from "../utils/firestoreHelpers";

export default function EditDraft() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [draft, setDraft] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ---------------- FETCH DRAFT ----------------
  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        const data = await fetchDraft(id);
        if (!data) {
          alert("Draft not found");
          navigate("/drafts");
          return;
        }
        setDraft(data);
      } catch (err) {
        console.error(err);
        alert("Failed to load draft.");
        navigate("/drafts");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, navigate]);

  if (loading) return <p className="p-6 text-gray-600">Loading draft...</p>;
  if (!draft) return <p className="p-6 text-red-600">No draft found.</p>;

  // ---------------- HANDLERS ----------------
  const handleMetaChange = (e: any) => {
    const { name, value } = e.target;
    setDraft((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await updateDraft(id, draft);
      alert("Draft saved successfully!");
    } catch (err) {
      console.error(err);
      alert("Error saving draft.");
    } finally {
      setSaving(false);
    }
  };

  // ---------------- TIMELINE HANDLERS ----------------
  const addTimelineEvent = () => {
    const newEvent = {
      date: "",
      event: "",
      description: "",
      imageUrl: "",
      sourceLink: "",
    };
    setDraft((prev: any) => ({
      ...prev,
      timeline: [...(prev.timeline || []), newEvent],
    }));
  };

  const updateTimelineEvent = (index: number, field: string, value: string) => {
    setDraft((prev: any) => {
      const updated = [...(prev.timeline || [])];
      updated[index][field] = value;
      return { ...prev, timeline: updated };
    });
  };

  const removeTimelineEvent = (index: number) => {
    setDraft((prev: any) => {
      const updated = [...(prev.timeline || [])];
      updated.splice(index, 1);
      return { ...prev, timeline: updated };
    });
  };

  // ---------------- ANALYSIS HANDLERS ----------------
  const addAnalysisItem = (type: "stakeholders" | "faqs" | "future") => {
    const newItem =
      type === "stakeholders"
        ? { name: "", detail: "" }
        : { question: "", answer: "" };
    setDraft((prev: any) => ({
      ...prev,
      analysis: {
        ...prev.analysis,
        [type]: [...(prev.analysis?.[type] || []), newItem],
      },
    }));
  };

  const updateAnalysisItem = (
    type: "stakeholders" | "faqs" | "future",
    index: number,
    field: string,
    value: string
  ) => {
    setDraft((prev: any) => {
      const updated = [...(prev.analysis?.[type] || [])];
      updated[index][field] = value;
      return {
        ...prev,
        analysis: { ...prev.analysis, [type]: updated },
      };
    });
  };

  const removeAnalysisItem = (type: string, index: number) => {
    setDraft((prev: any) => {
      const updated = [...(prev.analysis?.[type] || [])];
      updated.splice(index, 1);
      return {
        ...prev,
        analysis: { ...prev.analysis, [type]: updated },
      };
    });
  };

  // ---------------- RENDER ----------------
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Edit Draft</h1>

      {/* ----- METADATA SECTION ----- */}
      <div className="bg-white rounded-lg p-4 shadow mb-8 border border-gray-200">
        <h2 className="text-lg font-semibold mb-3 text-gray-800">Metadata</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input name="title" value={draft.title || ""} onChange={handleMetaChange} placeholder="Title" className="border rounded p-2" />
          <input name="category" value={draft.category || ""} onChange={handleMetaChange} placeholder="Category" className="border rounded p-2" />
          <input name="subcategory" value={draft.subcategory || ""} onChange={handleMetaChange} placeholder="Subcategory" className="border rounded p-2" />
          <input name="imageUrl" value={draft.imageUrl || ""} onChange={handleMetaChange} placeholder="Image URL" className="border rounded p-2" />
          <input name="tags" value={(draft.tags || []).join(", ")} onChange={(e) => handleMetaChange({ target: { name: "tags", value: e.target.value.split(",").map((t) => t.trim()) } })} placeholder="Tags (comma-separated)" className="border rounded p-2" />
          <input name="sources" value={(draft.sources || []).join(", ")} onChange={(e) => handleMetaChange({ target: { name: "sources", value: e.target.value.split(",").map((s) => s.trim()) } })} placeholder="Sources (comma-separated)" className="border rounded p-2" />
          <select name="status" value={draft.status || "draft"} onChange={handleMetaChange} className="border rounded p-2">
            <option value="draft">Draft</option>
            <option value="review">Review</option>
            <option value="published">Published</option>
          </select>
          <select name="significance" value={draft.significance || 1} onChange={handleMetaChange} className="border rounded p-2">
            <option value={1}>1 (Low)</option>
            <option value={2}>2 (Medium)</option>
            <option value={3}>3 (High)</option>
          </select>
        </div>

        <textarea
          name="overview"
          value={draft.overview || ""}
          onChange={handleMetaChange}
          placeholder="Overview"
          className="border rounded p-2 w-full mt-4"
          rows={4}
        />
      </div>

      {/* ----- TIMELINE SECTION ----- */}
      <div className="bg-white rounded-lg p-4 shadow mb-8 border border-gray-200">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold text-gray-800">🕒 Timeline of Events</h2>
          <button onClick={addTimelineEvent} className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm">+ Add Event</button>
        </div>

        {(draft.timeline || []).map((item: any, index: number) => (
          <div key={index} className="border rounded p-3 mb-3 bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input value={item.date} onChange={(e) => updateTimelineEvent(index, "date", e.target.value)} placeholder="Date (YYYY-MM-DD)" className="border p-2 rounded" />
              <input value={item.event} onChange={(e) => updateTimelineEvent(index, "event", e.target.value)} placeholder="Event Title" className="border p-2 rounded" />
              <textarea value={item.description} onChange={(e) => updateTimelineEvent(index, "description", e.target.value)} placeholder="Description" className="border p-2 rounded md:col-span-2" rows={2} />
              <input value={item.imageUrl} onChange={(e) => updateTimelineEvent(index, "imageUrl", e.target.value)} placeholder="Image URL" className="border p-2 rounded" />
              <input value={item.sourceLink} onChange={(e) => updateTimelineEvent(index, "sourceLink", e.target.value)} placeholder="Source Link" className="border p-2 rounded" />
            </div>
            <button onClick={() => removeTimelineEvent(index)} className="text-red-600 hover:underline mt-2 text-sm">Delete Event</button>
          </div>
        ))}
      </div>

      {/* ----- ANALYSIS SECTION ----- */}
      <div className="bg-white rounded-lg p-4 shadow mb-8 border border-gray-200">
        <h2 className="text-lg font-semibold mb-3 text-gray-800">💬 Analysis Sections</h2>

        {/* Stakeholders */}
        <SectionEditor
          title="Stakeholders"
          type="stakeholders"
          items={draft.analysis?.stakeholders || []}
          addItem={addAnalysisItem}
          updateItem={updateAnalysisItem}
          removeItem={removeAnalysisItem}
        />

        {/* FAQs */}
        <SectionEditor
          title="FAQs"
          type="faqs"
          items={draft.analysis?.faqs || []}
          addItem={addAnalysisItem}
          updateItem={updateAnalysisItem}
          removeItem={removeAnalysisItem}
        />

        {/* Future Outlook */}
        <SectionEditor
          title="Future Outlook"
          type="future"
          items={draft.analysis?.future || []}
          addItem={addAnalysisItem}
          updateItem={updateAnalysisItem}
          removeItem={removeAnalysisItem}
        />
      </div>

      {/* ----- SAVE BUTTON ----- */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save All Changes"}
      </button>
    </div>
  );
}

// ------------- SUBCOMPONENT FOR ANALYSIS -------------
function SectionEditor({ title, type, items, addItem, updateItem, removeItem }: any) {
  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-medium text-gray-700">{title}</h3>
        <button onClick={() => addItem(type)} className="text-blue-600 hover:underline text-sm">
          + Add
        </button>
      </div>

      {(items || []).map((item: any, index: number) => (
        <div key={index} className="border rounded p-3 mb-2 bg-gray-50">
          {type === "stakeholders" ? (
            <>
              <input value={item.name} onChange={(e) => updateItem(type, index, "name", e.target.value)} placeholder="Name" className="border p-2 rounded w-full mb-2" />
              <textarea value={item.detail} onChange={(e) => updateItem(type, index, "detail", e.target.value)} placeholder="Detail" className="border p-2 rounded w-full" rows={2} />
            </>
          ) : (
            <>
              <input value={item.question} onChange={(e) => updateItem(type, index, "question", e.target.value)} placeholder="Question" className="border p-2 rounded w-full mb-2" />
              <textarea value={item.answer} onChange={(e) => updateItem(type, index, "answer", e.target.value)} placeholder="Answer" className="border p-2 rounded w-full" rows={2} />
            </>
          )}
          <button onClick={() => removeItem(type, index)} className="text-red-600 hover:underline text-sm mt-1">
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
