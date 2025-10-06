import { useEffect, useState } from "react";
import { fetchDrafts, deleteDraft, createDraft } from "../utils/firestoreHelpers";
import DraftForm from "../components/DraftForm";
import type { DraftFormData } from "../components/DraftForm";
import DraftCard from "../components/DraftCard";
import Loader from "../components/Loader";
import { useToast } from "../hooks/useToast";

export default function Drafts() {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const { showToast, ToastContainer } = useToast();

  async function loadDrafts() {
    setLoading(true);
    try {
      const data = await fetchDrafts();
      setDrafts(data);
    } catch {
      showToast("Failed to fetch drafts.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDrafts();
  }, []);

  async function handleCreate(data: DraftFormData) {
    setCreating(true);
    try {
      await createDraft(data);
      showToast("Draft created successfully!", "success");
      await loadDrafts();
    } catch {
      showToast("Failed to create draft.", "error");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (confirm("Delete this draft?")) {
      try {
        await deleteDraft(id);
        showToast("Draft deleted.", "success");
        await loadDrafts();
      } catch {
        showToast("Delete failed.", "error");
      }
    }
  }

  return (
    <div className="space-y-8 relative">
      {ToastContainer}
      {(loading || creating) && <Loader />}

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
