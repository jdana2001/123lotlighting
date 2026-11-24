// Price book (copied from 123 Pothole Repair and 123 Lot Striping, plus lighting; keep the shared prices in sync). Keep in sync with the HubSpot product library
// (prices and unit costs) — Claude never sets prices; this file does.
//
// Striping and sealcoating prices are PLACEHOLDERS drafted from 2026 market
// rates (Chicago end of national ranges). Replace them with sub quotes.
// Products without a hubspotId are added to deals as plain line items.

export const PRODUCTS = {
  // Pothole repair (sized by Claude from photos)
  POT_S:  { group: "pothole", sku: "POT-S",  name: "Pothole patch – Small",    desc: "up to 2×2 ft, up to 3 in deep", unit: "ea",     price: 175, cost: 85,  hubspotId: "348667882178", discountable: true },
  POT_M:  { group: "pothole", sku: "POT-M",  name: "Pothole patch – Standard", desc: "up to 4×4 ft, up to 3 in deep", unit: "ea",     price: 275, cost: 140, hubspotId: "348550818545", discountable: true },
  POT_L:  { group: "pothole", sku: "POT-L",  name: "Pothole patch – Large",    desc: "up to 6×6 ft, up to 4 in deep", unit: "ea",     price: 425, cost: 225, hubspotId: "348536452802", discountable: true },
  SAW_SF: { group: "pothole", sku: "SAW-SF", name: "Saw-cut patch",            desc: "remove & replace, per sq ft",   unit: "sq ft",  price: 14,  cost: 8,   hubspotId: "348547210976", discountable: true },
  CRK_LF: { group: "pothole", sku: "CRK-LF", name: "Crack sealing",            desc: "hot-pour, per linear ft",       unit: "lin ft", price: 2,   cost: 1,   hubspotId: "348658937590", discountable: true },

  // Striping (calculator, from the customer's counts) — placeholder prices
  STR_STALL:  { group: "striping", sku: "STR-STALL",  name: "Restripe parking stalls",     desc: "standard stall, existing layout",               unit: "stall",  price: 8,    cost: 3.5,  discountable: true },
  STR_LAYOUT: { group: "striping", sku: "STR-LAYOUT", name: "New stall layout",            desc: "measure & mark new or changed layout, per stall", unit: "stall", price: 6,    cost: 2.5,  discountable: true },
  STR_ADA:    { group: "striping", sku: "STR-ADA",    name: "ADA accessible stall",        desc: "stall, hatched access aisle, wheelchair symbol", unit: "stall",  price: 95,   cost: 40,   discountable: true },
  STR_SIGN:   { group: "striping", sku: "STR-SIGN",   name: "ADA parking sign, installed", desc: "sign on new post",                                unit: "ea",     price: 250,  cost: 120,  discountable: true },
  STR_NUM:    { group: "striping", sku: "STR-NUM",    name: "Stall numbers",               desc: "stenciled number in each stall",                  unit: "stall",  price: 5,    cost: 2,    discountable: true },
  STR_ARROW:  { group: "striping", sku: "STR-ARROW",  name: "Directional arrow",           desc: "painted stencil",                                 unit: "ea",     price: 30,   cost: 10,   discountable: true },
  STR_STOP:   { group: "striping", sku: "STR-STOP",   name: "Stop bar with STOP text",     desc: "painted",                                         unit: "ea",     price: 55,   cost: 20,   discountable: true },
  STR_XWALK:  { group: "striping", sku: "STR-XWALK",  name: "Crosswalk",                   desc: "up to 24 ft, painted",                            unit: "ea",     price: 110,  cost: 45,   discountable: true },
  STR_WORD:   { group: "striping", sku: "STR-WORD",   name: "Stenciled words",             desc: "FIRE LANE, NO PARKING, RESERVED, etc.",          unit: "ea",     price: 45,   cost: 15,   discountable: true },
  STR_CURB:   { group: "striping", sku: "STR-CURB",   name: "Curb / fire lane painting",   desc: "yellow or red, per linear ft",                    unit: "lin ft", price: 1.75, cost: 0.7,  discountable: true },

  // Sealcoating (calculator, from the customer's measured area) — placeholder prices
  SEAL_1:  { group: "sealcoat", sku: "SEAL-1",  name: "Sealcoating – 1 coat",  desc: "clean, edge and seal, per sq ft",          unit: "sq ft", price: 0.20, cost: 0.11, discountable: true },
  SEAL_2:  { group: "sealcoat", sku: "SEAL-2",  name: "Sealcoating – 2 coats", desc: "clean, edge and seal (2 coats), per sq ft", unit: "sq ft", price: 0.30, cost: 0.17, discountable: true },

  // Lighting (calculator, from the customer's fixture counts) — PLACEHOLDER prices
  // drafted from 2026 market rates. Replace them with electrician sub quotes.
  LT_REPAIR:   { group: "lighting", sku: "LT-REPAIR",   name: "Light repair",                  desc: "diagnose and fix one fixture (lamp, ballast/driver, photocell), lift included", unit: "fixture", price: 325,  cost: 175,  discountable: true },
  LT_LED_POLE: { group: "lighting", sku: "LT-LED-POLE", name: "LED pole light, installed",     desc: "replace one pole-mounted head with an LED fixture, lift included",           unit: "fixture", price: 950,  cost: 575,  discountable: true },
  LT_LED_WALL: { group: "lighting", sku: "LT-LED-WALL", name: "LED wall pack, installed",      desc: "replace one building-mounted light with an LED wall pack",                  unit: "fixture", price: 450,  cost: 260,  discountable: true },
  LT_CTRL:     { group: "lighting", sku: "LT-CTRL",     name: "Lighting controls",             desc: "photocell or timer replaced and set, per circuit",                         unit: "circuit", price: 275,  cost: 140,  discountable: true },
  LT_POLE:     { group: "lighting", sku: "LT-POLE",     name: "Light pole replacement",        desc: "remove damaged pole, set new pole on existing base, rehang fixture",       unit: "pole",    price: 4200, cost: 2900, discountable: true },
  LT_SIGN:     { group: "lighting", sku: "LT-SIGN",     name: "Lighted sign repair",           desc: "LED retrofit or repair, per sign face",                                    unit: "face",    price: 650,  cost: 360,  discountable: true },

  // Charges added automatically by buildQuote
  TRIP:     { group: "fee", sku: "MOB",     name: "Trip charge",       desc: "pothole jobs under $400",  unit: "ea", price: 95, cost: 40, hubspotId: "348658937591", discountable: false },
  MIN_STR:  { group: "fee", sku: "MIN-STR", name: "Striping minimum",  desc: "brings striping to the job minimum",  unit: "ea", price: 0, cost: 0, discountable: false },
  MIN_SEAL: { group: "fee", sku: "MIN-SEAL", name: "Sealcoating minimum", desc: "brings sealcoating to the job minimum", unit: "ea", price: 0, cost: 0, discountable: false },
  MIN_LT:   { group: "fee", sku: "MIN-LT",  name: "Lighting minimum",  desc: "brings lighting work to the job minimum (lift and electrician trip)", unit: "ea", price: 0, cost: 0, discountable: false },
};

