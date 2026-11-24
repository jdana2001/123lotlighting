// Subcontractor paperwork: a work order (or bid request) per trade, drafted
// automatically from the quote, checked by a person, then sent to the sub.
// Subs never see customer prices or customer contact details.
import { PRODUCTS } from "./pricebook.mjs";
import { COMPANY, SUB_TERMS } from "./subs.mjs";
import { esc, money, pageShell, emailShell, button } from "./templates.mjs";

export const TRADES = { lighting: "Parking lot lighting (electrical)", pothole: "Pothole & crack repair", striping: "Parking lot striping", sealcoat: "Sealcoating" };
const CODES = { lighting: "LT", pothole: "P", striping: "ST", sealcoat: "SC" };

/** What the checker confirms before an order can go to a sub. */
export const CHECKS = [
  ["address", "Property address and map link are right"],
  ["qty", "Quantities match the customer's quote, and every pothole/area is listed"],
  ["photos", "Photos and location notes are attached and make sense"],
  ["private", "Nothing for the sub shows customer prices, names, phone numbers or emails"],
  ["sub", "Sub, rates and work window are filled in"],
];

export const orderCode = (rec, o) => `${rec.id}-${CODES[o.group] || o.n}`;
export const orderTotal = (o) => Math.round(o.lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.rate) || 0), 0) * 100) / 100;
export const subDocId = (rec, o) => `${rec.id}.${o.n}`;
const round2 = (n) => Math.round(n * 100) / 100;

/** One draft order per trade on the quote. Default sub rates = price book unit cost. */
export function draftSubOrders(rec, allSubs = []) {
  const lines = rec.quote?.lines || [];
  const groups = [...new Set(lines.map((l) => (l.key === "TRIP" ? "pothole" : l.group)).filter((g) => TRADES[g]))];
  return groups.map((group, n) => {
    const mine = lines.filter((l) => (l.key === "TRIP" ? "pothole" : l.group) === group);
    const subs = allSubs.filter((s) => s.active !== false && (s.trades || []).includes(group));
    const only = subs.length === 1 ? subs[0] : null;
    return {
      n, group,
      mode: rec.status === "accepted" ? "work" : "bid",
      status: "draft",
      subName: only ? only.name : "",
      subEmail: only ? only.email : "",
      window: rec.request?.timing || "",
      siteNotes: "",
      customerNotes: rec.request?.notes || "", // shown to the checker only
      customerAmount: round2(mine.reduce((s, l) => s + l.amount, 0)),
      lines: mine.map((l) => ({
        key: l.key,
        name: l.key === "TRIP" ? "Mobilization" : PRODUCTS[l.key]?.name || l.name,
        desc: l.key === "TRIP" ? "small job, one trip" : l.desc,
        qty: l.key === "TRIP" ? 1 : l.qty,
        unit: l.unitLabel,
        rate: only?.rates?.[l.key] ?? PRODUCTS[l.key]?.cost ?? 0,
      })),
      checks: {},
      checkedBy: "",
      history: [{ at: new Date().toISOString(), what: "Drafted from quote" }],
    };
  });
}

// ---------- shared bits ----------
const mapsLink = (addr) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr || "")}`;
function outlineLink(c) {
  if (!c?.outline?.length) return "";
  const lat = c.outline.reduce((s, p) => s + p[0], 0) / c.outline.length;
  const lng = c.outline.reduce((s, p) => s + p[1], 0) / c.outline.length;
  return `https://www.google.com/maps/@${lat.toFixed(6)},${lng.toFixed(6)},60m/data=!3m1!1e3`;
}
const n0 = (v) => Number(v || 0).toLocaleString("en-US");

