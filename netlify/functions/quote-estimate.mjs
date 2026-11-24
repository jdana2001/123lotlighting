// Live price estimate for the lighting, striping and sealcoating calculators on /quote/.
// Staff only: needs the estimator key from the owner review page, so the
// public can't pull prices. Costs are never sent to the browser.
import { json, verify } from "../lib/services.mjs";
import { cleanStriping, cleanSealcoat, cleanLighting, qtyFromCalculators, buildQuote, publicLines, RULES } from "../lib/pricebook.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let b;
  try { b = await req.json(); } catch { return json({ error: "Invalid request" }, 400); }
  if (!verify("estimator", "staff", b.k)) return json({ error: "Forbidden" }, 403);
  const striping = b.striping ? cleanStriping(b.striping) : null;
  const sealcoat = b.sealcoat ? cleanSealcoat(b.sealcoat) : null;
  const lighting = b.lighting ? cleanLighting(b.lighting) : null;
  const q = buildQuote(qtyFromCalculators(striping, sealcoat, lighting), 0);
  return json({ ...publicLines(q), minimums: { striping: RULES.stripingMin, sealcoat: RULES.sealcoatMin, lighting: RULES.lightingMin } });
};