export const RULES = {
  sawMinSqft: 50,      // saw-cut jobs bill at least this many sq ft
  tripUnder: 400,      // trip charge added when pothole work (after discount) is below this and nothing else is on the job
  stripingMin: 450,    // striping subtotal is brought up to at least this
  sealcoatMin: 850,    // sealcoating subtotal is brought up to at least this
  lightingMin: 495,    // lighting subtotal is brought up to at least this (covers the lift and the trip)
  crackLfPer100Sqft: { none: 0, some: 1, lots: 3 }, // crack filling estimate before sealcoating
  nteFactor: 1.25,     // not-to-exceed = total × this, rounded up to $25
  validDays: 30,
};

/** Product keys a person can set a quantity for (everything except fees). */
export const QTY_KEYS = Object.keys(PRODUCTS).filter((k) => PRODUCTS[k].group !== "fee");
export const emptyQty = () => Object.fromEntries(QTY_KEYS.map((k) => [k, 0]));

/** The customer's optional size guess on each pothole card, and the tier it suggests. */
export const SIZE_GUESSES = {
  pizza:  { label: "smaller than a pizza box",        tier: "small" },
  door:   { label: "about the size of a car door",     tier: "standard" },
  bigger: { label: "bigger than a car door",           tier: "large" },
  stall:  { label: "most of a parking space, or more", tier: "saw_cut" },
};

