// Subs page: add, edit and deactivate subcontractors. Private link (signed with
// purpose "subsadmin"), opened from the owner review page or the sub paperwork page.
import crypto from "node:crypto";
import { verify, sign, saveSubs, htmlRes } from "../lib/services.mjs";
import { pageShell, esc, money } from "../lib/templates.mjs";
import { loadSubs, AREAS } from "../lib/subs.mjs";
import { PRODUCTS, QTY_KEYS } from "../lib/pricebook.mjs";
import { TRADES } from "../lib/suborder.mjs";

const clean = (v, n) => String(v ?? "").trim().slice(0, n);

export default async (req) => {
  const url = new URL(req.url);
  const t = url.searchParams.get("t");
  if (!verify("subsadmin", "staff", t)) return htmlRes(pageShell("Not found", "<h1>Link not valid</h1>"), 403);
  const self = `/.netlify/functions/subs-admin?t=${t}`;
  let subs = (await loadSubs()).map((s) => ({ id: s.id || crypto.randomBytes(4).toString("hex"), active: true, trades: [], areas: [], rates: {}, ...s }));
  let message = "";

  if (req.method === "POST") {
    const f = new URLSearchParams(await req.text());
    const id = f.get("id");
    if (f.get("action") === "delete") {
      const gone = subs.find((s) => s.id === id);
      subs = subs.filter((s) => s.id !== id);
      message = gone ? `Deleted ${gone.name}.` : "Not found.";
    } else {
      const s = {
        id: id || crypto.randomBytes(4).toString("hex"),
        name: clean(f.get("name"), 120), contact: clean(f.get("contact"), 120),
        email: clean(f.get("email"), 200).toLowerCase(), phone: clean(f.get("phone"), 40),
        trades: Object.keys(TRADES).filter((k) => f.get(`trade_${k}`) === "on"),
        areas: AREAS.filter((a) => f.get(`area_${a}`) === "on"),
        active: f.get("active") === "on",
        notes: clean(f.get("notes"), 1000),
        rates: {},
      };
      for (const k of QTY_KEYS) {
        const v = f.get(`rate_${k}`);
        if (v !== null && v.trim() !== "" && Number.isFinite(Number(v))) s.rates[k] = Math.max(0, Math.round(Number(v) * 100) / 100);
      }
      if (!s.name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.email)) message = "Not saved: a sub needs a company name and a valid email.";
      else if (!s.trades.length) message = "Not saved: pick at least one trade.";
      else {
        const i = subs.findIndex((x) => x.id === s.id);
        if (i >= 0) subs[i] = s; else subs.push(s);
        message = `Saved ${s.name}.`;
      }
    }
    if (!message.startsWith("Not saved")) await saveSubs(subs);
  }

  const editing = subs.find((s) => s.id === url.searchParams.get("edit")) || null;
  return htmlRes(page(subs, editing, self, message));
};

