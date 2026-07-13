/* The Translation Tree — data.
   Nodes are English Bibles (plus the three source texts they drink from);
   edges are parent links: kind "rev" = revision of that English text (solid),
   kind "src" = translated afresh from / shaped by it (dashed).
   `yr` places a node on the time scale; `years` is the label people read.
   `col` is a column index into COLS (app.js); small vertical nudges are
   applied automatically when neighbors crowd each other. */

const STREAMS = {
  vulgate:  { label: "from the Latin Vulgate",        color: "#7d8c2e" },
  tr:       { label: "the Textus Receptus line",      color: "#9c2a1e" },
  critical: { label: "the critical (eclectic) Greek text", color: "#3a62ac" },
};

const PHIL = {
  source: "source text",
  formal: "word-for-word",
  mediating: "balanced",
  dynamic: "thought-for-thought",
  paraphrase: "paraphrase",
};

const ERAS = [
  { from: 1355, to: 1516, name: "The manuscript age",
    sub: "England’s Bible is Latin — after 1408, an English one is contraband" },
  { from: 1516, to: 1611, name: "The Reformation century",
    sub: "printing + Greek = seven English Bibles in eighty-five years" },
  { from: 1611, to: 1870, name: "The reign of the King James",
    sub: "one Bible, two hundred and fifty years" },
  { from: 1870, to: 1960, name: "The revision era",
    sub: "older manuscripts reopen the KJV line" },
  { from: 1960, to: 2026, name: "The modern flood",
    sub: "a translation for every philosophy" },
];