function stripingDetails(s) {
  if (!s) return "";
  const rows = [
    ["Regular stalls", n0(s.stalls)], ["ADA stalls (aisle + symbol)", n0(s.ada)],
    ["Layout", s.layout === "new" ? "New or changed layout: measure and mark" : "Repaint existing layout"],
    ["Stall numbers", s.numbered ? "Yes, every stall" : "No"],
    ["ADA signs on posts", n0(s.signs)], ["Arrows", n0(s.arrows)], ["Stop bars", n0(s.stops)],
    ["Crosswalks", n0(s.crosswalks)], ["Stenciled words", n0(s.words)], ["Curb painting", `${n0(s.curb_lf)} ft`],
  ].filter(([, v]) => v !== "0" && v !== "0 ft");
  return `<table class="kv">${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</table>`;
}
function lightingDetails(l) {
  if (!l) return "";
  const rows = [
    ["Customer wants", { repair: "Fix the lights that are out", upgrade: "Upgrade to LED", advise: "Not sure, wants advice" }[l.need] || l.need],
    ["Pole-mounted lights", n0(l.poles)], ["Wall packs / building lights", n0(l.walls)],
    ["Out or flickering", n0(l.out)], ["Damaged or leaning poles", n0(l.damaged)], ["Lighted sign faces", n0(l.signs)],
    ["Lights on at the wrong times", l.controls ? "Yes, check photocells/timers" : "No"],
  ].filter(([, v]) => v !== "0" && v !== "No");
  return `<table class="kv">${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</table>`;
}
function sealDetails(c) {
  if (!c) return "";
  const link = outlineLink(c);
  return `<table class="kv">
    <tr><th>Area</th><td>${n0(c.sqft)} sq ft ${c.measured === "map" ? "(outlined by the customer on satellite)" : "(customer's figure)"}</td></tr>
    <tr><th>Coats</th><td>${c.coats}</td></tr>
    <tr><th>Cracks</th><td>${esc({ none: "Few or none", some: "Some", lots: "A lot" }[c.cracks] || c.cracks)}</td></tr>
  </table>${link ? `<p><a href="${esc(link)}" target="_blank">See the lot on satellite</a></p>` : ""}`;
}
function tradePhotos(rec, type, photoUrl) {
  const ids = (rec.request?.photoGroups || []).filter((g) => g.type === type).flatMap((g) => g.photos);
  if (!ids.length) return "";
  return `<div class="hole"><p><strong>Customer's photos</strong></p><div class="thumbs">${ids.map((i) => `<a href="${esc(photoUrl(i))}" target="_blank"><img src="${esc(photoUrl(i))}" alt="Photo ${i + 1}"></a>`).join("")}</div></div>`;
}

function potholeDetails(rec, photoUrl) {
  const groups = (rec.request?.photoGroups || []).filter((g) => g.type === "pothole" || g.type === "overview");
  const holes = rec.assessment?.potholes || [];
  const thumbs = (ids) => ids.map((i) => `<a href="${esc(photoUrl(i))}" target="_blank"><img src="${esc(photoUrl(i))}" alt="Photo ${i + 1}"></a>`).join("");
  let html = "";
  if (holes.length) {
    html += holes.filter((h) => h.tier !== "not_pothole").map((h, i) => `<div class="hole">
      <p><strong>${esc(h.label || `Pothole ${i + 1}`)}</strong> · <span class="tier">${esc(h.tier === "saw_cut" ? `Saw-cut, about ${Math.round(h.saw_cut_sqft || 0)} sq ft` : (h.tier || "") + " patch")}</span><br>
      <span class="muted">About ${Math.round(h.length_in || 0)} × ${Math.round(h.width_in || 0)} in, ${h.depth_in || "?"} in deep · measured from ${esc(h.measured_from || "photo")}${h.notes ? " · " + esc(h.notes) : ""}</span></p>
      <div class="thumbs">${thumbs(h.photos?.map((p) => p - 1).filter((p) => p >= 0 && p < rec.photoCount) || [])}</div></div>`).join("");
  } else if (groups.length) {
    let card = 0;
    html += groups.map((g) => `<div class="hole"><p><strong>${g.type === "pothole" ? `Pothole ${++card}` : "Overview"}</strong>${g.note ? ` · ${esc(g.note)}` : ""}</p><div class="thumbs">${thumbs(g.photos)}</div></div>`).join("");
  } else if (rec.photoCount && !(rec.request?.photoGroups || []).length) {
    html += `<div class="thumbs">${thumbs(Array.from({ length: rec.photoCount }, (_, i) => i))}</div>`;
  }
  const overview = groups.filter((g) => g.type === "overview").flatMap((g) => g.photos);
  if (holes.length && overview.length) html += `<div class="hole"><p><strong>Overview</strong></p><div class="thumbs">${thumbs(overview)}</div></div>`;
  return html || `<p class="muted">No photos. Measure on site.</p>`;
}

