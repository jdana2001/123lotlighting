// Customer accepts the quote (link in the quote email). Notifies the owner and
// moves the HubSpot deal to "Won: Job Approved".
import { getRecord, saveRecord, verify, sendEmail, ownerEmail, hubspotOn, hubspotWon, htmlRes, link } from "../lib/services.mjs";
import { mergeDrafts, checkerEmail } from "../lib/suborder.mjs";
import { loadSubs } from "../lib/subs.mjs";
import { RULES } from "../lib/pricebook.mjs";
import { acceptPage, pageShell, ownerAcceptedEmail } from "../lib/templates.mjs";

export default async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id"), t = url.searchParams.get("t");
  if (!verify("accept", id, t)) return htmlRes(pageShell("Not found", "<h1>Link not valid</h1>"), 403);
  const rec = await getRecord(id);
  if (!rec || !rec.sentAt) return htmlRes(pageShell("Not found", "<h1>Quote not found</h1>"), 404);

  const self = `/.netlify/functions/quote-accept?id=${encodeURIComponent(id)}&t=${t}`;
  const expired = Date.now() > Date.parse(rec.sentAt) + RULES.validDays * 864e5;

  if (req.method === "POST" && rec.status === "sent" && !expired) {
    const f = new URLSearchParams(await req.text());
    rec.status = "accepted";
    rec.acceptedAt = new Date().toISOString();
    rec.acceptedBy = (f.get("accepted_by") || rec.request.name).slice(0, 120);
    // Draft the sub work orders now; unsent bid-request drafts are replaced by work orders.
    rec.subOrders = mergeDrafts(rec, await loadSubs());
    await saveRecord(rec);
    const checkUrl = link("sub-check", "subcheck", rec.id, rec.origin);
    try { if (ownerEmail()) await sendEmail({ to: ownerEmail(), replyTo: rec.request.email, subject: `Accepted: quote ${rec.id} · $${Math.round(rec.quote.total)} · ${rec.request.company || rec.request.address}`, html: ownerAcceptedEmail(rec, checkUrl) }); }
    catch (e) { console.error(e); }
    const checkers = (process.env.CHECKER_EMAIL || "").split(",").map((s) => s.trim()).filter(Boolean);
    try { if (checkers.length && rec.subOrders.some((o) => o.status === "draft")) await sendEmail({ to: checkers, replyTo: ownerEmail() || undefined, subject: `Check sub paperwork: ${rec.request.company || rec.request.address} (${rec.id})`, html: checkerEmail(rec, checkUrl) }); }
    catch (e) { console.error(e); }
    if (hubspotOn()) { try { await hubspotWon(rec); } catch (e) { console.error(e); } }
  }
  return htmlRes(acceptPage(rec, { actionUrl: self, done: rec.status === "accepted", expired: expired && rec.status !== "accepted" }));
};
