#!/usr/bin/env python3
"""Builds the 123lotlighting.com static site into ./site.

Edit the CONFIG block for business details, the page content below for copy,
then run:  python3 build.py
Netlify serves the ./site folder as-is (see netlify.toml).
"""
import html
import json
import shutil
from pathlib import Path

from visuals import HERO_STALLS, ICONS

ROOT = Path(__file__).parent
OUT = ROOT / "site"
SRC = ROOT / "src"

# ---------------------------------------------------------------------------
# CONFIG — replace the bracketed placeholders with real values, then rebuild.
# Placeholders render highlighted in yellow so they're easy to spot.
# ---------------------------------------------------------------------------
CONFIG = {
    "name": "123 Lot Lighting",
    "domain": "https://123lotlighting.com",
    "phone": "(630) 868-9208",
    "email": "quotes@123lotlighting.com",
    "hours": "Mon–Fri 7am–5pm",
    "response": "one business day",
    "area": "DuPage and Will County, Illinois",
    # Search engine verification: paste only the content="..." code from each tool's
    # "HTML tag" verification option. Leave empty until you have it.
    "google_verification": "",   # Google Search Console
    "bing_verification": "",     # Bing Webmaster Tools
    # Public profile URLs (Google Business Profile, Bing Places, Yelp, BBB, Facebook...).
    # Add each one once it exists; they go into the schema as sameAs so search and AI tools
    # can tie the listings to this site.
    "profiles": [],
}


def verification_tags():
    tags = ""
    if CONFIG["google_verification"]:
        tags += f'<meta name="google-site-verification" content="{html.escape(CONFIG["google_verification"])}">\n'
    if CONFIG["bing_verification"]:
        tags += f'<meta name="msvalidate.01" content="{html.escape(CONFIG["bing_verification"])}">\n'
    return tags


IMAGES = SRC / "images"


PHOTO_POS = {}


def photo(slot, alt, cls="photo", lazy=True):
    """<img> for src/images/<slot>.jpg (or .png/.webp) if that file exists, else ''."""
    for ext in (".jpg", ".jpeg", ".png", ".webp"):
        f = IMAGES / f"{slot}{ext}"
        if f.exists():
            pos = f' style="object-position:{PHOTO_POS[slot]}"' if slot in PHOTO_POS else ""
            ld = ' loading="lazy"' if lazy else ' fetchpriority="high"'
            return f'<img class="{cls}" src="/images/{f.name}" alt="{html.escape(alt)}"{ld}{pos}>'
    return ""


def is_ph(v):
    return v.startswith("[") and v.endswith("]")


def val(key):
    """A config value for display, highlighted if still a placeholder."""
    v = CONFIG[key]
    return f'<span class="ph">{html.escape(v)}</span>' if is_ph(v) else html.escape(v)


def tel_href():
    if is_ph(CONFIG["phone"]):
        return "/contact/"
    digits = "".join(c for c in CONFIG["phone"] if c.isdigit())
    return f"tel:+1{digits[-10:]}"


def phone_link(cls="", label=None):
    text = label or val("phone")
    c = f' class="{cls}"' if cls else ""
    return f'<a{c} href="{tel_href()}">{text}</a>'


def email_link():
    if is_ph(CONFIG["email"]):
        return val("email")
    e = html.escape(CONFIG["email"])
    return f'<a href="mailto:{e}">{e}</a>'


import re as _re


def _pricebook():
    """Read lighting prices from netlify/lib/pricebook.mjs so published prices match the quote calculator."""
    src = (ROOT / "netlify" / "lib" / "pricebook.mjs").read_text(encoding="utf-8")
    prices = {k: float(v) for k, v in _re.findall(r"(\w+):\s*\{[^}]*?price:\s*([\d.]+)", src)}
    prices["MIN"] = float(_re.search(r"lightingMin:\s*([\d.]+)", src).group(1))
    return prices


PRICE = _pricebook()


def money(v):
    return f"${v:,.0f}" if float(v).is_integer() else f"${v:,.2f}"


# Public pages show prices as a range around the price list (the quote calculator stays exact).
RANGE_LOW, RANGE_HIGH = 0.75, 1.25


def _nice(x):
    step = 0.25 if x < 5 else 1 if x < 20 else 5 if x < 100 else 25 if x < 1000 else 50
    return round(x / step) * step


def rng(v):
    return f"{money(_nice(v * RANGE_LOW))}–{money(_nice(v * RANGE_HIGH))}"


def job_rng(raw):
    """Range for a whole job, with the job minimum."""
    lo, hi = max(PRICE["MIN"], _nice(raw * RANGE_LOW)), max(PRICE["MIN"], _nice(raw * RANGE_HIGH))
    return f"{money(lo)} (job minimum)" if lo == hi else f"{money(lo)}–{money(hi)}"


BIZ_ID = CONFIG["domain"] + "/#business"
OG_IMAGE = CONFIG["domain"] + "/images/property-managers.jpg"


def ref_biz():
    return {"@id": BIZ_ID}


def faq_html(items, title="Frequently asked questions"):
    rows = "".join(f'<details class="faq-item"><summary>{q}</summary><p>{a}</p></details>' for q, a in items)
    return f'<h2>{title}</h2><div class="faq">{rows}</div>'


def faq_section(items, title="Frequently asked questions"):
    return f'<section class="section"><div class="wrap">{faq_html(items, title)}</div></section>'


def _plain(t):
    return html.unescape(_re.sub(r"<[^>]+>", "", t))


def faq_schema(items):
    return {"@context": "https://schema.org", "@type": "FAQPage",
            "mainEntity": [{"@type": "Question", "name": _plain(q),
                            "acceptedAnswer": {"@type": "Answer", "text": _plain(a)}} for q, a in items]}


def service_schema(name, desc, path, area=None):
    return {"@context": "https://schema.org", "@type": "Service", "name": name, "serviceType": name,
            "description": desc, "url": CONFIG["domain"] + path, "provider": ref_biz(),
            "areaServed": area or [{"@type": "AdministrativeArea", "name": "DuPage County, IL"},
                                   {"@type": "AdministrativeArea", "name": "Will County, IL"}]}


def breadcrumb_schema(path, name):
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": CONFIG["domain"] + "/"},
        {"@type": "ListItem", "position": 2, "name": name, "item": CONFIG["domain"] + path}]}




# ---------------------------------------------------------------------------
# Site structure
# ---------------------------------------------------------------------------
SERVICES = [
    ("parking-lot-light-repair", "Parking Lot Light Repair",
     "Lights out, flickering or cycling on and off? We find the cause and fix it, from lamps and drivers to photocells and wiring."),
    ("led-lighting-upgrades", "LED Lighting Upgrades",
     "Old metal halide and sodium heads swapped for LED: brighter, more even light for a fraction of the power."),
    ("wall-packs-building-lights", "Wall Packs & Building Lights",
     "Wall packs, entrance and canopy lights repaired or replaced, so doors, docks and walkways stay lit."),
    ("light-pole-repair-replacement", "Light Pole Repair & Replacement",
     "Knocked-down, leaning or rusted poles replaced, with open hand-holes and exposed wiring made safe."),
    ("lighted-sign-repair", "Lighted Sign Repair",
     "Pylon, monument and building signs relit, with LED retrofits for dim or dead sign cabinets."),
    ("lighting-maintenance-plans", "Lighting Maintenance Plans",
     "Scheduled checks and repairs, so outages get fixed before tenants and customers notice."),
]
INDUSTRIES = [
    ("property-managers", "Property Managers"),
    ("retail", "Retail & Shopping Centers"),
    ("hoa", "HOAs & Apartments"),
    ("healthcare", "Hospitals & Medical"),
    ("schools", "Schools & Churches"),
    ("industrial", "Warehouses & Industrial"),
]
CITIES = [
    ("naperville", "Naperville",
     "Naperville's shopping centers, office parks and medical buildings stay busy into the evening, so dark corners get noticed fast. We work on both the DuPage and Will County sides of the city."),
    ("joliet", "Joliet",
     "From retail strips to distribution yards along I-80 and I-55, we fix pole lights, wall packs and dock lighting without interrupting operations."),
    ("aurora", "Aurora",
     "We serve the DuPage and Will County sides of Aurora, working with retail centers, apartment communities and medical offices."),
    ("bolingbrook", "Bolingbrook",
     "Warehouses, retail and townhome communities make up most of our Bolingbrook work, from truck-court poles to guest-parking lights."),
    ("plainfield", "Plainfield",
     "Newer retail and office lots in Plainfield still lose lights to failed drivers, photocells and the occasional plow-struck pole."),
    ("downers-grove", "Downers Grove",
     "Office campuses and medical buildings here want lighting fixed without disrupting tenants. We schedule around your busiest hours."),
    ("wheaton", "Wheaton",
     "Churches, schools, retail centers and HOAs make up most of our Wheaton work."),
    ("romeoville", "Romeoville",
     "We relight distribution-center yards, retail lots and townhome guest parking across Romeoville."),
]
CITY_COUNTY = {'naperville': 'DuPage and Will County', 'joliet': 'Will County', 'aurora': 'DuPage, Kane, Will and Kendall counties', 'bolingbrook': 'Will and DuPage County', 'plainfield': 'Will and Kendall County', 'downers-grove': 'DuPage County', 'wheaton': 'DuPage County', 'romeoville': 'Will County'}
CITY_NEAR = {'naperville': ['aurora', 'plainfield', 'bolingbrook', 'wheaton'], 'joliet': ['romeoville', 'plainfield', 'bolingbrook'], 'aurora': ['naperville', 'plainfield'], 'bolingbrook': ['romeoville', 'naperville', 'downers-grove'], 'plainfield': ['naperville', 'joliet', 'romeoville'], 'downers-grove': ['wheaton', 'naperville', 'bolingbrook'], 'wheaton': ['downers-grove', 'naperville'], 'romeoville': ['bolingbrook', 'joliet', 'plainfield']}