const DOC_CSS = `
  .doc h1{font-size:24px;margin:0}.doc .code{font-size:14px;color:#6b6a66}
  .doc .head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start;border-bottom:3px solid #e2581a;padding-bottom:10px;margin-bottom:10px}
  .doc .badge{display:inline-block;background:#1d1d1b;color:#fff;border-radius:4px;padding:2px 8px;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
  .kv th{width:42%;color:#6b6a66;font-weight:500}
  .scope td.num,.scope th.num{text-align:right;white-space:nowrap}
  .scope input{width:90px}
  .hole{border-top:1px solid #e4e2dc;padding:8px 0}.hole p{margin:0 0 6px}
  .tier{text-transform:capitalize;font-weight:600}
  .thumbs{display:flex;flex-wrap:wrap;gap:6px}.thumbs img{width:110px;height:110px;object-fit:cover;border-radius:6px}
  ol.terms{padding-left:20px;font-size:14px}ol.terms li{margin:4px 0}
  .total td{font-weight:700;font-size:16px;border:0}
  @media print{.bar,.noprint{display:none}.card{border:0;padding:0}body{background:#fff}.thumbs img{width:90px;height:90px}}`;

// ---------- the sub's page ----------
export function subDocPage(rec, o, { photoUrl, actionUrl, message, preview }) {
  const r = rec.request;
  const isWork = o.mode === "work";
  const responded = Boolean(o.response);
  const canRespond = !preview && !responded && ["sent"].includes(o.status);
  const issued = new Date(o.sentAt || Date.now()).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Chicago" });

  const scopeRows = o.lines.map((l) => {
    const bidVal = o.response?.prices?.[l.key];
    const last = isWork
      ? `<td class="num">${money(l.rate)}</td><td class="num">${money((l.qty || 0) * (l.rate || 0))}</td>`
      : canRespond
      ? `<td class="num"><input type="number" min="0" step="0.01" name="price_${esc(l.key)}" required aria-label="Your price per ${esc(l.unit)}"></td>`
      : `<td class="num">${bidVal != null ? money(bidVal) : "—"}</td>`;
    return `<tr><td>${esc(l.name)}<br><span class="muted">${esc(l.desc || "")}</span></td><td class="num">${n0(l.qty)} ${esc(l.unit)}</td>${last}</tr>`;
  }).join("");
  const head = isWork ? `<th class="num">Rate</th><th class="num">Amount</th>` : `<th class="num">Your price / unit</th>`;
  const totalRow = isWork ? `<tr class="total"><td>Total</td><td></td><td></td><td class="num">${money(orderTotal(o))}</td></tr>`
    : responded ? `<tr class="total"><td>Your total</td><td></td><td class="num">${money(o.response.total)}</td></tr>` : "";

  let details = "";
  if (o.group === "pothole") details = potholeDetails(rec, photoUrl);
  if (o.group === "lighting") details = lightingDetails(r.lighting) + tradePhotos(rec, "lighting", photoUrl);
  if (o.group === "striping") details = stripingDetails(r.striping) + tradePhotos(rec, "striping", photoUrl);
  if (o.group === "sealcoat") details = sealDetails(r.sealcoat) + tradePhotos(rec, "sealcoat", photoUrl);

  const respond = responded
    ? `<p class="ok">${isWork ? `Accepted by ${esc(o.response.name)}${o.response.start ? `, planned start ${esc(o.response.start)}` : ""}.` : `Bid received from ${esc(o.response.name)}. Thanks, we'll be in touch.`}</p>`
    : canRespond
    ? `<div class="card noprint"><h2>${isWork ? "Accept this job" : "Send your bid"}</h2>
        ${isWork ? "" : `<p class="muted">Fill in your price per unit in the scope table above.</p>`}
        <label for="r-start"><strong>${isWork ? "Planned start date" : "Earliest you could start"}</strong></label>
        <input type="text" id="r-start" name="start" placeholder="e.g. Tue Nov 17" required>
        <label for="r-notes"><strong>Notes</strong> <span class="muted">(optional)</span></label>
        <textarea id="r-notes" name="notes" rows="3"></textarea>
        <label for="r-name"><strong>Your name</strong></label>
        <input type="text" id="r-name" name="name" value="${esc(o.subName || "")}" required>
        <p class="muted">${isWork ? "By accepting, you agree to do the work above at these rates and to the terms on this order." : "Your price should include labor, materials, equipment and mobilization."}</p>
        <button class="btn pri" type="submit">${isWork ? "Accept job" : "Submit bid"}</button></div>`
    : preview ? `<p class="flag noprint">Preview: this is what the sub will see. The ${isWork ? "accept" : "bid"} form appears once it's sent.</p>` : "";

  const body = `<div class="doc">
    ${message ? `<p class="ok">${esc(message)}</p>` : ""}
    <div class="head"><div><span class="badge">${isWork ? "Work order" : "Bid request"}</span><h1>${esc(TRADES[o.group])}</h1>
      <div class="code">${esc(orderCode(rec, o))} · issued ${issued}${o.subName ? ` · to ${esc(o.subName)}` : ""}</div></div>
      <div class="muted" style="text-align:right">${esc(COMPANY.name)}${COMPANY.phone ? `<br>${esc(COMPANY.phone)}` : ""}${COMPANY.email ? `<br>${esc(COMPANY.email)}` : ""}</div></div>
    <div class="card"><h2>Job site</h2><table class="kv">
      <tr><th>Property</th><td>${esc(r.company || r.property_type || "Commercial property")}</td></tr>
      <tr><th>Address</th><td>${esc(r.address)}<br><a href="${esc(mapsLink(r.address))}" target="_blank">Open in Google Maps</a></td></tr>
      ${r.property_type ? `<tr><th>Type</th><td>${esc(r.property_type)}</td></tr>` : ""}
      ${o.window ? `<tr><th>Work window</th><td>${esc(o.window)}</td></tr>` : ""}
    </table>${o.siteNotes ? `<p style="margin-top:10px"><strong>Site notes:</strong><br>${esc(o.siteNotes).replace(/\n/g, "<br>")}</p>` : ""}</div>
    <form method="POST" action="${esc(actionUrl || "#")}">
    <div class="card"><h2>Scope</h2><table class="scope"><tr><th>Item</th><th class="num">Qty</th>${head}</tr>${scopeRows}${totalRow}</table></div>
    <div class="card"><h2>${o.group === "pothole" ? "Each repair" : "Details"}</h2>${details}</div>
    <div class="card"><h2>Terms</h2><ol class="terms">${SUB_TERMS.map((t) => `<li>${esc(t)}</li>`).join("")}</ol></div>
    ${respond}
    </form>
    <p class="noprint"><button class="btn" type="button" onclick="window.print()">Print or save as PDF</button></p>
  </div><style>${DOC_CSS}</style>`;
  return pageShell(`${isWork ? "Work order" : "Bid request"} ${orderCode(rec, o)}`, body);
}

