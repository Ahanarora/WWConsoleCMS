import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

type OgResult = {
  imageUrl: string | null;
  width: number | null;
  height: number | null;
  source: "og" | "twitter" | "none";
};

export async function resolveOgImage(url: string): Promise<OgResult> {
  const fn = httpsCallable(functions, "resolveOgImage");
  const res: any = await fn({ url });
  return res.data as OgResult;
}