NAV = [
    ("/parking-lot-light-repair/", "Light Repair"),
    ("/led-lighting-upgrades/", "LED Upgrades"),
    ("/who-we-serve/", "Who We Serve"),
    ("/service-area/", "Service Area"),
    ("/about/", "About"),
    ("/contact/", "Contact"),
]

FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@600;700&display=swap" rel="stylesheet">')


def header(path):
    links = "".join(
        f'<a href="{h}"{" aria-current=\"page\"" if path == h else ""}>{t}</a>' for h, t in NAV
    )
    links += '<a class="nav-quote" href="/quote/">Get a Quote</a>'
    return f'''<a class="skip" href="#main">Skip to content</a>
<header class="site-head"><div class="wrap">
  <a class="brand" href="/" aria-label="123 Lot Lighting home"><span class="brand-mark">123</span>Lot Lighting</a>
  <nav class="nav" id="nav" aria-label="Main">{links}</nav>
  <button class="menu-btn" aria-expanded="false" aria-controls="nav" onclick="var n=document.getElementById('nav');var o=n.classList.toggle('open');this.setAttribute('aria-expanded',o)">Menu</button>
  <div class="head-cta">{phone_link("head-phone")}<a class="btn btn-primary" href="/quote/">Get a Quote</a></div>
</div></header>'''


def footer():
    svc = "".join(f'<li><a href="/{s}/">{t}</a></li>' for s, t, _ in SERVICES)
    ind = "".join(f'<li><a href="/{s}/">{t}</a></li>' for s, t in INDUSTRIES)
    cty = "".join(f'<li><a href="/{s}/">{t}</a></li>' for s, t, _ in CITIES[:6])
    return f'''<footer class="site-foot"><div class="wrap">
  <div class="foot-grid">
    <div><h4>123 Lot Lighting</h4>
      <p>Parking lot light repair, LED upgrades, wall packs, light poles and lighted signs for {CONFIG["area"]}.</p>
      <p>{phone_link()}<br>{email_link()}<br>{val("hours")}</p></div>
    <div><h4>Services</h4><ul>{svc}<li><a href="/parking-lot-lighting-cost/">Lighting cost</a></li></ul></div>
    <div><h4>Who we serve</h4><ul>{ind}</ul></div>
    <div><h4>Service area</h4><ul>{cty}<li><a href="/service-area/">All areas</a></li></ul></div>
  </div>
  <div class="foot-bottom"><span>© 2026 123 Lot Lighting</span><span><a href="/privacy/">Privacy</a></span></div>
</div></footer>'''


def cta_band(title="Get your lot lit up again.",
             text="Send the address and how many lights are out. Most repairs are done in a single visit."):
    return f'''<section class="cta-band"><div class="wrap">
  <div><h2>{title}</h2><p>{text}</p></div>
  <div class="btns"><a class="btn btn-ghost" href="/quote/">Request a Quote</a></div>
</div></section>'''


def aside():
    return f'''<aside class="aside-box">
  <h3>Get a quote</h3>
  <p>Send the address and how many lights are out. We reply within {val("response")}.</p>
  <a class="btn btn-primary" href="/quote/">Request a Quote</a>
  <p style="margin-top:14px">Or call {phone_link()}</p>
</aside>'''


