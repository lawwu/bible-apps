/* The Line of Kings — interactive timeline of Israel & Judah.
   Renders KINGS / PROPHETS / WRITINGS / EVENTS from data.js. */

const EVAL_COLOR = { good: "#5f7134", mixed: "#a97d1c", bad: "#8b2a1d" };
const EVAL_PHRASE = {
  good: "did right in the eyes of the LORD",
  mixed: "started well, ended badly",
  bad: "did evil in the eyes of the LORD",
};
const PROPHET_COLOR = "#2f4b7c";
const GOLD = "#a97d1c";

const W = 1200;
const DOMAIN = [1060, 555];
const KING_LANE_H = 26;
const PROPHET_LANE_H = 15;

/* ---------- lane packing (years are BC: start > end) ---------- */

function assignLanes(items) {
  const lanes = [];
  const sorted = [...items].sort((a, b) => b.start - a.start);
  for (const it of sorted) {
    let lane = lanes.findIndex((endBC) => it.start < endBC + 0.5);
    if (lane === -1) { lanes.push(0); lane = lanes.length - 1; }
    it.lane = lane;
    lanes[lane] = Math.min(lanes[lane] || Infinity, it.end);
  }
  return lanes.length;
}

const israelKings = KINGS.filter((k) => k.kingdom === "israel");
const judahKings = KINGS.filter((k) => k.kingdom === "judah");
const unitedKings = KINGS.filter((k) => k.kingdom === "united");
const israelProphets = PROPHETS.filter((p) => p.kingdom === "israel");
const judahProphets = PROPHETS.filter((p) => p.kingdom !== "israel");
unitedKings.forEach((k) => (k.lane = 0));

const ipLanes = assignLanes(israelProphets);
const ikLanes = assignLanes(israelKings);
const jkLanes = assignLanes(judahKings);
const jpLanes = assignLanes(judahProphets);

/* ---------- vertical layout ---------- */

const bands = {};
let cursor = 46;
function caption(text) { const y = cursor + 9; cursor += 15; return y; }
bands.capIP = caption();
bands.ip = cursor; cursor += ipLanes * PROPHET_LANE_H + 4;
bands.capIK = caption();
bands.ik = cursor; cursor += ikLanes * KING_LANE_H + 12;
bands.capJK = caption();
bands.jk = cursor; cursor += jkLanes * KING_LANE_H + 6;
bands.capJP = caption();
bands.jp = cursor; cursor += jpLanes * PROPHET_LANE_H + 8;
bands.writings = cursor + 8; cursor += 26;
bands.axis = cursor + 8;
const H = bands.axis + 30;

const CAPTIONS = [
  [bands.capIP, "Prophets to Israel & Nineveh"],
  [bands.capIK, "KINGS OF ISRAEL — the northern kingdom"],
  [bands.capJK, "KINGS OF JUDAH — the southern kingdom, the line of David"],
  [bands.capJP, "Prophets to Judah & the exiles"],
];

/* ---------- svg scaffold ---------- */

const svg = d3.select("#chart").attr("viewBox", `0 0 ${W} ${H}`);
const x0 = d3.scaleLinear().domain(DOMAIN).range([6, W - 6]);
let zx = x0;

const defs = svg.append("defs");
defs.append("pattern").attr("id", "co-hatch")
  .attr("width", 5).attr("height", 5).attr("patternUnits", "userSpaceOnUse")
  .attr("patternTransform", "rotate(45)")
  .append("rect").attr("width", 2).attr("height", 5).attr("fill", "#8d8064").attr("opacity", 0.55);

const gMain = svg.append("g");
const gZones = gMain.append("g");
const gEvents = gMain.append("g");
const gCaptions = gMain.append("g");
const gUnited = gMain.append("g");
const gKings = gMain.append("g");
const gProphets = gMain.append("g");
const gWritings = gMain.append("g");
const gAxis = gMain.append("g").attr("class", "axis").attr("transform", `translate(0,${bands.axis})`);

const tooltip = document.getElementById("tooltip");
let selectedEl = null;

/* ---------- static pieces ---------- */

const capSel = gCaptions.selectAll("text")
  .data(CAPTIONS)
  .join("text")
  .attr("class", (d, i) => (i === 1 || i === 2) ? "track-caption" : "track-caption-sub")
  .attr("x", 10).attr("y", (d) => d[0])
  .text((d) => d[1]);

