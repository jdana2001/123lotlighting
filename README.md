# 123lotlighting.com

Static website for 123 Lot Lighting, hosted on Netlify. Built the same way as 123lotstriping.com and 123pothole.com.

- `build.py` holds the business details (CONFIG at the top) and all page copy.
- `visuals.py` holds the hero illustration and service icons.
- `src/styles.css` is the stylesheet (same base as the other 123 sites).
- `python3 build.py` regenerates the finished site into `site/`, which Netlify publishes as-is.

## Making changes

1. Edit copy or details in `build.py` (or styles in `src/styles.css`).
2. Run `python3 build.py`.
3. Commit both the source and the rebuilt `site/` folder, then push. Netlify updates the live site within about a minute.

## Placeholders still to fill

Owner bios on the About page are a placeholder (highlighted in yellow). Phone, hours and response time match 123 Lot Striping; the email is quotes@123lotlighting.com, so set up that forward at Namecheap.

## Photos

Drop photos into `src/images/` and rebuild. `hero.jpg` replaces the hero illustration. Service pages pick up `<slug>.jpg` (for example `parking-lot-light-repair.jpg`), and industry pages do the same (`hoa.jpg`, `healthcare.jpg`, `schools.jpg`, `industrial.jpg`). `property-managers.jpg`, `retail.jpg` and `texture.jpg` are borrowed from the other 123 sites for now.

## Quote form (same system as the other 123 sites)

The `/quote/` page is the same quote builder as 123lotstriping.com, with **Lighting** listed first and pre-selected. Customers enter how many pole lights and wall packs they have, how many are out, damaged poles and lit signs, and whether they want repairs or LED. They can also add striping, sealcoating, potholes and crack sealing.

1. **quote-submit** saves the request and photos (Netlify Blobs, separate from the other sites').
2. **quote-process** prices lighting, striping and sealcoating from the counts, sizes any potholes from photos, creates the HubSpot contact and a deal (named "... – 123 Lot Lighting"), then emails the owner a review link. Lighting requests always go to owner review.
3. **quote-review** (owner page): adjust, add a note, **Send**. The customer gets the quote by email.
4. **quote-accept** records acceptance, moves the deal to Won and drafts sub paperwork (**sub-check** / **sub-doc**). Lighting work goes to subs tagged "Parking lot lighting (electrical)" on **subs-admin**.
5. **quote-sweep** retries anything stuck, every 10 minutes.

Prices live in `netlify/lib/pricebook.mjs`. **Lighting prices are placeholders** drafted from 2026 market rates; replace them with electrician sub quotes. The public price ranges on the site are read from the same file. Striping, sealcoating and pothole prices are copied from the other sites; if you change them there, change them here too.

### Environment variables (Netlify → Site configuration → Environment variables)

Copy these from the 123pothole site, changing only the two marked lines:

| Variable | Value |
|---|---|
| `RESEND_API_KEY` | Same key as the pothole site |
| `QUOTE_FROM_EMAIL` | **`123 Lot Lighting <quotes@123lotlighting.com>`** (verify 123lotlighting.com in Resend first; until then use the pothole address) |
| `OWNER_EMAIL` | Same as the pothole site |
| `QUOTE_SECRET` | **A new long random string** (don't reuse another site's) |
| `HUBSPOT_TOKEN` | Same as the pothole site |
| `ANTHROPIC_API_KEY` | Same as the pothole site (only used for pothole photos) |
| `CHECKER_EMAIL`, `COMPANY_PHONE`, `CLAUDE_MODEL`, `AUTO_SEND` | Optional, same as the pothole site |

Until `QUOTE_SECRET`, `RESEND_API_KEY` and `OWNER_EMAIL` are set, the quote form shows an error on submit. Set them right after the first deploy.

## Search engine verification

To verify the site in Google Search Console or Bing Webmaster Tools with the "HTML tag" method, copy just the code inside `content="..."` into `google_verification` or `bing_verification` in CONFIG, rebuild and push. (DNS verification at Namecheap works too and needs no code change.)
