// Quote form: service picker, lighting counts, one card per pothole, striping and
// sealcoating calculators, then sends everything to quote-submit.
// The live price only shows on the private estimator link (/quote/?k=…), which
// the owner opens from the review page. Customers never see a price here.
(function () {
  var form = document.getElementById("quote-form");
  if (!form || !window.fetch || !window.FileReader) return; // falls back to Netlify Forms

  var MAX_PHOTOS = 12, PER_CARD = 3, MAX_TOTAL = 5000000; // stay under the 6 MB function limit
  var status = document.getElementById("form-status");
  var btn = form.querySelector('button[type="submit"]');
  var $ = function (id) { return document.getElementById(id); };

  function setStatus(msg, err) {
    status.textContent = msg;
    status.className = "form-status" + (err ? " err" : "");
  }
  function chosen() {
    return Array.prototype.map.call(form.querySelectorAll('input[name="services"]:checked'), function (i) { return i.value; });
  }
  function has(s) { return chosen().indexOf(s) >= 0; }

  // ---------- show the sections that match the chosen services ----------
  var sections = form.querySelectorAll(".qsec");
  var other = $("svc-other"), otherBox = $("other-svcs");
  function refresh() {
    var c = chosen();
    otherBox.hidden = !other.checked;
    if (!other.checked) Array.prototype.forEach.call(otherBox.querySelectorAll("input"), function (i) { i.checked = false; });
    Array.prototype.forEach.call(sections, function (sec) {
      var on = sec.getAttribute("data-for").split("|").some(function (s) { return c.indexOf(s) >= 0; });
      sec.hidden = !on;
    });
    // Renumber the visible detail sections 3, 4, 5…
    var n = 3;
    Array.prototype.forEach.call(sections, function (sec) { if (!sec.hidden) sec.querySelector(".q-step span").textContent = n++; });
    $("restripe-tip").hidden = has("Striping");
    if (has("Pothole repair") || has("Crack sealing")) { if (!cards.length) addCard(); }
    if (has("Sealcoating")) initMap();
    estimate();
  }
  form.addEventListener("change", function (e) {
    if (e.target.name === "services" || e.target === other) refresh();
  });

  // ---------- pothole cards ----------
  var cards = []; // { el, files: [] }
  // Optional photo boxes: overview (pothole section), striping, sealcoat, other.
  var boxes = Array.prototype.map.call(form.querySelectorAll(".photo-box"), function (el) {
    var b = { group: el.getAttribute("data-group"), el: el, files: [], preview: el.querySelector(".photo-preview"), section: el.closest(".qsec") };
    var input = el.querySelector('input[type="file"]');
    input.addEventListener("change", function () { addFiles(input, b.files, b.preview, MAX_PHOTOS); });
    return b;
  });
  var tpl = $("pothole-tpl"), holder = $("pothole-cards");

  function photoCount() {
    return cards.reduce(function (s, c) { return s + c.files.length; }, boxes.reduce(function (s, b) { return s + b.files.length; }, 0));
  }
  function drawPreview(box, list) {
    box.innerHTML = "";
    list.forEach(function (f, i) {
      var w = document.createElement("span");
      w.className = "thumb";
      var img = document.createElement("img");
      img.alt = "";
      img.src = f.url || (f.url = URL.createObjectURL(f));
      var x = document.createElement("button");
      x.type = "button"; x.textContent = "×"; x.setAttribute("aria-label", "Remove photo");
      x.onclick = function () { list.splice(i, 1); drawPreview(box, list); };
      w.appendChild(img); w.appendChild(x); box.appendChild(w);
    });
  }
  function addFiles(input, list, box, cap) {
    var room = Math.min(cap - list.length, MAX_PHOTOS - photoCount());
    var files = Array.prototype.slice.call(input.files);
    if (files.length > room) setStatus(room > 0 ? "Only " + room + " more photo(s) fit here." : "That's the photo limit. Remove one to add another.", true);
    else setStatus("");
    files.slice(0, Math.max(0, room)).forEach(function (f) { list.push(f); });
    input.value = "";
    drawPreview(box, list);
  }
  function renumber() {
    cards.forEach(function (c, i) {
      c.el.querySelector(".hcard-title").textContent = "Pothole " + (i + 1);
      c.el.querySelector(".hcard-rm").hidden = cards.length < 2;
    });
  }
  function addCard() {
    var el = tpl.content.firstElementChild.cloneNode(true);
    var card = { el: el, files: [] };
    var input = el.querySelector(".hcard-files"), box = el.querySelector(".photo-preview");
    input.addEventListener("change", function () { addFiles(input, card.files, box, PER_CARD); });
    el.querySelector(".hcard-rm").onclick = function () {
      cards.splice(cards.indexOf(card), 1); el.remove(); renumber();
    };
    holder.appendChild(el);
    cards.push(card);
    renumber();
    return card;
  }
  $("add-pothole").onclick = function () {
    addCard().el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // ---------- lighting ----------
  function lighting() {
    return {
      need: radio("l-need") || "advise", poles: num("l-poles"), walls: num("l-walls"), out: num("l-out"),
      damaged: num("l-damaged"), signs: num("l-signs"), controls: $("l-controls").checked
    };
  }

  // ---------- striping ----------
  function num(id) { var v = parseInt($(id).value, 10); return isNaN(v) || v < 0 ? 0 : v; }
  function radio(name) { var r = form.querySelector('input[name="' + name + '"]:checked'); return r ? r.value : ""; }
  function striping() {
    return {
      stalls: num("s-stalls"), ada: num("s-ada"), layout: radio("s-layout"), numbered: $("s-numbered").checked,
      signs: num("s-signs"), arrows: num("s-arrows"), stops: num("s-stops"), crosswalks: num("s-crosswalks"),
      words: num("s-words"), curb_lf: num("s-curb")
    };
  }
  $("add-restripe").onclick = function () {
    form.querySelector('input[name="services"][value="Striping"]').checked = true;
    refresh();
    $("sec-striping").scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ---------- sealcoating map ----------
  var map = null, areas = [[]], layers = [], mapSqft = 0;
  function loadLeaflet(cb) {
    if (window.L) return cb();
    var css = document.createElement("link");
    css.rel = "stylesheet"; css.href = "/vendor/leaflet/leaflet.css";
    document.head.appendChild(css);
    var js = document.createElement("script");
    js.src = "/vendor/leaflet/leaflet.js";
    js.onload = cb;
    js.onerror = function () { $("seal-map").innerHTML = '<p style="padding:14px">The map didn\'t load. Type your square footage below instead.</p>'; };
    document.head.appendChild(js);
  }
  function initMap() {
    if (map === true) return; // still loading
    if (map) { setTimeout(function () { map.invalidateSize(); }, 50); return; }
    map = true;
    loadLeaflet(function () {
      map = L.map("seal-map", { zoomControl: true }).setView([41.72, -88.12], 11);
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxNativeZoom: 19, maxZoom: 21, attribution: "Imagery © Esri, Maxar, Earthstar Geographics"
      }).addTo(map);
      map.on("click", function (e) { areas[areas.length - 1].push([e.latlng.lat, e.latlng.lng]); drawAreas(); });
      if ($("f-address").value.trim()) findAddress();
    });
  }
  // Area of a lat/lng polygon on the earth's surface, in square feet.
  function sqftOf(pts) {
    if (pts.length < 3) return 0;
    var R = 6378137, rad = Math.PI / 180, a = 0;
    for (var i = 0; i < pts.length; i++) {
      var p1 = pts[i], p2 = pts[(i + 1) % pts.length];
      a += (p2[1] - p1[1]) * rad * (2 + Math.sin(p1[0] * rad) + Math.sin(p2[0] * rad));
    }
    return Math.abs(a * R * R / 2) * 10.7639;
  }
  function drawAreas() {
    layers.forEach(function (l) { map.removeLayer(l); });
    layers = [];
    mapSqft = 0;
    areas.forEach(function (pts) {
      if (pts.length >= 3) layers.push(L.polygon(pts, { color: "#e2581a", weight: 2, fillOpacity: 0.25 }).addTo(map));
      else if (pts.length === 2) layers.push(L.polyline(pts, { color: "#e2581a", weight: 2 }).addTo(map));
      pts.forEach(function (p) { layers.push(L.circleMarker(p, { radius: 5, color: "#fff", weight: 2, fillColor: "#e2581a", fillOpacity: 1 }).addTo(map)); });
      mapSqft += sqftOf(pts);
    });
    mapSqft = Math.round(mapSqft / 10) * 10;
    $("map-area").innerHTML = "Area: <strong>" + mapSqft.toLocaleString("en-US") + " sq ft</strong>" +
      (areas.length > 1 ? " in " + areas.filter(function (a) { return a.length >= 3; }).length + " areas" : "");
    if (mapSqft) $("c-sqft").value = "";
    estimate();
  }
  function findAddress() {
    var q = $("f-address").value.trim();
    if (!q) { setStatus("Enter the property address above first.", true); $("f-address").focus(); return; }
    if (!window.L || map === true) return;
    fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=" + encodeURIComponent(q))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j[0]) { map.setView([+j[0].lat, +j[0].lon], 19); setStatus(""); }
        else setStatus("Couldn't find that address on the map. Zoom in by hand, or type the square footage.", true);
      }).catch(function () {});
  }
  $("map-find").onclick = findAddress;
  $("map-undo").onclick = function () {
    if (!window.L || map === true) return;
    var cur = areas[areas.length - 1];
    if (cur.length) cur.pop(); else if (areas.length > 1) { areas.pop(); areas[areas.length - 1].pop(); }
    drawAreas();
  };
  $("map-new").onclick = function () { if (areas[areas.length - 1].length >= 3) areas.push([]); };
  $("map-clear").onclick = function () { if (!window.L || map === true) return; areas = [[]]; drawAreas(); };
  $("f-address").addEventListener("change", function () { if (window.L && map && map !== true) findAddress(); });

  function sealcoat() {
    var typed = num("c-sqft");
    var outline = [];
    areas.forEach(function (a) { if (a.length >= 3) a.forEach(function (p) { outline.push([+p[0].toFixed(6), +p[1].toFixed(6)]); }); });
    return {
      sqft: typed || mapSqft, measured: typed ? "typed" : "map",
      coats: +radio("c-coats") || 2, cracks: radio("c-cracks") || "none", outline: outline
    };
  }

  // ---------- live estimate ----------
  var estBox = $("estimate"), estTimer = null, estSeq = 0;
  var staffKey = new URLSearchParams(location.search).get("k") || "";
  function money(n) { return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var LABELS = { pothole: "Crack filling", striping: "Striping", sealcoat: "Sealcoating", lighting: "Lighting" };
  function estimate() {
    clearTimeout(estTimer);
    estTimer = setTimeout(runEstimate, 350);
  }
  function runEstimate() {
    var body = {};
    if (has("Lighting")) body.lighting = lighting();
    if (has("Striping")) body.striping = striping();
    if (has("Sealcoating")) body.sealcoat = sealcoat();
    var photoWork = has("Pothole repair") || has("Crack sealing");
    if (!staffKey || (!body.striping && !body.sealcoat && !body.lighting)) { estBox.innerHTML = ""; return; }
    body.k = staffKey;
    var seq = ++estSeq;
    fetch("/.netlify/functions/quote-estimate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (seq !== estSeq) return;
        if (j.error) { estBox.innerHTML = "<h3>Estimator</h3><p class=\"est-note\" style=\"margin:0\">This estimator link isn't valid. Open it again from a quote review page.</p>"; return; }
        if (!j.total) {
          estBox.innerHTML = "<h3>Estimate (staff only)</h3><p class=\"est-note\" style=\"margin:0\">" +
            (body.sealcoat && !body.sealcoat.sqft ? "Outline your lot or type the square footage to see a price. " : "") +
            (body.striping && !(body.striping.stalls || body.striping.ada) ? "Enter your stall count to see a price. " : "") +
            (body.lighting ? "Enter the light counts to see a price." : "") + "</p>";
          return;
        }
        var groups = {}, rows = "";
        j.lines.forEach(function (l) { groups[l.group] = 1; });
        var multi = Object.keys(groups).filter(function (g) { return g !== "fee"; }).length > 1, last = null;
        j.lines.forEach(function (l) {
          if (multi && l.group !== "fee" && l.group !== last) { last = l.group; rows += '<tr class="est-group"><td colspan="2">' + LABELS[l.group] + "</td></tr>"; }
          var qty = l.group === "fee" ? "" : " <span style=\"opacity:.7\">· " + Number(l.qty).toLocaleString("en-US") + " " + esc(l.unit) + "</span>";
          rows += "<tr><td>" + esc(l.name) + qty + "</td><td>" + money(l.amount) + "</td></tr>";
        });
        estBox.innerHTML = "<h3>Estimate (staff only)</h3><table>" + rows +
          '<tr class="est-total"><td>Estimated total</td><td>' + money(j.total) + "</td></tr></table>" +
          '<p class="est-note">Only visible on your private estimator link. Customers see no price on this page.' +
          (photoWork ? " Pothole and crack repairs are priced from photos on the review page." : "") + "</p>";
      }).catch(function () { if (seq === estSeq) estBox.innerHTML = ""; });
  }
  form.addEventListener("input", function (e) {
    if (e.target.closest && (e.target.closest("#sec-lighting") || e.target.closest("#sec-striping") || e.target.closest("#sec-seal"))) estimate();
  });

  // ---------- submit ----------
  function resize(file, edge, quality) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, edge / Math.max(img.width, img.height));
        var c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", quality).split(",")[1]);
      };
      img.onerror = function () { reject(new Error("Couldn't read " + file.name + ". Try a different photo.")); };
      img.src = file.url || URL.createObjectURL(file);
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var c = chosen();
    if (!c.length) { setStatus("Pick at least one service at the top.", true); form.scrollIntoView({ behavior: "smooth" }); return; }
    if (!form.reportValidity()) return;
    var fd = new FormData(form);
    if (fd.get("company_url")) return; // honeypot
    var body = {
      first_name: fd.get("first_name"), last_name: fd.get("last_name"),
      name: ((fd.get("first_name") || "").trim() + " " + (fd.get("last_name") || "").trim()).trim(), company: fd.get("company"), email: fd.get("email"),
      phone: fd.get("phone"), address: fd.get("address"),
      property_type: fd.get("property_type"), timing: fd.get("timing"),
      services: c, notes: fd.get("notes")
    };
    if (has("Pothole repair") || has("Crack sealing")) body.pothole_total = num("p-total");
    if (has("Lighting")) {
      body.lighting = lighting();
      var L = body.lighting;
      if (!L.poles && !L.walls && !L.out && !L.damaged && !L.signs && !L.controls) { setStatus("Enter how many lights you have, or how many are out.", true); $("l-poles").focus(); return; }
    }
    if (has("Striping")) {
      body.striping = striping();
      if (!body.striping.stalls && !body.striping.ada) { setStatus("Enter how many parking stalls need striping.", true); $("s-stalls").focus(); return; }
    }
    if (has("Sealcoating")) {
      body.sealcoat = sealcoat();
      if (!body.sealcoat.sqft) { setStatus("Outline your lot on the map, or type the square footage.", true); $("c-sqft").focus(); return; }
    }

    // Flatten photos and remember which belong to which pothole.
    var files = [], groups = [];
    if (has("Pothole repair") || has("Crack sealing")) {
      cards.forEach(function (card) {
        var note = card.el.querySelector(".hcard-note").value.trim();
        var size = card.el.querySelector(".hcard-size").value;
        if (!card.files.length && !note && !size) return;
        var idx = card.files.map(function (f) { files.push(f); return files.length - 1; });
        groups.push({ type: "pothole", note: note, size: size, photos: idx });
      });
    }
    // Photos from the other sections, only if that section is showing.
    boxes.forEach(function (b) {
      if (!b.files.length || b.section.hidden) return;
      groups.push({ type: b.group, note: "", photos: b.files.map(function (f) { files.push(f); return files.length - 1; }) });
    });
    files = files.slice(0, MAX_PHOTOS);
    body.photoGroups = groups;

    btn.disabled = true;
    setStatus(files.length ? "Preparing photos…" : "Sending…");
    function encode(edge, q) { return Promise.all(files.map(function (f) { return resize(f, edge, q); })); }
    function total(arr) { return arr.reduce(function (s, p) { return s + p.length; }, 0); }
    encode(1200, 0.7).then(function (photos) {
      return total(photos) > MAX_TOTAL ? encode(900, 0.6) : photos;
    }).then(function (photos) {
      setStatus("Sending…");
      body.photos = photos;
      return fetch("/.netlify/functions/quote-submit", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
      });
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error(j.error || "Something went wrong. Please try again.");
        // Start processing; the request is already saved, and a scheduled job retries if this is cut off.
        try {
          fetch("/.netlify/functions/quote-process", {
            method: "POST", keepalive: true, headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: j.id, k: j.k })
          }).catch(function () {});
        } catch (err) {}
        setTimeout(function () { window.location.href = "/thank-you/"; }, 300);
      });
    }).catch(function (err) {
      btn.disabled = false;
      setStatus(err.message, true);
    });
  });

  // Start: services can be preselected with ?service=striping etc.
  var pre = (new URLSearchParams(location.search).get("service") || "").toLowerCase();
  var map2 = { lighting: "Lighting", lights: "Lighting", pothole: "Pothole repair", potholes: "Pothole repair", crack: "Crack sealing", striping: "Striping", sealcoating: "Sealcoating" };
  if (map2[pre]) form.querySelector('input[name="services"][value="' + map2[pre] + '"]').checked = true;
  refresh();
})();
