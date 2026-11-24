// HTML for emails and the owner/customer pages.
import { PRODUCTS, RULES, QTY_KEYS, GROUP_LABELS, SIZE_GUESSES } from "./pricebook.mjs";

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const money = (n) => "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money0 = (n) => "$" + Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
const ORANGE = "#e2581a", INK = "#1d1d1b", MUTE = "#6b6a66", LINE = "#e4e2dc";
const firstName = (n) => (n || "").trim().split(/\s+/)[0] || "there";

function linesTable(q, { showCost = false } = {}) {
  const multi = (q.groups || []).length > 1;
  const cols = showCost ? 4 : 3;
  let lastGroup = null;
  const rows = q.lines.map((l) => {
    let head = "";
    if (multi && l.group !== "fee" && l.group !== lastGroup) {
      lastGroup = l.group;
      head = `<tr><td colspan="${cols}" style="padding:12px 6px 4px;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:${MUTE}">${esc(GROUP_LABELS[l.group] || "")}</td></tr>`;
    }
    return head + `<tr>
    <td style="padding:8px 6px;border-bottom:1px solid ${LINE}">${esc(l.name)}<br><span style="color:${MUTE};font-size:13px">${esc(l.desc)}${l.discountPct ? ` · ${l.discountPct}% off` : ""}</span></td>
    <td style="padding:8px 6px;border-bottom:1px solid ${LINE};text-align:right;white-space:nowrap">${Number(l.qty).toLocaleString("en-US")} ${esc(l.unitLabel)}</td>
    <td style="padding:8px 6px;border-bottom:1px solid ${LINE};text-align:right;white-space:nowrap">${money(l.amount)}</td>
    ${showCost ? `<td style="padding:8px 6px;border-bottom:1px solid ${LINE};text-align:right;color:${MUTE}">${money(l.cost)}</td>` : ""}
  </tr>`;
  }).join("");
  return `<table role="presentation" style="width:100%;border-collapse:collapse;font-size:15px">
    <tr><th style="text-align:left;padding:6px;color:${MUTE};font-weight:500;font-size:12px">Item</th><th style="text-align:right;padding:6px;color:${MUTE};font-weight:500;font-size:12px">Qty</th><th style="text-align:right;padding:6px;color:${MUTE};font-weight:500;font-size:12px">Amount</th>${showCost ? `<th style="text-align:right;padding:6px;color:${MUTE};font-weight:500;font-size:12px">Sub cost</th>` : ""}</tr>
    ${rows}
    <tr><td style="padding:10px 6px;font-weight:700">Total</td><td></td><td style="padding:10px 6px;text-align:right;font-weight:700;font-size:17px">${money(q.total)}</td>${showCost ? `<td style="padding:10px 6px;text-align:right;color:${MUTE}">${money(q.cost)}</td>` : ""}</tr>
  </table>`;
}

export function emailShell(inner) {
  return `<!doctype html><html><body style="margin:0;background:#f6f5f2;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${INK}">
  <div style="max-width:600px;margin:0 auto;padding:20px">
    <div style="background:${INK};color:#fff;padding:14px 18px;border-radius:10px 10px 0 0;font-weight:700;font-size:18px"><span style="background:${ORANGE};padding:2px 7px;border-radius:4px;margin-right:6px">123</span>Lot Lighting</div>
    <div style="background:#fff;padding:20px 18px;border-radius:0 0 10px 10px;border:1px solid ${LINE};border-top:0;line-height:1.5">${inner}</div>
    <p style="color:${MUTE};font-size:12px;text-align:center;margin-top:14px">123 Lot Lighting · DuPage and Will County, Illinois · 123lotlighting.com</p>
  </div></body></html>`;
}
export const button = (href, label) =>
  `<a href="${esc(href)}" style="display:inline-block;background:${ORANGE};color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px">${esc(label)}</a>`;

