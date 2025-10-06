import { useEffect, useState } from "react";
import { fetchDrafts, deleteDraft, createDraft } from "../utils/firestoreHelpers";
import DraftForm from "../components/DraftForm";
import type { DraftFormData } from "../components/DraftForm";
import Loader from "../components/Loader";
import { Link } from "react-router-dom";

export default function Drafts() {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  async function loadDrafts() {
    setLoading(true);
    const data = await fetchDrafts();
    setDrafts(data);
    setLoading(false);
  }

  useEffect(() => {
    loadDrafts();
  }, []);

  async function handleCreate(data: DraftFormData) {
    setCreating(true);
    await createDraft(data);
    setCreating(false);
    await loadDrafts();
  }

  async function handleDelete(id: string) {
    if (confirm("Delete this draft?")) {
      await deleteDraft(id);
      await loadDrafts();
    }
  }

  if (loading) return <Loader />;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Drafts</h1>

      <DraftForm onSubmit={handleCreate} isSubmitting={creating} />

      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-3">Existing Drafts</h2>
        {drafts.length === 0 && <p className="text-gray-500">No drafts yet.</p>}

        <ul className="space-y-3">
          {drafts.map((d) => (
            <li
              key={d.id}
              className="flex justify-between items-center bg-white rounded shadow p-3"
            >
              <div>
                <p className="font-medium">{d.title}</p>
                <p className="text-sm text-gray-500">{d.overview}</p>
              </div>
              <div className="space-x-2">
                <Link
                  to={`/drafts/${d.id}`}
                  className="text-blue-600 hover:underline"
                >
                  Edit
                </Link>
                <button
                  onClick={() => handleDelete(d.id)}
                  className="text-red-500 hover:underline"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
