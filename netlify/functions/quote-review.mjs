// Owner review page (link in the owner email). Adjust quantities or discount,
// add a note, then send the quote to the customer.
import { getRecord, saveRecord, verify, sign, sendEmail, htmlRes } from "../lib/services.mjs";
import { buildQuote, QTY_KEYS } from "../lib/pricebook.mjs";
import { sendQuote } from "../lib/process.mjs";
import { reviewPage, pageShell, photoRequestEmail } from "../lib/templates.mjs";

const KEYS = QTY_KEYS;

export default async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id"), t = url.searchParams.get("t");
  if (!verify("review", id, t)) return htmlRes(pageShell("Not found", "<h1>Link not valid</h1>"), 403);
  const rec = await getRecord(id);
  if (!rec) return htmlRes(pageShell("Not found", "<h1>Quote not found</h1>"), 404);

  const self = `/.netlify/functions/quote-review?id=${encodeURIComponent(id)}&t=${t}`;
  const photoUrl = (n) => `/.netlify/functions/quote-photo?id=${encodeURIComponent(id)}&n=${n}&t=${sign("review", id)}`;
  let message = "";

  if (req.method === "POST") {
    const f = new URLSearchParams(await req.text());
    const action = f.get("action");
    const locked = ["sent", "accepted", "declined"].includes(rec.status);
    if (!locked) {
      rec.qty = Object.fromEntries(KEYS.map((k) => [k, Math.max(0, parseInt(f.get(k) || "0", 10) || 0)]));
      rec.discountPct = Math.min(50, Math.max(0, parseFloat(f.get("discount") || "0") || 0));
      rec.customerNote = (f.get("note") || "").slice(0, 2000);
      rec.quote = buildQuote(rec.qty, rec.discountPct);
    }
    try {
      if (action === "send" && !locked) {
        if (!rec.quote.total) message = "Add at least one repair before sending.";
        else { await sendQuote(rec); message = `Quote sent to ${rec.request.email}.`; }
      } else if (action === "request_photos" && !locked) {
        const msg = (f.get("photo_message") || "").slice(0, 2000);
        await sendEmail({ to: rec.request.email, replyTo: process.env.OWNER_EMAIL, subject: `A few more photos for your quote (${rec.id})`, html: photoRequestEmail(rec, msg) });
        rec.status = "photos_requested";
        message = "Photo request emailed to the customer.";
      } else if (action === "decline" && !locked) {
        rec.status = "declined";
        message = "Marked as handled manually. Nothing was sent to the customer.";
      } else if (!locked) {
        message = "Quote updated.";
      }
    } catch (e) {
      console.error(e);
      message = "Something went wrong: " + e.message.slice(0, 200);
    }
    await saveRecord(rec);
  }
  const subCheckUrl = `/.netlify/functions/sub-check?id=${encodeURIComponent(id)}&t=${sign("subcheck", id)}`;
  const estimatorUrl = `/quote/?k=${sign("estimator", "staff")}`;
  const subsUrl = `/.netlify/functions/subs-admin?t=${sign("subsadmin", "staff")}`;
  return htmlRes(reviewPage(rec, { photoUrl, actionUrl: self, message, subCheckUrl, estimatorUrl, subsUrl }));
};
