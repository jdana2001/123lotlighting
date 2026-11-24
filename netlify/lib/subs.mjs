// Subcontractor directory and the standard terms printed on every work order.
// Subs are managed on the Subs page (subs-admin function) and stored in Netlify
// Blobs. SUBS below is only a starting list used until the Subs page is saved.
// trades: which work they do ("lighting", "pothole", "striping", "sealcoat").
import { getSubs } from "./services.mjs";

export const AREAS = ["DuPage", "Will", "Cook", "Kane", "Kendall", "Lake", "McHenry"];

/** The live sub directory. */
export async function loadSubs() {
  try { return (await getSubs()) || SUBS; } catch (e) { console.error(e); return SUBS; }
}

export const SUBS = [
  // { name: "Example Asphalt LLC", contact: "Mike", email: "mike@example.com", phone: "(630) 555-0100", trades: ["pothole", "sealcoat"] },
];

export const COMPANY = {
  name: "123 Lot Lighting",
  phone: process.env.COMPANY_PHONE || "",
  email: process.env.OWNER_EMAIL || "",
};

/** Printed on every work order and bid request. */
export const SUB_TERMS = [
  "Do not contact the property owner, manager or tenants. Call us with any questions on site.",
  "Take before and after photos of every repair or area, from the same angle, and send them with your invoice.",
  "Measure each pothole before starting. If one is larger or deeper than its tier, call us before doing the work.",
  "Set up cones and signage for every work zone. Leave the site clean, with all debris removed.",
  "Keep a current certificate of insurance on file with us (general liability and auto, naming us as additional insured).",
  "Quantities are our estimates. Bill what you actually complete, at the rates on this order. Extra work needs our written OK first.",
  "Invoice us, not the property, within 7 days of completion.",
];
