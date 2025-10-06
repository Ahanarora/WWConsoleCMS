import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

const draftsRef = collection(db, "drafts");

// --- Get all drafts ---
export async function fetchDrafts() {
  const snapshot = await getDocs(draftsRef);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// --- Get single draft by ID ---
export async function fetchDraft(id: string) {
  const ref = doc(db, "drafts", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Draft not found");
  return { id: snap.id, ...snap.data() };
}

// --- Add new draft ---
export async function createDraft(data: any) {
  const docRef = await addDoc(draftsRef, {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

// --- Update existing draft ---
export async function updateDraft(id: string, data: any) {
  const ref = doc(db, "drafts", id);
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
}

// --- Delete draft ---
export async function deleteDraft(id: string) {
  const ref = doc(db, "drafts", id);
  await deleteDoc(ref);
}
