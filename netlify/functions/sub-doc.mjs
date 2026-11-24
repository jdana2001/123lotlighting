// The sub's page: work order or bid request, with accept / bid form.
// id is "<quote id>.<order number>", signed with purpose "subdoc".
import { getRecord, saveRecord, verify, sign, sendEmail, ownerEmail, htmlRes } from "../lib/services.mjs";
import { pageShell } from "../lib/templates.mjs";
import { subDocPage, subResponseEmail } from "../lib/suborder.mjs";

const clean = (v, n) => String(v ?? "").trim().slice(0, n);

export default async (req) => {
  const url = new URL(req.url);
  const sid = url.searchParams.get("id") || "", t = url.searchParams.get("t");
  if (!verify("subdoc", sid, t)) return htmlRes(pageShell("Not found", "<h1>Link not valid</h1>"), 403);
  const [id, nStr] = sid.split(".");
  const rec = await getRecord(id);
  const o = rec?.subOrders?.find((x) => String(x.n) === nStr);
  if (!o) return htmlRes(pageShell("Not found", "<h1>Order not found</h1>"), 404);

  const preview = url.searchParams.get("preview") === "1";
  const photoUrl = (i) => `/.netlify/functions/quote-photo?id=${encodeURIComponent(id)}&n=${i}&t=${sign("subphoto", id)}`;
  const self = `/.netlify/functions/sub-doc?id=${encodeURIComponent(sid)}&t=${t}`;
  let message = "";

  if (req.method === "POST" && !preview && o.status === "sent" && !o.response) {
    const f = new URLSearchParams(await req.text());
    const resp = { name: clean(f.get("name"), 120), start: clean(f.get("start"), 80), notes: clean(f.get("notes"), 2000), at: new Date().toISOString() };
    if (o.mode === "bid") {
      resp.prices = Object.fromEntries(o.lines.map((l) => [l.key, Math.max(0, Math.round((parseFloat(f.get(`price_${l.key}`) || "0") || 0) * 100) / 100)]));
      resp.total = Math.round(o.lines.reduce((s, l) => s + l.qty * (resp.prices[l.key] || 0), 0) * 100) / 100;
    }
    if (!resp.name) message = "Please enter your name.";
    else {
      o.response = resp;
      o.status = o.mode === "work" ? "accepted" : "bid_received";
      o.history.push({ at: resp.at, what: o.mode === "work" ? `Accepted by ${resp.name}` : `Bid ${resp.total} from ${resp.name}` });
      await saveRecord(rec);
      const checkUrl = `${rec.origin || process.env.URL || "https://123lotlighting.com"}/.netlify/functions/sub-check?id=${encodeURIComponent(id)}&t=${sign("subcheck", id)}`;
      const to = [ownerEmail(), ...(process.env.CHECKER_EMAIL || "").split(",")].map((s) => (s || "").trim()).filter(Boolean);
      try { if (to.length) await sendEmail({ to: [...new Set(to)], replyTo: o.subEmail, subject: `${o.mode === "work" ? "Sub accepted" : "Bid received"}: ${rec.request.address}`, html: subResponseEmail(rec, o, checkUrl) }); }
      catch (e) { console.error(e); }
      message = o.mode === "work" ? "Thanks, the job is confirmed. We'll send site access details if needed." : "Thanks, your bid is in.";
    }
  }
  return htmlRes(subDocPage(rec, o, { photoUrl, actionUrl: self, message, preview }));
};