const NODES = [
  /* ---------- source texts ---------- */
  {
    id: "vulgate", short: "Latin Vulgate", name: "The Latin Vulgate",
    years: "c. 405", yr: 1362, ypin: 66, col: 0, stream: "vulgate", phil: "source",
    parents: [],
    wiki: "Vulgate",
    blurb: "Jerome’s Latin Bible (c. 382–405) was Scripture for the western church for a thousand years. When English translation was outlawed after 1408, “the Bible” meant this Latin text — and the first two English Bibles on this chart were made from it, not from the Hebrew or Greek.",
  },
  {
    id: "tr", short: "Textus Receptus", name: "The Textus Receptus",
    years: "1516", yr: 1516, ypin: 198, col: 1, stream: "tr", phil: "source",
    parents: [],
    wiki: "Textus_Receptus",
    blurb: "Erasmus raced his Greek New Testament into print in 1516 from a handful of late Byzantine manuscripts. Polished by Stephanus and Beza, it became the “received text” — the Greek under Tyndale, Geneva, and the King James — until older manuscripts unseated it in 1881. Among major modern versions only the NKJV still builds on it.",
  },
  {
    id: "critical", short: "Eclectic Greek text", name: "The Critical (Eclectic) Greek Text",
    years: "1881 →", yr: 1876, col: 4, stream: "critical", phil: "source",
    parents: [],
    wiki: "Novum_Testamentum_Graece",
    blurb: "Westcott and Hort’s 1881 edition began weighing the oldest witnesses — Sinaiticus, Vaticanus, and eventually the papyri — instead of counting late copies. Carried on by the Nestle-Aland and UBS editions, this ever-revised “eclectic” text sits beneath nearly every translation made since.",
  },

  /* ---------- the manuscript age ---------- */
  {
    id: "wycliffe", short: "Wycliffe Bible", name: "The Wycliffe Bible",
    years: "1382", yr: 1382, ypin: 124, col: 0, stream: "vulgate", phil: "formal",
    parents: [["vulgate", "src"]],
    wiki: "Wycliffe's_Bible",
    blurb: "The first complete Bible in English, hand-copied by followers of the Oxford reformer John Wycliffe and revised by John Purvey around 1388 — all of it translated from the Latin Vulgate. The church answered in 1408 by making unlicensed English Scripture a heresy offence, and in 1428 by digging up Wycliffe’s bones to burn them. Some 250 manuscripts survived anyway.",
  },

  /* ---------- the Reformation century ---------- */
  {
    id: "tyndale", short: "Tyndale", name: "Tyndale’s New Testament & Pentateuch",
    years: "1526–34", yr: 1526, col: 2, stream: "tr", phil: "formal",
    parents: [["tr", "src"]],
    wiki: "Tyndale_Bible",
    blurb: "William Tyndale printed the first English New Testament translated from the Greek (Worms, 1526) and smuggled it home in bales of cloth, adding the Pentateuch from the Hebrew in 1530. Strangled and burned near Brussels in 1536, he prayed “Lord, open the king of England’s eyes.” More than four-fifths of the King James New Testament is still his wording.",
  },
  {
    id: "coverdale", short: "Coverdale", name: "The Coverdale Bible",
    years: "1535", yr: 1535, col: 3, stream: "tr", phil: "formal",
    parents: [["tyndale", "rev"]],
    wiki: "Coverdale_Bible",
    blurb: "Myles Coverdale produced the first complete printed English Bible without much Hebrew or Greek of his own — stitching Tyndale’s work together with the Vulgate and German versions, “out of Douche and Latyn.” His musical Psalter outlived everything else: it is still sung from the Book of Common Prayer.",
  },
  {
    id: "matthews", short: "Matthew’s Bible", name: "Matthew’s Bible",
    years: "1537", yr: 1537, col: 2, stream: "tr", phil: "formal",
    parents: [["tyndale", "rev"], ["coverdale", "rev"]],
    wiki: "Matthew_Bible",
    blurb: "John Rogers, hiding behind the pen-name “Thomas Matthew,” bound Tyndale’s published books, Tyndale’s unpublished Joshua–2 Chronicles, and Coverdale’s remainder into one volume — and won Henry VIII’s licence for it, months after Tyndale had died for the same work. Rogers became the first martyr of Mary I’s reign in 1555.",
  },
  {
    id: "great", short: "Great Bible", name: "The Great Bible",
    years: "1539", yr: 1539, col: 2, stream: "tr", phil: "formal",
    parents: [["matthews", "rev"]],
    wiki: "Great_Bible",
    blurb: "Thomas Cromwell commissioned Coverdale to revise Matthew’s Bible into an official one, and royal injunctions ordered a copy set up in every parish church in England — chained to the lectern, read aloud by anyone who could. “Great” referred simply to its size.",
  },
  {
    id: "geneva", short: "Geneva Bible", name: "The Geneva Bible",
    years: "1560", yr: 1560, col: 3, stream: "tr", phil: "formal",
    parents: [["great", "rev"]],
    wiki: "Geneva_Bible",
    blurb: "Made by Protestant exiles in Calvin’s Geneva during Mary’s persecutions: the first English Bible with numbered verses, roman type, italics for supplied words, and a study apparatus of fiercely Protestant margin notes. The Bible of Shakespeare, Bunyan, and the Mayflower, it outsold the King James for a generation.",
  },
  {
    id: "bishops", short: "Bishops’ Bible", name: "The Bishops’ Bible",
    years: "1568", yr: 1568, col: 2, stream: "tr", phil: "formal",
    parents: [["great", "rev"]],
    wiki: "Bishops'_Bible",
    blurb: "The Church of England’s answer to Geneva — Archbishop Parker’s bench of bishops revised the Great Bible so the official pulpit Bible would carry no Calvinist margin notes. Nobody loved it, but its 1602 printing was handed to the King James translators as the text “to be followed, and as little altered as the truth of the original will permit.”",
  },
  {
    id: "douay", short: "Douay–Rheims", name: "The Douay–Rheims Bible",
    years: "1582 · 1610", yr: 1582, col: 0, stream: "vulgate", phil: "formal",
    parents: [["vulgate", "src"]],
    wiki: "Douay–Rheims_Bible",
    blurb: "English Catholic exiles translated the Vulgate at Rheims (New Testament, 1582) and Douai (Old Testament, 1609–10), Latinate to the bone. The Rheims New Testament left real fingerprints on the KJV’s wording, and Bishop Challoner’s 1749–52 revision — which borrowed back from the KJV — served English-speaking Catholics into the twentieth century.",
  },

  /* ---------- the King James ---------- */
  {
    id: "kjv1611", short: "AV of 1611 (KJV)", name: "The King James Version",
    alt: "the Authorized Version", years: "1611", yr: 1611, ypin: 583, col: 2, stream: "tr", phil: "formal",
    parents: [["bishops", "rev"], ["geneva", "src"], ["douay", "src"]],
    wiki: "King_James_Version",
    blurb: "Commissioned by James I after the 1604 Hampton Court conference: some 47 scholars in six companies, instructed to revise the Bishops’ Bible against the Hebrew and Greek while consulting Tyndale, Matthew’s, Coverdale, the Great Bible, and Geneva. What emerged was less a new translation than the Tyndale tradition perfected — and, for three centuries, simply “the Bible.”",
  },
  {
    id: "kjv1769", short: "AV of 1769 (KJV)", name: "The King James Version of 1769",
    alt: "Blayney’s Oxford standard", years: "1769", yr: 1769, col: 2, stream: "tr", phil: "formal",
    parents: [["kjv1611", "rev"]],
    edgeLabel: "revisions",
    wiki: "King_James_Version",
    blurb: "The KJV read today is not quite 1611’s. Printings accumulated corrections for a century and a half until Benjamin Blayney’s 1769 Oxford edition standardized spelling, punctuation, and thousands of small details — the text every “KJV” on a shelf now actually follows, and the trunk every later revision starts from.",
  },

  /* ---------- the revision era ---------- */
  {
    id: "erv", short: "ERV", name: "The English Revised Version",
    years: "1881–85", yr: 1881, col: 2, stream: "critical", phil: "formal",
    parents: [["kjv1769", "rev"], ["critical", "src"]],
    wiki: "Revised_Version",
    blurb: "The first official revision of the KJV, ordered by the Convocation of Canterbury in 1870. Its committee — Westcott and Hort among them — quietly swapped the Textus Receptus for the oldest Greek manuscripts; American newspapers printed its entire New Testament by telegraph. Accurate and unloved, too wooden to dethrone the KJV, it nonetheless reopened the text for everyone after.",
  },
  {
    id: "asv", short: "ASV", name: "The American Standard Version",
    years: "1901", yr: 1901, col: 2, stream: "critical", phil: "formal",
    parents: [["erv", "rev"]],
    wiki: "American_Standard_Version",
    blurb: "The American members of the revision committee waited out a fourteen-year courtesy agreement, then published their preferred readings in 1901. Stricter still than the ERV — it renders the divine name “Jehovah” throughout — it became the seminary workhorse, and the trunk from which the RSV, the NASB, and the Living Bible all grew.",
  },
  {
    id: "rsv", short: "RSV", name: "The Revised Standard Version",
    years: "1946–52", yr: 1949, col: 2, stream: "critical", phil: "formal",
    parents: [["asv", "rev"]],
    wiki: "Revised_Standard_Version",
    blurb: "The National Council of Churches’ thorough revision of the ASV (New Testament 1946, complete 1952) was the first English Bible to draw on the Dead Sea Scrolls. Rendering Isaiah 7:14 “young woman” got it denounced from pulpits — one North Carolina pastor burned the page. Its quieter legacy: the 1971 second edition became the base text of the ESV.",
  },
  {
    id: "nrsv", short: "NRSV", name: "The New Revised Standard Version",
    years: "1989", yr: 1989, col: 1, stream: "critical", phil: "formal",
    parents: [["rsv", "rev"]],
    wiki: "New_Revised_Standard_Version",
    blurb: "Bruce Metzger’s committee brought the RSV up to date in 1989 with gender-accurate language (“brothers and sisters”) and the newest manuscript evidence. It remains the standard Bible of universities, mainline churches, and most academic study editions, refreshed again as the NRSV Updated Edition in 2021.",
  },
  {
    id: "esv", short: "ESV", name: "The English Standard Version",
    years: "2001", yr: 2001, col: 2, stream: "critical", phil: "formal",
    parents: [["rsv", "rev"]],
    wiki: "English_Standard_Version",
    blurb: "Crossway licensed the 1971 RSV and revised about six percent of it — “essentially literal,” and conservative where the RSV had rankled evangelicals (“virgin” restored at Isaiah 7:14). Text updates followed in 2007, 2011, 2016, and 2025, and it has become the house Bible of Reformed and evangelical churches across the English-speaking world.",
  },
  {
    id: "nasb71", short: "NASB", name: "The New American Standard Bible",
    years: "1971", yr: 1971, col: 3, stream: "critical", phil: "formal",
    parents: [["asv", "rev"]],
    wiki: "New_American_Standard_Bible",
    blurb: "When the RSV read as too mainline for conservatives, the Lockman Foundation revived the ASV instead — New Testament 1963, complete Bible 1971. For a generation “most literal translation in English” was practically its subtitle: supplied words in italics, literal renderings in the margin, a verse to a line.",
  },
  {
    id: "nasb95", short: "NASB ’95", name: "The NASB 1995 Update",
    years: "1995", yr: 1995, col: 3, stream: "critical", phil: "formal",
    parents: [["nasb71", "rev"]],
    wiki: "New_American_Standard_Bible",
    blurb: "The 1995 update finally retired “Thee” and “Thou,” smoothed the clunkiest word orders, and became the NASB most people actually own. It matters on this chart for one more reason: it is the exact base text the Legacy Standard Bible starts from.",
  },
  {
    id: "nasb2020", short: "NASB 2020", name: "The NASB 2020",
    years: "2020", yr: 2020, col: 3, stream: "critical", phil: "formal",
    parents: [["nasb95", "rev"]],
    wiki: "New_American_Standard_Bible",
    blurb: "Lockman’s 2020 refresh adds “brothers and sisters” (italicized) where the Greek address plainly includes women, and trades a little literalism for readability. The foundation keeps 1995 and 2020 in print side by side — a fork within the NASB itself.",
  },
  {
    id: "lsb", short: "LSB", name: "The Legacy Standard Bible",
    years: "2021", yr: 2021, col: 4, stream: "critical", phil: "formal",
    parents: [["nasb95", "rev"]],
    wiki: "Legacy_Standard_Bible",
    blurb: "Faculty of The Master’s University and Seminary, with the Lockman Foundation’s blessing, tightened the NASB 1995 rather than loosening it: YHWH appears as “Yahweh” in every one of its nearly seven thousand occurrences, doulos is consistently “slave,” and each original word maps to the same English wherever possible. A 2021 translation bred for expository preaching.",
  },
  {
    id: "nkjv", short: "NKJV", name: "The New King James Version",
    years: "1982", yr: 1982, col: 0, stream: "tr", phil: "formal",
    parents: [["kjv1769", "rev"]],
    wiki: "New_King_James_Version",
    blurb: "Thomas Nelson’s 130 scholars modernized the KJV’s English (1982) while deliberately keeping its Greek — the Textus Receptus — making the NKJV the only major modern translation on the KJV’s own textual base. Where the older manuscripts differ, it footnotes them rather than following them.",
  },

  /* ---------- the modern flood ---------- */
  {
    id: "tlb", short: "Living Bible", name: "The Living Bible",
    years: "1971", yr: 1971, col: 4, stream: "critical", phil: "paraphrase",
    parents: [["asv", "rev"]],
    wiki: "The_Living_Bible",
    blurb: "Kenneth Taylor began rephrasing the ASV in plain English on his train commute so his ten children could follow family devotions. Living Letters (1962) grew into The Living Bible (1971) — a paraphrase by its own admission, and for a stretch of the 1970s the best-selling book in America of any kind.",
  },
  {
    id: "nlt", short: "NLT", name: "The New Living Translation",
    years: "1996", yr: 1996, col: 4, stream: "critical", phil: "dynamic",
    parents: [["tlb", "rev"], ["critical", "src"]], noEdge: ["critical"],
    wiki: "New_Living_Translation",
    blurb: "Tyndale House hired ninety scholars to turn Taylor’s paraphrase into a genuine translation, checked against the Hebrew and Greek. By its 1996 debut — and thorough revisions in 2004 and 2015 — the NLT had become a fresh thought-for-thought translation, now perennially among the best-sellers.",
  },
  {
    id: "jb", short: "Jerusalem Bible", name: "The Jerusalem Bible",
    years: "1966", yr: 1966, col: 5, stream: "critical", phil: "dynamic",
    parents: [["critical", "src"]],
    wiki: "Jerusalem_Bible",
    blurb: "The first complete Catholic Bible translated into English from the Hebrew and Greek (1966), shaped by the French Bible de Jérusalem and aimed at literary English — J. R. R. Tolkien had a hand in Jonah. Revised as the New Jerusalem Bible (1985) and the Revised New Jerusalem (2019).",
  },
  {
    id: "nab", short: "NAB", name: "The New American Bible",
    years: "1970", yr: 1970, col: 6, stream: "critical", phil: "mediating",
    parents: [["critical", "src"]],
    wiki: "New_American_Bible",
    blurb: "The American Catholic translation (1970), heir of the Douay line by way of the Confraternity version, and the text proclaimed at Mass in US parishes ever since. Revised piecemeal — New Testament 1986, then the NABRE of 2011 — with a further revision in progress.",
  },
  {
    id: "gnt", short: "Good News (GNT)", name: "The Good News Translation",
    alt: "Today’s English Version", years: "1976", yr: 1976, col: 5, stream: "critical", phil: "dynamic",
    parents: [["critical", "src"]],
    wiki: "Good_News_Bible",
    blurb: "Robert Bratcher’s Good News for Modern Man (1966) put dynamic equivalence — translate the thought, not the word order — into ordinary newspaper English, complete with Annie Vallotton’s line drawings. The full Good News Translation followed in 1976 and became the second-language and mission-field classic.",
  },
  {
    id: "niv", short: "NIV", name: "The New International Version",
    years: "1978", yr: 1978, col: 6, stream: "critical", phil: "mediating",
    parents: [["critical", "src"]],
    wiki: "New_International_Version",
    blurb: "A hundred-plus evangelical scholars aimed squarely between word-for-word and thought-for-thought: New Testament 1973, full Bible 1978, revisions in 1984 and 2011. By the mid-1980s it had done what no version had managed in three and a half centuries — outsold the King James.",
  },
  {
    id: "msg", short: "The Message", name: "The Message",
    years: "1993–2002", yr: 2002, col: 5, stream: "critical", phil: "paraphrase",
    parents: [["critical", "src"]],
    wiki: "The_Message_(Bible)",
    blurb: "Eugene Peterson, working from the Greek and Hebrew at his desk from 1993 to 2002, re-voiced Scripture in American vernacular for readers gone numb to church English. Its own introduction insists it is a reading Bible, not a study one — a paraphrase in the Living Bible’s spirit, though made from the original languages.",
  },
  {
    id: "hcsb", short: "HCSB", name: "The Holman Christian Standard Bible",
    years: "2004", yr: 2004, col: 6, stream: "critical", phil: "mediating",
    parents: [["critical", "src"]],
    wiki: "Holman_Christian_Standard_Bible",
    blurb: "Southern Baptist–sponsored and freshly translated (New Testament 1999, whole Bible 2004), it pursued “optimal equivalence” — formal where possible, dynamic where necessary — and dared to print “Yahweh” and “Messiah” in the text itself.",
  },
  {
    id: "csb", short: "CSB", name: "The Christian Standard Bible",
    years: "2017", yr: 2017, col: 6, stream: "critical", phil: "mediating",
    parents: [["hcsb", "rev"]],
    wiki: "Christian_Standard_Bible",
    blurb: "The 2017 rebalancing and renaming of the HCSB under co-chairs Tom Schreiner and David Allen: “Yahweh” returned to the traditional LORD, edges smoothed, scholarship refreshed. Now the default Bible of Southern Baptist churches and curriculum.",
  },
  {
    id: "net", short: "NET", name: "The NET Bible",
    years: "2005", yr: 2005, col: 5, stream: "critical", phil: "mediating",
    parents: [["critical", "src"]],
    wiki: "New_English_Translation",
    blurb: "Born on the early internet (1996–2005), the NET Bible was drafted online, revised in public beta, and given away free — with more than sixty thousand translators’ footnotes showing every decision as it was made. The notes, even more than the text, made it a study standard.",
  },
  {
    id: "bsb", short: "BSB", name: "The Berean Standard Bible",
    years: "2016–23", yr: 2016, col: 5, stream: "critical", phil: "mediating",
    parents: [["critical", "src"]],
    wiki: "Berean_Standard_Bible",
    blurb: "Bible Hub built the Berean Standard Bible outward from its interlinear — every English word anchored to the Greek and Hebrew underneath — and in 2023 dedicated the whole translation to the public domain. It is the text the other apps on this site read from.",
  },
];