def page(path, title, desc, body, schema=None):
    canonical = CONFIG["domain"] + path
    if schema and not isinstance(schema, list):
        schema = [schema]
    schema_tag = "".join(f'<script type="application/ld+json">{json.dumps(x)}</script>' for x in (schema or []))
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">
<link rel="canonical" href="{canonical}">
{verification_tags()}<meta property="og:title" content="{html.escape(title)}">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:url" content="{canonical}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{CONFIG["name"]}">
<meta property="og:image" content="{OG_IMAGE}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
{FONTS}
<link rel="stylesheet" href="/styles.css">
{schema_tag}
</head>
<body>
{header(path)}
<main id="main">
{body}
</main>
{footer()}
</body>
</html>
'''


def sub_hero(h1, lead, kicker=None, buttons=True):
    k = f'<p class="kicker">{kicker}</p>' if kicker else ""
    b = (f'<div class="btns"><a class="btn btn-primary" href="/quote/">Request a Quote</a>'
         f'{phone_link("btn btn-ghost", "Call " + val("phone"))}</div>') if buttons else ""
    return f'''<section class="hero hero-sub"><div class="wrap">{k}<h1>{h1}</h1><p class="lead">{lead}</p>
{b}</div></section>'''


def ul(items):
    return "<ul>" + "".join(f"<li>{i}</li>" for i in items) + "</ul>"


def content_page(main_html, img=""):
    return f'<section class="section"><div class="wrap content"><div>{img}{main_html}</div>{aside()}</div></section>'


# ---------------------------------------------------------------------------
# Pages
# ---------------------------------------------------------------------------
PAGES = {}


PAGE_FAQ = {}       # path -> FAQ list, shown above the CTA band and marked up as FAQPage
SERVICE_NAMES = {}  # filled below from SERVICES


def add(path, title, desc, body, schema=None, faq=None, crumb=None):
    schema = ([schema] if isinstance(schema, dict) else list(schema or []))
    slug = path.strip("/")
    if slug in SERVICE_NAMES:
        schema.append(service_schema(SERVICE_NAMES[slug], desc, path))
        crumb = crumb or SERVICE_NAMES[slug]
    faq = faq or PAGE_FAQ.get(path)
    if faq:
        sec = faq_section(faq)
        body = body.replace('<section class="cta-band">', sec + '<section class="cta-band">', 1) if '<section class="cta-band">' in body else body + sec
        schema.append(faq_schema(faq))
    if crumb:
        schema.append(breadcrumb_schema(path, crumb))
    PAGES[path] = page(path, title, desc, body, schema)


schema_home = {
    "@context": "https://schema.org",
    "@type": "HomeAndConstructionBusiness",
    "@id": BIZ_ID,
    "name": CONFIG["name"],
    "url": CONFIG["domain"],
    "image": OG_IMAGE,
    "logo": CONFIG["domain"] + "/favicon.svg",
    "priceRange": "$$",
    "openingHoursSpecification": [{"@type": "OpeningHoursSpecification",
                                   "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                                   "opens": "07:00", "closes": "17:00"}],
    "knowsAbout": ["Parking lot lighting", "Parking lot light repair", "LED lighting retrofits",
                   "Wall pack lighting", "Light pole replacement", "Lighted sign repair",
                   "Photocells and lighting controls", "Exterior commercial lighting maintenance"],
    "hasOfferCatalog": {"@type": "OfferCatalog", "name": "Parking lot lighting services",
                        "itemListElement": [{"@type": "Offer", "itemOffered": {"@type": "Service", "name": t,
                                             "url": f"{CONFIG['domain']}/{s}/"}} for s, t, _ in SERVICES]},
    "description": "Parking lot light repair, LED lighting upgrades, wall packs and building lights, light pole repair and replacement, lighted sign repair and lighting maintenance plans.",
    "areaServed": [{"@type": "AdministrativeArea", "name": "DuPage County, IL"},
                   {"@type": "AdministrativeArea", "name": "Will County, IL"}],
}
if not is_ph(CONFIG["phone"]):
    schema_home["telephone"] = CONFIG["phone"]
if not is_ph(CONFIG["email"]):
    schema_home["email"] = CONFIG["email"]
schema_home["areaServed"] += [{"@type": "City", "name": f"{c}, IL"} for _, c, _ in CITIES]
if CONFIG["profiles"]:
    schema_home["sameAs"] = CONFIG["profiles"]
schema_site = {"@context": "https://schema.org", "@type": "WebSite", "name": CONFIG["name"],
               "url": CONFIG["domain"] + "/", "publisher": ref_biz()}

# FAQ content ------------------------------------------------------------------
P = PRICE
FAQ_COST = ("How much does parking lot light repair cost?",
            f"Fixing a light that's out runs {rng(P['LT_REPAIR'])} per fixture, including the lift. Replacing a pole-mounted head with an LED fixture "
            f"is {rng(P['LT_LED_POLE'])}, and an LED wall pack is {rng(P['LT_LED_WALL'])}. Lighting jobs have a {money(P['MIN'])} minimum, "
            f'which covers the lift and the electrician\'s trip. See <a href="/parking-lot-lighting-cost/">parking lot lighting cost</a> for examples.')
FAQ_WHY_OUT = ("Why do parking lot lights go out?",
               "On older metal halide and high-pressure sodium fixtures it's usually a worn-out lamp or a failed ballast. On LED fixtures it's usually the driver. "
               "A bad photocell or timer can keep a whole row dark, and damaged underground wiring can knock out several poles at once. "
               "Lights that cycle on and off are a classic sign of a lamp or ballast at the end of its life.")
FAQ_LED = ("Is it worth upgrading parking lot lights to LED?",
           "Usually, yes. LED fixtures often use half the power or less of the metal halide heads they replace, last far longer, and spread light more evenly, "
           "so the lot looks brighter with fewer dark spots. If your building is a ComEd customer, the upgrade may qualify for an incentive through the "
           "ComEd Energy Efficiency Program. (Naperville runs its own electric utility.)")
FAQ_DAY = ("Do you work at night?",
           "Most repairs and upgrades are done during the day. Lights are tested by covering the photocell, so we can see which ones work without coming back after dark.")
FAQ_OPEN = ("Do you have to close the parking lot?",
            "No. The lift takes up a stall or two around each pole. We cone off that area while we work and move on, so the rest of the lot stays open.")
FAQ_WRONG_TIME = ("Why are my lot lights on during the day, or off too early at night?",
                  "That's almost always a failed photocell or a timer that's set wrong or lost its settings after a power outage. "
                  "It's a quick fix, and it stops you paying to light an empty lot at noon.")
FAQ_QUOTE = ("How do I get a quote?",
             f'Use the <a href="/quote/">quote form</a> with the address, how many lights you have and how many are out. Photos help. We email a written, '
             f"fixed-price quote, usually within {CONFIG['response']}, and confirm each fixture on site before any work.")
FAQ_MORE = ("Can you fix the pavement and lines at the same time?",
            'Yes. Our sister companies <a href="https://123pothole.com">123 Pothole Repair</a> and <a href="https://123lotstriping.com">123 Lot Striping</a> '
            "fill potholes, seal cracks, sealcoat and restripe. Add it all on one quote form and get one price.")
HOME_FAQ = [FAQ_COST, FAQ_WHY_OUT, FAQ_LED, FAQ_DAY, FAQ_OPEN, FAQ_WRONG_TIME, FAQ_QUOTE, FAQ_MORE]

services_rows = "".join(
    f'<div class="service-row">{ICONS[s]}<h3><a href="/{s}/">{t}</a></h3><p>{d}</p><a class="more" href="/{s}/">Details</a></div>'
    for s, t, d in SERVICES
)
aud = "".join(f'<li><a href="/{s}/">{t}</a></li>' for s, t in INDUSTRIES)

REBATE_NOTE = ('<div class="callout"><p><strong>Rebates for LED upgrades.</strong> If your building is a ComEd customer, replacing older fixtures with LED '
               'may qualify for an incentive through the ComEd Energy Efficiency Program, which can take a real bite out of the cost. Ask when you request your quote '
               'and we\'ll help you check. Naperville runs its own electric utility, so Naperville properties should check with the city.</p></div>')

DAYTIME_NOTE = ('<div class="callout"><p><strong>Done in daylight.</strong> We test lights by covering the photocell, so most repairs and upgrades happen '
                'during normal working hours, with no after-dark visits needed.</p></div>')

# Home -----------------------------------------------------------------------
add("/", "Parking Lot Light Repair & LED Upgrades | DuPage & Will County | 123 Lot Lighting",
    "Parking lot light repair, LED upgrades, wall packs, light poles and lighted signs for commercial properties, HOAs and schools in DuPage and Will County. Free quotes.",
    f'''<section class="hero"><div class="wrap hero-grid"><div>
  <p class="kicker">Serving DuPage and Will County</p>
  <h1>Parking lot lights fixed fast, without the runaround</h1>
  <p class="lead">Dark poles, flickering heads and dead wall packs repaired or upgraded to LED, scheduled around your business. Fixed quotes from a fixture count and an address.</p>
  <div class="btns"><a class="btn btn-primary" href="/quote/">Request a Quote</a>{phone_link("btn btn-ghost", "Call " + val("phone"))}</div>
</div>{photo("hero", "A well-lit parking lot at night", "hero-art hero-photo", lazy=False) or HERO_STALLS}</div></section>

<section class="section"><div class="wrap">
  <h2>Why fix the lights now</h2>
  <ul class="points">
    <li><strong>Safety</strong><span>Dark lots mean trips, falls and fender-benders, and people notice which corners nobody can see.</span></li>
    <li><strong>Security</strong><span>Good lighting is one of the simplest ways to make a property feel watched and cared for.</span></li>
    <li><strong>Tenant complaints</strong><span>Employees leaving after dark notice every light that's out, and so do your tenants.</span></li>
    <li><strong>Energy cost</strong><span>Old metal halide heads burn power all night. LED often cuts lighting wattage by half or more.</span></li>
  </ul>
</div></section>

<section class="section section-alt"><div class="wrap">
  <h2>Services</h2>
  <div class="services">{services_rows}</div>
</div></section>

<section class="section"><div class="wrap">
  <h2>How it works</h2>
  <ol class="steps">
    <li><strong>Send the address</strong><span>How many lights you have, how many are out, and a few photos if you can.</span></li>
    <li><strong>Get a fixed quote</strong><span>Priced per fixture, within {val("response")}.</span></li>
    <li><strong>We fix it in daylight</strong><span>A lift and an electrician, with cones around each pole and the rest of the lot open.</span></li>
    <li><strong>You get proof</strong><span>A list of every fixture fixed or replaced, with photos for your files.</span></li>
  </ol>
</div></section>

<section class="section section-alt"><div class="wrap">
  <h2>Fix the rest of the lot on the same visit</h2>
  <p class="intro">New lights shine a spotlight on faded lines and potholes. Through our sister companies we also <a href="https://123lotstriping.com/parking-lot-striping/">restripe</a>, fill <a href="https://123pothole.com/pothole-repair/">potholes</a>, <a href="https://123pothole.com/sealcoating/">sealcoat</a> and fix <a href="https://123concreterepair.com/trip-hazard-repair/">sidewalk trip hazards</a>. Tick the boxes on the quote form and it's all one price.</p>
</div></section>

<section class="section"><div class="wrap">
  <h2>Who we serve</h2>
  <p class="intro">Property managers, shopping centers, HOAs, hospitals, schools and warehouses across DuPage and Will County.</p>
  <ul class="audiences">{aud}</ul>
</div></section>

{faq_section(HOME_FAQ, "Parking lot lighting questions")}

