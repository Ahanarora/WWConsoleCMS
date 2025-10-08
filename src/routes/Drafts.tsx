// ----------------------------------------
// src/routes/Drafts.tsx
// ----------------------------------------

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createDraft, fetchDrafts, deleteDraft } from "../utils/firestoreHelpers";
import type { Draft } from "../utils/firestoreHelpers";

export default function Drafts() {
  const navigate = useNavigate();

  // Local state
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form inputs for new draft
  const [form, setForm] = useState({
    title: "",
    overview: "",
    category: "",
    subcategory: "",
  });

  // Load all drafts
  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchDrafts();
        setDrafts(data);
      } catch (err) {
        console.error("Error loading drafts:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  // Create new draft
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      alert("Title is required");
      return;
    }

    try {
      setSaving(true);

      // ✅ Matches the current Draft schema (status literal typed)
      const id = await createDraft({
        title: form.title,
        overview: form.overview,
        category: form.category,
        subcategory: form.subcategory,
        tags: [],
        imageUrl: "",
        sources: [],
        timeline: [],
        analysis: { stakeholders: [], faqs: [], future: [] },
        status: "draft",
        slug: form.title
          ? form.title.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "")
          : "",
        editorNotes: "",
      });

      // Refresh drafts list
      const updated = await fetchDrafts();
      setDrafts(updated);

      // Clear form
      setForm({ title: "", overview: "", category: "", subcategory: "" });

      // Navigate directly to Edit screen for this draft
      navigate(`/drafts/${id}`);
    } catch (err) {
      console.error("Error creating draft:", err);
      alert("Failed to create draft");
    } finally {
      setSaving(false);
    }
  };

  // Delete draft
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

  // Render loading state
  if (loading) return <div className="p-6">Loading drafts...</div>;

  // ----------------------------------------
  // ✅ UI
  // ----------------------------------------
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Drafts</h1>
      </div>

      {/* CREATE NEW DRAFT FORM */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Create New Draft</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            name="title"
            placeholder="Title"
            value={form.title}
            onChange={handleChange}
            className="border p-2 rounded"
          />
          <input
            name="category"
            placeholder="Category"
            value={form.category}
            onChange={handleChange}
            className="border p-2 rounded"
          />
          <input
            name="subcategory"
            placeholder="Subcategory"
            value={form.subcategory}
            onChange={handleChange}
            className="border p-2 rounded"
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
            {saving ? "Saving..." : "Create Draft"}
          </button>
        </form>
      </div>

      {/* LIST OF DRAFTS */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Existing Drafts</h2>

        {drafts.length === 0 ? (
          <p className="text-gray-500">No drafts yet.</p>
        ) : (
          <ul className="divide-y">
            {drafts.map((draft) => (
              <li
                key={draft.id}
                className="py-3 flex justify-between items-center hover:bg-gray-50 rounded-md px-2"
              >
                <div>
                  <p className="font-medium">{draft.title || "Untitled"}</p>
                  <p className="text-sm text-gray-500">
                    {draft.category} • {draft.status}
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
