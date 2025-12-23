//src/components/TagInput.tsx

import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import {
  arrayUnion,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { dedupeTags, normalizeTag } from "../utils/tags";

interface Props {
  value?: string[];
  onChange: (tags: string[]) => void;
}

export default function TagInput({ value = [], onChange }: Props) {
  const [input, setInput] = useState("");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Keep allTags updated with any tags already on the record
  useEffect(() => {
    setAllTags((prev) => dedupeTags([...prev, ...value]));
  }, [value]);

  // Persist any existing tags for this record to the global system/tags doc
  useEffect(() => {
    const persist = async () => {
      const tokens = dedupeTags(value);
      if (!tokens.length) return;
      const ref = doc(db, "system", "tags");
      try {
        await setDoc(ref, { list: arrayUnion(...tokens) }, { merge: true });
      } catch (err) {
        try {
          await updateDoc(ref, { list: arrayUnion(...tokens) });
        } catch (err2) {
          console.error("Failed to persist existing tags to system/tags:", err2);
        }
      }
    };
    persist();
  }, [value]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const ref = doc(db, "system", "tags");
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const list = snap.data()?.list;
          if (Array.isArray(list)) {
            setAllTags((prev) => dedupeTags([...(list as string[]), ...prev, ...value]));
          }
        } else {
          // create empty doc so arrayUnion works later
          await setDoc(ref, { list: [] });
        }
      } catch (err) {
        console.error("Failed to load tags:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const source = (allTags || []).filter((t) => !value.includes(t));
    if (!input) return source.slice(0, 10);
    const q = normalizeTag(input);
    return source.filter((t) => normalizeTag(t).includes(q));
  }, [input, allTags, value]);

  const addTag = async (raw: string) => {
    const tokens = raw
      .split(",")
      .map((t) => normalizeTag(t))
      .filter(Boolean);
    if (!tokens.length) return;

    const newTags = dedupeTags([...value, ...tokens]);
    onChange(newTags);

    // Ensure system/tags exists and merge tags
    const ref = doc(db, "system", "tags");
    try {
      await setDoc(ref, { list: arrayUnion(...tokens) }, { merge: true });
    } catch (err) {
      // Fallback to updateDoc if setDoc with arrayUnion fails (older SDK behavior)
      try {
        await updateDoc(ref, { list: arrayUnion(...tokens) });
      } catch (err2) {
        console.error("Failed to persist tag in system/tags:", err2);
      }
    }

    setAllTags((prev) => dedupeTags([...prev, ...tokens]));
    setInput("");
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  return (
    <div className="w-full">
      <label className="text-sm font-medium mb-1 block">Tags</label>

      {/* Selected tags */}
      <div className="flex flex-wrap gap-2 mb-2">
        {value.map((tag) => (
          <span
            key={tag}
            className="px-2 py-1 bg-gray-200 rounded text-xs flex items-center gap-1"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-red-500"
              aria-label={`Remove ${tag}`}
            >
              ✕
            </button>
          </span>
        ))}
      </div>

      {/* Input box */}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addTag(input);
          }
        }}
        onBlur={() => addTag(input)}
        placeholder="Type to add tag…"
        className="border px-2 py-2 rounded w-full"
        disabled={loading}
      />

      {/* Dropdown */}
      {filtered.length > 0 && (
        <div className="border rounded mt-1 bg-white shadow p-1 max-h-40 overflow-auto">
          {filtered.map((t) => (
            <div
              key={t}
              className="px-2 py-1 hover:bg-gray-100 cursor-pointer"
              onClick={() => addTag(t)}
            >
              {t}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
