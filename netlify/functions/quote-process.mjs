// Called by the browser right after submit (fire-and-forget). Runs the Claude
// assessment and emails the owner (or the customer, in auto mode).
import { verify, json } from "../lib/services.mjs";
import { processQuote } from "../lib/process.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let b;
  try { b = await req.json(); } catch { return json({ error: "Invalid request" }, 400); }
  if (!verify("process", b.id, b.k)) return json({ error: "Forbidden" }, 403);
  try {
    const rec = await processQuote(b.id);
    return json({ ok: true, status: rec?.status });
  } catch (e) {
    console.error(e);
    return json({ ok: false }, 500); // the scheduled sweep retries
  }
};
