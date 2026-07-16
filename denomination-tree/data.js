/* The Denomination Tree — data.
   Nodes are churches, communions, and movements; edges are parent links:
   kind "rev" = separated from / descends directly (solid),
   kind "merge" = formed by union within that family (solid),
   kind "src" = shaped by it without formal descent (dashed).
   `yr` places a node on the time scale; `years` is the label people read.
   `col` is a column index into COLS (app.js).
   `adh` is a rough 2020s estimate of adherents in millions — family nodes
   carry family totals, movements overlap, and historic umbrella nodes
   (the early church, the Anabaptists, the charismatic renewal) carry
   none. Drawn as a √-scaled bar under each node. */

const STREAMS = {
  root:        { label: "the undivided church",             color: "#5c5240" },
  east:        { label: "the Eastern churches",             color: "#6b4f9e" },
  catholic:    { label: "the Catholic communion",           color: "#a97d1c" },
  lutheran:    { label: "the Lutheran branch",              color: "#8b2a1d" },
  reformed:    { label: "the Reformed branch",              color: "#2f4b7c" },
  anglican:    { label: "the Anglican branch",              color: "#5f7134" },
  baptist:     { label: "the believers'-baptism line",      color: "#0e7a83" },
  methodist:   { label: "the Methodist–Holiness line",      color: "#b3541e" },
  pentecostal: { label: "the Pentecostal–Charismatic line", color: "#9c2760" },
};

const PHIL = {
  source: "the common root",
  communion: "communion of patriarchates",
  episcopal: "episcopal polity",
  presbyterian: "presbyterian polity",
  congregational: "congregational polity",
  connexional: "connexional polity",
  movement: "movement · network",
};

const ERAS = [
  { from: 33, to: 1054, name: "The one church",
    sub: "five patriarchates, seven councils — one increasingly strained communion" },
  { from: 1054, to: 1517, name: "East and West",
    sub: "Rome and the eastern patriarchates excommunicate each other; dissenters go underground" },
  { from: 1517, to: 1650, name: "The Reformation",
    sub: "one century, four Protestant streams" },
  { from: 1650, to: 1790, name: "Dissent & awakening",
    sub: "state churches fray; Quakers, Pietists, and the people called Methodists" },
  { from: 1790, to: 1900, name: "The American explosion",
    sub: "frontier revivals, Black churches, restorations — and a slavery split" },
  { from: 1900, to: 2026, name: "Pentecost again",
    sub: "Azusa Street, the charismatic renewal, the mergers — and the non-denominational tide" },
];

