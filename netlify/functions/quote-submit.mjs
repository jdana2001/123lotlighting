// POST from the /quote/ form. Saves the request and photos, then returns a key
// the browser uses to start processing. Fast: no AI work happens here.
import { saveRecord, savePhoto, markPending, newId, sign, json, safeOrigin } from "../lib/services.mjs";
import { cleanStriping, cleanSealcoat, cleanLighting } from "../lib/pricebook.mjs";

const MAX_PHOTOS = 12;
const MAX_PHOTO_CHARS = 2_500_000; // ~1.8 MB per resized photo
const clean = (v, n = 300) => String(v ?? "").trim().slice(0, n);

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let b;
  try { b = await req.json(); } catch { return json({ error: "Invalid request" }, 400); }

  const services = (Array.isArray(b.services) ? b.services : []).slice(0, 12).map((s) => clean(s, 60));
  const request = {
    first_name: clean(b.first_name, 60), last_name: clean(b.last_name, 60),
    name: clean(`${clean(b.first_name, 60)} ${clean(b.last_name, 60)}`.trim() || b.name, 120), company: clean(b.company, 160), email: clean(b.email, 200).toLowerCase(),
    phone: clean(b.phone, 40), address: clean(b.address, 300), property_type: clean(b.property_type, 40),
    timing: clean(b.timing, 40), notes: clean(b.notes, 3000), services,
    pothole_total: Math.min(500, Math.max(0, parseInt(b.pothole_total, 10) || 0)),
    striping: services.includes("Striping") ? cleanStriping(b.striping) : null,
    sealcoat: services.includes("Sealcoating") ? cleanSealcoat(b.sealcoat) : null,
    lighting: services.includes("Lighting") ? cleanLighting(b.lighting) : null,
  };
  if (!request.first_name || !request.last_name || !request.address || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(request.email)) {
    return json({ error: "Please fill in your first and last name, a valid email and the property address." }, 400);
  }

  // Photos arrive as one flat list. photoGroups says which photos belong
  // together: one "pothole" group per pothole card, plus optional "overview",
  // "striping", "sealcoat", "lighting" and "other" photos.
  const raw = Array.isArray(b.photos) ? b.photos : [];
  const keep = [];      // original index -> stored index
  const photos = [];
  raw.forEach((p, i) => {
    if (photos.length < MAX_PHOTOS && typeof p === "string" && p.length > 100 && p.length < MAX_PHOTO_CHARS) {
      keep[i] = photos.length;
      photos.push(p);
    }
  });
  const photoGroups = (Array.isArray(b.photoGroups) ? b.photoGroups : []).slice(0, 20).map((g) => ({
    type: ["overview", "striping", "sealcoat", "lighting", "other"].includes(g?.type) ? g.type : "pothole",
    note: clean(g?.note, 200),
    size: ["pizza", "door", "bigger", "stall"].includes(g?.size) ? g.size : "",
    photos: (Array.isArray(g?.photos) ? g.photos : []).map((i) => keep[i]).filter((i) => Number.isInteger(i)),
  })).filter((g) => g.photos.length || (g.type === "pothole" && (g.note || g.size)));
  request.photoGroups = photoGroups;

  const id = newId();
  for (let i = 0; i < photos.length; i++) await savePhoto(id, i, photos[i]);
  await saveRecord({ id, createdAt: new Date().toISOString(), status: "received", request, photoCount: photos.length, flags: [], origin: safeOrigin(new URL(req.url).origin) });
  await markPending(id);

  return json({ ok: true, id, k: sign("process", id) });
};
