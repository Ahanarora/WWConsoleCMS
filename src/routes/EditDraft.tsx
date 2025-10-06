import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchDraft, updateDraft } from "../utils/firestoreHelpers";
import DraftForm from "../components/DraftForm";
import type { DraftFormData } from "../components/DraftForm";
import Loader from "../components/Loader";

export default function EditDraft() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      if (!id) return;
      const data = await fetchDraft(id);
      setDraft(data);
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleSubmit(data: DraftFormData) {
    if (!id) return;
    setSaving(true);
    await updateDraft(id, data);
    setSaving(false);
    navigate("/drafts");
  }

  if (loading) return <Loader />;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Edit Draft</h1>
      <DraftForm
        defaultValues={{ title: draft.title, overview: draft.overview }}
        onSubmit={handleSubmit}
        isSubmitting={saving}
      />
    </div>
  );
}