// ---------- customer quote ----------
export function customerQuoteEmail(rec, acceptUrl) {
  const r = rec.request, q = rec.quote;
  const valid = new Date((rec.sentAt ? Date.parse(rec.sentAt) : Date.now()) + RULES.validDays * 864e5)
    .toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return emailShell(`
    <p>Hi ${esc(firstName(r.name))},</p>
    <p>Thanks for your quote request for ${esc(r.company || "your property")} at ${esc(r.address)}. Here's your fixed-price quote.</p>
    ${rec.customerNote ? `<p style="background:#f6f5f2;padding:10px 12px;border-radius:8px">${esc(rec.customerNote).replace(/\n/g, "<br>")}</p>` : ""}
    <p style="color:${MUTE};font-size:13px;margin:16px 0 4px">Quote ${esc(rec.id)} · valid until ${valid}</p>
    ${linesTable(q)}
    <h3 style="font-size:15px;margin:20px 0 6px">How our pricing works</h3>
    ${pricingNotes(rec).map((t) => `<p style="font-size:14px;margin:0 0 8px">${t}</p>`).join("")}
    <p style="font-size:14px;margin:0 0 18px">The total won't go over <strong>${money0(q.notToExceed)}</strong> without your approval. You'll get before and after photos of the work.</p>
    <p>${button(acceptUrl, "Accept this quote")}</p>
    <p style="font-size:14px">Questions? Just reply to this email.</p>
  `);
}

const PHOTO_GROUP_TITLES = { overview: "Overview", lighting: "Lighting photos", striping: "Striping photos", sealcoat: "Sealcoating photos", other: "Other work photos" };

function pricingNotes(rec) {
  const g = rec.quote.groups || [];
  const out = [];
  if (g.includes("pothole")) out.push("Each pothole is priced by size tier: Small (up to 2×2 ft), Standard (up to 4×4 ft) or Large (up to 6×6 ft). Our crew measures each repair before starting. If one turns out larger than it looked in the photos, it's billed at the next tier's price.");
  if (g.includes("lighting")) out.push("Lighting is priced per fixture from the counts on your request. Our electrician confirms each fixture, pole and circuit on site before starting, and we bill what is actually fixed or replaced.");
  if (g.includes("striping")) out.push("Striping is priced from the stall and marking counts on your request. We confirm the counts on site before painting and bill what we actually paint.");
  if (g.includes("sealcoat")) out.push("Sealcoating is priced by the square footage of your lot. We confirm the area before starting and bill the measured area at the same rate.");
  return out;
}

/** Plain summary of the calculator inputs, for the owner. */
function calcSummary(r) {
  const out = [];
  const l = r.lighting;
  if (l) {
    const need = { repair: "fix what's out", upgrade: "upgrade to LED", advise: "not sure, advise" }[l.need] || l.need;
    const bits = [need, `${l.poles} pole lights`, `${l.walls} wall packs`, `${l.out} out or flickering`];
    if (l.damaged) bits.push(`${l.damaged} damaged poles`);
    if (l.signs) bits.push(`${l.signs} lighted signs`);
    if (l.controls) bits.push("lights on at wrong times");
    out.push(["Lighting", bits.join(" · ")]);
  }
  const s = r.striping;
  if (s) {
    const bits = [`${s.stalls} stalls (${s.layout === "new" ? "new layout" : "existing layout"})`];
    if (s.ada) bits.push(`${s.ada} ADA`);
    if (s.signs) bits.push(`${s.signs} ADA signs`);
    if (s.numbered) bits.push("numbered");
    if (s.arrows) bits.push(`${s.arrows} arrows`);
    if (s.stops) bits.push(`${s.stops} stop bars`);
    if (s.crosswalks) bits.push(`${s.crosswalks} crosswalks`);
    if (s.words) bits.push(`${s.words} stenciled words`);
    if (s.curb_lf) bits.push(`${s.curb_lf} ft curb painting`);
    out.push(["Striping", bits.join(" · ")]);
  }
  const c = r.sealcoat;
  if (c) out.push(["Sealcoating", `${Number(c.sqft || 0).toLocaleString("en-US")} sq ft (${c.measured === "map" ? "outlined on map" : "typed"}) · ${c.coats} coat${c.coats === 1 ? "" : "s"} · cracks: ${c.cracks}`]);
  return out;
}

