// src/routes/EditDraft.tsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchDraft, updateDraft } from "../utils/firestoreHelpers";

export default function EditDraft() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [overview, setOverview] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
        setTitle((data as any).title || "");
        setOverview((data as any).overview || "");
      } catch (e) {
        console.error(e);
        alert("Failed to load draft.");
        navigate("/drafts");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, navigate]);

  const handleSave = async () => {
    if (!id) return;
    if (!title.trim() || !overview.trim()) {
      alert("Please fill all fields.");
      return;
    }
    setSaving(true);
    try {
      await updateDraft(id, { title, overview });
      alert("Draft updated successfully!");
      navigate("/drafts");
    } catch (e) {
      console.error(e);
      alert("Failed to save draft.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="p-6 text-gray-600">Loading draft...</p>;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Edit Draft</h1>

      <div className="space-y-4">
        <div>
          <label className="block mb-1 text-sm font-medium text-gray-700">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="border border-gray-300 p-2 rounded w-full"
            placeholder="Enter title"
          />
        </div>

        <div>
          <label className="block mb-1 text-sm font-medium text-gray-700">Overview</label>
          <textarea
            value={overview}
            onChange={(e) => setOverview(e.target.value)}
            rows={5}
            className="border border-gray-300 p-2 rounded w-full"
            placeholder="Write a short summary"
          />
        </div>

        <div className="flex gap-4 mt-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>

          <button
            onClick={() => navigate("/drafts")}
            className="border px-4 py-2 rounded hover:bg-gray-100"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