/* exile shading behind the king bands */
const zones = [
  { from: 722, band: "ik", lanes: ikLanes, label: "Assyria scatters the north — no more kings" },
  { from: 586, band: "jk", lanes: jkLanes, label: "exile in Babylon" },
];
const zoneSel = gZones.selectAll("g").data(zones).join("g");
zoneSel.append("rect").attr("class", "exile-zone")
  .attr("y", (d) => bands[d.band] - 2)
  .attr("height", (d) => d.lanes * KING_LANE_H + 4);
zoneSel.append("text").attr("class", "exile-note")
  .attr("y", (d) => bands[d.band] + 14)
  .text((d) => d.label);

/* events: dashed rules + angled labels */
const evSel = gEvents.selectAll("g").data(EVENTS).join("g")
  .attr("class", "event-hit")
  .on("click", (e, d) => showDetail(d, "event"))
  .on("mouseenter", (e, d) => showTip(e, `${d.year} BC`, d.label, d.note))
  .on("mousemove", moveTip)
  .on("mouseleave", hideTip);
evSel.append("line").attr("class", "event-line")
  .attr("y1", 40).attr("y2", bands.axis - 2);
evSel.append("text").attr("class", "event-label")
  .text((d) => `${d.year} · ${d.label}`);

/* united monarchy: tall bars spanning both king bands */
const unitedSel = gUnited.selectAll("g").data(unitedKings).join("g")
  .attr("class", "king-bar")
  .on("click", (e, d) => showDetail(d, "king"))
  .on("mouseenter", (e, d) => showTip(e, reignLine(d), d.name, d.note))
  .on("mousemove", moveTip)
  .on("mouseleave", hideTip);
unitedSel.append("rect").attr("class", "body")
  .attr("y", bands.ik).attr("height", bands.jk + jkLanes * KING_LANE_H - bands.ik)
  .attr("fill", (d) => EVAL_COLOR[d.eval]).attr("opacity", 0.88);
unitedSel.append("text").attr("class", "king-label")
  .attr("y", (bands.ik + bands.jk + jkLanes * KING_LANE_H) / 2 + 4)
  .attr("text-anchor", "middle");

/* kings */
function kingY(d) {
  return (d.kingdom === "israel" ? bands.ik : bands.jk) + d.lane * KING_LANE_H;
}
const kingSel = gKings.selectAll("g").data([...israelKings, ...judahKings]).join("g")
  .attr("class", "king-bar")
  .on("click", (e, d) => showDetail(d, "king"))
  .on("mouseenter", (e, d) => showTip(e, reignLine(d), d.name + (d.queen ? " (queen)" : ""), d.note))
  .on("mousemove", moveTip)
  .on("mouseleave", hideTip);
kingSel.append("rect").attr("class", "co")
  .attr("y", (d) => kingY(d) + 5).attr("height", KING_LANE_H - 12)
  .attr("fill", "url(#co-hatch)")
  .style("display", (d) => d.co ? null : "none");
kingSel.append("rect").attr("class", "body")
  .attr("y", (d) => kingY(d) + 2).attr("height", KING_LANE_H - 6)
  .attr("fill", (d) => EVAL_COLOR[d.eval]);
kingSel.append("text").attr("class", "king-label")
  .attr("y", (d) => kingY(d) + KING_LANE_H / 2 + 3);

/* prophets */
function prophetY(d) {
  return (d.kingdom === "israel" ? bands.ip : bands.jp) + d.lane * PROPHET_LANE_H;
}
const prophetSel = gProphets.selectAll("g").data(PROPHETS).join("g")
  .attr("class", "prophet-bar")
  .on("click", (e, d) => showDetail(d, "prophet"))
  .on("mouseenter", (e, d) => showTip(e, ministryLine(d), d.name, d.note))
  .on("mousemove", moveTip)
  .on("mouseleave", hideTip);