const NODES = [
  /* ---------- the common root ---------- */
  {
    id: "early", short: "The early church", name: "The Church of the First Centuries",
    years: "AD 33 →", yr: 60, col: 3, stream: "root", phil: "source",
    parents: [],
    wiki: "Early_Christianity",
    blurb: "From Pentecost to the seven ecumenical councils, one church spread from Jerusalem across three continents — organized around the great sees of Rome, Constantinople, Alexandria, Antioch, and Jerusalem. Every branch on this chart claims this trunk; the councils that defined the Trinity and the natures of Christ (Nicaea 325, Chalcedon 451) are the shared inheritance almost everything below still confesses.",
  },

  /* ---------- the Eastern churches ---------- */
  {
    id: "coeast", adh: 0.4, short: "Church of the East", name: "The Church of the East",
    years: "431", yr: 431, col: 0, stream: "east", phil: "communion",
    parents: [["early", "rev"]], edgeLabel: "Ephesus, 431",
    wiki: "Church_of_the_East",
    blurb: "The church of the Persian Empire went its own way after the Council of Ephesus condemned Nestorius, whose teaching it refused to anathematize. Cut off politically as much as theologically, it carried the gospel down the Silk Road to India and Tang-dynasty China. Its heir today is the Assyrian Church of the East.",
  },
  {
    id: "oriental", adh: 60, short: "Oriental Orthodox", name: "The Oriental Orthodox Churches",
    years: "451", yr: 451, col: 0, stream: "east", phil: "communion",
    parents: [["early", "rev"]], edgeLabel: "Chalcedon, 451",
    wiki: "Oriental_Orthodoxy",
    blurb: "The Coptic, Armenian, Ethiopian, and Syriac churches rejected the Council of Chalcedon's two-natures formula — confessing instead one united divine-human nature in Christ. Armenia had been the first Christian kingdom on earth (301). Fifteen centuries later, joint statements with Rome and Constantinople suggest the split was as much about words as substance.",
  },
  {
    id: "orthodox", adh: 220, short: "Eastern Orthodox", name: "The Eastern Orthodox Church",
    years: "1054", yr: 1054, col: 0, stream: "east", phil: "communion",
    parents: [["early", "rev"]], edgeLabel: "the Great Schism",
    wiki: "Eastern_Orthodox_Church",
    blurb: "Centuries of drift between Greek East and Latin West — over papal authority, the filioque clause added to the creed, even leavened versus unleavened bread — hardened into mutual excommunications in 1054. The second-largest Christian communion, self-governing national churches united by conciliar authority rather than a pope. The anathemas of 1054 were finally lifted in 1965.",
  },

  /* ---------- the Catholic communion & medieval dissent ---------- */
  {
    id: "catholic", adh: 1400, short: "Roman Catholic", name: "The Roman Catholic Church",
    years: "1054", yr: 1054, col: 1, stream: "catholic", phil: "episcopal",
    parents: [["early", "rev"]],
    wiki: "Catholic_Church",
    blurb: "The Latin West under the bishop of Rome — after 1054, a communion defined by papal primacy as much as by its creeds. The largest Christian body by far, it answered the Reformation with its own at Trent (1545–63), and redefined its posture toward the modern world at the Second Vatican Council (1962–65). Every Protestant branch on this chart is, historically, a departure from this one.",
  },
  {
    id: "waldensian", adh: 0.03, short: "Waldensians", name: "The Waldensians",
    years: "1173", yr: 1173, col: 1, stream: "root", phil: "movement",
    parents: [["catholic", "rev"]],
    wiki: "Waldensians",
    blurb: "Peter Waldo of Lyon gave away his wealth and sent out lay preachers with vernacular Scripture — and was excommunicated for preaching without permission. Hunted for three centuries, the movement survived in Alpine valleys, and at the synod of Chanforan (1532) folded itself into the Reformed family it had anticipated by 350 years.",
  },
  {
    id: "unitas", short: "Unitas Fratrum", name: "The Unity of the Brethren",
    years: "1457", yr: 1457, col: 1, stream: "root", phil: "movement",
    parents: [["catholic", "rev"]],
    wiki: "Moravian_Church",
    blurb: "Followers of the Czech reformer Jan Hus — burned at Constance in 1415 despite a safe-conduct — organized their own fellowship at Kunvald in 1457, sixty years before Luther's theses. Nearly annihilated after 1620, a remnant carried the seed to Saxony, where it would be renewed as the Moravian Church.",
  },

  /* ---------- the Reformation ---------- */
  {
    id: "lutheran", adh: 70, short: "Lutheran", name: "The Lutheran Churches",
    years: "1517 · 1530", yr: 1517, col: 2, stream: "lutheran", phil: "episcopal",
    parents: [["catholic", "rev"]],
    wiki: "Lutheranism",
    blurb: "Luther's ninety-five theses (1517) sought a debate and started a continental rupture; the Augsburg Confession (1530) made it a church. Justification by faith alone, Scripture as final authority, and a high view of the sacraments retained — the state churches of Germany and Scandinavia, and some 70 million Lutherans today.",
  },
  {
    id: "reformed", adh: 30, short: "Reformed", name: "The Reformed Churches",
    years: "1519 · 1536", yr: 1519, col: 4, stream: "reformed", phil: "presbyterian",
    parents: [["catholic", "rev"], ["waldensian", "src"]],
    wiki: "Reformed_Christianity",
    blurb: "The Reformation's second front: Zwingli preaching through Matthew in Zurich (1519), then Calvin's Institutes and Geneva (1536) giving the movement its theology and its discipline. Sovereign grace, covenant, and church courts of elders — the stream behind the Presbyterians, the Puritans, the Dutch Reformed, and half of evangelical theology since.",
  },
  {
    id: "anglican", adh: 85, short: "Church of England", name: "The Church of England",
    years: "1534", yr: 1534, col: 3, stream: "anglican", phil: "episcopal",
    parents: [["catholic", "rev"]],
    wiki: "Church_of_England",
    blurb: "Henry VIII's Act of Supremacy (1534) began it as a jurisdictional break; Cranmer's Book of Common Prayer and the Thirty-Nine Articles made it a reformed catholic church — Protestant doctrine in episcopal vestments. The Elizabethan Settlement (1559) fixed its famous middle way, and its restless Puritan wing seeded half the branches to the right of this chart.",
  },
  {
    id: "anabaptist", short: "Anabaptists", name: "The Anabaptists",
    years: "1525", yr: 1525, col: 5, stream: "baptist", phil: "congregational",
    parents: [["reformed", "rev"]],
    wiki: "Anabaptism",
    blurb: "In Zurich in 1525, Zwingli's own students concluded that Scripture knows only believers' baptism — and baptized each other as adults, a capital crime. Felix Manz was drowned in the Limmat within two years. The Schleitheim Confession (1527) set the pattern: a free church of the committed, separate from the state, refusing the sword.",
  },
  {
    id: "mennonite", adh: 2.1, short: "Mennonites", name: "The Mennonites",
    years: "1536", yr: 1540, col: 5, stream: "baptist", phil: "congregational",
    parents: [["anabaptist", "rev"]],
    wiki: "Mennonites",
    blurb: "Menno Simons, a Dutch priest converted in 1536, gathered the scattered, hunted Anabaptists into disciplined peaceable communities — so thoroughly that they came to bear his name. Migrating from the Netherlands to Prussia, Russia, and the Americas, they carried the believers'-church and peace-witness tradition into the present.",
  },
  {
    id: "presbyterian", adh: 40, short: "Presbyterian", name: "The Presbyterian Churches",
    years: "1560", yr: 1560, col: 4, stream: "reformed", phil: "presbyterian",
    parents: [["reformed", "rev"]],
    wiki: "Presbyterianism",
    blurb: "John Knox, home from Calvin's Geneva, led Scotland's parliament to a Reformed confession in 1560 — a national church governed not by bishops but by courts of elders. The Westminster Confession (1646) became its doctrinal standard and, through Scots and Scots-Irish migration, the charter of Presbyterianism across America and the world.",
  },
  {
    id: "congregational", adh: 5, short: "Congregationalists", name: "The Congregationalists",
    years: "1592 · 1620", yr: 1607, col: 4, stream: "reformed", phil: "congregational",
    parents: [["anglican", "rev"], ["reformed", "src"]],
    wiki: "Congregationalism",
    blurb: "Puritans who despaired of purifying the Church of England from within and separated — each congregation complete in itself, under Christ alone. Persecution drove them to Holland and then Plymouth (1620); the Massachusetts Bay colony and Harvard were their projects, and the Cambridge Platform (1648) their charter.",
  },
  {
    id: "baptists", adh: 170, short: "Baptists", name: "The Baptists",
    years: "1609 · 1638", yr: 1609, col: 5, stream: "baptist", phil: "congregational",
    parents: [["congregational", "rev"], ["anabaptist", "src"]],
    wiki: "Baptists",
    blurb: "English Separatists in Amsterdam — John Smyth and Thomas Helwys — concluded in 1609 that a gathered church must baptize believers only; Particular (Calvinistic) Baptists in London reached the same conviction by 1638 and confessed it in 1644 and 1689. Congregational freedom, believer's immersion, and liberty of conscience: the largest Protestant family in America grew from this.",
  },
  {
    id: "quakers", adh: 0.4, short: "Quakers", name: "The Religious Society of Friends",
    years: "1652", yr: 1652, col: 4, stream: "reformed", phil: "movement",
    parents: [["congregational", "rev"]],
    wiki: "Quakers",
    blurb: "George Fox's preaching gathered England's radical seekers into the Society of Friends: Christ's inner light available to every soul, worship in expectant silence, no clergy, no oaths, no war. Persecuted ferociously, they answered with William Penn's holy experiment in Pennsylvania and, later, the first organized abolitionism.",
  },
  {
    id: "amish", adh: 0.4, short: "Amish", name: "The Amish",
    years: "1693", yr: 1693, col: 5, stream: "baptist", phil: "congregational",
    parents: [["mennonite", "rev"]],
    wiki: "Amish",
    blurb: "Jakob Ammann judged the Swiss Mennonites lax about shunning and separation, and led a division in 1693. His people carried strict discipline, plain dress, and community-before-modernity to Pennsylvania — where the Old Order still lives visibly apart, the most recognizable heirs of the radical Reformation.",
  },

  /* ---------- dissent & awakening ---------- */
  {
    id: "moravian", adh: 1, short: "Moravians", name: "The Moravian Church",
    years: "1727", yr: 1722, col: 6, stream: "methodist", phil: "connexional",
    parents: [["unitas", "rev"]],
    wiki: "Moravian_Church",
    blurb: "Refugees of the old Unity of the Brethren, sheltered on Count Zinzendorf's Saxon estate, were renewed in a 1727 communion service into the Moravian Church — and became Protestantism's first great missionary people, selling themselves into reach of slaves and sailing for Greenland. A Moravian's question to a frightened John Wesley in an Atlantic storm changed the chart below.",
  },
  {
    id: "methodist", adh: 60, short: "Methodist", name: "The Methodist Churches",
    years: "1738 · 1784", yr: 1744, col: 6, stream: "methodist", phil: "connexional",
    parents: [["anglican", "rev"], ["moravian", "src"]],
    wiki: "Methodism",
    blurb: "John Wesley's heart 'strangely warmed' at Aldersgate (1738) launched a half-century of field preaching, class meetings, and circuit riders inside the Church of England — organized as a separate church for America at the 1784 Christmas Conference. Holiness of heart and life, hymns by brother Charles, and a connexional system built to chase a moving frontier.",
  },
  {
    id: "episcopal", adh: 1.5, short: "Episcopal Church", name: "The Episcopal Church",
    years: "1789", yr: 1789, col: 3, stream: "anglican", phil: "episcopal",
    parents: [["anglican", "rev"]],
    wiki: "Episcopal_Church_(United_States)",
    blurb: "Anglicanism reorganized for a republic that had just fought the king at its head: American churchmen secured bishops (Seabury, consecrated by Scottish nonjurors in 1784) and constituted a self-governing church in 1789. The mother church's American province — and, two centuries on, the communion's stormiest member.",
  },

  /* ---------- the American explosion ---------- */
  {
    id: "ame", adh: 2.5, short: "AME Church", name: "The African Methodist Episcopal Church",
    years: "1816", yr: 1816, col: 6, stream: "methodist", phil: "connexional",
    parents: [["methodist", "rev"]],
    wiki: "African_Methodist_Episcopal_Church",
    blurb: "Richard Allen and Black Methodists walked out of Philadelphia's St. George's church after being pulled from their knees at prayer, and in 1816 organized the first fully independent Black denomination in America. Wesleyan in doctrine, episcopal in order — and from the start a church of abolition, education, and Black institutional life.",
  },
  {
    id: "stonecampbell", adh: 5, short: "Churches of Christ", name: "The Restoration Movement (Stone–Campbell)",
    years: "1832", yr: 1832, col: 5, stream: "baptist", phil: "congregational",
    parents: [["presbyterian", "rev"], ["baptists", "src"]],
    wiki: "Restoration_Movement",
    blurb: "Two frontier movements — Barton Stone's, born of the Cane Ridge revival, and the Campbells' — merged in 1832 around a radical idea: no creed but Christ, no name but Christian, restore the New Testament church and Christian division ends. The irony is on the chart: the movement against denominations became three (Churches of Christ, Christian Churches, Disciples).",
  },
  {
    id: "sbc", adh: 13, short: "Southern Baptist", name: "The Southern Baptist Convention",
    years: "1845", yr: 1845, col: 5, stream: "baptist", phil: "congregational",
    parents: [["baptists", "rev"]],
    wiki: "Southern_Baptist_Convention",
    blurb: "Formed at Augusta, Georgia in 1845 when Baptists in the South, refused missionary appointments for slaveholders, organized their own convention — an origin it formally repented of in 1995. It grew into the largest Protestant denomination in the United States: some 45,000 autonomous congregations cooperating in the world's largest missionary enterprise.",
  },
  {
    id: "adventist", adh: 22, short: "Seventh-day Adventist", name: "The Seventh-day Adventist Church",
    years: "1863", yr: 1863, col: 5, stream: "baptist", phil: "presbyterian",
    parents: [["baptists", "rev"], ["methodist", "src"]],
    wiki: "Seventh-day_Adventist_Church",
    blurb: "When William Miller's calculated return of Christ passed in the Great Disappointment of 1844, a remnant led by Ellen White reinterpreted the date and organized in 1863 around the seventh-day Sabbath and the soon second advent. Health reform made them famous (and made corn flakes); mission made them global — over 20 million members, most far from America.",
  },
  {
    id: "salvation", adh: 1.7, short: "Salvation Army", name: "The Salvation Army",
    years: "1865", yr: 1865, col: 6, stream: "methodist", phil: "connexional",
    parents: [["methodist", "rev"]],
    wiki: "The_Salvation_Army",
    blurb: "William and Catherine Booth took Methodist holiness preaching to East London's poorest streets in 1865 and, finding the churches wouldn't have their converts, built an army instead — uniforms, ranks, brass bands, and 'soup, soap, and salvation.' A church expressed almost entirely as mission to the destitute.",
  },
  {
    id: "nbc", adh: 7, short: "National Baptist", name: "The National Baptist Convention, USA",
    years: "1895", yr: 1895, col: 5, stream: "baptist", phil: "congregational",
    parents: [["baptists", "rev"]],
    wiki: "National_Baptist_Convention,_USA,_Inc.",
    blurb: "Black Baptist associations, multiplying explosively after Emancipation, united at Atlanta in 1895 into the National Baptist Convention — soon the largest Black religious organization on earth and the institutional backbone of Black community life. Martin Luther King Jr. was one of its preachers.",
  },

  /* ---------- Pentecost again ---------- */
  {
    id: "azusa", adh: 600, short: "Pentecostalism", name: "The Pentecostal Movement",
    years: "1901 · 1906", yr: 1906, col: 7, stream: "pentecostal", phil: "movement",
    parents: [["methodist", "rev"]],
    wiki: "Azusa_Street_Revival",
    blurb: "Holiness people praying for the apostles' power received tongues at Topeka (1901); under the one-eyed Black preacher William Seymour at Azusa Street, Los Angeles (1906), the fire caught. Interracial at the altar in Jim Crow America, dismissed by the papers, it became the twentieth century's fastest-growing Christian movement — perhaps 600 million heirs.",
  },
  {
    id: "cogic", adh: 6.5, short: "COGIC", name: "The Church of God in Christ",
    years: "1907", yr: 1907, col: 7, stream: "pentecostal", phil: "episcopal",
    parents: [["azusa", "rev"]],
    wiki: "Church_of_God_in_Christ",
    blurb: "Charles Harrison Mason, a holiness preacher who received Spirit baptism at Azusa Street, reorganized his church in 1907 as a Pentecostal body. For its first seven years it ordained hundreds of white ministers, too — until they departed to form the Assemblies. Today COGIC is the largest Pentecostal denomination in the United States.",
  },
  {
    id: "nazarene", adh: 2.6, short: "Nazarene", name: "The Church of the Nazarene",
    years: "1908", yr: 1908, col: 6, stream: "methodist", phil: "connexional",
    parents: [["methodist", "rev"]],
    wiki: "Church_of_the_Nazarene",
    blurb: "The holiness movement's scattered missions and associations merged at Pilot Point, Texas (1908) into one church devoted to Wesley's 'entire sanctification' — deliberately choosing the non-Pentecostal fork of the holiness road. It dropped 'Pentecostal' from its own name in 1919 to avoid confusion with the tongues movement next door.",
  },
  {
    id: "aog", adh: 85, short: "Assemblies of God", name: "The Assemblies of God",
    years: "1914", yr: 1914, col: 7, stream: "pentecostal", phil: "presbyterian",
    parents: [["azusa", "rev"]],
    wiki: "Assemblies_of_God",
    blurb: "Some 300 mostly white ministers, many credentialed by Mason's COGIC, organized at Hot Springs, Arkansas in 1914 to pool missions and credentialing. It became the largest Pentecostal fellowship in the world — roughly 85 million adherents across its national councils, from Springfield, Missouri to São Paulo and Seoul.",
  },
  {
    id: "foursquare", adh: 8.8, short: "Foursquare", name: "The Foursquare Church",
    years: "1923", yr: 1923, col: 7, stream: "pentecostal", phil: "episcopal",
    parents: [["azusa", "rev"]],
    wiki: "Foursquare_Church",
    blurb: "Aimee Semple McPherson — radio evangelist, Angelus Temple impresario, the most famous woman in 1920s America — organized her converts around the 'foursquare gospel': Jesus as Savior, Baptizer, Healer, and Coming King. Sister Aimee's church now counts most of its nearly 9 million members outside the United States.",
  },
  {
    id: "lcms", adh: 1.8, short: "LCMS", name: "The Lutheran Church—Missouri Synod",
    years: "1847", yr: 1847, col: 2, stream: "lutheran", phil: "congregational",
    parents: [["lutheran", "rev"]],
    wiki: "Lutheran_Church–Missouri_Synod",
    blurb: "Saxon immigrants who left rather than accept Prussia's forced union of Lutheran and Reformed churches organized in 1847 under C. F. W. Walther — confessional, liturgical, and unbending on the Book of Concord. America's second-largest Lutheran body, and its most theologically conservative major one.",
  },
  {
    id: "charismatic", short: "Charismatic renewal", name: "The Charismatic Renewal",
    years: "1960", yr: 1960, col: 7, stream: "pentecostal", phil: "movement",
    parents: [["azusa", "src"]],
    wiki: "Charismatic_movement",
    blurb: "When Episcopal rector Dennis Bennett told his Van Nuys parish he had spoken in tongues (1960), Pentecost jumped the denominational fence — into mainline Protestantism, and after 1967 into Roman Catholicism. Not a new denomination but a current through nearly all of them: the reason 'Spirit-filled' no longer maps onto any single branch of this chart.",
  },
  {
    id: "calvary", adh: 1, short: "Calvary Chapel", name: "Calvary Chapel",
    years: "1965", yr: 1965, col: 7, stream: "pentecostal", phil: "movement",
    parents: [["foursquare", "rev"], ["charismatic", "src"]],
    wiki: "Calvary_Chapel",
    blurb: "Chuck Smith, a former Foursquare pastor with a small Costa Mesa congregation, welcomed the barefoot hippies of the Jesus Movement — baptizing thousands in the Pacific — and taught verse-by-verse through the whole Bible. Casual dress, contemporary music, chapter-and-verse exposition: the template for a generation of California-style evangelicalism.",
  },
  {
    id: "vineyard", adh: 0.6, short: "Vineyard", name: "The Vineyard Movement",
    years: "1982", yr: 1982, col: 7, stream: "pentecostal", phil: "movement",
    parents: [["calvary", "rev"]],
    wiki: "Association_of_Vineyard_Churches",
    blurb: "John Wimber's 'signs and wonders' congregation outgrew Calvary Chapel's comfort with the gifts and became the Vineyard (1982) — kingdom theology, healing prayer as ordinary church practice, and a songbook of intimate worship choruses that reshaped how half of evangelicalism sings.",
  },
  {
    id: "ucc", adh: 0.7, short: "UCC", name: "The United Church of Christ",
    years: "1957", yr: 1957, col: 4, stream: "reformed", phil: "congregational",
    parents: [["congregational", "merge"]],
    wiki: "United_Church_of_Christ",
    blurb: "The Congregationalists' heirs joined the Evangelical and Reformed Church in 1957 — Pilgrim New England united with German Reformed Pennsylvania. The most consistently progressive of the mainline churches, ordaining the first openly gay minister in 1972, in the direct line of Plymouth Rock.",
  },
  {
    id: "umc", adh: 10, short: "United Methodist", name: "The United Methodist Church",
    years: "1968", yr: 1968, col: 6, stream: "methodist", phil: "connexional",
    parents: [["methodist", "merge"]],
    wiki: "United_Methodist_Church",
    blurb: "The Methodist Church merged with the Evangelical United Brethren in 1968 to form America's flagship mainline denomination. A half-century later the long argument over sexuality broke it: roughly a quarter of its US congregations departed between 2019 and 2023, most into the new Global Methodist Church.",
  },
  {
    id: "pca", adh: 0.4, short: "PCA", name: "The Presbyterian Church in America",
    years: "1973", yr: 1973, col: 4, stream: "reformed", phil: "presbyterian",
    parents: [["presbyterian", "rev"]],
    wiki: "Presbyterian_Church_in_America",
    blurb: "Conservative Southern Presbyterian congregations, alarmed by their denomination's drift, formed the PCA in 1973 — 'faithful to the Scriptures, true to the Reformed faith, obedient to the Great Commission.' Westminster orthodoxy plus church-planting energy; Tim Keller's Redeemer in Manhattan became its most famous pulpit.",
  },
  {
    id: "pcusa", adh: 1.1, short: "PC(USA)", name: "The Presbyterian Church (U.S.A.)",
    years: "1983", yr: 1983, col: 4, stream: "reformed", phil: "presbyterian",
    parents: [["presbyterian", "merge"]],
    wiki: "Presbyterian_Church_(USA)",
    blurb: "The northern and southern Presbyterian churches, divided since the Civil War, reunited in 1983 as the PC(USA) — the Presbyterian mainline. Like its Methodist and Episcopal siblings it has spent the decades since navigating decline and departures, with successive waves of congregations leaving for newer, more conservative Presbyterian bodies.",
  },
  {
    id: "elca", adh: 2.8, short: "ELCA", name: "The Evangelical Lutheran Church in America",
    years: "1988", yr: 1988, col: 2, stream: "lutheran", phil: "episcopal",
    parents: [["lutheran", "merge"]],
    wiki: "Evangelical_Lutheran_Church_in_America",
    blurb: "Three Lutheran bodies — themselves the products of a century of mergers among German and Scandinavian immigrant synods — united in 1988 into the ELCA, the largest Lutheran church in America and the Missouri Synod's mainline counterpart, in full communion with Episcopalians, Presbyterians, and Methodists alike.",
  },
  {
    id: "acna", adh: 0.13, short: "ACNA", name: "The Anglican Church in North America",
    years: "2009", yr: 2009, col: 3, stream: "anglican", phil: "episcopal",
    parents: [["episcopal", "rev"]],
    wiki: "Anglican_Church_in_North_America",
    blurb: "Congregations and whole dioceses that left the Episcopal Church over Scripture and sexuality organized in 2009 as the ACNA, recognized by the large Anglican provinces of Africa and Asia rather than by Canterbury — one visible piece of the global realignment running through the whole Anglican Communion.",
  },
  {
    id: "gmc", adh: 0.5, short: "Global Methodist", name: "The Global Methodist Church",
    years: "2022", yr: 2022, col: 6, stream: "methodist", phil: "connexional",
    parents: [["umc", "rev"]],
    wiki: "Global_Methodist_Church",
    blurb: "The traditionalist exodus from United Methodism gathered into the Global Methodist Church in 2022 — thousands of congregations holding Wesley's doctrine and discipline on the disputed questions. The newest denomination on this chart, and proof that the tree is still branching.",
  },
  {
    id: "nondenom", adh: 40, short: "Non-denominational", name: "The Non-Denominational Churches",
    years: "1970s →", yr: 1998, col: 7, stream: "pentecostal", phil: "movement",
    parents: [["charismatic", "src"], ["baptists", "src"]],
    wiki: "Nondenominational_Christianity",
    blurb: "Independent Bible and community churches — baptistic in practice, often charismatic-lite in worship, networked rather than governed — have grown from the Jesus Movement's margins into, collectively, one of the largest 'denominations' in America. The tree's newest habit is pretending not to be a branch; its roots are visible on this chart anyway.",
  },
];
