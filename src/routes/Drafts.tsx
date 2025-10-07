import React, { useEffect, useState } from "react";
import { fetchDrafts, createDraft, deleteDraft } from "../utils/firestoreHelpers";

export default function Drafts() {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [overview, setOverview] = useState("");

  // ✅ Fetch drafts on mount
  useEffect(() => {
    const loadDrafts = async () => {
      try {
        const data = await fetchDrafts();
        setDrafts(data);
      } catch (err) {
        console.error("Error loading drafts:", err);
      } finally {
        setLoading(false);
      }
    };
    loadDrafts();
  }, []);

  // ✅ Create new draft
  const handleCreate = async () => {
    if (!title.trim() || !overview.trim()) return alert("Please fill all fields");
    setCreating(true);
    try {
      await createDraft({ title, overview });
      setTitle("");
      setOverview("");
      const updated = await fetchDrafts();
      setDrafts(updated);
    } catch (err) {
      console.error("Error creating draft:", err);
      alert("Failed to create draft");
    } finally {
      setCreating(false);
    }
  };

  // ✅ Delete draft
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this draft?")) return;
    await deleteDraft(id);
    const updated = await fetchDrafts();
    setDrafts(updated);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Drafts</h1>

      {/* Create New Draft */}
      <div className="space-y-2 mb-6">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="border p-2 rounded w-full"
        />
        <textarea
          value={overview}
          onChange={(e) => setOverview(e.target.value)}
          placeholder="Overview"
          className="border p-2 rounded w-full"
          rows={3}
        />
        <button
          onClick={handleCreate}
          disabled={creating}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {creating ? "Creating..." : "Create Draft"}
        </button>
      </div>

      {/* Drafts List */}
      {loading ? (
        <p>Loading drafts...</p>
      ) : drafts.length === 0 ? (
        <p className="text-gray-500">No drafts found.</p>
      ) : (
        <ul className="space-y-3">
          {drafts.map((d) => (
            <li
              key={d.id}
              className="border p-4 rounded flex justify-between items-center"
            >
              <div>
                <h2 className="font-semibold">{d.title}</h2>
                <p className="text-sm text-gray-600">{d.overview}</p>
              </div>
              <button
                onClick={() => handleDelete(d.id)}
                className="text-red-600 hover:underline"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
