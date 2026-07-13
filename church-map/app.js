/* A Church Nearby — two church directories on one map.
   Data: church-map/data/churches.json built by scripts/build_churches.py. */

/* source palette — same CVD-validated trio used across these apps */
const SRC = [
  { key: "9marks", label: "9Marks church search", color: "#bf8a14" },
  { key: "tms", label: "TMS find-a-church", color: "#4468b0" },
  { key: "both", label: "listed in both", color: "#6d8226" },
];

let D = null;
let PROF = null;                 // domain -> scraped profile (profiles.json)
let map = null;
let dots = null;                 // canvas circle markers (no clustering)
let growthLayer = null;
let densLayer = null;            // lazy-loaded county density choropleth
const show = [true, true, true];
const pfilterOn = {};            // active profile-filter ids
const main = document.getElementById("main");

/* county density ramp — paper-toned, light→dark = sparse→dense */
const DCOLORS = [[10, "#efe6cf"], [50, "#e0d2b4"], [150, "#cbb890"],
                 [500, "#ad9668"], [2000, "#8a7146"], [Infinity, "#5d4a2a"]];
const DOPACITY = [0.25, 0.5, 0.62, 0.72, 0.8, 0.85];

const SIGNAL_LABEL = {
  credo_baptism: "believer's baptism", paedo_baptism: "infant baptism",
  immersion: "baptism by immersion", plural_elders: "plurality of elders",
  reformed_soteriology: "doctrines of grace", complementarian: "complementarian",
  cessationist: "cessationist", continuationist: "continuationist",
  inerrancy: "inerrancy", premillennial: "premillennial",
  amillennial: "amillennial", dispensational: "dispensational",
};
const MIN_LABEL = { kids: "kids", youth: "youth", small_groups: "small groups" };

/* seeker filters over scraped profiles; AND-combined when active */
const PFILTERS = [
  ["kids", "kids ministry", (p) => (p.min || []).includes("kids")],
  ["youth", "youth", (p) => (p.min || []).includes("youth")],
  ["sg", "small groups", (p) => (p.min || []).includes("small_groups")],
  ["elders", "plural elders", (p) => p.sig && p.sig.plural_elders],
  ["reformed", "doctrines of grace", (p) => p.sig && p.sig.reformed_soteriology],
  ["credo", "believer's baptism", (p) => p.sig && (p.sig.credo_baptism || p.sig.immersion)],
  ["video", "watch online", (p) => p.med && (p.med.youtube || p.med.vimeo)],
  ["es", "Spanish", (p) => (p.lang || []).includes("Spanish")],
  ["ko", "Korean", (p) => (p.lang || []).includes("Korean")],
];

function siteDomain(site) {
  try {
    return new URL(site.startsWith("http") ? site : "https://" + site)
      .hostname.replace(/^www\./, "").toLowerCase();
  } catch (e) { return ""; }
}

