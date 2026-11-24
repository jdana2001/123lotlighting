"""Inline SVG illustrations and icons for the 123 Lot Lighting site.

Palette matches src/styles.css: asphalt #2b2e33, orange #e2581a, lane yellow #f2c230.
"""

# Hero: a lot after dark — old, dim and half-out lights ("Before") next to bright LED heads ("After").
HERO_STALLS = '''<svg class="hero-art" viewBox="0 0 520 400" role="img" aria-labelledby="hero-art-t">
<title id="hero-art-t">A parking lot at night with dim, failing lights on one side and bright LED lights on the other</title>
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14161a"/><stop offset="1" stop-color="#262a30"/></linearGradient>
  <radialGradient id="old" cx="0.5" cy="0" r="1"><stop offset="0" stop-color="#e8a54a" stop-opacity="0.38"/><stop offset="1" stop-color="#e8a54a" stop-opacity="0"/></radialGradient>
  <radialGradient id="led" cx="0.5" cy="0" r="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.62"/><stop offset="0.6" stop-color="#eaf2ff" stop-opacity="0.18"/><stop offset="1" stop-color="#eaf2ff" stop-opacity="0"/></radialGradient>
  <radialGradient id="poolOld" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#e8a54a" stop-opacity="0.35"/><stop offset="1" stop-color="#e8a54a" stop-opacity="0"/></radialGradient>
  <radialGradient id="poolLed" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
</defs>
<rect width="520" height="400" rx="10" fill="url(#sky)"/>
<!-- pavement -->
<path d="M0 250 H520 V400 H0 Z" fill="#30343a"/>
<!-- stall lines in perspective -->
<g stroke="#8a8d92" stroke-width="3" opacity="0.55">
  <path d="M40 400 L80 260"/><path d="M120 400 L140 260"/><path d="M200 400 L200 260"/>
  <path d="M320 400 L320 260"/><path d="M400 400 L380 260"/><path d="M480 400 L440 260"/>
</g>
<!-- divider between before and after -->
<path d="M260 0 V400" stroke="#0d0e10" stroke-width="3" stroke-dasharray="10 8"/>

<!-- BEFORE: one dim orange light, one dead -->
<path d="M70 70 L20 330 H180 Z" fill="url(#old)"/>
<ellipse cx="96" cy="320" rx="80" ry="22" fill="url(#poolOld)"/>
<g fill="#55595f">
  <rect x="67" y="62" width="4" height="270"/><rect x="58" y="58" width="40" height="9" rx="2"/>
  <rect x="187" y="62" width="4" height="270"/><rect x="178" y="58" width="40" height="9" rx="2"/>
</g>
<rect x="64" y="66" width="28" height="4" rx="1" fill="#e8a54a" opacity="0.8"/>
<rect x="184" y="66" width="28" height="4" rx="1" fill="#3a3d42"/>

<!-- AFTER: two bright LED heads -->
<path d="M320 70 L262 345 H400 Z" fill="url(#led)"/>
<path d="M440 70 L382 345 H518 Z" fill="url(#led)"/>
<ellipse cx="330" cy="330" rx="78" ry="22" fill="url(#poolLed)"/>
<ellipse cx="450" cy="330" rx="78" ry="22" fill="url(#poolLed)"/>
<g fill="#8d9096">
  <rect x="317" y="62" width="4" height="270"/><rect x="306" y="58" width="42" height="9" rx="2"/>
  <rect x="437" y="62" width="4" height="270"/><rect x="426" y="58" width="42" height="9" rx="2"/>
</g>
<rect x="310" y="66" width="34" height="4" rx="1" fill="#ffffff"/>
<rect x="430" y="66" width="34" height="4" rx="1" fill="#ffffff"/>

<g font-family="Barlow Condensed, Arial Narrow, Arial, sans-serif" font-weight="700" font-size="20">
  <rect x="24" y="356" width="88" height="28" rx="4" fill="#5b6068"/><text x="68" y="376" text-anchor="middle" fill="#fff">Before</text>
  <rect x="284" y="356" width="80" height="28" rx="4" fill="#e2581a"/><text x="324" y="376" text-anchor="middle" fill="#fff">After</text>
</g>
<circle cx="480" cy="370" r="15" fill="#e2581a"/>
<path d="M473 370 L478 375 L488 364" stroke="#fff" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>'''

_ICON = '<svg class="svc-icon" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="#e2581a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">{}</svg>'

ICONS = {
    # pole light with a wrench
    "parking-lot-light-repair": _ICON.format(
        '<path d="M14 44V10h12" stroke="#5b6068"/><rect x="24" y="7" width="14" height="6" rx="1.5" stroke="#5b6068"/>'
        '<path d="M28 17l-1 4M34 17l1 4"/>'
        '<path d="M30 30l8 8M41 35a4 4 0 0 1-5 5l-3-3 5-5z"/>'),
    # LED head throwing an even beam
    "led-lighting-upgrades": _ICON.format(
        '<path d="M24 4v8" stroke="#5b6068"/><rect x="12" y="12" width="24" height="7" rx="2" stroke="#5b6068" fill="#fde3d4"/>'
        '<path d="M14 24l-6 16M24 24v16M34 24l6 16"/>'),
    # building wall with a wall pack
    "wall-packs-building-lights": _ICON.format(
        '<path d="M8 44V6h18v38" stroke="#5b6068"/><path d="M8 14h18M8 22h18M8 30h18M8 38h18" stroke="#5b6068" stroke-width="1.4"/>'
        '<rect x="26" y="16" width="8" height="8" rx="1.5" fill="#fde3d4"/><path d="M34 22l8 12M34 20h8"/>'),
    # tall pole on a concrete base
    "light-pole-repair-replacement": _ICON.format(
        '<path d="M24 38V8h10" stroke="#5b6068"/><rect x="32" y="5" width="10" height="5" rx="1.5" stroke="#5b6068"/>'
        '<path d="M16 38h16v6H16z" fill="#fde3d4"/><path d="M20 30l8-4"/>'),
    # pylon sign with lit face
    "lighted-sign-repair": _ICON.format(
        '<rect x="8" y="6" width="32" height="20" rx="2" stroke="#5b6068" fill="#fde3d4"/>'
        '<path d="M14 13h20M14 19h12"/><path d="M20 26v16M28 26v16M14 42h20" stroke="#5b6068"/>'),
    # calendar with a bulb
    "lighting-maintenance-plans": _ICON.format(
        '<rect x="6" y="10" width="36" height="32" rx="2" stroke="#5b6068"/><path d="M6 18h36M15 6v8M33 6v8" stroke="#5b6068"/>'
        '<path d="M24 24a5 5 0 0 0-3 9v3h6v-3a5 5 0 0 0-3-9z" fill="#fde3d4"/><path d="M22 39h4"/>'),
}