{cta_band()}''', [schema_home, schema_site, faq_schema(HOME_FAQ)])

# Services hub ----------------------------------------------------------------
add("/services/", "Parking Lot Lighting Services | 123 Lot Lighting",
    "Parking lot light repair, LED upgrades, wall packs, light pole replacement, lighted sign repair and lighting maintenance in DuPage and Will County.",
    sub_hero("Parking lot lighting services", "Everything that lights up a parking lot, from the pole heads to the sign out front.")
    + f'<section class="section"><div class="wrap"><div class="services">{services_rows}</div>'
    + '<p style="margin-top:24px">Wondering what it costs? See our <a href="/parking-lot-lighting-cost/">parking lot lighting price list</a>.</p></div></section>'
    + cta_band(), crumb="Services")

SERVICE_NAMES.update({s: t for s, t, _ in SERVICES})
PAGE_FAQ["/parking-lot-light-repair/"] = [FAQ_COST, FAQ_WHY_OUT, FAQ_WRONG_TIME, FAQ_DAY, FAQ_OPEN, FAQ_MORE]
PAGE_FAQ["/led-lighting-upgrades/"] = [
    FAQ_LED,
    ("How much does an LED parking lot light cost?",
     f"Replacing a pole-mounted head with an LED fixture runs {rng(P['LT_LED_POLE'])} per fixture installed, including the lift, and an LED wall pack is "
     f"{rng(P['LT_LED_WALL'])}. Any ComEd incentive you qualify for comes off that."),
    ("Should I repair my old lights or switch to LED?",
     "If one or two heads are out on a lot that's otherwise fine, a repair is usually the cheaper fix. If several are failing, or you're replacing "
     "lamps and ballasts every year, switching to LED usually costs less over a few years because the fixtures last much longer and use less power."),
    ("Do I have to replace the poles to go LED?",
     "Usually not. Most LED fixtures mount on existing poles and arms, and many lots keep the same wiring. We check pole condition while we're up there."),
    ("Will LED lights be too bright for neighbors?",
     "They don't have to be. Modern LED fixtures aim light down and onto the lot, and shielded fixtures cut glare toward homes and roads. "
     "Some towns have rules on light spilling past the property line, and we pick fixtures to suit."),
]
PAGE_FAQ["/wall-packs-building-lights/"] = [
    ("What is a wall pack?",
     "A wall pack is a light mounted on the side of a building, usually over doors, along walkways and at loading docks. Older ones use metal halide "
     "or sodium lamps; new ones are LED."),
    ("How much does an LED wall pack cost?",
     f"{rng(P['LT_LED_WALL'])} per wall pack installed, and {rng(P['LT_REPAIR'])} to repair one that's out."),
    ("Can you add lights where it's dark now?",
     "Often, yes, where there's power nearby. Send photos of the area and we'll tell you what it takes."),
]
PAGE_FAQ["/light-pole-repair-replacement/"] = [
    ("A car knocked over our light pole. What do we do?",
     "Keep people and cars away from the base, since the wiring may still be live. Call us and we'll make it safe, remove the pole and quote the replacement. "
     "If the pole was hit by a driver, the replacement is often a claim on their insurance, so keep the police report or incident details."),
    ("How much does it cost to replace a light pole?",
     f"Replacing a damaged pole on its existing base runs {rng(P['LT_POLE'])}, including rehanging the fixture. A cracked or broken concrete base adds to that, "
     "and we quote it once we've seen it."),
    ("Is a leaning or rusted pole dangerous?",
     "It can be. Rust at the base and loose anchor bolts weaken a pole, and wind or a light bump can bring it down. Send photos of the base and we'll take a look."),
]
PAGE_FAQ["/lighted-sign-repair/"] = [
    ("Can you fix a sign that's dim or half dark?",
     "Yes. Most lit signs use fluorescent tubes or older lamps inside the cabinet. We replace failed parts, or retrofit the cabinet with LED modules so it stays bright for years."),
    ("How much does lighted sign repair cost?",
     f"Repairing or retrofitting a sign cabinet with LED runs {rng(P['LT_SIGN'])} per lit face. Big or unusual signs are quoted from photos."),
    ("Do you make new signs?",
     "We fix and relight existing pylon, monument and building signs. New sign faces and lettering are a job for a sign shop."),
]
PAGE_FAQ["/lighting-maintenance-plans/"] = [
    ("How does a lighting maintenance plan work?",
     "We check every pole light, wall pack and sign on a set schedule, fix what's out on the same visit at your plan rates, and send you a report. "
     "Between visits, report an outage and we add it to the next trip."),
    ("How often should parking lot lights be checked?",
     "Quarterly works well for most commercial properties, and fall is the most important visit, before the long dark evenings start."),
]

# Service pages ---------------------------------------------------------------
add("/parking-lot-light-repair/", "Parking Lot Light Repair | 123 Lot Lighting",
    "Parking lot lights out, flickering or on at the wrong time? We repair pole lights, lamps, drivers, photocells and wiring in DuPage and Will County. Free quotes.",
    sub_hero("Parking lot light repair",
             "One dark pole makes the whole lot feel unsafe. We find out why it's out and fix it, usually in a single daytime visit.")
    + content_page(photo("parking-lot-light-repair", "Parking lot light poles", "svc-photo") + f'''
<h2>What we fix</h2>
{ul(["Pole lights that are out, dim, flickering or cycling on and off",
     "Failed lamps and ballasts in metal halide and sodium fixtures",
     "Failed drivers in LED fixtures",
     "Photocells and timers that leave lights on all day or off all night",
     "Breakers, contactors and wiring that knock out a whole row"])}
<h2>How we do it</h2>
{ul(["<strong>Find the cause.</strong> One dark head is usually the fixture. A whole row is usually the controls or the wiring.",
     "<strong>Fix it in one trip.</strong> A lift and an electrician with common parts on the truck.",
     "<strong>Tell you what's next.</strong> If more fixtures are close to failing, we say so, with the price to upgrade them to LED."])}
{DAYTIME_NOTE}
<div class="callout"><p><strong>Half the lot out every year?</strong> Repairs on old fixtures add up. An <a href="/led-lighting-upgrades/">LED upgrade</a> often costs less over a few years.</p></div>
''') + cta_band())

add("/led-lighting-upgrades/", "LED Parking Lot Lighting Upgrades | 123 Lot Lighting",
    "Replace metal halide and sodium parking lot lights with LED. Brighter, more even light, lower power bills and possible ComEd incentives. DuPage and Will County.",
    sub_hero("LED parking lot lighting upgrades",
             "Old metal halide heads are dim, orange and expensive to run. LED fixtures light the lot evenly and often use half the power or less.")
    + content_page(f'''
<h2>Why upgrade</h2>
{ul(["<strong>Lower power bills.</strong> LED often cuts lighting wattage by half or more.",
     "<strong>Far fewer repairs.</strong> LED fixtures last many years longer than metal halide lamps.",
     "<strong>Better light.</strong> Whiter, more even light with fewer dark spots between poles.",
     "<strong>Less glare.</strong> Modern fixtures aim light at the lot, not at neighbors or the road."])}
<h2>What's included</h2>
{ul(["A count of every pole head and wall pack, and what each one should be replaced with",
     "LED fixtures mounted on your existing poles and arms in most cases",
     "Photocells or timers replaced so the new lights come on when they should",
     "Old fixtures hauled away"])}
{REBATE_NOTE}
''') + cta_band("Light the lot for less.", "Send your fixture count and we'll quote the upgrade, with any rebate noted."))

add("/wall-packs-building-lights/", "Wall Pack & Building Light Repair | 123 Lot Lighting",
    "Wall packs, entrance, canopy and loading dock lights repaired or replaced with LED for commercial buildings in DuPage and Will County.",
    sub_hero("Wall packs and building lights",
             "The lights on the building matter as much as the ones on the poles. They're what light the doors, walkways and docks.")
    + content_page(f'''
<h2>What we work on</h2>
{ul(["Wall packs over doors and along building walls",
     "Entrance, canopy and soffit lights",
     "Loading dock and truck-court lights",
     "Flood lights on buildings and poles"])}
<h2>Repair or replace</h2>
<p>If a wall pack is out, we fix it. If it's an old metal halide unit, it's often worth replacing with an LED wall pack instead: they cost little more than a major repair and last far longer.</p>
{REBATE_NOTE}
''') + cta_band())

add("/light-pole-repair-replacement/", "Light Pole Repair & Replacement | 123 Lot Lighting",
    "Knocked-down, leaning and rusted parking lot light poles made safe and replaced, with fixtures rehung. DuPage and Will County.",
    sub_hero("Light pole repair and replacement",
             "Plows, delivery trucks and rust take poles down. We make the site safe, replace the pole and get the light back on.")
    + content_page(f'''
<h2>What we handle</h2>
{ul(["Poles knocked down or bent by vehicles or plows",
     "Leaning poles and loose anchor bolts",
     "Rusted-through poles and bases",
     "Missing hand-hole covers and exposed wiring at the base",
     "Fixtures moved from the old pole to the new one, or upgraded to LED at the same time"])}
<h2>Making it safe first</h2>
<p>A downed pole can leave live wiring in the base. Keep people and cars away and call us. We make the wiring safe, remove the old pole, and quote the replacement with the right height and arm for your fixtures.</p>
<div class="callout"><p><strong>Hit by a driver?</strong> Keep the police report or incident details. The replacement is often covered by the driver's insurance, and we can give you an itemized quote for the claim.</p></div>
''') + cta_band())

add("/lighted-sign-repair/", "Lighted Sign Repair & LED Retrofits | 123 Lot Lighting",
    "Pylon, monument and building signs relit, with LED retrofits for dim or dark sign cabinets. Commercial properties in DuPage and Will County.",
    sub_hero("Lighted sign repair",
             "Your sign is the first thing people see from the road. When half of it is dark, they notice.")
    + content_page(f'''
<h2>What we fix</h2>
{ul(["Pylon and monument signs at the entrance",
     "Building-mounted cabinet signs",
     "Dim, flickering or half-dark sign faces",
     "Sign timers and photocells"])}
