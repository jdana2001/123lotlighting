// Runs every 10 minutes. Retries any request whose processing never started or
// stalled, so no quote request is ever lost.
import { listPending, getRecord, saveRecord, clearPending } from "../lib/services.mjs";
import { processQuote, notifyOwner } from "../lib/process.mjs";
import { buildQuote, emptyQty, qtyFromCalculators } from "../lib/pricebook.mjs";

const STALE_MS = 3 * 60 * 1000;

export default async () => {
  const ids = await listPending();
  for (const id of ids) {
    const rec = await getRecord(id);
    if (!rec || !["received", "processing"].includes(rec.status)) { await clearPending(id); continue; }
    const last = Date.parse(rec.processingAt || rec.createdAt);
    if (Date.now() - last < STALE_MS) continue;
    if ((rec.attempts || 0) >= 3) {
      // Give up on AI; send it to the owner to price by hand.
      rec.status = "review";
      rec.error = rec.error || "AI processing didn't finish after 3 tries";
      rec.qty = rec.qty || qtyFromCalculators(rec.request?.striping, rec.request?.sealcoat) || emptyQty();
      rec.quote = rec.quote || buildQuote(rec.qty, 0);
      await saveRecord(rec);
      await notifyOwner(rec);
      await clearPending(id);
      continue;
    }
    try { await processQuote(id); } catch (e) { console.error(e); }
    return new Response("ok"); // one per run keeps us inside the 30 s limit
  }
  return new Response("ok");
};

export const config = { schedule: "*/10 * * * *" };