function profileFor(c) {
  return (PROF && c[6] && PROF[siteDomain(c[6])]) || null;
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const MI = (km) => Math.round(km * 0.621371);

function popupHtml(c) {
  const [name, , , locality, country, src, site, pastor] = c;
  const where = [locality, country === "United States" ? "" : country]
    .filter(Boolean).join(" · ");
  let siteLink = "";
  if (site && site.length > 10) {
    try {
      const host = new URL(site.startsWith("http") ? site : "https://" + site).hostname;
      siteLink = `<a href="${esc(site)}" target="_blank" rel="noopener">${esc(host.replace(/^www\./, ""))}</a>`;
    } catch (e) { /* malformed URL in source data */ }
  }
  return `
    <div class="popup-name">${esc(name)}</div>
    <div class="popup-meta">${esc(where)}${pastor ? `<br>Pastor-teacher: ${esc(pastor)}` : ""}
    ${siteLink ? `<br>${siteLink}` : ""}</div>
    ${profileBlock(profileFor(c))}
    <div class="popup-src">${SRC[src].label}</div>`;
}

/* scraped profile card — every claim carries its evidence quote as a title
   tooltip, and stale listings are flagged rather than hidden */
function profileBlock(p) {
  if (!p) return "";
  if (p.st !== "ok") {
    const why = { parked: "website domain is parked — listing may be stale",
                  dead: "website unreachable", js_only: "site needs JavaScript — not yet profiled",
                  moved: "website has moved", error: "website unreachable" }[p.st] || p.st;
    return `<div class="popup-profile stale">⚠ ${esc(why)} <i>(checked ${esc(p.chk)})</i></div>`;
  }
  let h = "";
  if (p.t) h += `<div>${esc(p.t.slice(0, 3).join(" · "))}</div>`;
  const chips = [];
  for (const k of (p.min || [])) chips.push(`<span class="chip">${MIN_LABEL[k] || k}</span>`);
  for (const [k, v] of Object.entries(p.sig || {})) {
    chips.push(`<span class="chip sig" title="${esc(v.q)}">${SIGNAL_LABEL[k] || k}</span>`);
  }
  for (const l of (p.lang || [])) if (l !== "English") chips.push(`<span class="chip">${esc(l)}</span>`);
  if (chips.length) h += `<div class="chip-row">${chips.join("")}</div>`;
  if (p.conf) h += `<div>Names: ${esc(p.conf.join(", "))}</div>`;
  if (p.aff) h += `<div>Affiliated: ${esc(p.aff.join(", "))}</div>`;
  if (p.kin) h += `<div title="wording similarity of the church's own statement, not a label it claims">
    Statement reads closest to <b>${esc(p.kin[0])}</b> (${p.kin[1]})</div>`;
  const links = [];
  if (p.b) links.push(`<a href="${esc(p.b)}" target="_blank" rel="noopener">beliefs</a>`);
  if (p.med && p.med.youtube) links.push(`<a href="${esc(p.med.youtube)}" target="_blank" rel="noopener">YouTube</a>`);
  if (p.med && p.med.podcast) links.push(`<a href="${esc(p.med.podcast)}" target="_blank" rel="noopener">podcast</a>`);
  if (links.length) h += `<div>${links.join(" · ")}</div>`;
  if (!h) return "";
  return `<div class="popup-profile">${h}<div class="popup-checked">from the church's website · checked ${esc(p.chk)}</div></div>`;
}

function rebuildMarkers() {
  dots.clearLayers();
  const active = PFILTERS.filter(([id]) => pfilterOn[id]);
  let matched = 0;
  for (const c of D.churches) {
    if (!show[c[5]]) continue;
    if (active.length) {
      const p = profileFor(c);
      if (!p || p.st !== "ok" || !active.every(([, , test]) => test(p))) continue;
      matched++;
    }
    const m = L.circleMarker([c[1], c[2]], {
      radius: 4.5,
      color: "#f7f1e3",
      weight: 1,
      fillColor: SRC[c[5]].color,
      fillOpacity: 0.85,
    });
    m.bindPopup(popupHtml(c));
    m._name = (c[0] + " " + (c[3] || "") + " " + (c[4] || "")).toLowerCase();
    dots.addLayer(m);
  }
  applySearch();
  const note = document.getElementById("pfilter-note");
  if (note) {
    note.textContent = active.length
      ? `showing ${matched} profiled church${matched === 1 ? "" : "es"} matching ` +
        active.map(([, label]) => label).join(" + ")
      : "";
  }
}

/* search dims everything that doesn't match, and flies to the first hit;
   every word must match somewhere ("berean irvine" finds Berean CC Irvine) */
function applySearch(fly) {
  const q = (document.getElementById("q") || {}).value || "";
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let first = null;
  dots.eachLayer((m) => {
    const hit = words.every((w) => m._name.includes(w));
    m.setStyle({ fillOpacity: hit ? 0.85 : 0.06, weight: hit ? 1 : 0 });
    if (hit && words.length && !first) first = m;
  });
  if (fly && q.trim().length > 2 && first) map.setView(first.getLatLng(), 9);
}

function flyToMetro(lat, lng) {
  map.setView([lat, lng], 9);
  window.scrollTo({ top: document.getElementById("map").offsetTop - 70,
                    behavior: "smooth" });
}

function render() {
  const k = D.meta.counts;
  const gapMi = MI(D.meta.gap_km);
  /* D.metros rows: [name, st, isMetro, lat, lng, pop2020, pop2024,
     nearestKm, churchesWithin25mi, nearestName] */
  const metros = D.metros.filter((r) => r[2] === 1);
  const gaps = metros.filter((r) => (r[7] || 1e9) > D.meta.gap_km);
  const growingNone = metros.filter((r) => r[6] > r[5] && r[8] === 0);

  main.innerHTML = `
    <p class="page-kicker">Two directories · ${k.total.toLocaleString()} churches</p>
    <h2 class="page-title">Where are the churches?</h2>
    <p class="page-note">Two lists, drawn for different reasons, on one map: every church
    in the <a href="https://www.9marks.org/church-search/">9Marks church search</a> and
    every congregation led by an alumnus of
    <a href="https://tms.edu/find-a-church/">The Master's Seminary</a>. Together —
    ${k.total.toLocaleString()} churches in ${k.countries} countries. Click any dot for
    its profile, toggle population density to see how peopled the empty-looking places
    really are, or click a metro in the lists below to fly there.</p>

    <div class="stats-row">
      <div class="stat"><b>${k.total.toLocaleString()}</b>churches on the map</div>
      <div class="stat"><b>${k.ninemarks.toLocaleString()}</b>in the 9Marks directory</div>
      <div class="stat"><b>${k.tms.toLocaleString()}</b>led by TMS alumni</div>
      <div class="stat"><b>${k.both.toLocaleString()}</b>listed in both</div>
      <div class="stat"><b>${k.countries}</b>countries</div>
      <div class="stat"><b>${growingNone.length}</b>growing U.S. metros with no listed church</div>
    </div>

    <div class="map-controls maptools">
      ${SRC.map((s, i) => `
        <button class="lgd" data-src="${i}"><i style="background:${s.color}"></i>${s.label}</button>`).join("")}
      <button class="lgd" id="growth-toggle"><i class="ring"></i>growth 2020–24</button>
      <button class="lgd off" id="density-toggle">
        <i style="background:linear-gradient(90deg,#e0d2b4,#5d4a2a);border-radius:2px"></i>population density</button>
      <input class="map-search" id="q" type="text" placeholder="search church or city…">
    </div>
    <div class="denslegend" id="dens-legend">
      <span class="dl-title">people / sq mi</span>
      ${DCOLORS.map(([max, col], i) => {
        const lo = i ? DCOLORS[i - 1][0] : 0;
        const label = max === Infinity ? `${lo / 1000}k+`
          : max >= 1000 ? `${lo}–${max / 1000}k` : i ? `${lo}–${max}` : `<${max}`;
        return `<span><i style="background:${col}"></i>${label}</span>`;
      }).join("")}
    </div>
    <div id="map"></div>
    <div class="map-controls metro-jumps">
      <span class="pfilters-label">fly to a metro:</span>
      ${metros.slice().sort((a, b) => b[6] - a[6]).slice(0, 21).map((r) => `
        <button class="jump" data-lat="${r[3]}" data-lng="${r[4]}"
          title="${esc(r[0])} · ${(r[6] / 1e6).toFixed(1)}M people · ${r[8]} listed church${r[8] === 1 ? "" : "es"} within ${MI(D.meta.gap_km)} mi">
          ${esc(r[0].split("-")[0])}</button>`).join("")}
    </div>
    ${PROF ? `
    <div class="map-controls pfilters">
      <span class="pfilters-label" title="from each church's own website — churches without a profile yet are hidden while a filter is on">find a church:</span>
      ${PFILTERS.map(([id, label]) => `
        <label><input type="checkbox" data-pf="${id}">${label}</label>`).join("")}
      <span id="pfilter-note"></span>
    </div>` : ""}

    <p class="sec-heading">Where the people are going</p>
    <p class="chart-note">America has some 356,000 congregations — one for every
    thousand people — yet, as <a href="https://churchanswers.com/podcasts/rainer-on-leadership/the-burge-report-are-there-too-many-churches-in-the-united-states/">the
    Burge Report on Church Answers</a> observes, houses of worship are not tracking
    with population growth: churches sit where America <em>was</em>. So overlay the
    U.S. Census: for every metro area that grew from 2020 to 2024, divide the
    <b>new residents</b> by the <b>listed churches within ${gapMi} miles</b> of its
    center. The bigger the number, the more a growing metro is running ahead of
    these two directories:</p>
    <div id="need-list"></div>

    <p class="sec-heading">The thin places</p>
    <p class="chart-note">The same ${metros.length} metro areas (plus
    ${(D.metros.length - metros.length).toLocaleString()} micropolitan ones), ranked by
    distance from the area's center to the nearest listed church anywhere. Only
    ${gaps.length === 1 ? "one metro has" : gaps.length + " metros have"} nothing within
    ${gapMi} miles${gaps.length ? " — " + gaps.map((g) => `<b>${esc(g[0])}</b>`).join(" and ") : ""}.
    The twenty-five farthest:</p>
    <div id="cov-list"></div>

    <p class="method-note">Method: both directories are self-listed and neither is
    exhaustive — plenty of faithful churches are in neither, and a listing is a signpost,
    not a seal. Population is the U.S. Census Bureau's metro-area estimate series
    (2024 vintage); distances are from each area's gazetteer centroid, as the crow
    flies, so very large metros understate their suburbs. The need figure is plain
    arithmetic — residents added 2020–2024 ÷ listed churches within ${gapMi} miles —
    a measure of where these two lists are thin relative to growth, not of where the
    gospel is absent. Churches within 0.7 km sharing most of a name are merged as
    "listed in both." Contact emails and phone numbers in the sources are deliberately
    not republished. Population density is Census 2024 county estimates over county
    land area. Data refreshed by <code>church-map/scripts/build_churches.py</code>.</p>`;

  // map — light CARTO basemap, canvas-rendered dots (no clustering)
  map = L.map("map", { preferCanvas: true, worldCopyJump: true,
                       scrollWheelZoom: true }).setView([38.5, -96.5], 4);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 18,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
  }).addTo(map);
  map.createPane("density");
  map.getPane("density").style.zIndex = 350;   // under the church dots
  dots = L.layerGroup().addTo(map);
  rebuildMarkers();

  growthLayer = buildGrowthLayer(metros);
  growthLayer.addTo(map);

  main.querySelectorAll(".maptools .lgd[data-src]").forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.classList.toggle("off");
      show[+btn.dataset.src] = !btn.classList.contains("off");
      rebuildMarkers();
    });
  });
  document.getElementById("growth-toggle").addEventListener("click", function () {
    this.classList.toggle("off");
    if (this.classList.contains("off")) map.removeLayer(growthLayer);
    else growthLayer.addTo(map);
  });
  document.getElementById("density-toggle").addEventListener("click", toggleDensity);
  document.getElementById("q").addEventListener("input", () => applySearch(true));
  bindFlyRows(main.querySelector(".metro-jumps"));
  main.querySelectorAll(".pfilters input[data-pf]").forEach((box) => {
    box.addEventListener("change", () => {
      pfilterOn[box.dataset.pf] = box.checked;
      rebuildMarkers();
    });
  });

  drawNeed(metros);
  drawThin();
}