<h2>LED retrofits</h2>
<p>Most lit signs use fluorescent tubes inside the cabinet. When they start failing, we can swap them for LED modules, which run cooler, use less power and last for years.</p>
<div class="callout"><p><strong>Need new sign faces or lettering?</strong> That's a job for a sign shop. We handle the lighting inside the sign.</p></div>
''') + cta_band())

add("/lighting-maintenance-plans/", "Parking Lot Lighting Maintenance Plans | 123 Lot Lighting",
    "Scheduled parking lot lighting checks and repairs for property managers and commercial owners in DuPage and Will County.",
    sub_hero("Lighting maintenance plans",
             "Stop waiting for complaints. We check every light on a schedule and fix what's out on the same visit.")
    + content_page(f'''
<h2>What's included</h2>
{ul(["Every pole light, wall pack and lit sign checked on a set schedule",
     "Outages fixed on the same visit at your plan rates",
     "Photocells and timers checked and reset as the days get shorter",
     "A short report after each visit, with photos, for your owners"])}
<h2>Good fit for</h2>
{ul(["Property managers with several sites", "Shopping centers and retail strips", "HOAs and apartment communities", "Medical and office campuses"])}
<div class="callout"><p><strong>Managing a portfolio?</strong> Send your property list and we'll quote one plan for all of it.</p></div>
''') + cta_band("Never chase a dark pole again.", "Send your property list and we'll quote a plan."))

# Cost page ---------------------------------------------------------------------
COST_EXAMPLES = [
    ("Two pole lights out", 2 * P["LT_REPAIR"]),
    ("Retail strip: 6 pole heads to LED", 6 * P["LT_LED_POLE"]),
    ("Office: 8 pole heads + 6 wall packs to LED", 8 * P["LT_LED_POLE"] + 6 * P["LT_LED_WALL"] + P["LT_CTRL"]),
    ("Knocked-down pole replaced", P["LT_POLE"]),
]
cost_rows = "".join(f"<tr><td>{n}</td><td>{job_rng(v)}</td></tr>" for n, v in COST_EXAMPLES)
UNIT_ROWS = [("Repair a light that's out (lift included)", "LT_REPAIR", "per fixture"),
             ("LED pole light, installed", "LT_LED_POLE", "per fixture"),
             ("LED wall pack, installed", "LT_LED_WALL", "per fixture"),
             ("Photocell or timer replaced", "LT_CTRL", "per circuit"),
             ("Light pole replaced on existing base", "LT_POLE", "per pole"),
             ("Lighted sign repair or LED retrofit", "LT_SIGN", "per sign face")]
unit_rows = "".join(f"<tr><td>{n}</td><td>{rng(P[k])} {u}</td></tr>" for n, k, u in UNIT_ROWS)
COST_FAQ = [
    FAQ_COST,
    ("Why is there a minimum charge?",
     f"Every lighting job needs a lift and an electrician on site, even for one light. The {money(P['MIN'])} minimum covers that trip. "
     "Fixing several lights on one visit is much cheaper per light."),
    ("Is it cheaper to repair or replace with LED?",
     f"A repair is {rng(P['LT_REPAIR'])} per fixture and an LED head is {rng(P['LT_LED_POLE'])}. For one or two lights, repair. "
     "For a lot full of aging metal halide fixtures, LED usually wins over a few years once power savings, fewer repairs and any ComEd incentive are counted."),
    ("Does the price include the lift?",
     "Yes. Repair and fixture prices include the lift or bucket truck. Pole replacement includes rehanging the fixture."),
]
add("/parking-lot-lighting-cost/", "Parking Lot Lighting Cost (2026) | DuPage & Will County | 123 Lot Lighting",
    f"What parking lot lighting costs in DuPage and Will County: {rng(P['LT_REPAIR'])} per light repair, {rng(P['LT_LED_POLE'])} per LED pole light, "
    f"{money(P['MIN'])} minimum. Price list and example jobs.",
    sub_hero("How much does parking lot lighting cost?",
             f"Repairs run {rng(P['LT_REPAIR'])} per fixture and LED pole lights {rng(P['LT_LED_POLE'])} installed in DuPage and Will County, "
             f"with a {money(P['MIN'])} job minimum. Here are our price ranges and what typical jobs come to.")
    + content_page(f'''<h2>Example jobs</h2>
<div class="table-wrap"><table class="price-table"><thead><tr><th>Job</th><th>Typical range</th></tr></thead>
<tbody>{cost_rows}</tbody></table></div>
<h2>Price ranges</h2>
<div class="table-wrap"><table class="price-table"><thead><tr><th>Item</th><th>Typical range</th></tr></thead><tbody>{unit_rows}</tbody></table></div>
<p>Lighting jobs have a {money(P["MIN"])} minimum. Ranges are for {CONFIG["area"]}, before any utility incentive. Your exact price depends on the fixtures and is confirmed on site before any work.</p>
<h2>What changes the price</h2>
{ul([
        "<strong>Number of fixtures.</strong> The biggest factor. Fixing several lights on one visit spreads the lift and trip cost.",
        "<strong>Repair vs. LED.</strong> Repairs cost less now. LED costs more up front but far less to run and maintain.",
        "<strong>Pole height and access.</strong> Very tall poles or poles in landscaping need bigger lifts.",
        "<strong>Wiring problems.</strong> A whole row out can mean underground wiring, which is quoted after we find the fault.",
        "<strong>Rebates.</strong> ComEd incentives can lower the net cost of LED upgrades for eligible buildings."])}
<div class="callout"><p><strong>Want your exact number?</strong> Send your fixture counts on the <a href="/quote/">quote form</a> and we'll email a fixed price.</p></div>
''')
    + cta_band(),
    schema=service_schema("Parking Lot Lighting", "Parking lot lighting price list and example costs.", "/parking-lot-lighting-cost/"),
    faq=COST_FAQ, crumb="Lighting Cost")

# Industry pages ---------------------------------------------------------------
IND_CONTENT = {
    "property-managers": ("Property Managers", "Parking Lot Lighting for Property Managers | 123 Lot Lighting",
        "Lighting repair, LED upgrades and maintenance plans across your whole portfolio, with photo reports for owners.",
        "One lighting vendor for every property you manage",
        "Dark poles show up in tenant complaints and on every property inspection. We fix lighting across your portfolio and document every visit.",
        ["One point of contact and one invoice format for every property",
         "A list of every fixture fixed, with photos for owner reports",
         "Certificates of insurance naming your owners, on request",
         "Maintenance plans so outages get caught on schedule"],
        "Send us your property list and we'll quote the whole portfolio."),
    "retail": ("Retail & Shopping Centers", "Shopping Center Parking Lot Lighting | 123 Lot Lighting",
        "Parking lot light repair, LED upgrades and pylon sign lighting for shopping centers and retail strips, scheduled around tenants.",
        "A lot that looks open for business after dark",
        "Shoppers judge a center by how it looks at 6pm in December. Dark poles and a half-lit pylon sign say closed.",
        ["Work scheduled around anchor tenants and peak hours",
         "Pylon and monument sign lighting fixed with the lot",
         "LED upgrades that cut the common-area power bill",
         "Wall packs and storefront canopy lights repaired"],
        "Ask about getting it done before the holiday season."),
    "hoa": ("HOAs & Apartments", "HOA & Apartment Parking Lot Lighting | 123 Lot Lighting",
        "Parking lot and walkway lighting repair and LED upgrades for HOAs and apartment communities, with itemized quotes for boards.",
        "Lighting your board can approve with confidence",
        "Residents notice every dark pole and every dark walkway, and it's the association's job to fix them.",
        ["Clear, itemized quotes that make board votes easy",
         "Guest parking, walkway and entrance lights",
         "LED upgrades priced over several years for reserve-study budgeting",
         "Maintenance plans so residents stop reporting outages"],
        "Request a quote before your next board meeting."),
    "healthcare": ("Hospitals & Medical", "Hospital & Medical Office Parking Lot Lighting | 123 Lot Lighting",
        "Parking lot and entrance lighting repair and LED upgrades for hospitals and medical offices, scheduled around patient access.",
        "Well-lit parking for patients and staff",
        "Patients and night-shift staff walk these lots in the dark. Lighting is part of patient safety.",
        ["Work scheduled so patient parking stays open",
         "Entrance, drop-off and walkway lighting",
         "Staff lot and garage-entry lights",
         "Maintenance plans for campuses with many poles"],
        "Ask about a plan that keeps every entrance lit."),
    "schools": ("Schools & Churches", "School & Church Parking Lot Lighting | 123 Lot Lighting",
        "Parking lot lighting repair and LED upgrades for schools and churches, scheduled around your calendar.",
        "Safe, well-lit lots for evening events",
        "Evening games, meetings and services mean people walking to their cars after dark. We schedule work around your calendar.",
        ["Work scheduled around breaks, events and services",
         "Walkway, entrance and bus-loop lighting",
         "LED upgrades that cut operating costs",
         "Written quotes for board and purchasing approval"],
        "Plan your lighting work for summer break and lock in your dates."),
    "industrial": ("Warehouses & Industrial", "Warehouse & Truck Court Lighting | 123 Lot Lighting",
        "Truck court, dock, yard and employee lot lighting repair and LED upgrades for warehouses in DuPage and Will County.",
        "Lighting for truck courts, docks and employee lots",
        "Shift changes and yard moves happen in the dark. Lit docks and walkways keep people safe and trailers moving.",
        ["Yard and truck-court pole lights",
         "Dock and wall-pack lighting",
         "Employee and visitor lot lighting",
         "Work scheduled around shifts and shipping windows"],
        "Send a site plan or satellite view and we'll quote the whole yard."),
}
for slug, (label, title, desc, h1, lead, bullets, cta) in IND_CONTENT.items():
    add(f"/{slug}/", title, desc,
        sub_hero(h1, lead, kicker=label)
        + content_page(photo(slug, label, "svc-photo") + f'''<h2>What you get</h2>{ul(bullets)}
