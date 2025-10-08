// -----------------------------
// src/routes/Drafts.tsx
// -----------------------------

import React, { useState, useEffect } from "react";
import { createDraft, fetchDrafts, deleteDraft } from "../utils/firestoreHelpers";
import { useNavigate } from "react-router-dom";

/**
 * Drafts.tsx
 * - Shows a form for creating new drafts
 * - Lists existing drafts with Edit/Delete options
 * - Redirects to EditDraft.tsx after creation
 */
export default function Drafts() {
  const [formData, setFormData] = useState({
    title: "",
    overview: "",
    category: "",
    subcategory: "",
    tags: "",
    status: "draft",
    significance: 1,
  });

  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Fetch all drafts when page loads
  useEffect(() => {
    const load = async () => {
      try {
        const list = await fetchDrafts();
        // Sort drafts by most recent
        list.sort((a: any, b: any) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
        setDrafts(list);
      } catch (err) {
        console.error(err);
        alert("Failed to fetch drafts.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  /**
   * Handle input changes in the form
   */
  const handleChange = (e: any) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  /**
   * Create a new draft and redirect to Edit page
   */
  const handleSubmit = async (e: any) => {
    e.preventDefault();
    try {
      const id = await createDraft({
        ...formData,
        tags: formData.tags.split(",").map((t) => t.trim()),
      });
      alert("✅ Draft created successfully!");
      navigate(`/drafts/${id}`); // Go directly to Edit interface
    } catch (err) {
      console.error(err);
      alert("❌ Failed to create draft.");
    }
  };

  /**
   * Delete a draft
   */
  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this draft?")) return;
    try {
      await deleteDraft(id);
      setDrafts((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      console.error(err);
      alert("❌ Failed to delete draft.");
    }
  };

  // -------------------- UI --------------------
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">📰 Draft Management</h1>

      {/* ---------- Create New Draft Form ---------- */}
      <div className="bg-white p-6 rounded-lg shadow border border-gray-200 mb-8">
        <h2 className="text-xl font-semibold mb-4">Create New Draft</h2>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            name="title"
            placeholder="Title"
            value={formData.title}
            onChange={handleChange}
            required
            className="border rounded p-2 w-full"
          />
          <input
            name="category"
            placeholder="Category"
            value={formData.category}
            onChange={handleChange}
            className="border rounded p-2 w-full"
          />
          <input
            name="subcategory"
            placeholder="Subcategory"
            value={formData.subcategory}
            onChange={handleChange}
            className="border rounded p-2 w-full"
          />
          <input
            name="tags"
            placeholder="Tags (comma separated)"
            value={formData.tags}
            onChange={handleChange}
            className="border rounded p-2 w-full"
          />
          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="border rounded p-2 w-full"
          >
            <option value="draft">Draft</option>
            <option value="review">Review</option>
            <option value="published">Published</option>
          </select>
          <select
            name="significance"
            value={formData.significance}
            onChange={handleChange}
            className="border rounded p-2 w-full"
          >
            <option value={1}>1 (Low)</option>
            <option value={2}>2 (Medium)</option>
            <option value={3}>3 (High)</option>
          </select>
          <textarea
            name="overview"
            placeholder="Overview"
            value={formData.overview}
            onChange={handleChange}
            rows={3}
            className="border rounded p-2 w-full md:col-span-2"
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 md:col-span-2"
          >
            + Create Draft
          </button>
        </form>
      </div>

      {/* ---------- Existing Drafts Table ---------- */}
      <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
        <h2 className="text-xl font-semibold mb-4">Existing Drafts</h2>

        {loading ? (
          <p>Loading drafts...</p>
        ) : drafts.length === 0 ? (
          <p className="text-gray-600">No drafts yet.</p>
        ) : (
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b bg-gray-50 text-sm text-gray-700">
                <th className="p-2">Title</th>
                <th className="p-2">Category</th>
                <th className="p-2">Status</th>
                <th className="p-2">Significance</th>
                <th className="p-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((d) => (
                <tr key={d.id} className="border-b hover:bg-gray-50 text-sm">
                  <td className="p-2">{d.title || "Untitled"}</td>
                  <td className="p-2">{d.category || "-"}</td>
                  <td className="p-2">{d.status}</td>
                  <td className="p-2">{d.significance}</td>
                  <td className="p-2 text-right space-x-2">
                    <button
                      onClick={() => navigate(`/drafts/${d.id}`)}
                      className="text-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(d.id)}
                      className="text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