/** Google Maps link to the middle of the customer's sealcoat outline. */
function outlineLink(c) {
  if (!c?.outline?.length) return "";
  const lat = c.outline.reduce((s, p) => s + p[0], 0) / c.outline.length;
  const lng = c.outline.reduce((s, p) => s + p[1], 0) / c.outline.length;
  return `https://www.google.com/maps/@${lat.toFixed(6)},${lng.toFixed(6)},60m/data=!3m1!1e3`;
}

// ---------- owner emails ----------
export function ownerReviewEmail(rec, reviewUrl) {
  const r = rec.request, a = rec.assessment, q = rec.quote;
  const gm = q.total ? Math.round(q.grossMargin * 100) + "%" : "–";
  const flags = [...(a?.red_flags || []), ...(rec.flags || [])];
  return emailShell(`
    <p style="margin-top:0"><strong>${esc(r.company || r.name)}</strong> · ${esc(r.address)}<br>
    <span style="color:${MUTE};font-size:14px">${esc(r.name)} · ${esc(r.email)} · ${esc(r.phone || "")} · ${rec.photoCount} photo(s)</span></p>
    ${calcSummary(r).map(([k, v]) => `<p style="margin:6px 0"><strong>${esc(k)}:</strong> ${esc(v)}</p>`).join("")}
    ${a ? `<p><strong>Claude (${esc(a.confidence)} confidence):</strong> ${esc(a.owner_summary)}</p>`
        : !rec.error && !rec.aiOff ? ""
        : rec.aiOff ? `<p>${rec.photoCount ? `${rec.photoCount} photo(s) attached on the review page. Size each pothole and enter the quantities.` : "No photos were sent. Price it on the review page or ask for photos."}</p>`
        : `<p><strong>No AI assessment:</strong> ${esc(rec.error || "no photos")}. Price it on the review page.</p>`}
    ${flags.length ? `<p style="background:#fdf2e3;padding:10px 12px;border-radius:8px;font-size:14px"><strong>Check:</strong> ${flags.map(esc).join(" · ")}</p>` : ""}
    ${q.total ? linesTable(q, { showCost: true }) + `<p style="font-size:14px">Gross margin: <strong>${gm}</strong> · Not-to-exceed: ${money0(q.notToExceed)}</p>` : ""}
    <p>${button(reviewUrl, "Review & send quote")}</p>
    <p style="color:${MUTE};font-size:13px">Nothing goes to the customer until you press Send on the review page.</p>
  `);
}

export function ownerAcceptedEmail(rec, subCheckUrl) {
  const r = rec.request;
  return emailShell(`
    <p style="margin-top:0"><strong>Quote ${esc(rec.id)} accepted</strong> by ${esc(rec.acceptedBy || r.name)}.</p>
    <p>${esc(r.company || "")} · ${esc(r.address)}<br>${esc(r.name)} · ${esc(r.email)} · ${esc(r.phone || "")}</p>
    ${linesTable(rec.quote, { showCost: true })}
    <p>Next: send the work order to a sub.${process.env.CHECKER_EMAIL ? " Your checker has been emailed the draft." : ""}</p>
    ${subCheckUrl ? `<p>${button(subCheckUrl, "Sub paperwork")}</p>` : ""}
  `);
}

export function photoRequestEmail(rec, message) {
  return emailShell(`
    <p>Hi ${esc(firstName(rec.request.name))},</p>
    <p>Thanks for your quote request for ${esc(rec.request.address)}. To give you an accurate fixed price, we need a little more from you:</p>
    <p style="background:#f6f5f2;padding:10px 12px;border-radius:8px">${esc(message).replace(/\n/g, "<br>")}</p>
    <p>You can reply to this email with the photos, or send them through our quote form:</p>
    <p>${button("https://123lotlighting.com/quote/", "Send photos")}</p>
  `);
}

