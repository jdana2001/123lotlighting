// Core flow: assess photos with Claude, price from the price book, then either
// send the quote (auto mode) or email the owner a review link (default).
import { assessPhotos } from "./claude.mjs";
import { PRODUCTS, buildQuote, qtyFromAssessment, qtyFromCalculators, mergeQty, emptyQty } from "./pricebook.mjs";
import {
  getRecord, saveRecord, getPhoto, sendEmail, ownerEmail, link, sign,
  hubspotOn, hubspotCreateLead, hubspotQuoteSent, clearPending,
} from "./services.mjs";
import { customerQuoteEmail, ownerReviewEmail } from "./templates.mjs";

// Services Claude prices from photos, and services priced by the on-page calculators.
// Anything else is flagged for manual pricing.
const PHOTO_SERVICES = new Set(["Pothole repair", "Crack sealing", "Not sure"]);
const CALC_SERVICES = new Set(["Lighting", "Striping", "Sealcoating"]);
export const needsPhotos = (r) => {
  const s = r.services || [];
  return !s.length || s.some((x) => PHOTO_SERVICES.has(x)); // old form/no choice: treat as photo request
};
const MAX_ATTEMPTS = 3;

export async function processQuote(id) {
  const rec = await getRecord(id);
  if (!rec || !["received", "processing"].includes(rec.status)) return rec;

  rec.status = "processing";
  rec.attempts = (rec.attempts || 0) + 1;
  rec.processingAt = new Date().toISOString();
  rec.flags = rec.flags || [];
  await saveRecord(rec);

  // 1. Capture the lead in HubSpot first, so the contact exists even if AI fails.
  if (hubspotOn() && !rec.hubspot) {
    try { rec.hubspot = await hubspotCreateLead(rec); }
    catch (e) { console.error(e); rec.flags.push("HubSpot contact/deal not created: " + e.message.slice(0, 120)); }
    await saveRecord(rec);
  }

  // 2. Claude sizes the potholes.
  rec.error = null;
  rec.aiOff = !process.env.ANTHROPIC_API_KEY; // no key = owner sizes the photos by hand
  if (rec.aiOff) {
    // skip Claude; the review page shows the photos and tier rules
  } else if (!needsPhotos(rec.request)) {
    // Lighting / striping / sealcoating only: priced from the calculators, no photo sizing.
  } else if (rec.photoCount > 0) {
    try {
      const photos = [];
      for (let i = 0; i < rec.photoCount; i++) {
        const buf = await getPhoto(id, i);
        if (buf) photos.push(buf.toString("base64"));
      }
      rec.assessment = await assessPhotos(rec.request, photos);
    } catch (e) {
      console.error(e);
      const timedOut = e.name === "AbortError";
      if (timedOut && rec.attempts < MAX_ATTEMPTS) {
        rec.status = "received"; // the scheduled sweep will retry
        await saveRecord(rec);
        return rec;
      }
      // Keep the owner email readable; the full error is in the function log
      // and on the record for debugging.
      rec.errorDetail = String(e.message || e).slice(0, 1000);
      rec.error = timedOut ? "Claude took too long to respond" : "Claude couldn't assess the photos (technical error, details in the Netlify function log)";
    }
  } else {
    rec.error = "The customer didn't send photos";
  }

  const extra = (rec.request.services || []).filter((s) => !PHOTO_SERVICES.has(s) && !CALC_SERVICES.has(s));
  if (extra.length) rec.flags.push(`Also asked about: ${extra.join(", ")}. Price separately`);
  if ((rec.assessment?.potholes || []).some((h) => h.tier === "not_pothole")) rec.flags.push("Photos include something that isn't a pothole");

  const r = rec.request;
  // Deterministic check, in case Claude misses it: customer says more potholes than were quoted.
  const quotedHoles = (rec.assessment?.potholes || []).filter((h) => h.tier !== "not_pothole").length
    || (r.photoGroups || []).filter((g) => g.type === "pothole").length;
  if (r.pothole_total && r.pothole_total > quotedHoles) {
    rec.flags.push(`Customer says about ${r.pothole_total} potholes in total, but only ${quotedHoles} are sized. Ask for more photos or confirm on site`);
  }
  if (r.lighting) {
    const l = r.lighting;
    if (!l.poles && !l.walls && !l.out && !l.damaged && !l.signs && !l.controls) rec.flags.push("Lighting requested without any fixture counts");
    if (l.need === "advise") rec.flags.push("Lighting: customer isn't sure between repair and LED upgrade. Price the repair line, or switch to LED lines");
    if (l.need === "repair" && !l.out) rec.flags.push("Lighting repair requested without a count of lights out");
    if (l.damaged) rec.flags.push(`${l.damaged} damaged pole(s): confirm base condition and pole height on site`);
    if (l.signs) rec.flags.push("Lighted sign work: confirm sign type and size from photos");
  }
  if (r.striping) {
    if (!r.striping.stalls && !r.striping.ada) rec.flags.push("Striping requested without a stall count");
    if (r.striping.layout === "new") rec.flags.push("New striping layout: confirm stall dimensions and count on site");
  }
  if (r.sealcoat) {
    if (!r.sealcoat.sqft) rec.flags.push("Sealcoating requested without an area");
    else rec.flags.push(`Sealcoat area ${r.sealcoat.sqft.toLocaleString("en-US")} sq ft ${r.sealcoat.measured === "map" ? "outlined on the map" : "typed by the customer"}: verify on satellite`);
    if (r.sealcoat.cracks !== "none") rec.flags.push(`Crack filling footage estimated from "${r.sealcoat.cracks === "lots" ? "lots of cracks" : "some cracks"}": verify`);
  }

  // 3. Price it from the price book.
  rec.qty = mergeQty(rec.assessment ? qtyFromAssessment(rec.assessment) : emptyQty(), qtyFromCalculators(r.striping, r.sealcoat, r.lighting));
  rec.discountPct = 0;
  rec.quote = buildQuote(rec.qty, 0);

  // 4. Auto-send only when everything is clean; otherwise owner reviews.
  const a = rec.assessment;
  const calc = Boolean(r.striping || r.sealcoat || r.lighting); // customer-entered counts always get a human look
  const clean = !calc && a && a.confidence === "high" && !(a.red_flags || []).length && !rec.flags.length && rec.quote.total > 0;
  if (process.env.AUTO_SEND === "true" && clean) {
    await sendQuote(rec);
  } else {
    rec.status = "review";
    await saveRecord(rec);
    await notifyOwner(rec);
  }
  await clearPending(id);
  return rec;
}

