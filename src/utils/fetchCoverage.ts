import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../firebase"; // your existing firebase.ts file

const functions = getFunctions(app, "asia-south1");

export async function fetchEventCoverage(eventText: string, description?: string) {
  const fn = httpsCallable(functions, "fetchEventCoverage");
  const res: any = await fn({ eventText, description });
  return res.data; // { imageUrl, sourceLink }
}
