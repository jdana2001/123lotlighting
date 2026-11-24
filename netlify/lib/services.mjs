// Storage (Netlify Blobs), signed links, email (Resend) and HubSpot helpers.
import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

// ---------- storage ----------
const store = () => getStore("quote-requests");

export async function saveRecord(rec) {
  rec.updatedAt = new Date().toISOString();
  await store().setJSON(`rec/${rec.id}`, rec);
}
export const getRecord = (id) => store().get(`rec/${id}`, { type: "json" });
export const savePhoto = (id, n, b64) => store().set(`photo/${id}/${n}`, Buffer.from(b64, "base64"));
export async function getPhoto(id, n) {
  const ab = await store().get(`photo/${id}/${n}`, { type: "arrayBuffer" });
  return ab ? Buffer.from(ab) : null;
}
// Subcontractor directory, edited on the Subs page (subs-admin).
export const getSubs = async () => (await store().get("config/subs", { type: "json" })) || null;
export const saveSubs = (subs) => store().setJSON("config/subs", subs);

// Pending index: requests waiting for (or stuck in) AI processing.
export const markPending = (id) => store().set(`pending/${id}`, new Date().toISOString());
export const clearPending = (id) => store().delete(`pending/${id}`);
export async function listPending() {
  const { blobs } = await store().list({ prefix: "pending/" });
  return blobs.map((b) => b.key.slice(8));
}

export function newId() {
  const d = new Date();
  const ymd = d.toISOString().slice(2, 10).replace(/-/g, "");
  return `Q${ymd}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

// ---------- signed links ----------
function secret() {
  const s = process.env.QUOTE_SECRET;
  if (!s) throw new Error("QUOTE_SECRET is not set");
  return s;
}
export const sign = (purpose, id) =>
  crypto.createHmac("sha256", secret()).update(`${purpose}:${id}`).digest("hex").slice(0, 40);
export function verify(purpose, id, token) {
  if (!id || !token) return false;
  const a = Buffer.from(sign(purpose, id)), b = Buffer.from(String(token));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export const siteUrl = () => (process.env.URL || "https://123lotlighting.com").replace(/\/$/, "");

/** Only trust request origins that belong to this site (production or its deploy previews). */
export function safeOrigin(origin) {
  try {
    const u = new URL(origin), main = new URL(siteUrl());
    const site = process.env.SITE_NAME || "123lotlighting";
    const ok = u.protocol === "https:" && (u.host === main.host || u.host === `www.${main.host}` ||
      u.host === `${site}.netlify.app` || u.host.endsWith(`--${site}.netlify.app`));
    return ok ? `${u.protocol}//${u.host}` : null;
  } catch { return null; }
}
export const link = (fn, purpose, id, base) =>
  `${base || siteUrl()}/.netlify/functions/${fn}?id=${encodeURIComponent(id)}&t=${sign(purpose, id)}`;

// ---------- email (Resend) ----------
export async function sendEmail({ to, subject, html, replyTo, bcc }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.QUOTE_FROM_EMAIL || "123 Lot Lighting <quotes@123lotlighting.com>",
      to: Array.isArray(to) ? to : [to],
      ...(bcc ? { bcc: Array.isArray(bcc) ? bcc : [bcc] } : {}),
      ...(replyTo ? { reply_to: replyTo } : {}),
      subject, html,
    }),
  });
  if (!res.ok) throw new Error(`Email failed ${res.status}: ${(await res.text()).slice(0, 300)}`);
}
export const ownerEmail = () => process.env.OWNER_EMAIL;

// ---------- HubSpot ----------
// Deal stages in the "123 Sales Pipeline"
export const STAGES = {
  photosReceived: process.env.HUBSPOT_STAGE_RECEIVED || "4551845571",
  quoteSent: process.env.HUBSPOT_STAGE_SENT || "4551845572",
  won: process.env.HUBSPOT_STAGE_WON || "4551845574",
};
export const hubspotOn = () => Boolean(process.env.HUBSPOT_TOKEN);

async function hs(method, path, body) {
  const res = await fetch(`https://api.hubapi.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.HUBSPOT_TOKEN}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`HubSpot ${method} ${path} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.status === 204 ? null : res.json();
}

const dealLabel = (services = []) => {
  const s = services.filter((x) => x !== "Not sure").map((x) => x.toLowerCase());
  return s.length ? s.slice(0, 3).join(", ") : "lighting";
};

/** Create or update the contact, then create a deal in "Photos Received". */
export async function hubspotCreateLead(rec) {
  const r = rec.request;
  const [firstname, ...rest] = (r.name || "").trim().split(/\s+/);
  const up = await hs("POST", "/crm/v3/objects/contacts/batch/upsert", {
    inputs: [{ idProperty: "email", id: r.email.toLowerCase(), properties: {
      email: r.email.toLowerCase(), firstname: r.first_name || firstname || "", lastname: r.last_name || rest.join(" "),
      phone: r.phone || "", company: r.company || "", address: r.address || "",
    } }],
  });
  const contactId = up.results[0].id;
  const deal = await hs("POST", "/crm/v3/objects/deals", {
    properties: {
      dealname: `${r.company || r.address} – ${dealLabel(r.services)} – 123 Lot Lighting (${rec.id})`,
      pipeline: "default", dealstage: STAGES.photosReceived,
      description: `123lotlighting.com quote request ${rec.id}\nAddress: ${r.address}\nServices: ${(r.services || []).join(", ")}${r.lighting ? `\nLighting: ${r.lighting.need}, ${r.lighting.poles} pole lights, ${r.lighting.walls} wall packs, ${r.lighting.out} out, ${r.lighting.damaged} damaged poles, ${r.lighting.signs} signs` : ""}${r.striping ? `\nStriping: ${r.striping.stalls} stalls, ${r.striping.ada} ADA, layout ${r.striping.layout}` : ""}${r.sealcoat ? `\nSealcoating: ${r.sealcoat.sqft} sq ft, ${r.sealcoat.coats} coat(s)` : ""}\nNotes: ${r.notes || ""}`,
    },
    associations: [{ to: { id: contactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 }] }],
  });
  return { contactId, dealId: deal.id };
}

/** Add the quote's line items to the deal and move it to "Quote Sent". */
export async function hubspotQuoteSent(rec, products) {
  const { dealId } = rec.hubspot || {};
  if (!dealId) return;
  for (const l of rec.quote.lines) {
    await hs("POST", "/crm/v3/objects/line_items", {
      properties: {
        ...(products[l.key]?.hubspotId ? { hs_product_id: products[l.key].hubspotId } : {}),
        name: l.name, quantity: String(l.qty),
        price: String(l.listPrice), hs_cost_of_goods_sold: String(products[l.key]?.cost ?? 0),
        ...(l.discountPct ? { hs_discount_percentage: String(l.discountPct) } : {}),
      },
      associations: [{ to: { id: dealId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 20 }] }],
    });
  }
  await hs("PATCH", `/crm/v3/objects/deals/${dealId}`, {
    properties: { dealstage: STAGES.quoteSent, amount: String(rec.quote.total) },
  });
}

export async function hubspotWon(rec) {
  const { dealId } = rec.hubspot || {};
  if (!dealId) return;
  await hs("PATCH", `/crm/v3/objects/deals/${dealId}`, {
    properties: { dealstage: STAGES.won, closedate: new Date().toISOString() },
  });
}

// ---------- responses ----------
export const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
export const htmlRes = (body, status = 200) =>
  new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