// ---------- the checker's page ----------
export function subCheckPage(rec, { actionUrl, docUrl, reviewUrl, subsUrl, message, subs = [] }) {
  const r = rec.request;
  const active = subs.filter((s) => s.active !== false).sort((a, b) => a.name.localeCompare(b.name));
  const subOpts = (group) => active.filter((s) => (s.trades || []).includes(group)).map((s) =>
    `<option value="${esc(s.email)}" data-name="${esc(s.name)}" data-rates="${esc(JSON.stringify(s.rates || {}))}">${esc(s.name)}${(s.areas || []).length ? ` · ${esc(s.areas.join(", "))}` : ""}</option>`).join("");
  const cards = (rec.subOrders || []).map((o) => {
    const locked = o.status !== "draft";
    const dis = locked ? "disabled" : "";
    const sub = o.response?.total ?? orderTotal(o), cust = o.customerAmount || 0;
    const gm = cust ? Math.round(((cust - sub) / cust) * 100) : null;
    const gmCls = gm == null ? "" : gm >= 40 ? "go" : gm >= 20 ? "mon" : "stop";
    const lineRows = o.lines.map((l) => `<tr><td>${esc(l.name)}<br><span class="muted">${esc(l.desc || "")}</span></td>
      <td><input type="number" min="0" step="1" name="qty_${esc(l.key)}" value="${esc(l.qty)}" ${dis} aria-label="Quantity"> <span class="muted">${esc(l.unit)}</span></td>
      <td><input type="number" min="0" step="0.01" name="rate_${esc(l.key)}" value="${esc(l.rate)}" ${dis} aria-label="Sub rate"></td></tr>`).join("");
    const checks = CHECKS.map(([k, label]) => `<label style="display:block;margin:4px 0"><input type="checkbox" name="chk_${k}" ${o.checks?.[k] ? "checked" : ""} ${dis}> ${esc(label)}</label>`).join("");
    const resp = o.response ? `<p class="ok">${o.mode === "work" ? `Accepted by ${esc(o.response.name)}, start ${esc(o.response.start || "?")}` : `Bid from ${esc(o.response.name)}: ${money(o.response.total)} (start ${esc(o.response.start || "?")})`}${o.response.notes ? `<br><span class="muted">${esc(o.response.notes)}</span>` : ""}</p>` : "";
    return `<form class="card" method="POST" action="${esc(actionUrl)}">
      <input type="hidden" name="n" value="${o.n}">
      <h2>${esc(TRADES[o.group])} · ${esc(orderCode(rec, o))} <span class="muted">· ${esc(o.status)}</span></h2>
      ${resp}
      <div class="row"><label for="m${o.n}">Send as</label><select id="m${o.n}" name="mode" ${dis}>
        <option value="work" ${o.mode === "work" ? "selected" : ""}>Work order (rates set)</option>
        <option value="bid" ${o.mode === "bid" ? "selected" : ""}>Bid request (sub prices it)</option></select></div>
      ${locked ? "" : subOpts(o.group) ? `<div class="row"><label>Pick a sub</label><select onchange="pickSub(this)"><option value="">Choose a ${esc(TRADES[o.group].toLowerCase())} sub…</option>${subOpts(o.group)}</select></div>`
        : `<p class="muted">No ${esc(TRADES[o.group].toLowerCase())} subs in your list yet. <a href="${esc(subsUrl)}">Add subs</a>, or type one in below.</p>`}
      <div class="row"><label>Sub company</label><input type="text" name="subName" value="${esc(o.subName)}" ${dis} style="max-width:60%"></div>
      <div class="row"><label>Sub email</label><input type="text" name="subEmail" value="${esc(o.subEmail)}" ${dis} style="max-width:60%"></div>
      <div class="row"><label>Work window</label><input type="text" name="window" value="${esc(o.window)}" ${dis} style="max-width:60%"></div>
      <table style="margin-top:10px"><tr><th>Item</th><th>Qty</th><th>Sub rate $</th></tr>${lineRows}</table>
      <p>${o.response?.total != null ? "Bid total" : "Sub total"}: <strong>${money(sub)}</strong> · Customer price: ${money(cust)} · Margin: <strong class="${gmCls}">${gm == null ? "–" : gm + "%"}</strong>${o.mode === "bid" ? ` <span class="muted">(bid requests don't show rates to the sub)</span>` : ""}</p>
      ${o.customerNotes ? `<p class="flag"><strong>Customer's notes (for you, not the sub):</strong> ${esc(o.customerNotes)}</p>` : ""}
      <label><strong>Site notes for the sub</strong> <span class="muted">(gate codes, where to stage, hours. No customer contact info.)</span></label>
      <textarea name="siteNotes" rows="3" ${dis}>${esc(o.siteNotes)}</textarea>
      <div style="margin-top:10px"><strong>Checklist</strong>${checks}</div>
      <div class="row"><label>Checked by</label><input type="text" name="checkedBy" value="${esc(o.checkedBy)}" ${dis} style="max-width:60%"></div>
      <p><a href="${esc(docUrl(o, true))}" target="_blank">Preview what the sub sees</a>${locked ? ` · <a href="${esc(docUrl(o, false))}" target="_blank">Sub's live page</a>` : ""}</p>
      ${locked ? `<p class="muted">Sent ${o.sentAt ? new Date(o.sentAt).toLocaleString("en-US", { timeZone: "America/Chicago" }) : ""} to ${esc(o.subEmail)}${o.checkedBy ? ` · checked by ${esc(o.checkedBy)}` : ""}.</p>
        <button class="btn" name="action" value="reopen">Reopen to resend</button>`
        : `<button class="btn" name="action" value="save">Save</button><button class="btn pri" name="action" value="send">Send to sub</button>`}
    </form>`;
  }).join("");
  return pageShell(`Sub paperwork ${rec.id}`, `
    <h1>Sub paperwork · quote ${esc(rec.id)}</h1>
    <p class="muted">${esc(r.company || "")} · ${esc(r.address)} · quote status: <strong>${esc(rec.status)}</strong> · <a href="${esc(reviewUrl)}">customer quote</a> · <a href="${esc(subsUrl)}">manage subs</a></p>
    <script>
      // Picking a sub fills in their name, email and any rates on their rate card.
      function pickSub(sel) {
        var o = sel.selectedOptions[0], f = sel.form;
        if (!o.value) return;
        f.subEmail.value = o.value; f.subName.value = o.dataset.name || "";
        var rates = {}; try { rates = JSON.parse(o.dataset.rates || "{}"); } catch (e) {}
        Object.keys(rates).forEach(function (k) { var i = f.elements["rate_" + k]; if (i && rates[k] !== "" && rates[k] != null) i.value = rates[k]; });
      }
    </script>
    ${message ? `<p class="ok">${esc(message)}</p>` : ""}
    <p class="muted">One order per trade. Check everything against the photos and the customer's quote, tick the checklist, then send. Subs never see customer prices or contact details.</p>
    ${cards || `<p class="flag">The quote has no priced work yet, so there's nothing to send.</p>`}
    <form method="POST" action="${esc(actionUrl)}"><button class="btn" name="action" value="redraft" onclick="return confirm('Rebuild every unsent order from the current quote? Unsent edits are lost.')">Rebuild unsent orders from the quote</button></form>`);
}

// ---------- emails ----------
export function subOrderEmail(rec, o, url) {
  const isWork = o.mode === "work";
  return emailShell(`
    <p>Hi${o.subName ? " " + esc(o.subName) : ""},</p>
    <p>${isWork ? "Here's a work order" : "We'd like your price on a job"} for <strong>${esc(TRADES[o.group].toLowerCase())}</strong> at ${esc(rec.request.address)}.${o.window ? ` Work window: ${esc(o.window)}.` : ""}</p>
    <p>${isWork ? `Scope and rates total <strong>${money(orderTotal(o))}</strong>. ` : ""}The link has the full scope, photos and our terms. You can ${isWork ? "accept the job" : "send your bid"} right from the page.</p>
    <p>${button(url, isWork ? "View work order" : "View & price the job")}</p>
    <p style="font-size:14px">Reference ${esc(orderCode(rec, o))}. Questions? Reply to this email.</p>`);
}

export function checkerEmail(rec, url) {
  const r = rec.request;
  return emailShell(`
    <p style="margin-top:0"><strong>Sub paperwork ready to check</strong> · quote ${esc(rec.id)}</p>
    <p>${esc(r.company || "")} · ${esc(r.address)}<br>${(rec.subOrders || []).map((o) => esc(TRADES[o.group])).join(", ")}</p>
    <p>Check the draft against the photos and the accepted quote, pick the sub, tick the checklist and send.</p>
    <p>${button(url, "Check & send to sub")}</p>`);
}

export function subResponseEmail(rec, o, checkUrl) {
  const isWork = o.mode === "work";
  return emailShell(`
    <p style="margin-top:0"><strong>${isWork ? "Sub accepted" : "Bid received"}</strong> · ${esc(orderCode(rec, o))}</p>
    <p>${esc(o.response.name)}${o.subName ? ` (${esc(o.subName)})` : ""} · ${esc(TRADES[o.group])} at ${esc(rec.request.address)}</p>
    <p>${isWork ? `Planned start: <strong>${esc(o.response.start || "not given")}</strong>` : `Bid total: <strong>${money(o.response.total)}</strong> vs customer price ${money(o.customerAmount)} · start ${esc(o.response.start || "?")}`}</p>
    ${o.response.notes ? `<p style="background:#f6f5f2;padding:10px 12px;border-radius:8px">${esc(o.response.notes)}</p>` : ""}
    <p>${button(checkUrl, "Open sub paperwork")}</p>`);
}

/**
 * Keep every order already sent, and add fresh drafts for trades that don't
 * have a sent order of the right kind yet. A work order drafted after a sub's
 * bid starts with that sub and their prices. Order numbers never change, so
 * links already sent to subs keep working.
 */
export function mergeDrafts(rec, subs = []) {
  const keep = (rec.subOrders || []).filter((o) => o.status !== "draft");
  let next = (rec.subOrders || []).reduce((m, o) => Math.max(m, o.n + 1), 0);
  const drafts = draftSubOrders(rec, subs).filter((d) => !keep.some((k) => k.group === d.group && k.mode === d.mode));
  for (const d of drafts) {
    d.n = next++;
    const bid = keep.filter((k) => k.group === d.group && k.status === "bid_received").pop();
    if (bid && d.mode === "work") {
      d.subName = bid.subName; d.subEmail = bid.subEmail;
      for (const l of d.lines) if (bid.response?.prices?.[l.key] != null) l.rate = bid.response.prices[l.key];
      d.history.push({ at: new Date().toISOString(), what: `Sub and rates taken from ${bid.subName || bid.subEmail}'s bid` });
    }
  }
  return [...keep, ...drafts].sort((a, b) => a.n - b.n);
}
