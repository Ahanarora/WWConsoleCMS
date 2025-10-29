// ----------------------------------------
// src/routes/DraftsThemes.tsx
// ----------------------------------------

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createDraft, fetchDrafts, deleteDraft } from "../utils/firestoreHelpers";
import type { Draft } from "../utils/firestoreHelpers";

export default function DraftsThemes() {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: "",
    overview: "",
    type: "Theme", // internal draft type
    category: "",
    subcategory: "",
    date: "",
    imageUrl: "",
  });

  // 🔹 Same category list as stories — can be refined later if themes differ
  const categories = [
    "Politics",
    "Economy",
    "Environment",
    "Science & Tech",
    "Health",
    "World",
    "Culture",
    "Sports",
    "Other",
  ];

  // ----------------------------
  // LOAD DRAFTS
  // ----------------------------
  useEffect(() => {
    const load = async () => {
      try {
        const data = (await fetchDrafts()).filter((d) => d.type === "Theme");
        setDrafts(data);
      } catch (err) {
        console.error("Error loading drafts:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ----------------------------
  // FORM HANDLERS
  // ----------------------------
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.category.trim()) {
      alert("Title and Category are required");
      return;
    }

    try {
      setSaving(true);
      const id = await createDraft({
        title: form.title,
        overview: form.overview,
        category: form.category,
        subcategory: form.subcategory,
        tags: [],
        imageUrl: form.imageUrl,
        sources: [],
        timeline: [],
        analysis: { stakeholders: [], faqs: [], future: [] },
        status: "draft",
        slug: form.title.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, ""),
        editorNotes: "",
        updatedAt: new Date(),
        type: "Theme", // 🔹 this separates it from Story drafts
      });

      const data = (await fetchDrafts()).filter((d) => d.type === "Theme");
      setDrafts(data);
      setForm({
        title: "",
        overview: "",
        type: "Theme",
        category: "",
        subcategory: "",
        date: "",
        imageUrl: "",
      });

      navigate(`/drafts/${id}`);
    } catch (err) {
      console.error("Error creating draft:", err);
      alert("Failed to create draft");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this draft?")) return;
    try {
      await deleteDraft(id);
      setDrafts((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      console.error(err);
      alert("Failed to delete draft");
    }
  };

  // ----------------------------
  // RENDER
  // ----------------------------
  if (loading) return <div className="p-6">Loading drafts...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Theme Drafts</h1>
      </div>

      {/* CREATE NEW DRAFT */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Create New Theme Draft</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            name="title"
            placeholder="Title"
            value={form.title}
            onChange={handleChange}
            className="border p-2 rounded"
          />

          {/* CATEGORY DROPDOWN */}
          <select
            name="category"
            value={form.category}
            onChange={handleChange}
            className="border p-2 rounded"
          >
            <option value="">Select Category</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <input
            name="subcategory"
            placeholder="Subcategory (e.g. Climate Policy, Geopolitical Conflict)"
            value={form.subcategory}
            onChange={handleChange}
            className="border p-2 rounded"
          />

          <input
            name="date"
            placeholder="Date (optional)"
            value={form.date}
            onChange={handleChange}
            className="border p-2 rounded"
          />

          <input
            name="imageUrl"
            placeholder="Image URL (optional)"
            value={form.imageUrl}
            onChange={handleChange}
            className="border p-2 rounded md:col-span-2"
          />

          <textarea
            name="overview"
            placeholder="Overview"
            value={form.overview}
            onChange={handleChange}
            rows={3}
            className="border p-2 rounded md:col-span-2"
          />

          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 text-white py-2 px-4 rounded md:col-span-2 hover:bg-blue-700"
          >
            {saving ? "Saving..." : "Create Theme Draft"}
          </button>
        </form>
      </div>

      {/* EXISTING DRAFTS LIST */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Existing Theme Drafts</h2>
        {drafts.length === 0 ? (
          <p className="text-gray-500">No theme drafts yet.</p>
        ) : (
          <ul className="divide-y">
            {drafts.map((draft) => (
              <li key={draft.id} className="py-3 flex justify-between items-center">
                <div>
                  <p className="font-medium">{draft.title || "Untitled"}</p>
                  <p className="text-sm text-gray-500">
                    {draft.category} • {draft.subcategory || "—"} • {draft.status}
                  </p>
                </div>
                <div className="space-x-2">
                  <button
                    onClick={() => navigate(`/drafts/${draft.id}`)}
                    className="text-blue-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(draft.id!)}
                    className="text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