<h2>Services</h2><p>{", ".join(f'<a href="/{s}/">{t.lower()}</a>' for s, t, _ in SERVICES)}.</p>
<div class="callout"><p>{cta}</p></div>''')
        + cta_band(), crumb=label)

add("/who-we-serve/", "Who We Serve | 123 Lot Lighting",
    "Parking lot lighting for property managers, shopping centers, HOAs, hospitals, schools and warehouses in DuPage and Will County.",
    sub_hero("Who we serve", "Commercial, community and industrial properties across DuPage and Will County.")
    + '<section class="section"><div class="wrap"><div class="services">'
    + "".join(f'<div class="service-row"><h3><a href="/{s}/">{IND_CONTENT[s][0]}</a></h3><p>{IND_CONTENT[s][4]}</p><a class="more" href="/{s}/">Details</a></div>' for s, _ in INDUSTRIES)
    + "</div></div></section>" + cta_band())

# City pages ------------------------------------------------------------------
CITY_NAME = {sl: c for sl, c, _ in CITIES}
for slug, city, detail in CITIES:
    county = CITY_COUNTY[slug]
    near_links = ", ".join(f'<a href="/{n}/">{CITY_NAME[n]}</a>' for n in CITY_NEAR[slug])
    rebate = ("Naperville runs its own electric utility, so ask the city about LED incentives."
              if slug == "naperville" else
              "If your building is a ComEd customer, LED upgrades may qualify for an incentive through the ComEd Energy Efficiency Program.")
    cfaq = [
        (f"How much does parking lot light repair cost in {city}?",
         f"Fixing a light that's out in {city} runs {rng(P['LT_REPAIR'])} per fixture, including the lift, and replacing a pole head with LED is "
         f"{rng(P['LT_LED_POLE'])}. Lighting jobs have a {money(P['MIN'])} minimum."),
        (f"Do you repair parking lot lights in {city}?",
         f"Yes. We repair pole lights and wall packs, upgrade to LED, replace damaged poles and relight signs across {city}, which sits in {county}. "
         f"We also work in nearby {near_links}."),
        (f"Are there rebates for LED lighting in {city}?", rebate),
        (f"How do I get a quote for my {city} property?",
         f'Send the address, how many lights you have and how many are out through the <a href="/quote/">quote form</a>. We email a fixed-price quote, usually within {CONFIG["response"]}.'),
    ]
    add(f"/{slug}/", f"Parking Lot Light Repair {city}, IL | 123 Lot Lighting",
        f"Parking lot light repair, LED upgrades, wall packs and light pole replacement in {city}, IL ({county}). Fixed-price quotes for businesses, HOAs and schools.",
        sub_hero(f"Parking lot lighting in {city}, IL",
                 f"123 Lot Lighting repairs pole lights, upgrades lots to LED and replaces damaged poles for properties across {city}.",
                 kicker="Service area")
        + content_page(f'''<h2>Working in {city}</h2><p>{detail}</p>
<p>{city} is in {county}, and we schedule {city} jobs alongside work in {near_links}, which keeps travel time (and your price) down.</p>
<h2>Services in {city}</h2>{ul([f'<a href="/{s}/">{t}</a>' for s, t, _ in SERVICES])}
<h2>Typical {city} jobs</h2>
{ul(["Pole lights out or cycling, fixed in a single daytime visit",
     "Metal halide heads upgraded to LED across a whole lot",
     "Wall packs over doors and docks repaired or replaced",
     "Poles knocked down by plows or delivery trucks replaced",
     "Lighting fixes paired with restriping from our sister company, <a href=\"https://123lotstriping.com\">123 Lot Striping</a>"])}
<div class="callout"><p><strong>Request a quote for your {city} property.</strong> Send the address and how many lights are out, and we'll reply within {val("response")}.</p></div>''')
        + cta_band(),
        schema=service_schema("Parking Lot Lighting", f"Parking lot light repair, LED upgrades and pole replacement in {city}, IL.", f"/{slug}/",
                              area={"@type": "City", "name": f"{city}, IL"}),
        faq=cfaq, crumb=f"{city}, IL")

city_list = "".join(f'<li><a href="/{s}/">{c}</a></li>' for s, c, _ in CITIES)
add("/service-area/", "Service Area | 123 Lot Lighting",
    "123 Lot Lighting serves parking lots and commercial properties across DuPage and Will County, Illinois.",
    sub_hero("Service area", "Parking lots and commercial properties across DuPage and Will County, Illinois.")
    + f'''<section class="section"><div class="wrap">
<h2>Cities we serve</h2><ul class="city-links">{city_list}</ul>
<p style="margin-top:20px">Don't see your town? If it's in DuPage or Will County, we cover it. <a href="/quote/">Request a quote</a>.</p>
</div></section>''' + cta_band())

# About -----------------------------------------------------------------------
add("/about/", "About | 123 Lot Lighting",
    "123 Lot Lighting is a locally owned parking lot lighting company serving DuPage and Will County.",
    sub_hero("Local, owner-run parking lot lighting",
             "A locally owned company serving DuPage and Will County, and a sister company of 123 Pothole Repair and 123 Lot Striping.")
    + content_page(f'''<h2>Why we started</h2>
<p>Getting a few lights fixed shouldn't mean a week of phone tag with an electrician who doesn't want a small job. Send an address and how many lights are out, and you should have a price.</p>
<p>We built a company around that. We answer quickly, schedule around your business, and send you a list of what we fixed when the job is done.</p>
<h2>What we stand behind</h2>
{ul(["Written, fixed quotes before any work", "Daytime work, with cones around every lift",
     "A list of every fixture fixed or replaced, with photos",
     "Certificates of insurance on request"])}
<p>Need the pavement done too? <a href="https://123pothole.com">123 Pothole Repair</a> handles potholes, crack sealing and sealcoating, <a href="https://123lotstriping.com">123 Lot Striping</a> paints lines, and <a href="https://123concreterepair.com">123 Concrete Repair</a> fixes sidewalk trip hazards.</p>
''') + cta_band())