/* county population density — lazy-loaded on first toggle */
async function toggleDensity() {
  const btn = document.getElementById("density-toggle");
  const on = btn.classList.contains("off");
  btn.classList.toggle("off", !on);
  document.getElementById("dens-legend").classList.toggle("on", on);
  if (!on) {
    if (densLayer) map.removeLayer(densLayer);
    return;
  }
  if (densLayer) { map.addLayer(densLayer); return; }
  btn.disabled = true;
  const gj = await fetch("data/counties_density.json").then((r) => r.json());
  const fmtP = (n) => n >= 1e6 ? (n / 1e6).toFixed(1) + "M"
    : n >= 1e3 ? (n / 1e3).toFixed(0) + "k" : n;
  densLayer = L.geoJSON(gj, {
    pane: "density",
    renderer: L.canvas({ pane: "density" }),
    style: (f) => {
      const cls = DCOLORS.findIndex(([max]) => f.properties.d < max);
      return { fillColor: DCOLORS[cls][1], fillOpacity: DOPACITY[cls],
               color: "#f7f1e3", weight: 0.4, opacity: 0.5 };
    },
    onEachFeature: (f, lay) => {
      lay.bindTooltip(`<b>${esc(f.properties.n)} County</b><br>` +
        `${fmtP(f.properties.p)} people · ${f.properties.d.toLocaleString()} / sq mi`,
        { sticky: true, direction: "top", opacity: 0.95 });
    },
  }).addTo(map);
  btn.disabled = false;
}

