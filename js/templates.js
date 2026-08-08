/* Question templates — calibrated to the book
   "Oefenen met leessommen (redactiesommen) voor groep 5" (Sietse Kuipers).
   Number ranges, phrasings and distractor style mirror the book:
   short 2-3 sentence stories, tight neighbouring distractors (±1, ±10, one
   operation-confusion), and the recurring CITO/DIA archetypes.

   Each template:
   - id, cat  (cat ∈ optellen | aftrekken | vermenigvuldigen | delen | tweestap | verrassing)
   - variants: phrasings in nl/en/tr with {tokens}
   - objects / objects2: optional rotating context nouns (3-lang)
   - gen(level, variantIdx): returns { vars, answer, wrongs, unit? }
                             or { vars, textCorrect, textWrongs } for text options
   Tokens: {name} {name2} {a} {b} {c} {d} {obj} {obj2} {Hij}/{hij} (nl/en) — TR uses O/o.
*/

const NAMES = [
  { n: "Maaike", g: "f" }, { n: "Romy", g: "f" }, { n: "Ebru", g: "f" }, { n: "Ilse", g: "f" },
  { n: "Elsa", g: "f" }, { n: "Hinke", g: "f" }, { n: "Gerda", g: "f" }, { n: "Jade", g: "f" },
  { n: "Anita", g: "f" }, { n: "Amalia", g: "f" }, { n: "Babette", g: "f" }, { n: "Sylvia", g: "f" },
  { n: "Linda", g: "f" }, { n: "Vera", g: "f" }, { n: "Irina", g: "f" }, { n: "Lieke", g: "f" },
  { n: "Irma", g: "f" }, { n: "Estelle", g: "f" }, { n: "Soraya", g: "f" }, { n: "Jane", g: "f" },
  { n: "Elin", g: "f" }, { n: "Jannie", g: "f" }, { n: "Lea", g: "f" }, { n: "Lena", g: "f" },
  { n: "Anouk", g: "f" }, { n: "Iris", g: "f" }, { n: "Mira", g: "f" }, { n: "Anne", g: "f" },
  { n: "Sara", g: "f" }, { n: "Roos", g: "f" }, { n: "Emma", g: "f" }, { n: "Julia", g: "f" },
  { n: "Britney", g: "f" }, { n: "Lindsey", g: "f" }, { n: "Annemiek", g: "f" }, { n: "Monique", g: "f" },
  { n: "Liam", g: "m" }, { n: "Berry", g: "m" }, { n: "Adam", g: "m" }, { n: "Kees", g: "m" },
  { n: "Olav", g: "m" }, { n: "Simon", g: "m" }, { n: "Gerard", g: "m" }, { n: "Angelo", g: "m" },
  { n: "Boaz", g: "m" }, { n: "Matthijs", g: "m" }, { n: "Eli", g: "m" }, { n: "Max", g: "m" },
  { n: "Samuel", g: "m" }, { n: "Steef", g: "m" }, { n: "Huub", g: "m" }, { n: "Jan", g: "m" },
  { n: "Job", g: "m" }, { n: "Terry", g: "m" }, { n: "Dylano", g: "m" }, { n: "Toby", g: "m" },
  { n: "Tijs", g: "m" }, { n: "Leco", g: "m" }, { n: "Jordi", g: "m" }, { n: "Robin", g: "m" },
  { n: "Ruben", g: "m" }, { n: "Peter", g: "m" }, { n: "Nick", g: "m" }, { n: "Sven", g: "m" },
  { n: "Mick", g: "m" }, { n: "Klaas", g: "m" }, { n: "Rico", g: "m" }, { n: "Kevin", g: "m" },
  { n: "Jelte", g: "m" }, { n: "Joey", g: "m" }, { n: "Melle", g: "m" }, { n: "Sem", g: "m" },
  { n: "Finn", g: "m" }, { n: "Noah", g: "m" }, { n: "Daan", g: "m" }, { n: "Milan", g: "m" }
];

const ri = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pickArr = arr => arr[ri(0, arr.length - 1)];

/* Difficulty is deliberately set a notch ABOVE CITO/DIA M5/E5 level, so the
   real test feels easier than the practice. lvRange grows the range with the
   hidden adaptive level: level 1 = base range, level 5 = range * grow.

   The scale also runs BELOW 1, down to -1. Those are the comfort bands: after
   a wrong answer the sommen of that soort quietly get smaller numbers, even
   for a child already playing at niveau 1. The formula keeps shrinking below
   L=1, floored so no template ever sees numbers too small to make sense. */
function lvRange(level, lo, hi, grow) {
  const L = Math.max(-1, Math.min(5, level == null ? 1 : level));
  const f = L < 1 ? (L === 0 ? 0.6 : 0.45)               // comfort bands
                  : 1 + (grow - 1) * (L - 1) / 4;
  const a = Math.max(1, Math.round(lo * f));
  const b = Math.max(a, Math.round(hi * f));
  return ri(a, b);
}
/* pick from a table list that widens with level (multiplication/division facts) */
function lvTable(level) {
  const L = Math.min(5, level == null ? 1 : level);
  if (L < 1) return pickArr([2, 3, 4, 5, 10]);   // comfort band: the easy tables
  const pools = [[3,4,5,10],[3,4,5,6,10],[4,6,7,8,10],[6,7,8,9,11],[6,7,8,9,11,12]];
  return pickArr(pools[L - 1]);
}

const OBJ = {
  knikkers:   { nl: "knikkers", en: "marbles", tr: "misket" },
  stickers:   { nl: "stickers", en: "stickers", tr: "çıkartma" },
  boeken:     { nl: "boeken", en: "books", tr: "kitap" },
  appels:     { nl: "appels", en: "apples", tr: "elma" },
  vogels:     { nl: "vogels", en: "birds", tr: "kuş" },
  bloembollen:{ nl: "bloembollen", en: "flower bulbs", tr: "çiçek soğanı" },
  postzegels: { nl: "postzegels", en: "stamps", tr: "pul" },
  koekjes:    { nl: "koekjes", en: "cookies", tr: "kurabiye" },
  kaarsen:    { nl: "kaarsen", en: "candles", tr: "mum" },
  gummen:     { nl: "gummen", en: "erasers", tr: "silgi" },
  rozen:      { nl: "rozen", en: "roses", tr: "gül" },
  balpennen:  { nl: "balpennen", en: "pens", tr: "tükenmez kalem" },
  snoepjes:   { nl: "snoepjes", en: "sweets", tr: "şeker" },
  schelpen:   { nl: "schelpen", en: "seashells", tr: "deniz kabuğu" }
};

// concrete shop items (for "buy" / "discount" stories)
const ITEM = {
  jas:         { nl: "jas", en: "coat", tr: "mont" },
  spelcomputer:{ nl: "spelcomputer", en: "game console", tr: "oyun konsolu" },
  fiets:       { nl: "fiets", en: "bike", tr: "bisiklet" },
  voetbal:     { nl: "voetbal", en: "football", tr: "futbol topu" },
  skateboard:  { nl: "skateboard", en: "skateboard", tr: "kaykay" },
  bouwpakket:  { nl: "bouwpakket", en: "building kit", tr: "yapım seti" },
  step:        { nl: "step", en: "scooter", tr: "scooter" }
};

// tight, book-style distractors around a numeric answer
function near(ans, extra) {
  return [ans + 10, ans - 10, ans + 1, ans - 1, ans + 2, ans - 2, ans + 20, ans - 20]
    .concat(extra || []);
}

