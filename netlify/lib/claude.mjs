// Sends the customer's photos to Claude and gets back a structured sizing
// assessment. Claude assigns tiers only; prices come from pricebook.mjs.
import { SIZE_GUESSES } from "./pricebook.mjs";

const SYSTEM = `You are the estimator for 123 Lot Lighting and its sister company 123 Pothole Repair, commercial parking lot companies in DuPage and Will County, Illinois. You size potholes from customer photos and assign each one to a fixed size tier. You never set prices; the company's price list does that.

TIER RULES (measure the pothole itself, edge to edge, at its longest and widest points):
- small: up to 2 ft × 2 ft and up to 3 in deep
- standard: up to 4 ft × 4 ft and up to 3 in deep
- large: up to 6 ft × 6 ft and up to 4 in deep
- saw_cut: bigger than 6 ft × 6 ft, deeper than 4 in, OR the pothole sits inside alligator-cracked or failed-base pavement where a patch won't hold. Estimate the square footage to cut out and replace: the failed area plus about 1 ft of sound pavement on each side.
- not_pothole: anything that isn't an asphalt pothole (catch basin, concrete, curb, utility cover). Not priced.
If a pothole is between two tiers, or a measurement is uncertain, choose the larger tier.

MEASURING:
- When a tape measure is in the photo, read the numbers on it. Use the depth photo (tape standing in the hole) for depth.
- With no tape, estimate from known references and say which you used: parking stall lines are usually about 9 ft apart, stripes about 4 in wide, a car tire about 8–10 in wide, a shoe about 11–12 in long. Set tape_visible to false.
- Several photos often show the same pothole. Count each distinct pothole once and list which photos show it.

POTHOLE CARDS: the customer groups photos into cards, one card per pothole ("Pothole 1", "Pothole 2", ...), sometimes with a location note. Treat each card as one pothole and report the potholes in card order, labeled with the card number and location. Exceptions, each also listed as a red flag:
- a card clearly shows two or more separate potholes: report each one separately.
- two cards clearly show the same pothole (same surroundings, same shape): report it once.
- a card has no photos, only a note: report it with tier "standard", tape_visible false, measured_from "no photo", and say in notes that it needs a photo.
SIZE GUESS: a card may include the customer's rough size guess (e.g. "about the size of a car door", which suggests a tier). Measure from the photos, never from the guess. If there's no tape measure, use the guess as a cross-check. If your size and the guess are more than one tier apart, list it as a red flag. A card with no photo but a size guess: use the guess's tier, measured_from "customer's guess", and say it needs a photo.

TOTAL COUNT: the customer may say how many potholes there are in total. Report only potholes you can see in the photos or that have their own card. If the customer's total is higher than that, list it as a red flag and mention it in owner_summary.

"Overview" photos show the wider lot. Use them for crack sealing and red flags, not as extra potholes unless the customer clearly meant them to be.

CRACK SEALING: only if the customer asked for crack sealing, estimate the linear feet of cracks visible that should be sealed. Otherwise 0.

RED FLAGS (list any you see): alligator cracking around a hole, sunken or failed base, standing water, a pothole next to a storm drain or catch basin, a utility cover in the repair area, concrete pavement, a hole not fully in frame, or the customer describing more potholes than the photos show.

CONFIDENCE:
- high: every pothole has a readable tape measure for size and depth, and clearly fits one tier.
- medium: one or more sizes estimated from references, or near a tier boundary.
- low: one or more potholes can't be sized, or the photos don't show the problem.

Always report your findings by calling the report_assessment tool exactly once. Do not answer in plain text.`;