# Quote -----------------------------------------------------------------------
add("/quote/", "Get a Lighting Quote | 123 Lot Lighting",
    "Fixed-price parking lot lighting quotes from your fixture counts, plus striping, sealcoating and pothole repair on the same visit. DuPage and Will County.",
    sub_hero("Get a quote",
             "Tell us about your lights and we'll email you a written, fixed-price quote. Need work on the pavement too? Add it here.", buttons=False)
    + f'''<section class="section"><div class="wrap">
<form class="form quote-form" id="quote-form" name="quote" method="POST" action="/thank-you/" data-netlify="true" netlify-honeypot="company_url" enctype="multipart/form-data" novalidate>
  <input type="hidden" name="form-name" value="quote">
  <p class="hidden"><label>Leave this empty <input name="company_url"></label></p>

  <p class="full req-note"><span class="req" aria-hidden="true">*</span> Required</p>
  <fieldset class="full"><legend class="q-step"><span>1</span> What do you need? <span class="req" aria-hidden="true">*</span></legend>
    <div class="svc-grid">
      <label class="svc"><input type="checkbox" name="services" value="Lighting" checked><span><strong>Lighting</strong><small>Priced from your counts</small></span></label>
      <label class="svc"><input type="checkbox" name="services" value="Striping"><span><strong>Striping</strong><small>Priced from your counts</small></span></label>
      <label class="svc"><input type="checkbox" name="services" value="Sealcoating"><span><strong>Sealcoating</strong><small>Priced from your lot size</small></span></label>
      <label class="svc"><input type="checkbox" name="services" value="Pothole repair"><span><strong>Pothole repair</strong><small>Priced from your photos</small></span></label>
      <label class="svc"><input type="checkbox" name="services" value="Crack sealing"><span><strong>Crack sealing</strong><small>Priced from your photos</small></span></label>
      <label class="svc"><input type="checkbox" id="svc-other"><span><strong>Something else</strong><small>We'll price it for you</small></span></label>
    </div>
    <div class="checks other-svcs" id="other-svcs">
      <label><input type="checkbox" name="services" value="New lights where it's dark"> New lights where there are none</label>
      <label><input type="checkbox" name="services" value="Wheel stops, bollards or signs"> Wheel stops, bollards or signs</label>
      <label><input type="checkbox" name="services" value="Curb repair or painting"> Curb repair or painting</label>
      <label><input type="checkbox" name="services" value="Catch basin repair"> Catch basin repair</label>
      <label><input type="checkbox" name="services" value="Not sure"> Not sure yet</label>
    </div>
  </fieldset>

  <h2 class="full q-step"><span>2</span> Your property</h2>
  <div><label for="f-first">First name <span class="req" aria-hidden="true">*</span></label><input id="f-first" name="first_name" autocomplete="given-name" required aria-required="true"></div>
  <div><label for="f-last">Last name <span class="req" aria-hidden="true">*</span></label><input id="f-last" name="last_name" autocomplete="family-name" required aria-required="true"></div>
  <div><label for="f-company">Company or property name</label><input id="f-company" name="company" autocomplete="organization"></div>
  <div><label for="f-email">Email <span class="req" aria-hidden="true">*</span></label><input id="f-email" type="email" name="email" autocomplete="email" required aria-required="true"></div>
  <div><label for="f-phone">Phone</label><input id="f-phone" type="tel" name="phone" autocomplete="tel"></div>
  <div class="full"><label for="f-address">Property address <span class="req" aria-hidden="true">*</span></label><input id="f-address" name="address" autocomplete="street-address" required aria-required="true"></div>
  <div><label for="f-type">Property type</label>
    <select id="f-type" name="property_type">
      <option>Retail</option><option>Office</option><option>HOA or apartments</option><option>Medical</option>
      <option>School or church</option><option>Industrial</option><option>Other</option>
    </select></div>
  <div><label for="f-timing">Timing</label>
    <select id="f-timing" name="timing">
      <option>As soon as possible</option><option>Within 30 days</option><option>Planning ahead</option>
    </select></div>

  <section class="qsec full" id="sec-lighting" data-for="Lighting">
    <h2 class="q-step"><span>3</span> Lighting details</h2>
    <fieldset><legend>What do you want done?</legend>
      <div class="checks">
        <label><input type="radio" name="l-need" value="repair" checked> Fix the lights that are out</label>
        <label><input type="radio" name="l-need" value="upgrade"> Upgrade the lights to LED</label>
        <label><input type="radio" name="l-need" value="advise"> Not sure yet, tell me what makes sense</label>
      </div></fieldset>
    <div class="calc-grid calc-grid-4" style="margin-top:14px">
      <div><label for="l-poles">Lights on poles</label><input id="l-poles" type="number" min="0" inputmode="numeric" placeholder="e.g. 12"><p class="hint">Count each head. A pole with two heads is 2.</p></div>
      <div><label for="l-walls">Wall packs</label><input id="l-walls" type="number" min="0" inputmode="numeric" value="0"><p class="hint">Lights mounted on the building.</p></div>
      <div><label for="l-out">Out or flickering</label><input id="l-out" type="number" min="0" inputmode="numeric" value="0"></div>
      <div><label for="l-damaged">Damaged or leaning poles</label><input id="l-damaged" type="number" min="0" inputmode="numeric" value="0"></div>
      <div><label for="l-signs">Lighted signs that need work</label><input id="l-signs" type="number" min="0" inputmode="numeric" value="0"><p class="hint">Count each lit face.</p></div>
    </div>
    <div class="checks" style="margin:14px 0"><label><input type="checkbox" id="l-controls"> Lights come on at the wrong times (on during the day, or off too early)</label></div>
    <div class="hcard hcard-overview photo-box" data-group="lighting">
      <div class="hcard-head"><strong>Photos of the lights</strong> <span class="hint">Optional, but they help us price it right: a daytime shot of each kind of fixture, the base of any damaged pole, and the sign if it needs work.</span></div>
      <label class="file-btn">Add photos<input type="file" accept="image/*" multiple></label>
      <div class="photo-preview"></div>
    </div>
  </section>

  <section class="qsec full" id="sec-striping" data-for="Striping">
    <h2 class="q-step"><span>3</span> Striping details</h2>
    <div class="calc-grid">
      <div><label for="s-stalls">Regular parking stalls</label><input id="s-stalls" type="number" min="0" inputmode="numeric" placeholder="e.g. 60"></div>
      <div><label for="s-ada">Accessible (ADA) stalls</label><input id="s-ada" type="number" min="0" inputmode="numeric" value="0"><p class="hint">Each includes the hatched access aisle and wheelchair symbol.</p></div>
    </div>
    <fieldset><legend>The lines are</legend>
      <div class="checks">
        <label><input type="radio" name="s-layout" value="existing" checked> Repainting the existing layout</label>
        <label><input type="radio" name="s-layout" value="new"> A new or changed layout</label>
      </div></fieldset>
    <div class="checks" style="margin:14px 0"><label><input type="checkbox" id="s-numbered"> Number each stall</label></div>
    <p class="calc-sub">Extras <span class="hint">(leave at 0 if you don't need them)</span></p>
    <div class="calc-grid calc-grid-4">
      <div><label for="s-signs">ADA signs on posts</label><input id="s-signs" type="number" min="0" inputmode="numeric" value="0"></div>
      <div><label for="s-arrows">Arrows</label><input id="s-arrows" type="number" min="0" inputmode="numeric" value="0"></div>
      <div><label for="s-stops">Stop bars</label><input id="s-stops" type="number" min="0" inputmode="numeric" value="0"></div>
      <div><label for="s-crosswalks">Crosswalks</label><input id="s-crosswalks" type="number" min="0" inputmode="numeric" value="0"></div>
      <div><label for="s-words">Stenciled words</label><input id="s-words" type="number" min="0" inputmode="numeric" value="0"><p class="hint">FIRE LANE, NO PARKING…</p></div>
      <div><label for="s-curb">Curb painting (feet)</label><input id="s-curb" type="number" min="0" inputmode="numeric" value="0"><p class="hint">A stall is about 9 ft wide.</p></div>
    </div>
    <div class="hcard hcard-overview photo-box" data-group="striping">
      <div class="hcard-head"><strong>Photos of the lot</strong> <span class="hint">Optional, but they help us price it right: a few wide shots showing the current lines, curbs and ADA stalls.</span></div>
      <label class="file-btn">Add photos<input type="file" accept="image/*" multiple></label>
      <div class="photo-preview"></div>
    </div>
  </section>

  <section class="qsec full" id="sec-photos" data-for="Pothole repair|Crack sealing">
    <h2 class="q-step"><span>3</span> Photos of the potholes and cracks</h2>
    <p class="hint">Make one card per pothole, so we never count the same one twice. For each pothole, the best photos are <strong>one with a tape measure laid across it</strong> and <strong>one with the tape standing in the deepest spot</strong>. No tape handy? Get the parking lines in the shot for scale.</p>
    <div class="calc-grid"><div><label for="p-total">About how many potholes in total? <span class="hint">(optional)</span></label>
      <input id="p-total" type="number" min="0" max="500" inputmode="numeric" placeholder="e.g. 6">
      <p class="hint">Include any you don't have photos of, so nothing gets missed.</p></div></div>
    <div id="pothole-cards"></div>
    <p><button type="button" class="btn btn-ghost-dark" id="add-pothole">+ Add another pothole</button></p>
    <div class="hcard hcard-overview photo-box" data-group="overview">
      <div class="hcard-head"><strong>Wider shots of the lot</strong> <span class="hint">Optional. Cracked areas, or more potholes than you have time to photograph one by one.</span></div>
      <label class="file-btn">Add photos<input type="file" accept="image/*" multiple></label>
      <div class="photo-preview"></div>
    </div>
  </section>

  <section class="qsec full" id="sec-seal" data-for="Sealcoating">
    <h2 class="q-step"><span>3</span> Sealcoating details</h2>
    <p class="hint"><strong>Outline your lot on the map:</strong> tap each corner of the paved area. Leave out buildings, grass and concrete. Two separate lots? Outline one, then tap "Add another area".</p>
    <div class="map-tools">
      <button type="button" class="btn btn-ghost-dark" id="map-find">Find my address</button>
      <button type="button" class="btn btn-ghost-dark" id="map-undo">Undo</button>
      <button type="button" class="btn btn-ghost-dark" id="map-new">Add another area</button>
      <button type="button" class="btn btn-ghost-dark" id="map-clear">Clear</button>
    </div>
    <div id="seal-map" class="seal-map" aria-label="Satellite map for outlining your parking lot"></div>
    <p class="map-area" id="map-area">Area: <strong>0 sq ft</strong></p>
    <div class="calc-grid">
      <div><label for="c-sqft">Or type the square footage</label><input id="c-sqft" type="number" min="0" inputmode="numeric" placeholder="e.g. 25000"></div>
    </div>
    <div class="calc-grid">
      <fieldset><legend>Coats</legend><div class="checks">
        <label><input type="radio" name="c-coats" value="2" checked> 2 coats (recommended)</label>
        <label><input type="radio" name="c-coats" value="1"> 1 coat</label></div></fieldset>
      <fieldset><legend>Cracks in the lot</legend><div class="checks">
        <label><input type="radio" name="c-cracks" value="none" checked> Few or none</label>
        <label><input type="radio" name="c-cracks" value="some"> Some</label>
        <label><input type="radio" name="c-cracks" value="lots"> A lot</label></div></fieldset>
    </div>
    <div class="hcard hcard-overview photo-box" data-group="sealcoat">
      <div class="hcard-head"><strong>Photos of the pavement</strong> <span class="hint">Optional, but they help us price it right: wide shots of the lot, plus close-ups of bad cracks or oil spots.</span></div>
      <label class="file-btn">Add photos<input type="file" accept="image/*" multiple></label>
      <div class="photo-preview"></div>
    </div>
    <p class="callout-sm" id="restripe-tip">Sealcoating covers the parking lines. <button type="button" class="linkbtn" id="add-restripe">Add restriping to this quote</button></p>
  </section>

  <section class="qsec full" id="sec-other" data-for="New lights where it's dark|Catch basin repair|Curb repair or painting|Wheel stops, bollards or signs|Not sure">
    <h2 class="q-step"><span>3</span> Photos of what needs work</h2>
    <p class="hint">Optional, but the more we can see, the faster and more accurate your quote. A wide shot so we know where it is, and a close-up of each problem.</p>
    <div class="hcard hcard-overview photo-box" data-group="other">
      <div class="hcard-head"><strong>Photos</strong> <span class="hint">Dark areas that need new lights, catch basins, curbs, signs, anything you want priced.</span></div>
      <label class="file-btn">Add photos<input type="file" accept="image/*" multiple></label>
      <div class="photo-preview"></div>
    </div>
  </section>

  <div class="full estimate" id="estimate" aria-live="polite"></div>

  <div class="full"><label for="f-notes">Anything else we should know?</label><textarea id="f-notes" name="notes" rows="4"></textarea></div>
  <div class="full"><button class="btn btn-primary" type="submit">Request My Quote</button>
    <p class="form-status" id="form-status" role="status" aria-live="polite"></p>
    <p class="hint">Nothing is booked until you accept your emailed quote. We confirm fixtures, counts and measurements on site before any work.</p></div>
</form>
</div></section>
<template id="pothole-tpl">
  <div class="hcard">
    <div class="hcard-head"><strong class="hcard-title">Pothole 1</strong><button type="button" class="linkbtn hcard-rm">Remove</button></div>
    <label class="file-btn">Add photos (up to 3)<input type="file" accept="image/*" multiple class="hcard-files"></label>
    <div class="photo-preview"></div>
    <input class="hcard-note" maxlength="200" placeholder="Where is it? e.g. drive lane by the main entrance" aria-label="Where is this pothole?">
    <label class="hcard-size-label">Roughly how big? <span class="hint">(optional)</span>
      <select class="hcard-size">
        <option value="">Not sure</option>
        <option value="pizza">Smaller than a pizza box</option>
        <option value="door">About the size of a car door</option>
        <option value="bigger">Bigger than a car door</option>
        <option value="stall">Most of a parking space, or more</option>
      </select></label>
  </div>
</template>
<script src="/quote.js" defer></script>''')

