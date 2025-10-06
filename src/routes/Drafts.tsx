import { useEffect, useState } from "react";
import { fetchDrafts, deleteDraft, createDraft } from "../utils/firestoreHelpers";
import DraftForm from "../components/DraftForm";
import type { DraftFormData } from "../components/DraftForm";
import DraftCard from "../components/DraftCard";
import Loader from "../components/Loader";

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
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-gray-800">Drafts</h1>

      <section className="bg-gray-100 p-5 rounded-xl">
        <h2 className="font-semibold text-gray-700 mb-3">Create New Draft</h2>
        <DraftForm onSubmit={handleCreate} isSubmitting={creating} />
      </section>

      <section>
        <h2 className="font-semibold text-gray-700 mb-4">All Drafts</h2>
        {drafts.length === 0 ? (
          <p className="text-gray-500">No drafts yet.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {drafts.map((d) => (
              <DraftCard
                key={d.id}
                id={d.id}
                title={d.title}
                overview={d.overview}
                onDelete={() => handleDelete(d.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
