/* Shared navigation bar — stitches the Bible apps into one site.
 *
 * Include from any page:
 *   <script defer src="../shared/nav.js"></script>          (light apps)
 *   <script defer src="../shared/nav.js" data-theme="dark"></script>  (Living Word)
 *
 * The bar's height is published as --appnav-h on :root so app CSS can
 * offset fixed elements (fallback 0px keeps pages working standalone).
 */
(function () {
  var script = document.currentScript;
  var root = script.src.replace(/shared\/nav\.js.*$/, "");
  var dark = script.dataset.theme === "dark";

  var apps = [
    { slug: "", label: "Home", title: "Bible apps — home" },
    { slug: "verse-explorer", label: "Entwined", title: "Every Word Entwined — cross-reference explorer" },
    { slug: "kings-timeline", label: "Kings", title: "The Line of Kings — timeline of Israel & Judah" },
    { slug: "preached", label: "Preached", title: "Preached — a sermon archive shaped like the Bible" },
    { slug: "living-word", label: "Living Word", title: "The Living Word — 3D knowledge graph of Scripture" },
    { slug: "translations", label: "Other Words", title: "In Other Words — where translations part ways" },
    { slug: "translation-tree", label: "Tree", title: "The Translation Tree — a family tree of the English Bible" },
    { slug: "denomination-tree", label: "Branches", title: "The Denomination Tree — how one church became many" },
    { slug: "church-map", label: "Churches", title: "A Church Nearby — two directories, one map" },
    { slug: "theological-triage", label: "Triage", title: "Theological Triage — a sorting room for doctrine" },
    { slug: "romans-road", label: "Romans Road", title: "The Romans Road — a guided walk" }
  ];

  var path = location.pathname;
  function isActive(slug) {
    if (!slug) {
      return apps.slice(1).every(function (a) { return path.indexOf("/" + a.slug + "/") === -1; });
    }
    return path.indexOf("/" + slug + "/") !== -1;
  }

  var css = [
    ":root { --appnav-h: 44px; }",
    ".appnav {",
    "  position: sticky; top: 0; z-index: 3000;",
    "  height: var(--appnav-h);",
    "  display: flex; align-items: center; gap: 1.5rem;",
    "  padding: 0 1.6rem;",
    "  background: rgba(247, 241, 227, 0.93);",
    "  -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);",
    "  border-bottom: 1px solid rgba(36, 29, 18, 0.3);",
    "  font-family: 'EB Garamond', 'Newsreader', Georgia, serif;",
    "  font-size: 0.95rem;",
    "  overflow-x: auto; white-space: nowrap;",
    "  scrollbar-width: none;",
    "}",
    ".appnav::-webkit-scrollbar { display: none; }",
    ".appnav-brand {",
    "  font-family: 'Fraunces', Georgia, serif; font-weight: 600; font-size: 1rem;",
    "  color: #241d12; text-decoration: none; letter-spacing: 0.01em;",
    "  display: inline-flex; align-items: baseline; gap: 0.5rem; flex: none;",
    "}",
    ".appnav-brand .mark { color: #8b2a1d; font-size: 0.9em; }",
    ".appnav-links { display: flex; gap: 1.2rem; margin-left: auto; }",
    ".appnav-link {",
    "  color: #5c5240; text-decoration: none; letter-spacing: 0.04em;",
    "}",
    ".appnav-link:hover { color: #241d12; }",
    ".appnav-link.active {",
    "  color: #8b2a1d;",
    "  text-decoration: underline; text-underline-offset: 7px;",
    "  text-decoration-color: rgba(139, 42, 29, 0.55);",
    "}",
    ".appnav--dark {",
    "  position: fixed; top: 0; left: 0; right: 0;",
    "  background: rgba(8, 10, 22, 0.55);",
    "  border-bottom: 1px solid rgba(212, 168, 59, 0.22);",
    "  -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);",
    "}",
    ".appnav--dark .appnav-brand { color: rgba(236, 230, 214, 0.92); }",
    ".appnav--dark .appnav-brand .mark { color: #d4a83b; }",
    ".appnav--dark .appnav-link { color: rgba(236, 230, 214, 0.62); }",
    ".appnav--dark .appnav-link:hover { color: rgba(236, 230, 214, 0.95); }",
    ".appnav--dark .appnav-link.active {",
    "  color: #d4a83b; text-decoration-color: rgba(212, 168, 59, 0.55);",
    "}",
    "@media (max-width: 640px) {",
    "  .appnav { padding: 0 1rem; gap: 1rem; font-size: 0.9rem; }",
    "  .appnav-links { gap: 0.95rem; }",
    "}"
  ].join("\n");

  function render() {
    var style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);

    var nav = document.createElement("nav");
    nav.className = "appnav" + (dark ? " appnav--dark" : "");
    nav.setAttribute("aria-label", "Bible apps");

    var brand = document.createElement("a");
    brand.className = "appnav-brand";
    brand.href = root;
    brand.innerHTML = '<span class="mark">✣</span> Bible apps';
    nav.appendChild(brand);

    var links = document.createElement("div");
    links.className = "appnav-links";
    apps.forEach(function (app) {
      var a = document.createElement("a");
      a.className = "appnav-link" + (isActive(app.slug) ? " active" : "");
      a.href = root + (app.slug ? app.slug + "/" : "");
      a.title = app.title;
      a.textContent = app.label;
      links.appendChild(a);
    });
    nav.appendChild(links);

    document.body.insertBefore(nav, document.body.firstChild);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();