prophetSel.append("rect").attr("class", "body")
  .attr("y", (d) => prophetY(d) + 3).attr("height", 8)
  .attr("fill", (d) => d.kingdom === "exile" ? "#5c5240" : PROPHET_COLOR)
  .attr("opacity", (d) => d.uncertain ? 0.55 : 0.9)
  .attr("stroke-dasharray", (d) => d.uncertain ? "3 2" : null)
  .attr("stroke", (d) => d.uncertain ? PROPHET_COLOR : "none");
prophetSel.append("text").attr("class", "prophet-label")
  .attr("y", (d) => prophetY(d) + 10.5)
  .text((d) => (d.book ? "¶ " : "") + d.name);

/* writings */
const writeSel = gWritings.selectAll("g").data(WRITINGS).join("g")
  .attr("class", "writing-mark")
  .on("click", (e, d) => showDetail(d, "writing"))
  .on("mouseenter", (e, d) => showTip(e, `c. ${d.year} BC`, d.name, d.note))
  .on("mousemove", moveTip)
  .on("mouseleave", hideTip);
writeSel.append("rect")
  .attr("width", 9).attr("height", 9)
  .attr("fill", GOLD)
  .attr("transform", `rotate(45)`);
const WRITE_SHORT = { "Psalms of David": "Psalms", "Proverbs · Song · Ecclesiastes": "Proverbs · Song · Eccl." };
writeSel.append("text").attr("class", "prophet-label")
  .attr("dy", 4).attr("dx", 10)
  .attr("fill", "#5c5240")
  .text((d) => "¶ " + (WRITE_SHORT[d.name] || d.name));

/* ---------- x updates (called on every zoom) ---------- */

function barX(d) { return zx(d.start); }
function barW(d) { return Math.max(zx(d.end) - zx(d.start), 2.5); }
function textFits(name, w) { return w > name.length * 6.8 + 8; }

function update() {
  capSel.filter((d, i) => i === 2)
    .attr("x", Math.max(10, Math.min(zx(931) + 6, W - 380)));

  let lastEvX = -Infinity;
  evSel.select("text").style("display", (d) => {
    const xx = zx(d.year);
    if (xx > 0 && xx < W && xx - lastEvX >= 38) { lastEvX = xx; return null; }
    return "none";
  });

  zoneSel.select("rect")
    .attr("x", (d) => zx(d.from))
    .attr("width", (d) => Math.max(zx(DOMAIN[1]) - zx(d.from), 0));
  zoneSel.select("text").attr("x", (d) => zx(d.from) + 8);

  evSel.select("line").attr("x1", (d) => zx(d.year)).attr("x2", (d) => zx(d.year));
  evSel.select("text")
    .attr("transform", (d) => `translate(${zx(d.year) + 3},36) rotate(-24)`);

  unitedSel.select("rect").attr("x", barX).attr("width", barW);
  unitedSel.select("text")
    .attr("x", (d) => zx(d.start) + barW(d) / 2)
    .text((d) => textFits(d.name, barW(d)) ? d.name : "")
    .attr("font-size", 14);

  kingSel.select("rect.body").attr("x", barX).attr("width", barW);
  kingSel.select("rect.co")
    .attr("x", (d) => d.co ? zx(d.co) : 0)
    .attr("width", (d) => d.co ? Math.max(zx(d.start) - zx(d.co), 0) : 0);
  kingSel.select("text")
    .attr("x", (d) => zx(d.start) + 5)
    .text((d) => textFits(d.name, barW(d)) ? d.name : "");

  prophetSel.select("rect")
    .attr("x", barX)
    .attr("width", (d) => d.start === d.end ? 8 : barW(d))
    .attr("transform", (d) => d.start === d.end
      ? `rotate(45 ${zx(d.start) + 4} ${prophetY(d) + 7})` : null);
  prophetSel.select("text")
    .attr("x", (d) => (d.start === d.end ? zx(d.start) + 11 : zx(d.end) + 5))
    .style("display", (d) => {
      if (d.start === d.end) return zx === x0 ? "none" : null;
      return barW(d) >= 18 ? null : "none";
    });

  writeSel.select("rect")
    .attr("transform", (d) => `translate(${zx(d.year)},${bands.writings}) rotate(45)`);
  writeSel.select("text")
    .attr("x", (d) => zx(d.year))
    .attr("y", bands.writings + 8);

  gAxis.call(
    d3.axisBottom(zx)
      .ticks(Math.min(12, Math.round(12 * (zx.domain()[0] - zx.domain()[1]) / 505)))
      .tickFormat((d) => d + " BC")
      .tickSizeOuter(0)
  );
}