function page(subs, e, self, message) {
  const sorted = [...subs].sort((a, b) => (b.active - a.active) || a.name.localeCompare(b.name));
  const rows = sorted.map((s) => `<tr${s.active ? "" : ' style="opacity:.5"'}>
    <td><strong>${esc(s.name)}</strong>${s.contact ? `<br><span class="muted">${esc(s.contact)}</span>` : ""}${s.active ? "" : " <span class=\"muted\">(inactive)</span>"}</td>
    <td>${esc(s.trades.map((k) => ({ lighting: "Lighting", pothole: "Pothole", striping: "Striping", sealcoat: "Sealcoating" })[k] || k).join(", "))}<br><span class="muted">${esc((s.areas || []).join(", "))}</span></td>
    <td><a href="${esc(self)}&edit=${esc(s.id)}#form">Edit</a></td></tr>`).join("");
  const v = e || { name: "", contact: "", email: "", phone: "", trades: [], areas: [], active: true, notes: "", rates: {} };
  const tradeBoxes = Object.entries(TRADES).map(([k, label]) =>
    `<label style="display:block;margin:4px 0"><input type="checkbox" name="trade_${k}" ${v.trades.includes(k) ? "checked" : ""}> ${esc(label)}</label>`).join("");
  const areaBoxes = AREAS.map((a) => `<label style="display:inline-block;margin:4px 12px 4px 0"><input type="checkbox" name="area_${a}" ${(v.areas || []).includes(a) ? "checked" : ""}> ${esc(a)}</label>`).join("");
  let lastG = null;
  const rateRows = QTY_KEYS.map((k) => {
    const p = PRODUCTS[k];
    const head = p.group !== lastG ? `<p style="margin:12px 0 2px;font-weight:700">${esc(TRADES[p.group] || p.group)}</p>` : "";
    lastG = p.group;
    return head + `<div class="row"><label for="r-${k}">${esc(p.name)} <span class="muted">per ${esc(p.unit)}</span></label>
      <input type="number" min="0" step="0.01" id="r-${k}" name="rate_${k}" value="${v.rates?.[k] ?? ""}" placeholder="${p.cost}"></div>`;
  }).join("");
  return pageShell("Subs", `
    <h1>Subs</h1>
    <p class="muted">Your subcontractor list. The sub paperwork page shows only the subs who do that trade; picking one fills in their email and their rates. Bookmark this page.</p>
    ${message ? `<p class="${message.startsWith("Not saved") ? "flag" : "ok"}">${esc(message)}</p>` : ""}
    <div class="card"><h2>${subs.length} sub${subs.length === 1 ? "" : "s"}</h2>
      ${subs.length ? `<table><tr><th>Sub</th><th>Trades · areas</th><th></th></tr>${rows}</table>` : `<p class="muted">None yet. Add your first one below.</p>`}
      ${e ? `<p><a href="${esc(self)}#form">+ Add a new sub instead</a></p>` : ""}</div>
    <form class="card" id="form" method="POST" action="${esc(self)}">
      <h2>${e ? `Edit ${esc(e.name)}` : "Add a sub"}</h2>
      ${e ? `<input type="hidden" name="id" value="${esc(e.id)}">` : ""}
      <div class="row"><label for="s-name">Company</label><input type="text" id="s-name" name="name" value="${esc(v.name)}" required style="max-width:60%"></div>
      <div class="row"><label for="s-contact">Contact person</label><input type="text" id="s-contact" name="contact" value="${esc(v.contact)}" style="max-width:60%"></div>
      <div class="row"><label for="s-email">Email</label><input type="text" id="s-email" name="email" value="${esc(v.email)}" required style="max-width:60%"></div>
      <div class="row"><label for="s-phone">Phone</label><input type="text" id="s-phone" name="phone" value="${esc(v.phone)}" style="max-width:60%"></div>
      <p style="margin:12px 0 2px"><strong>Trades</strong></p>${tradeBoxes}
      <p style="margin:12px 0 2px"><strong>Counties they cover</strong></p>${areaBoxes}
      <p style="margin:12px 0 2px"><strong>Notes</strong> <span class="muted">(insurance expiry, crew size, reliability. For you, never shown to the sub.)</span></p>
      <textarea name="notes" rows="2">${esc(v.notes)}</textarea>
      <label style="display:block;margin:10px 0"><input type="checkbox" name="active" ${v.active !== false ? "checked" : ""}> Active (show in the dropdown)</label>
      <details ${Object.keys(v.rates || {}).length ? "open" : ""}><summary><strong>Their rates</strong> <span class="muted">(optional; blank = your default, shown in grey)</span></summary>${rateRows}</details>
      <p><button class="btn pri" type="submit">${e ? "Save changes" : "Add sub"}</button></p>
    </form>
    ${e ? `<form method="POST" action="${esc(self)}" onsubmit="return confirm('Delete ${esc(e.name.replace(/['"\\]/g, ""))}? Tip: unticking Active hides them but keeps their details.')">
      <input type="hidden" name="id" value="${esc(e.id)}"><button class="btn" name="action" value="delete">Delete this sub</button></form>` : ""}`);
}
