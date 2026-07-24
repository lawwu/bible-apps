/* The sorting room — twelve doctrines, four tags, one clipboard. */
(function () {
  "use strict";

  var ORDERS = ["first order", "second order", "third order", "fourth order"];
  var PRIORITY = ["immediate", "urgent", "stable", "no injury"];

  // level: textbook ranking (1-4). also: additional defensible answers.
  var CASES = [
    {
      q: "Did Jesus rise bodily from the dead?",
      level: 1,
      explain: "Paul stakes the whole faith here: if Christ is not raised, preaching is vain, faith is vain, the dead are lost (1 Corinthians 15:14–17) — and it stands at the head of the passage he says was delivered “first of all.” Deny it and what remains, whatever it is, is not Christianity."
    },
    {
      q: "Public school, private school, or homeschool?",
      level: 4,
      explain: "Minter’s own specimen of a fourth-order matter. Scripture commands parents to raise children in the nurture of the Lord and never once names a delivery mechanism; wisdom, means, and the particular child settle it. A family’s schooling is a decision to respect, not a doctrine to enforce."
    },
    {
      q: "Elders, bishops, or the congregation — who governs the church?",
      level: 2,
      explain: "Practice forces a decision — someone signs the lease and shepherds the flock, and a church cannot be governed three ways at once. Presbyterian, episcopal, and congregational polity sort honest believers into separate structures while leaving them brothers. The textbook mark of second order."
    },
    {
      q: "Where is a believer between death and the resurrection?",
      level: 3,
      explain: "“Absent from the body… present with the Lord” (2 Corinthians 5:8) secures the comfort without furnishing the room. Christians have mapped the interval differently for centuries and stayed in the same churches while doing it. Debate freely; divide never."
    },
    {
      q: "Is Jesus fully God and fully man?",
      level: 1,
      explain: "The church called councils — Nicaea, Chalcedon — because a Christ who is half God, or who only seemed human, cannot carry what Scripture lays on him: “the Word was God… and the Word was made flesh” (John 1). Historically, re-answering this question is the first move of every group the church has had to call a cult."
    },
    {
      q: "May a Christian drink wine?",
      level: 4,
      explain: "Romans 14 is nearly this case verbatim: one believer partakes with thanksgiving, another abstains in conscience, and Paul forbids each to judge the other. Principles apply — sobriety, love for the weaker conscience — but there is no universal command to enforce. Tag it and discharge it."
    },
    {
      q: "Baptism: believers only, or infants too?",
      level: 2,
      explain: "Mohler’s own example of second order. The font forces the issue — a congregation will baptize its infants or it will not; there is no both — so the doctrine draws church lines. A Baptist and a Presbyterian can esteem one another as believers for a lifetime and still cannot share a membership roll."
    },
    {
      q: "What is the millennium of Revelation 20?",
      level: 3,
      explain: "That Christ will return is first order and creedal. Whether the thousand years comes before, after, or figuratively is a debate the church has sustained since the second century. Mohler files nearly all questions of end-times sequence third order: the blessed hope is essential; the timetable is not."
    },
    {
      q: "Is a sinner justified by faith alone, or by faith plus works?",
      level: 1,
      explain: "Galatians 1 pronounces its anathema over exactly this ground: another gospel. Mohler’s first-order list sets justification by faith alone beside the Trinity and the deity of Christ — the Reformation did not divide Europe over a scraped knee."
    },
    {
      q: "Does God unconditionally elect who will be saved?",
      level: 2,
      also: [3],
      explain: "The textbook (and Mohler’s heirs) usually file election second order — whole denominations stand on each answer, and a church’s preaching will lean one way. But here the shelf shows its seams: plenty of congregations keep Calvinists and Arminians in one pew and treat it as third. Rigney’s refinement exactly — second order is a range, not a point, and this call is closer than the textbook admits."
    },
    {
      q: "Are there degrees of reward in heaven — and of punishment in hell?",
      level: 3,
      explain: "Jesus speaks of few stripes and many (Luke 12:47–48), of treasure laid up and treasure lost; yet the arithmetic has never been made a test of fellowship. A classic third-order question: worth a long evening, not worth a church split."
    },
    {
      q: "May women be ordained as pastors?",
      level: 2,
      explain: "Mohler files it second order: a congregation must decide, so it cannot be third. And yet this is the card that shows the tool’s limits. Attebury — reviving the Puritan Edward Leigh’s category of “circa-foundational” error — argues it destabilizes first-order ground: creation, the authority of Scripture. Rigney adds that this error tends to spread where baptismal difference stays put. Same shelf as baptism; not the same weight. Rank is not importance."
    }
  ];

  var root = document.getElementById("room-app");
  if (!root) return;

  var i = 0;                 // current case index
  var results = [];          // "agree" | "differ" per answered case
  var answered = false;

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  }

  function roman(n) { return ["I", "II", "III", "IV"][n - 1]; }

  function renderCase() {
    answered = false;
    root.innerHTML = "";
    var c = CASES[i];

    var meta = el("div", "case-meta");
    meta.appendChild(el("span", null,
      "Case no. " + String(i + 1).padStart(3, "0") + " — admitted"));
    var dots = el("div", "case-dots");
    for (var d = 0; d < CASES.length; d++) {
      var dot = el("span");
      if (d < results.length) dot.className = results[d];
      else if (d === i) dot.className = "current";
      dots.appendChild(dot);
    }
    meta.appendChild(dots);
    root.appendChild(meta);

    root.appendChild(el("p", "case-q", c.q));

    var picks = el("div", "tag-picks");
    for (var L = 1; L <= 4; L++) {
      var b = el("button", "pick pick-" + L,
        "<b>" + roman(L) + "</b><span>" + ORDERS[L - 1] + "</span>");
      b.type = "button";
      b.dataset.level = L;
      b.setAttribute("aria-label", ORDERS[L - 1] + " — " + PRIORITY[L - 1]);
      b.addEventListener("click", onPick);
      picks.appendChild(b);
    }
    root.appendChild(picks);

    var verdict = el("div", "verdict");
    verdict.id = "verdict";
    verdict.setAttribute("aria-live", "polite");
    root.appendChild(verdict);
  }

  function onPick(e) {
    if (answered) return;
    answered = true;
    var pick = Number(e.currentTarget.dataset.level);
    var c = CASES[i];
    var ok = pick === c.level || (c.also || []).indexOf(pick) !== -1;
    results.push(ok ? "agree" : "differ");

    var buttons = root.querySelectorAll(".pick");
    buttons.forEach(function (b) {
      b.disabled = true;
      var L = Number(b.dataset.level);
      if (L === pick) b.classList.add("was-pick");
      if (L === c.level) b.classList.add("was-answer");
    });

    var dots = root.querySelectorAll(".case-dots span");
    dots[i].className = ok ? "agree" : "differ";

    var v = document.getElementById("verdict");
    v.appendChild(el("div", "stamp s" + c.level,
      ORDERS[c.level - 1] + " — " + PRIORITY[c.level - 1]));

    var callWord = ok
      ? '<span class="agree-word">' + (pick === c.level ? "agreed" : "defensible") + "</span>"
      : '<span class="differ-word">differs</span>';
    v.appendChild(el("p", "verdict-call",
      "Your tag: <b>" + roman(pick) + "</b> · textbook: <b>" + roman(c.level) +
      "</b> · " + callWord));

    v.appendChild(el("p", "verdict-explain", c.explain));

    var next = el("button", "next-btn",
      i + 1 < CASES.length ? "Next case →" : "End of shift →");
    next.type = "button";
    next.addEventListener("click", advance);
    v.appendChild(next);
    next.focus({ preventScroll: true });
  }

  function advance() {
    i++;
    if (i < CASES.length) renderCase();
    else renderReport();
  }

  function renderReport() {
    root.innerHTML = "";
    var agrees = results.filter(function (r) { return r === "agree"; }).length;

    var rep = el("div", "report");
    rep.appendChild(el("div", "stamp s3", "Shift complete"));
    rep.appendChild(el("h3", null,
      "You agreed with the textbook on " + agrees + " of " + CASES.length + " cases."));
    rep.appendChild(el("p", "score",
      agrees === CASES.length
        ? "A clean sheet — Mohler would hand you the clipboard. Now read the malpractice board below anyway: the tool fails in predictable ways even in careful hands."
        : "Where you differed, you are in company — the levels are a tool of judgment, not a table of the law. What matters is refusing the four failures on the malpractice board below."));
    rep.appendChild(el("p", "coda",
      "The tags are Mohler’s (2005), the fourth level Minter’s, the referee’s notes from Rigney and Attebury — sources at the foot of the page."));

    var again = el("button", "restart-btn", "Work another shift");
    again.type = "button";
    again.addEventListener("click", function () {
      i = 0; results = []; renderCase();
    });
    rep.appendChild(again);
    root.appendChild(rep);
  }

  // Keys 1-4 tag the current case; Enter advances once answered.
  document.addEventListener("keydown", function (e) {
    if (e.target instanceof Element && e.target.matches("input, textarea, select")) return;
    if (!answered && e.key >= "1" && e.key <= "4") {
      var b = root.querySelector('.pick[data-level="' + e.key + '"]');
      if (b && rootInView()) b.click();
    }
  });

  function rootInView() {
    var r = root.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0;
  }

  renderCase();

  // ---- reveal-on-scroll, matching the house pattern ----
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add("seen"); observer.unobserve(en.target); }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll(
    ".tag, .fail-card, .section-head, .section-lede, .qlist li, .q-coda, .room, .source-list li"
  ).forEach(function (n) { observer.observe(n); });
})();