// ---------- pages ----------
export function pageShell(title, inner) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex"><title>${esc(title)}</title>
  <style>
    body{margin:0;background:#f6f5f2;color:${INK};font:16px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif}
    .wrap{max-width:720px;margin:0 auto;padding:16px}
    .bar{background:${INK};color:#fff;padding:12px 16px;font-weight:700}.bar span{background:${ORANGE};padding:2px 7px;border-radius:4px;margin-right:6px}
    .card{background:#fff;border:1px solid ${LINE};border-radius:10px;padding:16px;margin:12px 0}
    h1{font-size:22px;margin:4px 0 8px}h2{font-size:16px;margin:0 0 10px}
    .muted{color:${MUTE};font-size:14px}
    .photos{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
    .photos a{display:block;position:relative}.photos img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px}
    .photos b{position:absolute;left:6px;top:6px;background:${INK};color:#fff;font-size:12px;padding:1px 6px;border-radius:4px}
    table{width:100%;border-collapse:collapse;font-size:14px}td,th{padding:6px 4px;border-bottom:1px solid ${LINE};text-align:left;vertical-align:top}
    .row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid ${LINE}}
    input[type=number]{width:90px;padding:8px;font-size:16px;border:1px solid #b9b5ae;border-radius:8px;text-align:right}
    input[type=text],textarea{width:100%;box-sizing:border-box;padding:9px;font:inherit;border:1px solid #b9b5ae;border-radius:8px}
    .btn{display:inline-block;border:0;border-radius:8px;padding:12px 18px;font-size:16px;font-weight:700;cursor:pointer;background:#e9e7e2;color:${INK};margin:4px 6px 4px 0}
    .btn.pri{background:${ORANGE};color:#fff}
    .flag{background:#fdf2e3;padding:10px 12px;border-radius:8px;font-size:14px}
    .ok{background:#e7f4ec;padding:12px;border-radius:8px;font-weight:600}
    .go{color:#1f7a4d}.mon{color:#b7791f}.stop{color:#b42318}
  </style></head><body><div class="bar"><span>123</span>Lot Lighting</div><div class="wrap">${inner}</div></body></html>`;
}

export function quoteTableHtml(q, showCost) {
  return linesTable(q, { showCost });
}

const TIER_GUIDE = `<table><tr><th>Tier</th><th>Pothole size</th><th>Max depth</th></tr>
  <tr><td>Small</td><td>up to 2 × 2 ft</td><td>3 in</td></tr>
  <tr><td>Standard</td><td>up to 4 × 4 ft</td><td>3 in</td></tr>
  <tr><td>Large</td><td>up to 6 × 6 ft</td><td>4 in</td></tr>
  <tr><td>Saw-cut</td><td>bigger, deeper, or in alligator cracking: sq ft of failed area + 1 ft each side</td><td>–</td></tr></table>
  <p class="muted">Between tiers or unsure? Pick the larger one. Photos without a tape measure: use stall lines (about 9 ft apart) for scale, or ask for better photos.</p>`;

export function reviewPage(rec, { photoUrl, actionUrl, message, subCheckUrl, estimatorUrl, subsUrl }) {
  const r = rec.request, a = rec.assessment, q = rec.quote;
  const gmPct = q.total ? Math.round(q.grossMargin * 100) : null;
  const gmCls = gmPct == null ? "" : gmPct >= 40 ? "go" : gmPct >= 20 ? "mon" : "stop";
  const flags = [...(a?.red_flags || []), ...(rec.flags || [])];
  const thumb = (i) => `<a href="${esc(photoUrl(i))}" target="_blank"><img src="${esc(photoUrl(i))}" alt="Photo ${i + 1}"><b>${i + 1}</b></a>`;
  const groups = r.photoGroups || [];
  let photos;
  if (groups.length) {
    const used = new Set();
    let card = 0;
    photos = groups.map((g) => {
      g.photos.forEach((i) => used.add(i));
      const title = g.type === "pothole" ? `Pothole ${++card}${g.note ? ` · ${esc(g.note)}` : ""}${SIZE_GUESSES[g.size] ? ` · <span style="font-weight:400">customer guess: ${esc(SIZE_GUESSES[g.size].label)}</span>` : ""}` : esc(PHOTO_GROUP_TITLES[g.type] || "Photos");
      return `<p class="muted" style="margin:10px 0 4px"><strong>${title}</strong></p>${g.photos.length ? `<div class="photos">${g.photos.map(thumb).join("")}</div>` : `<p class="muted">No photo</p>`}`;
    }).join("");
    const loose = Array.from({ length: rec.photoCount }, (_, i) => i).filter((i) => !used.has(i));
    if (loose.length) photos += `<p class="muted" style="margin:10px 0 4px"><strong>Other</strong></p><div class="photos">${loose.map(thumb).join("")}</div>`;
  } else {
    photos = `<div class="photos">${Array.from({ length: rec.photoCount }, (_, i) => thumb(i)).join("")}</div>`;
  }
  const calc = calcSummary(r);
  const mapUrl = outlineLink(r.sealcoat);
  const hasPhotoWork = !(r.services || []).length || (r.services || []).some((s) => ["Pothole repair", "Crack sealing", "Not sure"].includes(s));
  const holes = (a?.potholes || []).map((h) => `<tr><td>${esc(h.label)}<br><span class="muted">photos ${esc((h.photos || []).join(", "))} · ${esc(h.measured_from)}${h.notes ? " · " + esc(h.notes) : ""}</span></td>
    <td>${Math.round(h.length_in)}×${Math.round(h.width_in)} in, ${h.depth_in} in deep</td><td><strong>${esc(h.tier)}</strong>${h.tier === "saw_cut" ? ` (${Math.round(h.saw_cut_sqft || 0)} sq ft)` : ""}</td></tr>`).join("");
  let lastG = null;
  const qtyRows = QTY_KEYS.map((k) => {
    const g = PRODUCTS[k].group;
    const head = g !== lastG ? `<p style="margin:14px 0 2px;font-weight:700">${esc(GROUP_LABELS[g])}</p>` : "";
    lastG = g;
    return head + `<div class="row"><label for="q-${k}">${esc(PRODUCTS[k].name)}<br><span class="muted">${esc(PRODUCTS[k].desc)} · ${money(PRODUCTS[k].price)}/${esc(PRODUCTS[k].unit)}</span></label>
     <input type="number" min="0" step="1" id="q-${k}" name="${k}" value="${rec.qty?.[k] || 0}"></div>`;
  }).join("");
  const done = ["sent", "accepted", "declined"].includes(rec.status);

  return pageShell(`Review ${rec.id}`, `
    <h1>Quote ${esc(rec.id)}</h1>
    <p class="muted">${esc(r.company || "")} · ${esc(r.address)}<br>${esc(r.name)} · <a href="mailto:${esc(r.email)}">${esc(r.email)}</a> · ${esc(r.phone || "")}<br>
    ${esc(r.property_type || "")} · ${esc(r.timing || "")} · Services: ${esc((r.services || []).join(", ") || "not specified")}${r.pothole_total ? ` · <strong>customer says ~${r.pothole_total} potholes</strong>` : ""}</p>
    ${message ? `<p class="ok">${esc(message)}</p>` : ""}
    ${subCheckUrl && q.total ? `<p><a class="btn" href="${esc(subCheckUrl)}">Sub paperwork${rec.status === "accepted" ? " (work orders)" : " (send a bid request)"}</a></p>` : ""}
    ${r.notes ? `<div class="card"><h2>Customer notes</h2>${esc(r.notes)}</div>` : ""}
    ${calc.length ? `<div class="card"><h2>Customer's calculator entries</h2>${calc.map(([k, v]) => `<p style="margin:4px 0"><strong>${esc(k)}:</strong> ${esc(v)}</p>`).join("")}
      ${mapUrl ? `<p><a href="${esc(mapUrl)}" target="_blank">Check the lot on Google satellite</a></p>` : ""}</div>` : ""}
    <div class="card"><h2>Photos</h2>${rec.photoCount ? photos : `<p class="muted">No photos sent.</p>`}</div>
    ${hasPhotoWork || a ? `<div class="card"><h2>${a ? `Claude's assessment · ${esc(a.confidence)} confidence` : "Sizing guide"}</h2>
      ${a ? `<p>${esc(a.owner_summary)}</p>${holes ? `<table><tr><th>Pothole</th><th>Size</th><th>Tier</th></tr>${holes}</table>` : ""}`
          : `${rec.error && !rec.aiOff ? `<p class="muted">${esc(rec.error)}</p>` : ""}${TIER_GUIDE}`}
      ${flags.length ? `<p class="flag"><strong>Check:</strong> ${flags.map(esc).join(" · ")}</p>` : ""}
    </div>` : flags.length ? `<p class="flag"><strong>Check:</strong> ${flags.map(esc).join(" · ")}</p>` : ""}
    <form method="POST" action="${esc(actionUrl)}">
      <div class="card"><h2>Quote</h2>
        ${qtyRows}
        <div class="row"><label for="disc">Discount %</label><input type="number" min="0" max="50" step="1" id="disc" name="discount" value="${rec.discountPct || 0}"></div>
        <div style="margin-top:12px">${q.total ? quoteTableHtml(q, true) : `<p class="muted">Enter quantities, then Update.</p>`}</div>
        ${q.total ? `<p>Gross margin: <strong class="${gmCls}">${gmPct}%</strong> · Not-to-exceed: ${money0(q.notToExceed)}</p>` : ""}
        <label for="note"><strong>Note to customer</strong> <span class="muted">(optional, appears above the price)</span></label>
        <textarea id="note" name="note" rows="3">${esc(rec.customerNote || "")}</textarea>
        <p>${done ? `<span class="muted">Status: <strong>${esc(rec.status)}</strong>${rec.sentAt ? " · sent " + new Date(rec.sentAt).toLocaleString("en-US", { timeZone: "America/Chicago" }) : ""}</span><br>` : ""}
          <button class="btn" name="action" value="update">Update</button>
          ${done ? "" : `<button class="btn pri" name="action" value="send">Send quote to customer</button>`}</p>
      </div>
      ${done ? "" : `<div class="card"><h2>Need better photos?</h2>
        <textarea name="photo_message" rows="3">${esc(a?.photo_request || (hasPhotoWork ? "Please send one photo of each pothole with a tape measure laid across it, and one with the tape standing in the deepest spot." : "Please send a few photos of the lot so we can confirm the layout."))}</textarea>
        <p><button class="btn" name="action" value="request_photos">Email customer for photos</button>
        <button class="btn" name="action" value="decline">I'll handle this one myself</button></p></div>`}
    </form>
    ${estimatorUrl ? `<p class="muted">Pricing a job over the phone? <a href="${esc(estimatorUrl)}" target="_blank">Open the price estimator</a> (private link, bookmark it).</p>` : ""}
    ${subsUrl ? `<p class="muted">Your subcontractor list: <a href="${esc(subsUrl)}" target="_blank">Manage subs</a> (private link, bookmark it).</p>` : ""}
  `);
}

export function acceptPage(rec, { actionUrl, done, expired }) {
  const r = rec.request;
  const body = done
    ? `<p class="ok">Thanks${rec.acceptedBy ? ", " + esc(rec.acceptedBy) : ""}. Quote ${esc(rec.id)} is accepted. We'll be in touch shortly to schedule the work.</p>`
    : expired
    ? `<p class="flag">This quote has expired. Reply to the quote email and we'll send you an updated one.</p>`
    : `<form method="POST" action="${esc(actionUrl)}">
        <label for="by"><strong>Your name</strong></label>
        <input type="text" id="by" name="accepted_by" value="${esc(r.name)}" required>
        <p class="muted">By accepting, you authorize 123 Lot Lighting to complete the work above at these prices. Quantities are confirmed on site, and the total is capped at ${money0(rec.quote.notToExceed)} without further approval.</p>
        <button class="btn pri" type="submit">Accept quote</button></form>`;
  return pageShell(`Quote ${rec.id}`, `
    <h1>Quote ${esc(rec.id)}</h1>
    <p class="muted">${esc(r.company || "")} · ${esc(r.address)}</p>
    <div class="card">${quoteTableHtml(rec.quote, false)}</div>
    <div class="card">${body}</div>
  `);
}