/* oxblood rings sized by residents added 2020–24; bold when the growth has
   few listed churches to land in */
function buildGrowthLayer(metros) {
  const layer = L.layerGroup();
  const grow = metros.filter((r) => r[6] > r[5])
    .sort((a, b) => (b[6] - b[5]) - (a[6] - a[5])).slice(0, 120);
  for (const r of grow) {
    const added = r[6] - r[5];
    const per = added / Math.max(r[8], 1);
    const hot = per > 3000 || r[8] === 0;
    L.circleMarker([r[3], r[4]], {
      radius: Math.min(28, Math.max(5, Math.sqrt(added) / 22)),
      color: "#8b2a1d",
      weight: hot ? 2.5 : 1,
      opacity: hot ? 0.9 : 0.4,
      fillColor: "#8b2a1d",
      fillOpacity: hot ? 0.12 : 0.04,
    }).bindTooltip(`<b>${esc(r[0])}</b><br>+${added.toLocaleString()} people since 2020<br>` +
        `${r[8]} listed church${r[8] === 1 ? "" : "es"} within ${MI(D.meta.gap_km)} mi`)
      .addTo(layer);
  }
  return layer;
}

function bindFlyRows(el) {
  if (!el) return;
  el.querySelectorAll("[data-lat]").forEach((row) => row.addEventListener(
    "click", () => flyToMetro(+row.dataset.lat, +row.dataset.lng)));
}