/* ---------- zoom ---------- */

const zoom = d3.zoom()
  .scaleExtent([1, 24])
  .translateExtent([[0, 0], [W, H]])
  .on("zoom", (e) => { zx = e.transform.rescaleX(x0); update(); });

svg.call(zoom);
update();

function zoomToRange(a, b, animate = true) {
  const k = Math.min(24, (x0.range()[1] - x0.range()[0]) / (x0(b) - x0(a)));
  const t = d3.zoomIdentity.scale(k).translate(-x0(a) + 6 / k, 0);
  (animate ? svg.transition().duration(700) : svg).call(zoom.transform, t);
}

document.querySelectorAll(".views button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".views button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const [a, b] = btn.dataset.range.split(",").map(Number);
    zoomToRange(a, b);
  });
});

/* ---------- tooltip ---------- */

function showTip(event, kicker, title, body) {
  tooltip.innerHTML = `<span class="tip-ref">${kicker}</span><b>${title}</b> — ${
    body.length > 150 ? body.slice(0, 147) + "…" : body}`;
  tooltip.hidden = false;
  moveTip(event);
}

function moveTip(event) {
  const wrap = document.querySelector(".chart-wrap").getBoundingClientRect();
  let px = event.clientX - wrap.left + 14;
  let py = event.clientY - wrap.top + 14;
  if (px + 310 > wrap.width) px -= 330;
  if (py + 110 > wrap.height) py -= 130;
  tooltip.style.left = px + "px";
  tooltip.style.top = py + "px";
}

function hideTip() { tooltip.hidden = true; }

/* ---------- detail card ---------- */

function reignLine(d) {
  let s = `${d.start}–${d.end} BC · reigned ${d.years}`;
  if (d.co) s += ` · co-regent from ${d.co}`;
  return s;
}

function ministryLine(d) {
  return d.start === d.end
    ? `c. ${d.start} BC${d.uncertain ? " · date debated" : ""}`
    : `c. ${d.start}–${d.end} BC${d.uncertain ? " · date debated" : ""}`;
}

function showDetail(d, type) {
  document.querySelectorAll(".king-bar.selected, .prophet-bar.selected")
    .forEach((el) => el.classList.remove("selected"));
  if (type === "king" || type === "prophet") {
    d3.selectAll(type === "king" ? ".king-bar" : ".prophet-bar")
      .filter((x) => x === d).classed("selected", true);
  }

  let kicker, color, dates;
  if (type === "king") {
    const realm = d.kingdom === "united" ? "United kingdom"
      : d.kingdom === "israel" ? "Israel · northern kingdom" : "Judah · southern kingdom";
    kicker = `${realm} · ${EVAL_PHRASE[d.eval]}`;
    color = EVAL_COLOR[d.eval];
    dates = reignLine(d);
  } else if (type === "prophet") {
    kicker = d.kingdom === "exile" ? "Prophet · in exile"
      : `Prophet · to ${d.kingdom === "israel" ? "Israel" : "Judah"}`
      + (d.book ? ` · wrote ${d.book}` : "");
    color = d.kingdom === "exile" ? "#5c5240" : PROPHET_COLOR;
    dates = ministryLine(d);
  } else if (type === "writing") {
    kicker = "Writings";
    color = GOLD;
    dates = `c. ${d.year} BC`;
  } else {
    kicker = "Turning point";
    color = "#241d12";
    dates = `${d.year} BC`;
  }

  const name = d.name || d.label;
  const refs = (d.refs || []).map(([label, osis]) =>
    `<a href="../verse-explorer/#${osis}">${label}</a>`).join("");

  document.getElementById("detail").innerHTML = `
    <div class="detail-kicker"><span class="swatch" style="background:${color}"></span>${kicker}</div>
    <h2 class="detail-name">${name}${d.alt ? ` <span class="alt">also called ${d.alt}</span>` : ""}</h2>
    <p class="detail-dates">${dates}</p>
    <p class="detail-note">${d.note}</p>
    ${refs ? `<div class="detail-refs">${refs}</div>` : ""}`;
}