const TOOL = {
  name: "report_assessment",
  description: "Report the sizing assessment for this quote request.",
  input_schema: {
    type: "object",
    properties: {
      potholes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string", description: "Short name, e.g. 'Pothole 1 – drive lane near entrance'" },
            photos: { type: "array", items: { type: "integer" }, description: "Photo numbers that show this pothole" },
            length_in: { type: "number" },
            width_in: { type: "number" },
            depth_in: { type: "number" },
            tape_visible: { type: "boolean" },
            measured_from: { type: "string", description: "How size was measured, e.g. 'tape measure' or 'stall lines'" },
            tier: { type: "string", enum: ["small", "standard", "large", "saw_cut", "not_pothole"] },
            saw_cut_sqft: { type: "number", description: "Only for saw_cut: square feet to remove and replace" },
            notes: { type: "string" },
          },
          required: ["label", "photos", "length_in", "width_in", "depth_in", "tape_visible", "measured_from", "tier"],
        },
      },
      crack_seal_linear_ft: { type: "number" },
      red_flags: { type: "array", items: { type: "string" } },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
      photo_request: { type: "string", description: "If more photos would help, a short, friendly request to the customer saying exactly what to send. Empty if none needed." },
      owner_summary: { type: "string", description: "2–3 sentences for the owner: what you see, how sure you are, anything to check." },
    },
    required: ["potholes", "crack_seal_linear_ft", "red_flags", "confidence", "photo_request", "owner_summary"],
  },
};

export async function assessPhotos(request, photosB64) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  const model = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";

  const details = [
    `Property: ${request.company || "(not given)"}, ${request.address}`,
    `Property type: ${request.property_type || ""}`,
    `Services requested: ${(request.services || []).join(", ") || "not specified"}`,
    `Customer notes: ${request.notes || "(none)"}`,
    `Number of photos: ${photosB64.length}`,
    `Customer's total pothole count: ${request.pothole_total || "not given"}`,
    `Pothole cards: ${(request.photoGroups || []).filter((g) => g.type === "pothole").length || "not used (photos are ungrouped)"}`,
  ].join("\n");

  const content = [{ type: "text", text: details }];
  const addPhoto = (i) => {
    if (!photosB64[i]) return;
    content.push({ type: "text", text: `Photo ${i + 1}:` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: photosB64[i] } });
  };
  const groups = request.photoGroups || [];
  if (groups.length) {
    const used = new Set();
    let card = 0;
    for (const g of groups) {
      // Lighting, striping and sealcoating photos are for the owner, not for pothole sizing.
      if (g.type === "striping" || g.type === "sealcoat" || g.type === "lighting") { g.photos.forEach((i) => used.add(i)); continue; }
      if (g.type === "pothole") {
        card += 1;
        const guess = SIZE_GUESSES[g.size];
        content.push({ type: "text", text: `--- Pothole ${card}${g.note ? ` (customer note: ${g.note})` : ""}${guess ? ` (customer's size guess: ${guess.label}, suggests ${guess.tier})` : ""}: ${g.photos.length ? `photos ${g.photos.map((i) => i + 1).join(", ")}` : "no photos"} ---` });
      } else if (g.type === "other") {
        content.push({ type: "text", text: `--- Other photos (catch basins, curbs or anything else the customer wants looked at) ---` });
      } else {
        content.push({ type: "text", text: `--- Overview photos of the lot ---` });
      }
      g.photos.forEach((i) => { used.add(i); addPhoto(i); });
    }
    const loose = photosB64.map((_, i) => i).filter((i) => !used.has(i));
    if (loose.length) { content.push({ type: "text", text: "--- Other photos ---" }); loose.forEach(addPhoto); }
  } else {
    photosB64.forEach((_, i) => addPhoto(i));
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 27000);
  let res;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model, max_tokens: 2000, system: SYSTEM,
        // Newer models reject forced tool_choice ("tool"/"any"), so use "auto";
        // the system prompt tells Claude to always call the tool.
        tools: [TOOL], tool_choice: { type: "auto" },
        messages: [{ role: "user", content }],
      }),
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const block = (data.content || []).find((b) => b.type === "tool_use");
  if (!block) throw new Error("Claude replied without an assessment (stop_reason: " + data.stop_reason + ")");
  return { ...block.input, model };
}