export const GROUP_LABELS = { pothole: "Pothole & crack repair", striping: "Striping", sealcoat: "Sealcoating", lighting: "Lighting" };

const TIER_TO_KEY = { small: "POT_S", standard: "POT_M", large: "POT_L" };
const int = (v, max = 5_000_000) => Math.min(max, Math.max(0, Math.round(Number(v) || 0)));

/** Turn Claude's assessment into product quantities. */
export function qtyFromAssessment(a) {
  const q = emptyQty();
  for (const h of a?.potholes || []) {
    if (TIER_TO_KEY[h.tier]) q[TIER_TO_KEY[h.tier]] += 1;
    else if (h.tier === "saw_cut") q.SAW_SF += Math.ceil(Number(h.saw_cut_sqft) || 0);
  }
  q.CRK_LF = Math.ceil(Number(a?.crack_seal_linear_ft) || 0);
  return q;
}

/** Clean the striping calculator inputs from the form. */
export function cleanStriping(s) {
  if (!s || typeof s !== "object") return null;
  return {
    stalls: int(s.stalls, 5000),
    layout: s.layout === "new" ? "new" : "existing",
    ada: int(s.ada, 200),
    signs: int(s.signs, 200),
    numbered: Boolean(s.numbered),
    arrows: int(s.arrows, 500),
    stops: int(s.stops, 200),
    crosswalks: int(s.crosswalks, 200),
    words: int(s.words, 500),
    curb_lf: int(s.curb_lf, 50000),
  };
}

/** Clean the sealcoating calculator inputs from the form. */
export function cleanSealcoat(s) {
  if (!s || typeof s !== "object") return null;
  const outline = Array.isArray(s.outline)
    ? s.outline.slice(0, 200).map((p) => [Number(p[0]), Number(p[1])]).filter((p) => p.every(Number.isFinite))
    : [];
  return {
    sqft: int(s.sqft, 2_000_000),
    measured: s.measured === "map" ? "map" : "typed",
    coats: Number(s.coats) === 1 ? 1 : 2,
    cracks: ["none", "some", "lots"].includes(s.cracks) ? s.cracks : "none",
    outline,
  };
}

/** Clean the lighting calculator inputs from the form. */
export function cleanLighting(l) {
  if (!l || typeof l !== "object") return null;
  return {
    need: ["repair", "upgrade", "advise"].includes(l.need) ? l.need : "advise",
    poles: int(l.poles, 1000),
    walls: int(l.walls, 1000),
    out: int(l.out, 2000),
    damaged: int(l.damaged, 200),
    signs: int(l.signs, 100),
    controls: Boolean(l.controls),
  };
}

/** Quantities from the striping, sealcoating and lighting calculators. */
export function qtyFromCalculators(striping, sealcoat, lighting) {
  const q = emptyQty();
  if (lighting) {
    const l = lighting;
    if (l.need === "upgrade") { q.LT_LED_POLE = l.poles; q.LT_LED_WALL = l.walls; }
    else q.LT_REPAIR = l.out; // repair, or "not sure" (owner adjusts on review)
    q.LT_POLE = l.damaged;
    q.LT_SIGN = l.signs;
    q.LT_CTRL = l.controls ? 1 : 0;
  }
  if (striping) {
    const s = striping;
    q.STR_STALL = s.stalls;
    q.STR_LAYOUT = s.layout === "new" ? s.stalls + s.ada : 0;
    q.STR_ADA = s.ada;
    q.STR_SIGN = s.signs;
    q.STR_NUM = s.numbered ? s.stalls + s.ada : 0;
    q.STR_ARROW = s.arrows;
    q.STR_STOP = s.stops;
    q.STR_XWALK = s.crosswalks;
    q.STR_WORD = s.words;
    q.STR_CURB = s.curb_lf;
  }
  if (sealcoat && sealcoat.sqft) {
    q[sealcoat.coats === 1 ? "SEAL_1" : "SEAL_2"] = sealcoat.sqft;
    q.CRK_LF = Math.ceil((sealcoat.sqft / 100) * (RULES.crackLfPer100Sqft[sealcoat.cracks] || 0));
  }
  return q;
}

