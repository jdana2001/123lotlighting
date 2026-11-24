// Serves a customer photo to the owner review page (signed link only).
import { verify, getPhoto } from "../lib/services.mjs";

export default async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id"), n = parseInt(url.searchParams.get("n") || "-1", 10);
  const t = url.searchParams.get("t");
  if (!(verify("review", id, t) || verify("subphoto", id, t)) || n < 0 || n > 11) return new Response("Forbidden", { status: 403 });
  const buf = await getPhoto(id, n);
  if (!buf) return new Response("Not found", { status: 404 });
  return new Response(buf, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=86400" } });
};