export async function notifyOwner(rec) {
  const to = ownerEmail();
  if (!to) { console.error("OWNER_EMAIL not set"); return; }
  const r = rec.request;
  const subject = rec.quote.total
    ? `Review quote ${rec.id}: $${Math.round(rec.quote.total)} · ${r.company || r.address}`
    : `New quote request needs pricing: ${r.company || r.address}`;
  await sendEmail({ to, subject, html: ownerReviewEmail(rec, link("quote-review", "review", rec.id, rec.origin)), replyTo: r.email });
}

export async function sendQuote(rec) {
  rec.sentAt = new Date().toISOString();
  const r = rec.request;
  await sendEmail({
    to: r.email,
    bcc: ownerEmail() || undefined,
    replyTo: ownerEmail() || undefined,
    subject: `Your quote from 123 Lot Lighting for ${r.company || r.address} (${rec.id})`,
    html: customerQuoteEmail(rec, link("quote-accept", "accept", rec.id, rec.origin)),
  });
  rec.status = "sent";
  await saveRecord(rec);
  if (hubspotOn()) {
    try { await hubspotQuoteSent(rec, PRODUCTS); }
    catch (e) { console.error(e); rec.flags = [...(rec.flags || []), "HubSpot line items not added: " + e.message.slice(0, 120)]; await saveRecord(rec); }
  }
}

export { sign };