add("/thank-you/", "Thanks | 123 Lot Lighting", "Your quote request was received.",
    sub_hero("Thanks, we've got your request",
             f"We'll review your request and email your quote, usually within {val('response')}. Need it sooner? Call {val('phone')}.", buttons=False))

# Contact ---------------------------------------------------------------------
add("/contact/", "Contact | 123 Lot Lighting",
    "Contact 123 Lot Lighting for parking lot light repair and LED upgrades in DuPage and Will County.",
    sub_hero("Contact 123 Lot Lighting", "The fastest way to a price is the quote form.")
    + f'''<section class="section"><div class="wrap">
<ul class="contact-list">
  <li><strong>Phone</strong> {phone_link()}</li>
  <li><strong>Email</strong> {email_link()}</li>
  <li><strong>Hours</strong> {val("hours")}</li>
  <li><strong>Service area</strong> {CONFIG["area"]}</li>
</ul>
<a class="btn btn-primary" href="/quote/">Request a Quote</a>
</div></section>''')

# Privacy ---------------------------------------------------------------------
add("/privacy/", "Privacy | 123 Lot Lighting", "How 123 Lot Lighting handles information you send us.",
    sub_hero("Privacy", "What we do with the information you send us.")
    + f'''<section class="section"><div class="wrap">
<p>When you submit our quote form, we collect the details you enter, such as your name, contact information, property address and photos. We use them only to prepare your quote and follow up about your project.</p>
<p>We don't sell your information. We may store it in our customer management and email tools so our team can respond to you.</p>
<p>To ask about or delete the information we hold, contact us at {email_link()}.</p>
<p>Last updated: November 2026.</p>
</div></section>''')

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------
NOT_FOUND = page("/404.html", "Page not found | 123 Lot Lighting", "Page not found.",
                 sub_hero("That page isn't here", 'Try the <a href="/" style="color:#fff">home page</a>, or request a quote.')).replace(
                 '<link rel="canonical" href="https://123lotlighting.com/404.html">', "")

FAVICON = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="#e2581a"/>'
           '<text x="32" y="42" text-anchor="middle" font-family="Arial Narrow,Arial,sans-serif" font-weight="700" font-size="26" fill="#fff">123</text></svg>')


def llms_txt():
    d = CONFIG["domain"]
    svc = "\n".join(f"- [{t}]({d}/{s}/): {x}" for s, t, x in SERVICES)
    cty = "\n".join(f"- [Parking lot lighting in {c}, IL]({d}/{s}/)" for s, c, _ in CITIES)
    ind = "\n".join(f"- [{t}]({d}/{s}/)" for s, t in INDUSTRIES)
    faq = "\n".join(f"- **{_plain(q)}** {_plain(a)}" for q, a in HOME_FAQ)
    return f"""# {CONFIG["name"]}

> Locally owned parking lot lighting company serving {CONFIG["area"]}: light repair, LED upgrades, wall packs and building lights, light pole repair and replacement, lighted sign repair and lighting maintenance plans. Fixed-price quotes from a fixture count and an address.

- Phone: {CONFIG["phone"]}
- Email: {CONFIG["email"]}
- Hours: {CONFIG["hours"]}
- Service area: {CONFIG["area"]}, including {", ".join(c for _, c, _ in CITIES)}
- Quote: {d}/quote/
- Pricing: {rng(PRICE["LT_REPAIR"])} per light repair, {rng(PRICE["LT_LED_POLE"])} per LED pole light installed, {money(PRICE["MIN"])} minimum ({d}/parking-lot-lighting-cost/)
- Sister companies: 123 Pothole Repair (https://123pothole.com) for potholes, crack sealing and sealcoating; 123 Lot Striping (https://123lotstriping.com) for parking lot striping; 123 Concrete Repair (https://123concreterepair.com) for sidewalk trip hazards

## Services
{svc}
- [Parking lot lighting cost]({d}/parking-lot-lighting-cost/): price list and example jobs

## Service area
{cty}

## Who we serve
{ind}

## Common questions
{faq}
"""


def build():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    for path, doc in PAGES.items():
        target = OUT / path.strip("/") / "index.html" if path != "/" else OUT / "index.html"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(doc, encoding="utf-8")
    (OUT / "404.html").write_text(NOT_FOUND, encoding="utf-8")
    shutil.copy(SRC / "styles.css", OUT / "styles.css")
    shutil.copy(SRC / "quote.js", OUT / "quote.js")
    if (SRC / "vendor").exists():
        shutil.copytree(SRC / "vendor", OUT / "vendor")
    if IMAGES.exists():
        shutil.copytree(IMAGES, OUT / "images", ignore=shutil.ignore_patterns(".gitkeep"))
    (OUT / "favicon.svg").write_text(FAVICON, encoding="utf-8")
    urls = "".join(f"<url><loc>{CONFIG['domain']}{p}</loc></url>" for p in PAGES if p != "/thank-you/")
    (OUT / "sitemap.xml").write_text(
        f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}</urlset>',
        encoding="utf-8")
    (OUT / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {CONFIG['domain']}/sitemap.xml\n", encoding="utf-8")
    (OUT / "llms.txt").write_text(llms_txt(), encoding="utf-8")
    print(f"Built {len(PAGES)} pages into {OUT}")


if __name__ == "__main__":
    build()
