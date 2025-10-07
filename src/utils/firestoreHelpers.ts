// src/utils/firestoreHelpers.ts
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase";

/**
 * Reference to the "drafts" collection in Firestore.
 */
const draftsCollection = collection(db, "drafts");

/**
 * Fetch all drafts from Firestore.
 */
export async function fetchDrafts() {
  try {
    const snapshot = await getDocs(draftsCollection);
    const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    console.log("Fetched drafts:", data);
    return data;
  } catch (error) {
    console.error("Error fetching drafts:", error);
    throw error;
  }
}

/**
 * Fetch a single draft by its document ID.
 */
export async function fetchDraft(id: string) {
  try {
    const docRef = doc(db, "drafts", id);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) throw new Error("Draft not found");
    return { id: snapshot.id, ...snapshot.data() };
  } catch (error) {
    console.error("Error fetching draft:", error);
    throw error;
  }
}

/**
 * Create a new draft in Firestore.
 */
export async function createDraft(data: any) {
  try {
    const docRef = await addDoc(draftsCollection, {
      ...data,
      createdAt: new Date(),
      status: "draft",
    });
    console.log("Draft created:", docRef.id);
    return docRef;
  } catch (error) {
    console.error("Error creating draft:", error);
    throw error;
  }
}

/**
 * Update an existing draft in Firestore.
 */
export async function updateDraft(id: string, data: any) {
  try {
    const docRef = doc(db, "drafts", id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: new Date(),
    });
    console.log("Draft updated:", id);
  } catch (error) {
    console.error("Error updating draft:", error);
    throw error;
  }
}

/**
 * Delete a draft from Firestore by ID.
 */
export async function deleteDraft(id: string) {
  try {
    await deleteDoc(doc(db, "drafts", id));
    console.log("Draft deleted:", id);
  } catch (error) {
    console.error("Error deleting draft:", error);
    throw error;
  }
}