const TEMPLATES = [

  /* ===================== OPTELLEN ===================== */
  {
    id: "opt-sparen-krijgt", cat: "optellen",
    variants: [
      { nl: "{name} heeft {a} euro gespaard voor de vakantie. {Hij} krijgt er {b} euro bij van oma. Hoeveel euro heeft {hij} nu?",
        en: "{name} saved {a} euros for the holiday. {He} gets {b} euros more from grandma. How many euros does {he} have now?",
        tr: "{name} tatil için {a} euro biriktirdi. Büyükanneden {b} euro daha aldı. Şimdi kaç euro var?" },
      { nl: "{name} heeft {a} euro verdiend. {Hij} krijgt er {b} euro bij van opa. Hoeveel euro heeft {hij} nu?",
        en: "{name} earned {a} euros. {He} gets {b} euros more from grandpa. How many euros now?",
        tr: "{name} {a} euro kazandı. Büyükbabadan {b} euro daha aldı. Şimdi kaç euro var?" }
    ],
    gen(level) { const a = lvRange(level, 120, 480, 1.7), b = pickArr([25, 35, 45, 50, 60, 75]); const ans = a + b;
      return { vars: { a, b }, answer: ans, wrongs: near(ans, [a - b]) }; }
  },
  {
    id: "opt-voorraad", cat: "optellen",
    objects: [OBJ.koekjes, OBJ.boeken, OBJ.appels],
    variants: [
      { nl: "{name} werkt in de supermarkt. Er zijn nog {a} pakken {obj}. Er worden {b} nieuwe gebracht. Hoeveel pakken {obj} zijn er nu?",
        en: "{name} works in the supermarket. There are {a} packs of {obj} left. {b} new ones are delivered. How many packs of {obj} now?",
        tr: "{name} süpermarkette çalışıyor. {a} paket {obj} kaldı. {b} yeni paket geldi. Şimdi kaç paket {obj} var?" }
    ],
    gen(level) { const a = lvRange(level, 41, 79, 1), b = lvRange(level, 88, 99, 1); const ans = a + b;
      return { vars: { a, b }, answer: ans, wrongs: near(ans) }; }
  },
  {
    id: "opt-twee-collecties", cat: "optellen",
    objects: [OBJ.postzegels, OBJ.knikkers, OBJ.stickers],
    variants: [
      { nl: "{name} telt de verzameling {obj}. {Hij} heeft {a} Nederlandse en {b} Belgische {obj}. Hoeveel {obj} heeft {hij}?",
        en: "{name} counts the {obj} collection. {He} has {a} Dutch and {b} Belgian {obj}. How many {obj} does {he} have?",
        tr: "{name} {obj} koleksiyonunu sayıyor. {a} Hollanda ve {b} Belçika {obj} var. Kaç {obj} var?" }
    ],
    gen(level) { const a = lvRange(level, 12, 28, 1.6) * 25, b = lvRange(level, 4, 16, 1.6) * 25;
      const ans = a + b;
      return { vars: { a, b }, answer: ans, wrongs: [ans + 100, ans - 100, ans + 200, Math.abs(a - b)] }; }
  },
  {
    id: "opt-dagdeel", cat: "optellen",
    variants: [
      { nl: "{name} heeft 's ochtends {a} liedjes beluisterd. 's Middags luistert {hij} er nog {b}. Hoeveel liedjes heeft {hij} beluisterd?",
        en: "{name} listened to {a} songs in the morning. In the afternoon {he} listens to {b} more. How many songs in total?",
        tr: "{name} sabah {a} şarkı dinledi. Öğleden sonra {b} tane daha dinledi. Toplam kaç şarkı dinledi?" },
      { nl: "Het nieuwe museum had de eerste week {a} bezoekers. In de tweede week kwamen er {b}. Hoeveel bezoekers zijn er geweest?",
        en: "The new museum had {a} visitors the first week. The second week {b} came. How many visitors in total?",
        tr: "Yeni müzede ilk hafta {a} ziyaretçi vardı. İkinci hafta {b} kişi geldi. Toplam kaç ziyaretçi oldu?" }
    ],
    gen(level, v) {
      if (v === 1) { const a = pickArr([1255, 1350, 1420]); const b = pickArr([2000, 1000, 1500]); const ans = a + b;
        return { vars: { a, b }, answer: ans, wrongs: [ans - 1000, ans + 1000, ans - 100, Math.abs(a - b)] }; }
      const a = ri(45, 75), b = ri(24, 39); const ans = a + b;
      return { vars: { a, b }, answer: ans, wrongs: near(ans) };
    }
  },
  {
    id: "opt-tellen-vooruit", cat: "optellen",
    variants: [
      { nl: "{name} begint te tellen bij {a}. {Hij} telt er vier keer {b} bij. Welk getal heeft {name} als {hij} klaar is met tellen?",
        en: "{name} starts counting at {a}. {He} counts on by {b}, four times. What number does {name} end on?",
        tr: "{name} {a}'dan saymaya başlıyor. Dört kez {b} ekliyor. {name} sayması bitince hangi sayıda olur?" }
    ],
    gen(level) { const b = pickArr([10, 100]);
      const start = b === 100 ? lvRange(level, 700, 1900, 1.5) : lvRange(level, 700, 4900, 1.2);
      const ans = start + 4 * b;
      return { vars: { a: start, b }, answer: ans, wrongs: [start + 3 * b, start + 5 * b, start + 6 * b, start + 2 * b] }; }
  },
  {
    id: "opt-club-erbij", cat: "optellen",
    variants: [
      { nl: "De hockeyclub van {name} heeft {a} leden. Er komen {b} nieuwe leden bij. Hoeveel leden heeft de club nu?",
        en: "{name}'s hockey club has {a} members. {b} new members join. How many members now?",
        tr: "{name_in} hokey kulübünde {a} üye var. {b} yeni üye katılıyor. Şimdi kaç üye var?" }
    ],
    gen(level) { const a = lvRange(level, 520, 545, 1), b = ri(2, 5); const ans = a + b;
      return { vars: { a, b }, answer: ans, wrongs: [ans + 1, ans - 1, ans + 2, ans - 2] }; }
  },

  /* ===================== AFTREKKEN ===================== */
  {
    id: "aft-vrijlaten", cat: "aftrekken",
    variants: [
      { nl: "{name} helpt in de vogelopvang. Er zitten {a} vogels. Er worden {b} vogels vrijgelaten. Hoeveel vogels zitten er dan nog?",
        en: "{name} helps at the bird shelter. There are {a} birds. {b} birds are released. How many birds are left?",
        tr: "{name} kuş barınağına yardım ediyor. {a} kuş var. {b} kuş serbest bırakılıyor. Kaç kuş kaldı?" }
    ],
    gen(level) { const a = lvRange(level, 55, 95, 2.2), b = ri(6, 19); const ans = a - b;
      return { vars: { a, b }, answer: ans, wrongs: near(ans, [a + b]) }; }
  },
  {
    id: "aft-korting-verschil", cat: "aftrekken",
    objects: [ITEM.jas, ITEM.spelcomputer, ITEM.fiets],
    variants: [
      { nl: "{name} ziet een {obj} van {a} euro. In de uitverkoop kost de {obj} nu maar {b} euro. Hoeveel euro goedkoper is de {obj} geworden?",
        en: "{name} sees a {obj} of {a} euros. In the sale the {obj} now costs only {b} euros. How many euros cheaper is the {obj}?",
        tr: "{name} {a} euroluk bir {obj} görüyor. İndirimde {obj} şimdi sadece {b} euro. {Obj} kaç euro ucuzladı?" }
    ],
    gen(level) { const a = lvRange(level, 210, 340, 1), b = lvRange(level, 90, 190, 1); const ans = a - b;
      return { vars: { a, b }, answer: ans, wrongs: near(ans, [a + b]) }; }
  },
  {
    id: "aft-nog-doen", cat: "aftrekken",
    variants: [
      { nl: "{name} moet {a} folders vouwen. {Hij} heeft er al {b} gedaan. Hoeveel folders moet {hij} nog vouwen?",
        en: "{name} has to fold {a} flyers. {He} has already done {b}. How many flyers are left to fold?",
        tr: "{name} {a} broşür katlamalı. {b} tanesini yaptı bile. Kaç broşür katlaması kaldı?" },
      { nl: "{name} moet {a} sommen maken. {Hij} heeft er al {b} af. Hoeveel sommen moet {hij} nog maken?",
        en: "{name} has to do {a} sums. {He} has already finished {b}. How many sums are left?",
        tr: "{name} {a} soru çözmeli. {b} tanesini bitirdi bile. Kaç soru kaldı?" }
    ],
    gen(level, v) {
      if (v === 0) { const a = lvRange(level, 420, 470, 1), b = pickArr([30, 40, 25]); const ans = a - b;
        return { vars: { a, b }, answer: ans, wrongs: [ans + 10, ans - 10, ans + 5, ans - 5] }; }
      const a = lvRange(level, 45, 58, 1), b = Math.min(lvRange(level, 38, 42, 1), a - 2); const ans = a - b;
      return { vars: { a, b }, answer: ans, wrongs: near(ans) };
    }
  },
  {
    id: "aft-verliezen", cat: "aftrekken",
    objects: [OBJ.knikkers, OBJ.stickers],
    variants: [
      { nl: "{name} begint met {a} {obj} aan het spel. {Hij} verliest er {b}. Hoeveel {obj} heeft {hij} over?",
        en: "{name} starts the game with {a} {obj}. {He} loses {b}. How many {obj} are left?",
        tr: "{name} oyuna {a} {obj} ile başlıyor. {b} tanesini kaybediyor. Kaç {obj} kaldı?" }
    ],
    gen(level) { const a = lvRange(level, 80, 99, 1), b = Math.min(lvRange(level, 38, 55, 1), a - 5); const ans = a - b;
      return { vars: { a, b }, answer: ans, wrongs: near(ans, [a + b]) }; }
  },
  {
    id: "aft-tellen-terug", cat: "aftrekken",
    variants: [
      { nl: "{name} begint terug te tellen bij {a}. {Hij} haalt er vier keer {b} af. Welk getal heeft {name} als {hij} klaar is met terugtellen?",
        en: "{name} starts counting back from {a}. {He} takes off {b}, four times. What number does {name} end on?",
        tr: "{name} {a}'dan geriye saymaya başlıyor. Dört kez {b} çıkarıyor. Sayması bitince hangi sayıda olur?" }
    ],
    gen(level) { const b = pickArr([1, 10]);
      const start = b === 10 ? lvRange(level, 3000, 5900, 1.2) : lvRange(level, 320, 890, 1.4);
      const ans = start - 4 * b;
      return { vars: { a: start, b }, answer: ans, wrongs: [start - 3 * b, start - 5 * b, start - 2 * b, start - 6 * b] }; }
  },
  {
    id: "aft-helft", cat: "aftrekken",
    variants: [
      { nl: "Er staan {a} lege flessen in de schuur. {name} neemt de helft mee naar de glasbak. Hoeveel lege flessen staan er nu nog in de schuur?",
        en: "There are {a} empty bottles in the shed. {name} takes half to the bottle bank. How many empty bottles are left?",
        tr: "Depoda {a} boş şişe var. {name} yarısını cam kutusuna götürüyor. Depoda kaç boş şişe kaldı?" }
    ],
    gen(level) { const half = lvRange(level, 9, 45, 1.6); const a = half * 2; const ans = half;
      return { vars: { a }, answer: ans, wrongs: [ans + 2, ans - 2, ans + 1, a] }; }
  },
  {
    id: "aft-restant-bellen", cat: "aftrekken",
    variants: [
      { nl: "{name} kan met het abonnement per maand {a} minuten bellen. {Hij} heeft al {b} minuten gebeld. Hoeveel minuten kan {hij} nog bellen?",
        en: "{name}'s plan allows {a} minutes of calling per month. {He} has already called {b} minutes. How many minutes are left?",
        tr: "{name_in} aboneliğinde ayda {a} dakika konuşma var. {b} dakika konuştu bile. Kaç dakika kaldı?" }
    ],
    gen(level) { const a = lvRange(level, 24, 40, 1.5) * 25, b = lvRange(level, 8, 20, 1.5) * 25;
      const ans = a - b;
      return { vars: { a, b }, answer: ans, wrongs: [ans + 100, ans - 100, ans + 200, a + b > 1000 ? ans + 300 : a + b] }; }
  },
  {
    id: "aft-voordat", cat: "aftrekken",
    variants: [
      { nl: "De club van {name} heeft na de rommelmarkt {a} euro in kas. De rommelmarkt heeft {b} euro opgebracht. Hoeveel euro was er in kas vóór de rommelmarkt?",
        en: "{name}'s club has {a} euros after the jumble sale. The sale raised {b} euros. How many euros were there before the sale?",
        tr: "{name_in} kulübünde bit pazarından sonra {a} euro var. Pazar {b} euro kazandırdı. Pazardan önce kasada kaç euro vardı?" }
    ],
    gen(level) { const a = lvRange(level, 28, 50, 1.3) * 100, b = lvRange(level, 8, 22, 1.3) * 100;
      const ans = a - b;
      return { vars: { a, b }, answer: ans, wrongs: [ans + 100, ans - 100, a + b, ans + 1000] }; }
  },

  /* ===================== VERMENIGVULDIGEN ===================== */
  {
    id: "verm-kisten", cat: "vermenigvuldigen",
    objects: [OBJ.appels, OBJ.snoepjes, OBJ.boeken],
    variants: [
      { nl: "{name} telt de {obj}. Er staan {a} kisten. In iedere kist zitten {b} {obj}. Hoeveel {obj} zijn er?",
        en: "{name} counts the {obj}. There are {a} crates. Each crate holds {b} {obj}. How many {obj} are there?",
        tr: "{name} {obj} sayıyor. {a} kasa var. Her kasada {b} {obj} var. Toplam kaç {obj} var?" }
    ],
    gen(level) { const a = ri(4, 9), b = lvRange(level, 20, 90, 1.7); const ans = a * b;
      return { vars: { a, b }, answer: ans, wrongs: [ans + 10, ans - 10, ans + b, ans - b] }; }
  },
  {
    id: "verm-dagen-afstand", cat: "vermenigvuldigen",
    variants: [
      { nl: "{name} is {a} dagen op fietsvakantie. {Hij} fietst iedere dag {b} kilometer. Hoeveel kilometer fietst {name}?",
        en: "{name} is on a {a}-day cycling holiday. {He} cycles {b} kilometres each day. How many kilometres does {name} cycle?",
        tr: "{name} {a} günlük bisiklet tatilinde. Her gün {b} kilometre gidiyor. {name} toplam kaç kilometre gider?" }
    ],
    gen(level) { const a = ri(4, 9), b = lvRange(level, 15, 80, 1.7); const ans = a * b;
      return { vars: { a, b }, answer: ans, wrongs: [ans + 20, ans - 20, ans + b, ans - b] }; }
  },
  {
    id: "verm-rijen", cat: "vermenigvuldigen",
    objects: [OBJ.vogels],
    variants: [
      { nl: "{name} telt de slaplantjes in de tuin. Er staan {a} rijen met {b} slaplantjes. Hoeveel slaplantjes staan er?",
        en: "{name} counts the lettuce plants in the garden. There are {a} rows of {b} plants. How many plants are there?",
        tr: "{name} bahçedeki marul fidelerini sayıyor. {b} fidelik {a} sıra var. Kaç fide var?" },
      { nl: "In de bioscoop zijn {a} rijen met {b} stoelen per rij. Hoeveel stoelen zijn er in totaal?",
        en: "The cinema has {a} rows with {b} seats each. How many seats in total?",
        tr: "Sinemada her sırada {b} koltuk olan {a} sıra var. Toplam kaç koltuk var?" }
    ],
    gen(level) { const a = lvTable(level), b = lvRange(level, 6, 30, 1.6); const ans = a * b;
      return { vars: { a, b }, answer: ans, wrongs: [ans + a, ans - a, ans + b, a + b] }; }
  },
  {
    id: "verm-hoofdstukken", cat: "vermenigvuldigen",
    variants: [
      { nl: "Het rekenboek van {name} heeft {a} hoofdstukken. In ieder hoofdstuk staan {b} sommen. Hoeveel sommen staan er in het boek?",
        en: "{name}'s maths book has {a} chapters. Each chapter has {b} sums. How many sums are in the book?",
        tr: "{name_in} matematik kitabında {a} bölüm var. Her bölümde {b} soru var. Kitapta kaç soru var?" }
    ],
    gen(level) { const a = lvRange(level, 20, 80, 1.6); const b = ri(6, 12); const ans = a * b;
      return { vars: { a, b }, answer: ans, wrongs: [ans + 10, ans - 10, ans + a, ans - a] }; }
  },
  {
    id: "verm-loten", cat: "vermenigvuldigen",
    variants: [
      { nl: "{name} verkoopt {a} loten voor de loterij. Een lot kost {b} euro. Hoeveel euro heeft {name} daarmee verdiend?",
        en: "{name} sells {a} lottery tickets. One ticket costs {b} euros. How many euros did {name} earn?",
        tr: "{name} piyango için {a} bilet satıyor. Bir bilet {b} euro. {name} kaç euro kazandı?" }
    ],
    gen(level) { const a = lvRange(level, 40, 95, 1.6); const b = ri(3, 8); const ans = a * b;
      return { vars: { a, b }, answer: ans, wrongs: [ans + 20, ans - 20, ans + a, ans - a] }; }
  },
  {
    id: "verm-cola-halve", cat: "vermenigvuldigen",
    variants: [
      { nl: "{name} verkoopt op de vrijmarkt {a} flesjes cola. Een flesje cola kost € 1,50. Hoeveel euro heeft {name} verdiend?",
        en: "{name} sells {a} bottles of cola at the market. One bottle costs € 1.50. How many euros did {name} earn?",
        tr: "{name} pazarda {a} şişe kola satıyor. Bir şişe kola € 1,50. {name} kaç euro kazandı?" }
    ],
    gen(level) { const a = lvRange(level, 8, 40, 1.6) * 2; const ans = a * 1.5;
      return { vars: { a }, answer: ans, wrongs: [ans + 1, ans - 1, ans + 2, a] }; }
  },

  /* ===================== DELEN ===================== */
  {
    id: "deel-eerlijk", cat: "delen",
    objects: [OBJ.koekjes, OBJ.knikkers, OBJ.snoepjes],
    variants: [
      { nl: "{name} heeft {a} {obj} voor de honden in het asiel. Er zitten {b} honden. Hoeveel {obj} krijgt iedere hond?",
        en: "{name} has {a} {obj} for the dogs at the shelter. There are {b} dogs. How many {obj} does each dog get?",
        tr: "{name_in} barınaktaki köpekler için {a} {obj} var. {b} köpek var. Her köpeğe kaç {obj} düşer?" }
    ],
    gen(level) { const b = lvTable(level); const q = lvRange(level, 4, 24, 1.5); const a = b * q;
      return { vars: { a, b }, answer: q, wrongs: [q + 1, q - 1, q + 2, b] }; }
  },
  {
    id: "deel-hoeveel-groepen", cat: "delen",
    variants: [
      { nl: "De schaatsclub van {name} gaat met {a} mensen naar het kampioenschap. Er worden busjes gehuurd waar {b} mensen in passen. Hoeveel busjes zijn er nodig?",
        en: "{name}'s skating club goes with {a} people to the championship. They rent vans that hold {b} people. How many vans are needed?",
        tr: "{name_in} paten kulübü şampiyonaya {a} kişiyle gidiyor. {b} kişilik minibüsler kiralanıyor. Kaç minibüs gerekir?" },
      { nl: "De familie van {name} gaat eten in een restaurant. Ze zijn met {a} personen. Er passen {b} mensen aan een tafel. Hoeveel tafels hebben ze nodig?",
        en: "{name}'s family goes to a restaurant. They are with {a} people. A table seats {b}. How many tables do they need?",
        tr: "{name_in} ailesi restorana gidiyor. {a} kişiler. Bir masaya {b} kişi sığıyor. Kaç masa gerekir?" }
    ],
    gen(level) { const b = pickArr([4, 5, 6, 8, 10, 20, 25]); const q = lvRange(level, 3, 30, 1.5); const a = b * q;
      return { vars: { a, b }, answer: q, wrongs: [q + 1, q - 1, q + 2, b] }; }
  },
  {
    id: "deel-per-stuk", cat: "delen",
    variants: [
      { nl: "De klas van {name} gaat naar het museum. De toegangskaartjes kosten samen {a} euro. Er zijn {b} kinderen. Hoeveel kosten de kaartjes per stuk?",
        en: "{name}'s class goes to the museum. The tickets cost {a} euros together. There are {b} children. How much is each ticket?",
        tr: "{name_in} sınıfı müzeye gidiyor. Biletler toplam {a} euro. {b} çocuk var. Bilet başına kaç euro?" }
    ],
    gen(level) { const b = ri(8, 32); const q = lvRange(level, 3, 12, 1.6); const a = b * q;
      return { vars: { a, b }, answer: q, wrongs: [q + 1, q - 1, q + 2, b] }; }
  },
  {
    id: "deel-boeken-dozen", cat: "delen",
    objects: [OBJ.boeken, OBJ.balpennen],
    variants: [
      { nl: "{name} gaat verhuizen en pakt {a} {obj} in. {Hij} heeft {b} dozen om de {obj} in te doen. Hoeveel {obj} doet {name} in iedere doos?",
        en: "{name} is moving and packs {a} {obj}. {He} has {b} boxes to put the {obj} in. How many {obj} go in each box?",
        tr: "{name} taşınıyor ve {a} {obj} paketliyor. {obj} için {b} kutusu var. Her kutuya kaç {obj} koyar?" }
    ],
    gen(level) { const b = pickArr([4, 5, 6, 8, 10]); const q = lvRange(level, 12, 45, 1.5); const a = b * q;
      return { vars: { a, b }, answer: q, wrongs: [q + 5, q - 5, q + 10, b] }; }
  },
  {
    id: "deel-vullen-vol", cat: "delen",
    objects: [OBJ.snoepjes, OBJ.knikkers],
    variants: [
      { nl: "{name} vult doosjes met {obj}. {Hij} heeft {a} {obj}. In een doosje passen {b} {obj}. Hoeveel doosjes kan {name} helemaal vullen?",
        en: "{name} fills boxes with {obj}. {He} has {a} {obj}. A box holds {b} {obj}. How many boxes can {name} fill completely?",
        tr: "{name} kutuları {obj} ile dolduruyor. {a} {obj} var. Bir kutuya {b} {obj} sığıyor. {name} kaç kutuyu tam doldurabilir?" }
    ],
    gen(level) { const b = pickArr([5, 6, 8, 10, 12, 15]); const q = lvRange(level, 4, 16, 1.5); const a = b * q + ri(1, b - 1);
      return { vars: { a, b }, answer: q, wrongs: [q + 1, q - 1, q + 2, b] }; }
  },
  {
    id: "deel-rest-over", cat: "delen",
    objects: [OBJ.snoepjes, OBJ.knikkers, OBJ.stickers],
    variants: [
      { nl: "{name} doet {obj} in zakjes. {Hij} heeft {a} {obj}. In ieder zakje gaan {b} {obj}. Hoeveel {obj} houdt {name} over?",
        en: "{name} puts {obj} into bags. {He} has {a} {obj}. Each bag holds {b} {obj}. How many {obj} are left over?",
        tr: "{name} {obj} paketliyor. {a} {obj} var. Her pakete {b} {obj} giriyor. Geriye kaç {obj} artar?" }
    ],
    gen(level) { const b = pickArr([5, 6, 7, 8, 9, 12]); const q = lvRange(level, 4, 16, 1.5); const r = ri(1, b - 1); const a = b * q + r;
      return { vars: { a, b }, answer: r, wrongs: [r + 1, r - 1, q, b - r] }; }
  },
  {
    id: "deel-prijs-aantal", cat: "delen",
    variants: [
      { nl: "In de kantine is voor {a} euro patat verkocht. Een bakje patat kost € 2,50. Hoeveel bakjes patat zijn er verkocht?",
        en: "The canteen sold {a} euros of fries. A portion costs € 2.50. How many portions were sold?",
        tr: "Kantinde {a} euroluk patates satıldı. Bir porsiyon € 2,50. Kaç porsiyon satıldı?" }
    ],
    gen(level) { const q = lvRange(level, 40, 120, 1.5) * 2; const a = q * 2.5;
      return { vars: { a }, answer: q, wrongs: [q + 20, q - 20, q + 10, a / 10] }; }
  },

  /* ===================== TWEE BEWERKINGEN ===================== */
  {
    id: "twee-min-min", cat: "tweestap",
    variants: [
      { nl: "{name} heeft {a} euro verdiend met de vakantiebaan. {Hij} geeft {b} euro uit aan beltegoed en {c} euro aan snoep. Hoeveel euro heeft {name} nog over?",
        en: "{name} earned {a} euros. {He} spends {b} euros on phone credit and {c} euros on sweets. How many euros are left?",
        tr: "{name} yaz işinden {a} euro kazandı. {b} euroyu kontöre, {c} euroyu şekere harcadı. Kaç euro kaldı?" }
    ],
    gen(level) { const a = lvRange(level, 80, 99, 2.4);
      // spent amounts scale with what was earned, so an eased som stays possible
      const b = ri(Math.max(8, Math.floor(a * 0.25)), Math.max(9, Math.floor(a * 0.4)));
      const c = ri(3, Math.max(4, Math.floor(a * 0.18)));
      const ans = a - b - c;
      return { vars: { a, b, c }, answer: ans, wrongs: [a - b + c, ans + 1, ans - 1, ans + 2] }; }
  },
  {
    id: "twee-deel-min", cat: "tweestap",
    variants: [
      { nl: "{name} verdeelt {a} hapjes over {b} schalen. Van de eerste schaal worden {c} hapjes opgegeten. Hoeveel hapjes liggen er nu nog op die schaal?",
        en: "{name} divides {a} snacks over {b} plates. From the first plate {c} snacks are eaten. How many snacks are left on that plate?",
        tr: "{name} {a} atıştırmalığı {b} tabağa paylaştırıyor. İlk tabaktan {c} tane yeniyor. O tabakta kaç tane kaldı?" }
    ],
    gen(level) { const b = pickArr([4, 5, 6]); const per = lvRange(level, 30, 50, 1); const a = per * b; const c = Math.min(ri(15, 25), per - 3); const ans = per - c;
      return { vars: { a, b, c }, answer: ans, wrongs: [per, ans + 5, ans - 5, ans + 10] }; }
  },
  {
    id: "twee-deel-plus", cat: "tweestap",
    objects: [OBJ.knikkers, OBJ.balpennen],
    variants: [
      { nl: "{name} verdeelt {a} {obj} over {b} bakjes. Daarna doet {hij} er in ieder bakje {c} {obj} bij. Hoeveel {obj} zitten er nu in ieder bakje?",
        en: "{name} divides {a} {obj} over {b} tubs. Then {he} adds {c} {obj} to each tub. How many {obj} are now in each tub?",
        tr: "{name} {a} {obj} {b} kaba paylaştırıyor. Sonra her kaba {c} {obj} ekliyor. Şimdi her kapta kaç {obj} var?" }
    ],
    gen(level) { const b = pickArr([8, 6, 4]); const per = lvRange(level, 40, 80, 1); const a = per * b; const c = ri(20, 30); const ans = per + c;
      return { vars: { a, b, c }, answer: ans, wrongs: [per, ans + 10, ans - 10, ans - c + 10] }; }
  },
  {
    id: "twee-bus", cat: "tweestap",
    variants: [
      { nl: "Er zitten {a} mensen in de bus. Bij de eerste halte stappen er {b} uit, bij de tweede halte {c} en bij de derde halte {d}. Hoeveel mensen zitten er nu nog in de bus?",
        en: "There are {a} people on the bus. At the stops {b}, {c} and {d} people get off. How many people are on the bus now?",
        tr: "Otobüste {a} kişi var. Duraklarda sırayla {b}, {c} ve {d} kişi iniyor. Şimdi otobüste kaç kişi var?" }
    ],
    gen(level) { const a = lvRange(level, 50, 60, 1), b = ri(2, 6), c = ri(3, 6), d = ri(2, 5); const ans = a - b - c - d;
      return { vars: { a, b, c, d }, answer: ans, wrongs: [ans + 1, ans - 1, a - b - c, ans + 2] }; }
  },
  {
    id: "twee-maal-deel", cat: "tweestap",
    variants: [
      { nl: "{name} pakt dozen met boeken uit. Er staan {a} dozen. In iedere doos zitten {b} boeken. {name} verdeelt de boeken over {c} planken. Hoeveel boeken staan er op iedere plank?",
        en: "{name} unpacks boxes of books. There are {a} boxes with {b} books each. {name} divides the books over {c} shelves. How many books per shelf?",
        tr: "{name} kitap kutularını açıyor. Her birinde {b} kitap olan {a} kutu var. {name} kitapları {c} rafa paylaştırıyor. Her rafta kaç kitap olur?" }
    ],
    /* the books have to divide over the shelves without a remainder, so the
       number per box is chosen as a multiple of the number of shelves */
    gen(level) { const c = pickArr([4, 5, 6]); const a = ri(3, 6);
      const k = lvRange(level, 8, 22, 1.5); const b = c * k; const ans = a * k;
      return { vars: { a, b, c }, answer: ans, wrongs: [ans + 5, ans - 5, ans + 3, b] }; }
  },
  {
    id: "twee-min-deel", cat: "tweestap",
    variants: [
      { nl: "{name} heeft {a} bitterballen gebakken. Er worden er meteen {b} opgegeten. {Hij} verdeelt de rest over {c} borden. Hoeveel bitterballen liggen er op ieder bord?",
        en: "{name} baked {a} snacks. {b} are eaten right away. {He} divides the rest over {c} plates. How many snacks per plate?",
        tr: "{name} {a} köfte pişirdi. Hemen {b} tanesi yeniyor. Kalanı {c} tabağa paylaştırıyor. Her tabakta kaç köfte olur?" }
    ],
    gen(level) { const c = pickArr([4, 5, 6]); const per = lvRange(level, 8, 24, 1.5);
      const b = ri(4, 14); const a = per * c + b; const ans = per;
      return { vars: { a, b, c }, answer: ans, wrongs: [ans + 1, ans - 1, ans + 2, c] }; }
  },
  {
    id: "twee-verdubbel", cat: "tweestap",
    variants: [
      { nl: "{name} heeft met de sponsorloop {a} euro opgehaald. De vader verdubbelt het bedrag. De oom verdubbelt het nieuwe bedrag. De opa verdubbelt daarna nog een keer. Hoeveel geld kan {name} aan het goede doel geven?",
        en: "{name} raised {a} euros in the sponsor run. Dad doubles it, uncle doubles the new amount, grandpa doubles it once more. How much can {name} give to charity?",
        tr: "{name} sponsorlu koşuda {a} euro topladı. Baba iki katına çıkarıyor, amca yeni tutarı iki katına, dede bir kez daha iki katına çıkarıyor. {name} hayır için kaç euro verebilir?" }
    ],
    gen(level) { const a = lvRange(level, 12, 45, 1.5); const ans = a * 8;
      return { vars: { a }, answer: ans, wrongs: [a * 6, a * 4, ans + 8, ans - 8] }; }
  },
  {
    id: "twee-korting-deel", cat: "tweestap",
    objects: [ITEM.spelcomputer, ITEM.fiets],
    variants: [
      { nl: "{name} koopt een {obj} voor het clubhuis. De {obj} kost {a} euro. {Hij} krijgt {b} euro korting. {name} deelt de kosten met {c} vrienden. Hoeveel betalen ze per persoon?",
        en: "{name} buys a {obj} for the clubhouse. The {obj} costs {a} euros. {He} gets {b} euros discount. {name} shares the cost with {c} friends. How much does each person pay?",
        tr: "{name} kulüp için bir {obj} alıyor. {obj} {a} euro. {b} euro indirim alıyor. {name} masrafı {c} arkadaşıyla paylaşıyor. Kişi başı kaç euro öderler?" }
    ],
    gen(level) { const c = pickArr([3, 4, 5]); const per = lvRange(level, 8, 25, 1.5);
      const b = ri(4, 12); const a = per * (c + 1) + b;
      return { vars: { a, b, c }, answer: per, wrongs: [per + 1, per - 1, per + 2, c + 1] }; }
  },
  {
    id: "twee-koop-twee", cat: "tweestap",
    objects: [ITEM.bouwpakket, ITEM.skateboard, ITEM.voetbal, ITEM.step],
    objects2: [ITEM.voetbal, ITEM.skateboard, ITEM.bouwpakket, ITEM.step],
    variants: [
      { nl: "{name} gaat een {obj} en een {obj2} kopen. De {obj} kost {a} euro. De {obj2} kost {b} euro. Hoeveel moet {hij} betalen bij de kassa?",
        en: "{name} buys a {obj} and a {obj2}. The {obj} costs {a} euros. The {obj2} costs {b} euros. How much at the till?",
        tr: "{name} bir {obj} ve bir {obj2} alacak. {obj} {a} euro. {obj2} {b} euro. Kasada kaç euro öder?" }
    ],
    gen(level) { const a = lvRange(level, 20, 28, 1), b = lvRange(level, 12, 18, 1); const ans = a + b;
      return { vars: { a, b }, answer: ans, wrongs: [ans + 1, ans - 1, ans + 2, Math.abs(a - b)] }; }
  },

  /* --- ketensommen: drie of vier getallen achter elkaar ---
     Soms kaal, want een som zonder verhaaltje is een ander soort werk: er valt
     niets te begrijpen, alleen netjes op volgorde rekenen. */
  {
    id: "kaal-ketting", cat: "tweestap",
    variants: [
      { nl: "Hoeveel is {a} + {b} + {c} − {d}?",
        en: "How much is {a} + {b} + {c} − {d}?",
        tr: "{a} + {b} + {c} − {d} kaç eder?" },
      { nl: "Hoeveel is {a} + {b} − {c} + {d}?",
        en: "How much is {a} + {b} − {c} + {d}?",
        tr: "{a} + {b} − {c} + {d} kaç eder?" },
      { nl: "Reken uit: {a} − {b} + {c}",
        en: "Work it out: {a} − {b} + {c}",
        tr: "Hesapla: {a} − {b} + {c}" },
      { nl: "Reken uit: {a} + {b} + {c}",
        en: "Work it out: {a} + {b} + {c}",
        tr: "Hesapla: {a} + {b} + {c}" }
    ],
    gen(level, v) {
      const a = lvRange(level, 45, 130, 2.6);
      const b = lvRange(level, 25, 90, 2.6);
      const c = lvRange(level, 15, 70, 2.6);
      if (v === 0) {                                   // a + b + c − d
        const d = ri(12, Math.floor((a + b + c) / 2));
        const ans = a + b + c - d;
        return { vars: { a, b, c, d }, answer: ans,
                 wrongs: [a + b + c + d, ans + 10, ans - 10, ans + 1, ans - 1] };
      }
      if (v === 1) {                                   // a + b − c + d
        const cc = ri(12, Math.floor((a + b) / 2));
        const d = lvRange(level, 15, 70, 2.6);
        const ans = a + b - cc + d;
        return { vars: { a, b, c: cc, d }, answer: ans,
                 wrongs: [a + b + cc + d, a + b - cc - d, ans + 10, ans - 10, ans + 1] };
      }
      if (v === 2) {                                   // a − b + c
        const bb = ri(Math.max(3, Math.floor(a * 0.25)), Math.max(4, Math.floor(a * 0.6)));
        const ans = a - bb + c;
        return { vars: { a, b: bb, c }, answer: ans,
                 wrongs: [a - bb - c, a + bb + c, ans + 10, ans - 10, ans + 1] };
      }
      const ans = a + b + c;                           // a + b + c
      return { vars: { a, b, c }, answer: ans,
               wrongs: [a + b - c, ans + 10, ans - 10, ans + 100, ans + 1] };
    }
  },
  {
    id: "twee-kassa-drie", cat: "tweestap",
    variants: [
      { nl: "{name} koopt een boek van {a} euro, een spel van {b} euro en een pen van {c} euro. {Hij} betaalt met {d} euro. Hoeveel euro krijgt {hij} terug?",
        en: "{name} buys a book for {a} euros, a game for {b} euros and a pen for {c} euros. {He} pays with {d} euros. How many euros does {he} get back?",
        tr: "{name} {a} euroluk kitap, {b} euroluk oyun ve {c} euroluk kalem alıyor. {d} euro veriyor. Kaç euro para üstü alır?" }
    ],
    gen(level) {
      const a = lvRange(level, 12, 30, 1.8), b = lvRange(level, 8, 25, 1.8), c = ri(2, 9);
      const total = a + b + c;
      const d = Math.ceil((total + ri(5, 25)) / 10) * 10;      // a round note
      const ans = d - total;
      return { vars: { a, b, c, d }, answer: ans,
               wrongs: [d - a - b, total, ans + 10, ans - 10, ans + 1] };
    }
  },
  {
    id: "twee-club-ketting", cat: "tweestap",
    variants: [
      { nl: "De club van {name} had {a} leden. Er kwamen {b} nieuwe leden bij en later nog {c}. Daarna stopten er {d}. Hoeveel leden heeft de club nu?",
        en: "{name}'s club had {a} members. {b} new members joined and later {c} more. Then {d} left. How many members does the club have now?",
        tr: "{name_in} kulübünde {a} üye vardı. {b} yeni üye katıldı, sonra {c} kişi daha. Ardından {d} kişi ayrıldı. Kulüpte şimdi kaç üye var?" }
    ],
    gen(level) {
      const a = lvRange(level, 60, 160, 2.4);
      const b = lvRange(level, 15, 50, 2.0);
      const c = lvRange(level, 10, 40, 2.0);
      const d = ri(8, Math.floor((a + b + c) / 3));
      const ans = a + b + c - d;
      return { vars: { a, b, c, d }, answer: ans,
               wrongs: [a + b + c + d, a + b - c - d, ans + 10, ans - 10, ans + 1] };
    }
  },
  {
    id: "twee-spaar-ketting", cat: "tweestap",
    variants: [
      { nl: "{name} had {a} euro gespaard. {Hij} kreeg er {b} euro bij en verdiende {c} euro met klusjes. Daarna gaf {hij} {d} euro uit. Hoeveel euro heeft {name} nu?",
        en: "{name} had saved {a} euros. {He} was given {b} euros more and earned {c} euros doing chores. Then {he} spent {d} euros. How many euros does {name} have now?",
        tr: "{name} {a} euro biriktirmişti. {b} euro daha aldı ve işlerden {c} euro kazandı. Sonra {d} euro harcadı. {name} şimdi kaç euroya sahip?" }
    ],
    gen(level) {
      const a = lvRange(level, 40, 120, 2.4);
      const b = lvRange(level, 10, 45, 2.0);
      const c = lvRange(level, 10, 40, 2.0);
      const d = ri(10, Math.floor((a + b + c) / 2));
      const ans = a + b + c - d;
      return { vars: { a, b, c, d }, answer: ans,
               wrongs: [a + b + c + d, a + b - c + d, ans + 10, ans - 10, ans + 1] };
    }
  },

  /* ===================== KLOKKIJKEN (CITO/DIA) =====================
     Not in the book, but a core groep 5 CITO/DIA topic and a known weak spot.
     Answers are always digital times or plain numbers, so the four options
     stay language-neutral while the question itself is spoken per language. */
  {
    id: "klok-woord-digitaal", cat: "klok",
    variants: [
      { nl: "De zwemles van {name} begint 's middags om {klok}. Hoe laat is dat op een digitale klok?",
        en: "{name}'s swimming lesson starts in the afternoon at {klok}. What time is that on a digital clock?",
        tr: "{name_in} yüzme dersi öğleden sonra {klok} başlıyor. Bu, dijital saatte kaçtır?" },
      { nl: "{name} gaat 's avonds om {klok} naar bed. Hoe laat is dat op een digitale klok?",
        en: "{name} goes to bed in the evening at {klok}. What time is that on a digital clock?",
        tr: "{name} akşam {klok} yatıyor. Bu, dijital saatte kaçtır?" }
    ],
    gen(level, v) {
      const h = v === 1 ? ri(7, 11) : ri(1, 6);         // 12-hour clock hour
      const m = level < 1 ? pickArr([0, 30, 15, 45])    // comfort band: familiar times
                          : ri(0, 11) * 5;   // a spoken time only lands on five minutes
      const H = h + 12;                                  // afternoon / evening
      const ans = tFmt(H, m);
      const wrongs = [
        tFmt(H + 1, m), tFmt(H - 1, m),                  // hour off by one
        tFmt(h, m),                                      // forgot to convert to 24h
        tFmt(H, (m + 30) % 60)                           // half-hour trap
      ];
      return { vars: { _h: h, _m: m }, textCorrect: ans, textWrongs: wrongs };
    }
  },
  {
    id: "klok-duur-vooruit", cat: "klok",
    variants: [
      { nl: "De film begint om {t} uur en duurt {a} minuten. Hoe laat is de film afgelopen?",
        en: "The film starts at {t} and lasts {a} minutes. What time does the film end?",
        tr: "Film {t_de} başlıyor ve {a} dakika sürüyor. Film saat kaçta biter?" },
      { nl: "{name} begint om {t} uur met huiswerk. {Hij} doet er {a} minuten over. Hoe laat is {hij} klaar?",
        en: "{name} starts homework at {t}. It takes {a} minutes. What time is {he} finished?",
        tr: "{name} ödeve {t_de} başlıyor. {a} dakika sürüyor. Saat kaçta biter?" }
    ],
    gen(level) {
      const h = ri(9, 19);
      const m = level < 1 ? pickArr([0, 30]) : pickArr([5, 10, 15, 20, 25, 35, 40, 45, 50]);
      const a = level < 1 ? pickArr([15, 30, 60]) : pickArr([25, 35, 40, 45, 50, 55, 75, 90]);
      const e = tAdd(h, m, a);
      const w1 = tAdd(h, m, a + 10), w2 = tAdd(h, m, a - 10), w3 = tAdd(h + 1, m, a);
      return { vars: { t: tFmt(h, m), a },
        textCorrect: tFmt(e.h, e.m),
        textWrongs: [tFmt(w1.h, w1.m), tFmt(w2.h, w2.m), tFmt(w3.h, w3.m)] };
    }
  },
  {
    id: "klok-duur-terug", cat: "klok",
    variants: [
      { nl: "De trein van {name} komt om {t} uur aan. De reis duurt {a} minuten. Hoe laat is de trein vertrokken?",
        en: "{name}'s train arrives at {t}. The journey takes {a} minutes. What time did the train leave?",
        tr: "{name_in} treni {t_de} varıyor. Yolculuk {a} dakika sürüyor. Tren saat kaçta kalktı?" }
    ],
    gen(level) {
      const h = ri(10, 20);
      const m = level < 1 ? pickArr([0, 30]) : pickArr([0, 5, 10, 15, 20, 25, 30, 40, 45]);
      const a = level < 1 ? pickArr([15, 30, 60]) : pickArr([25, 35, 40, 45, 50, 70, 85]);
      const s = tAdd(h, m, -a);
      const w1 = tAdd(h, m, a), w2 = tAdd(h, m, -a + 10), w3 = tAdd(h, m, -a - 10);
      return { vars: { t: tFmt(h, m), a },
        textCorrect: tFmt(s.h, s.m),
        textWrongs: [tFmt(w1.h, w1.m), tFmt(w2.h, w2.m), tFmt(w3.h, w3.m)] };
    }
  },
  {
    id: "klok-hoelang", cat: "klok",
    variants: [
      { nl: "De les van {name} begint om {t} uur en eindigt om {t2} uur. Hoeveel minuten duurt de les?",
        en: "{name}'s lesson starts at {t} and ends at {t2}. How many minutes does the lesson last?",
        tr: "{name_in} dersi {t_de} başlayıp {t2_de} bitiyor. Ders kaç dakika sürer?" },
      { nl: "Het zwembad gaat om {t} uur open en om {t2} uur dicht. Hoeveel minuten is het zwembad open?",
        en: "The pool opens at {t} and closes at {t2}. How many minutes is the pool open?",
        tr: "Havuz {t_de} açılıp {t2_de} kapanıyor. Havuz kaç dakika açık kalır?" }
    ],
    gen(level) {
      const h = ri(8, 18);
      const m = level < 1 ? pickArr([0, 30]) : pickArr([0, 10, 15, 20, 25, 30, 45, 50]);
      const dur = level < 1 ? pickArr([30, 45, 60, 90]) : pickArr([35, 40, 45, 50, 55, 65, 75, 80, 90]);
      const e = tAdd(h, m, dur);
      return { vars: { t: tFmt(h, m), t2: tFmt(e.h, e.m) },
        answer: dur, wrongs: [dur + 10, dur - 10, dur + 5, dur - 5, dur + 40] };
    }
  },
  {
    id: "klok-omrekenen", cat: "klok",
    variants: [
      { nl: "{name} heeft {a} uur en {b} minuten gefietst. Hoeveel minuten is dat in totaal?",
        en: "{name} cycled for {a} hours and {b} minutes. How many minutes is that in total?",
        tr: "{name} {a} saat {b} dakika bisiklet sürdü. Bu toplam kaç dakikadır?" }
    ],
    gen(level) {
      const a = lvRange(level, 2, 6, 1.5);
      const b = level < 1 ? pickArr([15, 30, 45]) : ri(1, 11) * 5 + ri(0, 4);
      const ans = a * 60 + b;
      return { vars: { a, b }, answer: ans,
        wrongs: [a * 100 + b, ans - 60, ans + 60, a * 60] };   // a*100+b = classic error
    }
  },
  {
    id: "klok-twee-stappen", cat: "klok",
    variants: [
      { nl: "De training van {name} begint om {t} uur en duurt {a} minuten. Daarna fietst {hij} {b} minuten naar huis. Hoe laat is {hij} thuis?",
        en: "{name}'s training starts at {t} and lasts {a} minutes. Then {he} cycles home for {b} minutes. What time is {he} home?",
        tr: "{name_in} antrenmanı {t_de} başlıyor ve {a} dakika sürüyor. Sonra {b} dakika bisikletle eve gidiyor. Saat kaçta evde olur?" }
    ],
    gen(level) {
      const h = ri(15, 19);
      const m = level < 1 ? pickArr([0, 30]) : pickArr([0, 15, 20, 30, 45]);
      const a = level < 1 ? pickArr([30, 60]) : pickArr([45, 50, 55, 60, 75]);
      const b = level < 1 ? pickArr([10, 15, 30]) : pickArr([10, 15, 20, 25]);
      const e = tAdd(h, m, a + b);
      // offsets chosen so all four options stay distinct for every b (b >= 10):
      // w1 = forgot the cycle home, w2/w3 = ±slips that can never equal w1
      const w1 = tAdd(h, m, a), w2 = tAdd(h, m, a + b + 15), w3 = tAdd(h, m, a + b - 5);
      return { vars: { t: tFmt(h, m), a, b },
        textCorrect: tFmt(e.h, e.m),
        textWrongs: [tFmt(w1.h, w1.m), tFmt(w2.h, w2.m), tFmt(w3.h, w3.m)] };
    }
  },

  /* ===================== VERRASSING (mixed CITO/DIA) ===================== */
  {
    id: "verr-briefjes", cat: "verrassing",
    variants: [
      { nl: "{name} heeft {a} briefje(s) van 100 euro, {b} briefjes van 10 euro en {c} munten van 1 euro. Hoeveel euro heeft {name}?",
        en: "{name} has {a} note(s) of 100 euros, {b} notes of 10 euros and {c} coins of 1 euro. How many euros?",
        tr: "{name_de} {a} tane 100 euroluk, {b} tane 10 euroluk banknot ve {c} tane 1 euroluk madeni para var. Kaç euro?" }
    ],
    gen() { const a = ri(1, 6), b = ri(3, 8), c = ri(2, 6); const ans = a * 100 + b * 10 + c;
      return { vars: { a, b, c }, answer: ans, wrongs: [a * 100 + c * 10 + b, ans + 10, ans - 10, ans + 100] }; }
  },
  {
    id: "verr-rekening", cat: "verrassing",
    variants: [
      { nl: "{name} gaat uit eten. {Hij} bestelt een broodje van € {a}, een milkshake van € {b} en als toetje een ijsje van € {c}. Hoeveel moet {name} betalen?",
        en: "{name} eats out. {He} orders a roll for € {a}, a milkshake for € {b} and an ice cream for € {c}. How much to pay?",
        tr: "{name} dışarıda yemek yiyor. € {a} sandviç, € {b} milkshake ve tatlı olarak € {c} dondurma alıyor. Kaç euro öder?" }
    ],
    gen() {
      const cents = () => (ri(2, 3) + pickArr([0, 0.5, 0.98, 0.5]));
      const a = cents(), b = cents(), c = cents();
      const fmt = n => "€ " + n.toFixed(2).replace(".", ",");
      const ans = Math.round((a + b + c) * 100) / 100;
      const wrongs = [ans + 1, ans - 1, ans + 0.5].map(fmt);
      return { vars: { a: a.toFixed(2).replace(".", ","), b: b.toFixed(2).replace(".", ","), c: c.toFixed(2).replace(".", ",") },
        textCorrect: fmt(ans), textWrongs: wrongs };
    }
  },
  {
    id: "verr-welkesom", cat: "verrassing",
    variants: [
      { nl: "Er zitten {a} kinderen in de klas. {b} kinderen zijn ziek thuis. Hoeveel kinderen zijn er op school? Welke som hoort erbij?",
        en: "There are {a} children in the class. {b} are home sick. How many are at school? Which sum fits?",
        tr: "Sınıfta {a} çocuk var. {b} çocuk hasta, evde. Okulda kaç çocuk var? Hangi işlem doğru?" },
      { nl: "{name} heeft {a} stickers. {Hij} krijgt er {b} bij. Hoeveel heeft {hij} nu? Welke som hoort erbij?",
        en: "{name} has {a} stickers. {He} gets {b} more. How many now? Which sum fits?",
        tr: "{name} {a} çıkartma topladı. {b} tane daha aldı. Şimdi kaç tane? Hangi işlem doğru?" }
    ],
    gen(level, v) { const a = ri(24, 60), b = ri(4, 12); const op = v === 1 ? "+" : "−";
      const textCorrect = `${a} ${op} ${b}`;
      const textWrongs = ["+", "−", "×", ":"].filter(o => o !== op).map(o => `${a} ${o} ${b}`);
      return { vars: { a, b }, textCorrect, textWrongs }; }
  },
  {
    id: "verr-schatten", cat: "verrassing",
    variants: [
      { nl: "Ongeveer hoeveel is {a} + {b}? Rond af op honderdtallen.",
        en: "About how much is {a} + {b}? Round to the nearest hundred.",
        tr: "{a} + {b} yaklaşık kaç eder? Yüzlüklere yuvarla." }
    ],
    gen() { const a = ri(120, 480) + pickArr([-8, -5, 5, 8]); const b = ri(120, 480) + pickArr([-8, -5, 5, 8]);
      const ans = Math.round((a + b) / 100) * 100;
      return { vars: { a, b }, answer: ans, wrongs: [ans + 100, ans - 100, ans + 200, ans - 200] }; }
  },

  /* --- meten & wegen (CITO): unit conversion inside a story --- */
  {
    id: "verr-meten-cm", cat: "verrassing",
    variants: [
      { nl: "{name} heeft een touw van {a} meter. Er wordt {b} centimeter afgeknipt. Hoeveel centimeter touw is er nog over?",
        en: "{name} has a rope of {a} metres. {b} centimetres are cut off. How many centimetres of rope are left?",
        tr: "{name_in} {a} metrelik bir ipi var. {b} santimetre kesiliyor. Geriye kaç santimetre ip kalır?" }
    ],
    gen() { const a = ri(3, 6), b = pickArr([45, 65, 80, 125, 150]); const ans = a * 100 - b;
      return { vars: { a, b }, answer: ans, wrongs: [a * 100 + b, ans + 100, ans - 100, a * 10 - b] }; }
  },
  {
    id: "verr-gewicht", cat: "verrassing",
    variants: [
      { nl: "{name} koopt {a} pakken meel van {b} gram. Hoeveel gram meel is dat samen?",
        en: "{name} buys {a} bags of flour of {b} grams each. How many grams is that in total?",
        tr: "{name} her biri {b} gram olan {a} paket un alıyor. Bu toplam kaç gramdır?" },
      { nl: "Een doos weegt {a} kilo. Hoeveel gram is dat?",
        en: "A box weighs {a} kilos. How many grams is that?",
        tr: "Bir kutu {a} kilo geliyor. Bu kaç gramdır?" }
    ],
    gen(level, v) {
      if (v === 1) { const a = ri(2, 7); const ans = a * 1000;
        return { vars: { a }, answer: ans, wrongs: [a * 100, ans + 1000, ans - 1000, a * 10] }; }
      const a = ri(3, 6), b = pickArr([250, 500, 750, 400]); const ans = a * b;
      return { vars: { a, b }, answer: ans, wrongs: [ans + b, ans - b, ans + 100, a + b] };
    }
  },
  {
    id: "verr-prijslijst", cat: "verrassing",
    variants: [
      { nl: "In de schoolwinkel kost een pen {a} euro en een schrift {b} euro. {name} koopt {c} pennen en {d} schriften. Hoeveel euro moet {hij} betalen?",
        en: "At the school shop a pen costs {a} euros and a notebook {b} euros. {name} buys {c} pens and {d} notebooks. How many euros must {he} pay?",
        tr: "Okul kantininde bir kalem {a} euro, bir defter {b} euro. {name} {c} kalem ve {d} defter alıyor. Kaç euro öder?" }
    ],
    gen() { const a = ri(2, 4), b = ri(5, 8), c = ri(3, 6), d = ri(2, 5); const ans = a * c + b * d;
      return { vars: { a, b, c, d }, answer: ans,
        wrongs: [a * d + b * c, ans + 5, ans - 5, (a + b) * (c + d)] }; }
  }
];

const CATS = ["optellen", "aftrekken", "vermenigvuldigen", "delen", "tweestap", "klok"];