function drawNeed(metros) {
  const rows = metros
    .filter((r) => r[6] - r[5] > 0 && r[6] >= 100000)
    .map((r) => ({
      name: r[0], added: r[6] - r[5], growth: (r[6] - r[5]) / r[5],
      within: r[8], per: (r[6] - r[5]) / Math.max(r[8], 1),
      lat: r[3], lng: r[4],
    }))
    .sort((a, b) => b.per - a.per).slice(0, 20);
  const max = rows[0].per;
  document.getElementById("need-list").innerHTML = rows.map((r) => `
    <div class="cov-row need-row" data-lat="${r.lat}" data-lng="${r.lng}"
      title="${esc(r.name)}: +${r.added.toLocaleString()} residents 2020–24, ${r.within} listed churches nearby — click to fly there">
      <span class="cov-city">${esc(r.name)}</span>
      <span class="cov-track"><i class="cov-bar${r.within === 0 ? " gap" : ""}"
        style="width:${Math.max(1.5, r.per / max * 100).toFixed(1)}%"></i></span>
      <span class="cov-val">${r.within === 0 ? `<span class="gap-tag">none listed</span>`
        : Math.round(r.per).toLocaleString() + " / church"}</span>
      <span class="cov-near">+${r.added.toLocaleString()} people (${(r.growth * 100).toFixed(1)}%) · ${r.within} church${r.within === 1 ? "" : "es"}</span>
    </div>`).join("");
  bindFlyRows(document.getElementById("need-list"));
}

function drawThin() {
  const rows = D.metros.slice()
    .sort((a, b) => (b[7] || 0) - (a[7] || 0)).slice(0, 25);
  const max = rows[0][7] || 1;
  document.getElementById("cov-list").innerHTML = rows.map((r) => `
    <div class="cov-row" data-lat="${r[3]}" data-lng="${r[4]}"
      title="nearest listed church to ${esc(r[0])}: ${esc(r[9] || "—")} — click to fly there">
      <span class="cov-city">${esc(r[0])}${r[2] ? "" : " <i>· micro</i>"}</span>
      <span class="cov-track"><i class="cov-bar${r[7] > D.meta.gap_km ? " gap" : ""}"
        style="width:${Math.max(1.5, (r[7] || 0) / max * 100).toFixed(1)}%"></i></span>
      <span class="cov-val">${MI(r[7] || 0)} mi${r[7] > D.meta.gap_km ? `<span class="gap-tag">gap</span>` : ""}</span>
      <span class="cov-near">${esc(r[9] || "")}</span>
    </div>`).join("");
  bindFlyRows(document.getElementById("cov-list"));
}

Promise.all([
  fetch("data/churches.json").then((r) => r.json()),
  fetch("data/profiles.json").then((r) => r.json()).catch(() => null),
]).then(([d, prof]) => { D = d; PROF = prof; render(); })
  .catch(() => {
    main.innerHTML = `<p class="loading-note">Couldn't load the church data.</p>`;
  });
