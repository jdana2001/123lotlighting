// Checker page for sub paperwork (link in the "ready to check" email and on the
// owner review page). Edit the drafted orders, tick the checklist, send to subs.
import { getRecord, saveRecord, verify, sign, sendEmail, ownerEmail, siteUrl, htmlRes } from "../lib/services.mjs";
import { pageShell } from "../lib/templates.mjs";
import { loadSubs } from "../lib/subs.mjs";
import { mergeDrafts, subCheckPage, subOrderEmail, subDocId, orderCode, CHECKS } from "../lib/suborder.mjs";

const clean = (v, n) => String(v ?? "").trim().slice(0, n);
const okEmail = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

export default async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id"), t = url.searchParams.get("t");
  if (!verify("subcheck", id, t)) return htmlRes(pageShell("Not found", "<h1>Link not valid</h1>"), 403);
  const rec = await getRecord(id);
  if (!rec) return htmlRes(pageShell("Not found", "<h1>Quote not found</h1>"), 404);

  const base = rec.origin || undefined;
  const self = `/.netlify/functions/sub-check?id=${encodeURIComponent(id)}&t=${t}`;
  const docUrl = (o, preview) => `/.netlify/functions/sub-doc?id=${encodeURIComponent(subDocId(rec, o))}&t=${sign("subdoc", subDocId(rec, o))}${preview ? "&preview=1" : ""}`;
  let message = "";

  const subs = await loadSubs();
  if (!rec.subOrders?.length) { rec.subOrders = mergeDrafts(rec, subs); await saveRecord(rec); }

  if (req.method === "POST") {
    const f = new URLSearchParams(await req.text());
    const action = f.get("action");
    if (action === "redraft") {
      rec.subOrders = mergeDrafts({ ...rec, subOrders: rec.subOrders.filter((o) => o.status !== "draft") }, subs);
      message = "Unsent orders rebuilt from the current quote.";
    } else {
      const o = rec.subOrders.find((x) => String(x.n) === f.get("n"));
      if (!o) message = "Order not found.";
      else if (action === "reopen") {
        o.status = "draft"; o.response = null; o.checks = {};
        o.history.push({ at: new Date().toISOString(), what: "Reopened" });
        message = `${orderCode(rec, o)} reopened. The old link stops accepting responses until you send again.`;
      } else if (o.status === "draft") {
        o.mode = f.get("mode") === "bid" ? "bid" : "work";
        o.subName = clean(f.get("subName"), 120);
        o.subEmail = clean(f.get("subEmail"), 200).toLowerCase();
        o.window = clean(f.get("window"), 120);
        o.siteNotes = clean(f.get("siteNotes"), 2000);
        o.checkedBy = clean(f.get("checkedBy"), 80);
        for (const l of o.lines) {
          l.qty = Math.max(0, parseInt(f.get(`qty_${l.key}`) || "0", 10) || 0);
          l.rate = Math.max(0, Math.round((parseFloat(f.get(`rate_${l.key}`) || "0") || 0) * 100) / 100);
        }
        o.checks = Object.fromEntries(CHECKS.map(([k]) => [k, f.get(`chk_${k}`) === "on"]));
        if (action === "send") {
          const missing = [];
          if (!okEmail(o.subEmail)) missing.push("a valid sub email");
          if (!o.checkedBy) missing.push("who checked it");
          if (CHECKS.some(([k]) => !o.checks[k])) missing.push("every checklist box");
          if (o.mode === "work" && o.lines.some((l) => l.qty && !l.rate)) missing.push("a rate on every line");
          if (!o.lines.some((l) => l.qty)) missing.push("at least one line with a quantity");
          if (missing.length) message = `Not sent. Still needs ${missing.join(", ")}.`;
          else {
            try {
              const subUrl = `${base || siteUrl()}${docUrl(o, false)}`;
              await sendEmail({ to: o.subEmail, replyTo: ownerEmail() || undefined, bcc: ownerEmail() || undefined,
                subject: `${o.mode === "work" ? "Work order" : "Bid request"} ${orderCode(rec, o)}: ${rec.request.address}`,
                html: subOrderEmail(rec, o, subUrl) });
              o.status = "sent"; o.sentAt = new Date().toISOString();
              o.history.push({ at: o.sentAt, what: `Sent to ${o.subEmail}, checked by ${o.checkedBy}` });
              message = `${orderCode(rec, o)} sent to ${o.subEmail}.`;
            } catch (e) { console.error(e); message = "Email failed: " + e.message.slice(0, 160); }
          }
        } else message = "Saved.";
      } else message = "Already sent. Reopen it to make changes.";
    }
    await saveRecord(rec);
  }
  const reviewUrl = `/.netlify/functions/quote-review?id=${encodeURIComponent(id)}&t=${sign("review", id)}`;
  const subsUrl = `/.netlify/functions/subs-admin?t=${sign("subsadmin", "staff")}`;
  return htmlRes(subCheckPage(rec, { actionUrl: self, docUrl, reviewUrl, subsUrl, message, subs }));
};