/** Combine quantity sets. Crack sealing takes the larger estimate, not the sum. */
export function mergeQty(...sets) {
  const q = emptyQty();
  for (const s of sets) for (const k of QTY_KEYS) {
    const v = int(s?.[k]);
    q[k] = k === "CRK_LF" ? Math.max(q[k], v) : q[k] + v;
  }
  return q;
}

const round2 = (n) => Math.round(n * 100) / 100;

function feeLine(key, amount) {
  const p = PRODUCTS[key];
  return { key, sku: p.sku, name: p.name, desc: p.desc, unitLabel: p.unit, qty: 1, group: "fee",
    listPrice: amount, unitPrice: amount, discountPct: 0, amount: round2(amount), cost: p.cost };
}

/** Price a set of quantities. Same rules as the Quote & Margin Calculator. */
export function buildQuote(qty, discountPct = 0) {
  const disc = Math.min(50, Math.max(0, Number(discountPct) || 0)) / 100;
  const lines = [];
  for (const key of QTY_KEYS) {
    const q = int(qty?.[key]);
    if (!q) continue;
    const p = PRODUCTS[key];
    let billed = q, note = "";
    if (key === "SAW_SF" && q < RULES.sawMinSqft) { billed = RULES.sawMinSqft; note = ` (${RULES.sawMinSqft} sq ft minimum)`; }
    const unit = round2(p.price * (1 - (p.discountable ? disc : 0)));
    lines.push({ key, sku: p.sku, name: p.name + note, desc: p.desc, unitLabel: p.unit, qty: billed, group: p.group,
      listPrice: p.price, unitPrice: unit, discountPct: p.discountable ? disc * 100 : 0, amount: round2(unit * billed), cost: round2(p.cost * q) });
  }
  const sub = (g) => lines.filter((l) => l.group === g).reduce((s, l) => s + l.amount, 0);
  const stripe = sub("striping"), seal = sub("sealcoat"), pot = sub("pothole"), light = sub("lighting");
  if (light > 0 && light < RULES.lightingMin) lines.push(feeLine("MIN_LT", RULES.lightingMin - light));
  if (stripe > 0 && stripe < RULES.stripingMin) lines.push(feeLine("MIN_STR", RULES.stripingMin - stripe));
  if (seal > 0 && seal < RULES.sealcoatMin) lines.push(feeLine("MIN_SEAL", RULES.sealcoatMin - seal));
  // Trip charge only for small pothole-only jobs; striping/sealcoat minimums already cover mobilization.
  if (pot > 0 && !stripe && !seal && !light && pot < RULES.tripUnder) lines.push(feeLine("TRIP", PRODUCTS.TRIP.price));

  const total = round2(lines.reduce((s, l) => s + l.amount, 0));
  const cost = round2(lines.reduce((s, l) => s + l.cost, 0));
  const gp = round2(total - cost);
  return {
    lines, total, cost, grossProfit: gp,
    grossMargin: total ? gp / total : 0,
    discountPct: disc * 100,
    groups: [...new Set(lines.map((l) => l.group).filter((g) => g !== "fee"))],
    notToExceed: total ? Math.ceil((total * RULES.nteFactor) / 25) * 25 : 0,
  };
}

/** Price list without costs, for the public estimate on the quote page. */
export function publicLines(q) {
  return {
    total: q.total,
    lines: q.lines.map((l) => ({ name: l.name, desc: l.desc, qty: l.qty, unit: l.unitLabel, unitPrice: l.unitPrice, amount: l.amount, group: l.group })),
  };
}
