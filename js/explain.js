/* Uitleg per som.

   When a som has gone wrong twice — once in the opdracht, once on the second
   chance the report card gives — telling the child the answer teaches nothing.
   This file explains HOW, in one short paragraph, using the numbers of the som
   that was actually on the screen, in whichever language is being read.

   Each entry belongs to one template. Strings use the same tokens as the
   questions themselves ({a}, {name}, {klok}, …) plus {ans} — the correct
   option as shown — and any extra values computed in v(vars, q). An entry may
   be an array when the template's variants need different explanations. */

/* ---- little helpers for the clock explanations ---- */
function _pt(t) { const [h, m] = String(t).split(":").map(Number); return { h, m }; }

/* "18:20 + 10 min → 18:30, + 40 min → 19:10" — counting on via the full hour */
function chainFwd(t, add) {
  let cur = _pt(t), left = add;
  const parts = [];
  if (cur.m !== 0 && (60 - cur.m) <= left) {
    const step = 60 - cur.m, nxt = tAdd(cur.h, cur.m, step);
    parts.push(`${tFmt(cur.h, cur.m)} + ${step} min → ${tFmt(nxt.h, nxt.m)}`);
    cur = nxt; left -= step;
  }
  if (left > 0) {
    const nxt = tAdd(cur.h, cur.m, left);
    parts.push(`${tFmt(cur.h, cur.m)} + ${left} min → ${tFmt(nxt.h, nxt.m)}`);
  }
  return parts.join(", ");
}

/* the same going backwards */
function chainBack(t, sub) {
  let cur = _pt(t), left = sub;
  const parts = [];
  if (cur.m !== 0 && cur.m <= left) {
    const step = cur.m, nxt = tAdd(cur.h, cur.m, -step);
    parts.push(`${tFmt(cur.h, cur.m)} − ${step} min → ${tFmt(nxt.h, nxt.m)}`);
    cur = nxt; left -= step;
  }
  if (left > 0) {
    const nxt = tAdd(cur.h, cur.m, -left);
    parts.push(`${tFmt(cur.h, cur.m)} − ${left} min → ${tFmt(nxt.h, nxt.m)}`);
  }
  return parts.join(", ");
}

/* minutes between two times, split at the full hour */
function chainSpan(t, t2) {
  const A = _pt(t), B = _pt(t2);
  const total = (B.h * 60 + B.m) - (A.h * 60 + A.m);
  if (A.m === 0 || A.h === B.h) return `${t} → ${t2} = ${total} min`;
  const p1 = 60 - A.m, H1 = tFmt(A.h + 1, 0), p2 = total - p1;
  return `${t} → ${H1} = ${p1} min, ${H1} → ${t2} = ${p2} min, ${p1} + ${p2} = ${total} min`;
}

const EXPLAIN = {

  /* ===================== OPTELLEN ===================== */
  "opt-sparen-krijgt": {
    nl: "{name} had eerst {a} euro en kreeg er {b} euro bij. Erbij krijgen is optellen: {a} + {b} = {ans}.",
    en: "{name} first had {a} euros and got {b} more. Getting more means adding: {a} + {b} = {ans}.",
    tr: "{name} önce {a} euroya sahipti, üstüne {b} euro daha geldi. Üstüne gelmek toplamaktır: {a} + {b} = {ans}."
  },
  "opt-voorraad": {
    nl: "Er waren al {a} pakken en er kwamen {b} nieuwe bij. Samen is dat optellen: {a} + {b} = {ans}.",
    en: "There were {a} packs and {b} new ones arrived. Together means adding: {a} + {b} = {ans}.",
    tr: "Zaten {a} paket vardı, {b} yeni paket geldi. Hepsi birlikte demek toplama demek: {a} + {b} = {ans}."
  },
  "opt-twee-collecties": {
    nl: "Het zijn twee groepen: {a} en {b}. Alles samen tellen is optellen: {a} + {b} = {ans}.",
    en: "There are two groups: {a} and {b}. Counting them together is adding: {a} + {b} = {ans}.",
    tr: "İki grup var: {a} ve {b}. Hepsini birlikte saymak toplamaktır: {a} + {b} = {ans}."
  },
  "opt-dagdeel": {
    nl: "Eerst waren het er {a}, later kwamen er nog {b}. Samen: {a} + {b} = {ans}.",
    en: "First there were {a}, later {b} more. Together: {a} + {b} = {ans}.",
    tr: "Önce {a} taneydi, sonra {b} tane daha oldu. Toplam: {a} + {b} = {ans}."
  },
  "opt-tellen-vooruit": {
    v: v => ({ s1: v.a + v.b, s2: v.a + 2 * v.b, s3: v.a + 3 * v.b, step4: 4 * v.b }),
    nl: "Tel vier keer {b} erbij, stap voor stap: {a} → {s1} → {s2} → {s3} → {ans}. Vier keer {b} is samen {step4}, en {a} + {step4} = {ans}.",
    en: "Add {b} four times, step by step: {a} → {s1} → {s2} → {s3} → {ans}. Four times {b} makes {step4}, and {a} + {step4} = {ans}.",
    tr: "Dört kez {b} ekle, adım adım: {a} → {s1} → {s2} → {s3} → {ans}. Dört kez {b}, toplam {step4} eder; {a} + {step4} = {ans}."
  },
  "opt-club-erbij": {
    nl: "De club had {a} leden en er kwamen er {b} bij. Erbij is optellen: {a} + {b} = {ans}.",
    en: "The club had {a} members and {b} joined. Joining means adding: {a} + {b} = {ans}.",
    tr: "Kulüpte {a} üye vardı, {b} üye katıldı. Katılmak toplamaktır: {a} + {b} = {ans}."
  },

  /* ===================== AFTREKKEN ===================== */
  "aft-vrijlaten": {
    nl: "Er waren {a} vogels en er gingen er {b} weg. Weggaan is eraf halen: {a} − {b} = {ans}.",
    en: "There were {a} birds and {b} left. Leaving means taking away: {a} − {b} = {ans}.",
    tr: "{a} kuş vardı, {b} tanesi gitti. Gitmek çıkarmaktır: {a} − {b} = {ans}."
  },
  "aft-korting-verschil": {
    nl: "Hoeveel goedkoper? Dat is het verschil: de oude prijs min de nieuwe. {a} − {b} = {ans}.",
    en: "How much cheaper? That is the difference: old price minus new price. {a} − {b} = {ans}.",
    tr: "Ne kadar ucuzladı? Bu bir fark sorusu: eski fiyattan yenisini çıkar. {a} − {b} = {ans}."
  },
  "aft-nog-doen": {
    nl: "Er moeten er {a} in totaal, en {b} zijn al klaar. Wat al klaar is haal je eraf: {a} − {b} = {ans}.",
    en: "There are {a} in total and {b} are already done. Take away what is done: {a} − {b} = {ans}.",
    tr: "Toplam {a} tane var, {b} tanesi bitti bile. Biteni çıkar: {a} − {b} = {ans}."
  },
  "aft-verliezen": {
    nl: "{name} begon met {a} en verloor er {b}. Verliezen is eraf: {a} − {b} = {ans}.",
    en: "{name} started with {a} and lost {b}. Losing means taking away: {a} − {b} = {ans}.",
    tr: "{name} {a} taneyle başladı, {b} tanesini kaybetti. Kaybetmek çıkarmaktır: {a} − {b} = {ans}."
  },
  "aft-tellen-terug": {
    v: v => ({ s1: v.a - v.b, s2: v.a - 2 * v.b, s3: v.a - 3 * v.b, step4: 4 * v.b }),
    nl: "Haal er vier keer {b} af, stap voor stap: {a} → {s1} → {s2} → {s3} → {ans}. Vier keer {b} is {step4}, en {a} − {step4} = {ans}.",
    en: "Take {b} off four times, step by step: {a} → {s1} → {s2} → {s3} → {ans}. Four times {b} is {step4}, and {a} − {step4} = {ans}.",
    tr: "Dört kez {b} çıkar, adım adım: {a} → {s1} → {s2} → {s3} → {ans}. Dört kez {b}, {step4} eder; {a} − {step4} = {ans}."
  },
  "aft-helft": {
    v: v => ({ half: v.a / 2 }),
    nl: "De helft betekent: verdeel {a} in twee gelijke stukken. {a} : 2 = {ans}. Controle: {ans} + {ans} = {a}.",
    en: "Half means: split {a} into two equal parts. {a} : 2 = {ans}. Check: {ans} + {ans} = {a}.",
    tr: "Yarısı demek: {a} sayısını iki eşit parçaya böl. {a} : 2 = {ans}. Kontrol: {ans} + {ans} = {a}."
  },
  "aft-restant-bellen": {
    nl: "Er zijn {a} minuten in totaal en {b} zijn al gebruikt. Wat gebruikt is haal je eraf: {a} − {b} = {ans}.",
    en: "There are {a} minutes in total and {b} are used. Take away what is used: {a} − {b} = {ans}.",
    tr: "Toplam {a} dakika var, {b} dakikası kullanıldı. Kullanılanı çıkar: {a} − {b} = {ans}."
  },
  "aft-voordat": {
    nl: "Ná de markt is er {a} euro, en de markt bracht {b} euro op. Ervóór was het dus {b} minder: {a} − {b} = {ans}.",
    en: "After the sale there are {a} euros, and the sale raised {b}. Before, there was {b} less: {a} − {b} = {ans}.",
    tr: "Pazardan sonra kasada {a} euro var; pazar {b} euro kazandırdı. Öncesinde {b} eksikti: {a} − {b} = {ans}."
  },

  /* ===================== VERMENIGVULDIGEN ===================== */
  "verm-kisten": {
    nl: "Het zijn {a} kisten met in elke kist {b}. Gelijke groepen tel je met keer: {a} × {b} = {ans}.",
    en: "There are {a} crates with {b} in each. Equal groups means multiplying: {a} × {b} = {ans}.",
    tr: "{a} kasa var, her birinde {b} tane. Eşit gruplar çarpma demektir: {a} × {b} = {ans}."
  },
  "verm-dagen-afstand": {
    nl: "Elke dag {b} kilometer, en dat {a} dagen lang. Dat is keer: {a} × {b} = {ans}.",
    en: "Every day {b} kilometres, for {a} days. That is multiplying: {a} × {b} = {ans}.",
    tr: "Her gün {b} kilometre, bunu {a} gün yapıyor. Bu çarpmadır: {a} × {b} = {ans}."
  },
  "verm-rijen": {
    nl: "Het zijn {a} rijen met steeds {b} in een rij. Rijen van gelijke grootte: {a} × {b} = {ans}.",
    en: "There are {a} rows with {b} in each row. Equal rows: {a} × {b} = {ans}.",
    tr: "{a} sıra var, her sırada {b} tane. Eşit sıralar: {a} × {b} = {ans}."
  },
  "verm-hoofdstukken": {
    nl: "Er zijn {a} hoofdstukken met elk {b} sommen. Gelijke groepen: {a} × {b} = {ans}.",
    en: "There are {a} chapters with {b} sums each. Equal groups: {a} × {b} = {ans}.",
    tr: "{a} bölüm var, her birinde {b} soru. Eşit gruplar: {a} × {b} = {ans}."
  },
  "verm-loten": {
    nl: "{a} loten van elk {b} euro. Dat is keer: {a} × {b} = {ans} euro.",
    en: "{a} tickets of {b} euros each. That is multiplying: {a} × {b} = {ans} euros.",
    tr: "Her biri {b} euroluk {a} bilet. Bu çarpmadır: {a} × {b} = {ans} euro."
  },
  "verm-cola-halve": {
    v: v => ({ half: v.a / 2 }),
    nl: "€ 1,50 is 1 euro en 50 cent. {a} flesjes × 1 euro = {a} euro, en {a} flesjes × 50 cent = {half} euro. Samen: {a} + {half} = {ans} euro.",
    en: "€ 1.50 is 1 euro and 50 cents. {a} bottles × 1 euro = {a} euros, and {a} bottles × 50 cents = {half} euros. Together: {a} + {half} = {ans} euros.",
    tr: "€ 1,50; 1 euro artı 50 senttir. {a} şişe × 1 euro = {a} euro; {a} şişe × 50 sent = {half} euro. Toplam: {a} + {half} = {ans} euro."
  },

  /* ===================== DELEN ===================== */
  "deel-eerlijk": {
    nl: "Eerlijk verdelen is delen: {a} : {b} = {ans}. Controle met keer: {b} × {ans} = {a}.",
    en: "Sharing fairly is dividing: {a} : {b} = {ans}. Check with times: {b} × {ans} = {a}.",
    tr: "Eşit paylaştırmak bölmektir: {a} : {b} = {ans}. Çarpmayla kontrol et: {b} × {ans} = {a}."
  },
  "deel-hoeveel-groepen": {
    nl: "Je maakt groepen van {b} tot iedereen een plek heeft: {a} : {b} = {ans}. Controle: {ans} × {b} = {a}.",
    en: "You make groups of {b} until everyone has a place: {a} : {b} = {ans}. Check: {ans} × {b} = {a}.",
    tr: "Herkese yer bulunana kadar {b} kişilik gruplar yaparsın: {a} : {b} = {ans}. Kontrol: {ans} × {b} = {a}."
  },
  "deel-per-stuk": {
    nl: "De {a} euro wordt verdeeld over {b} kinderen: {a} : {b} = {ans} euro per kaartje. Controle: {b} × {ans} = {a}.",
    en: "The {a} euros are shared by {b} children: {a} : {b} = {ans} euros each. Check: {b} × {ans} = {a}.",
    tr: "{a} euro {b} çocuğa bölünür: {a} : {b} = {ans} euro. Kontrol: {b} × {ans} = {a}."
  },
  "deel-boeken-dozen": {
    nl: "De {a} {obj} worden eerlijk verdeeld over {b} dozen: {a} : {b} = {ans} per doos. Controle: {b} × {ans} = {a}.",
    en: "The {a} {obj} are shared over {b} boxes: {a} : {b} = {ans} per box. Check: {b} × {ans} = {a}.",
    tr: "{a} {obj}, {b} kutuya eşit bölünür: {a} : {b} = {ans}. Kontrol: {b} × {ans} = {a}."
  },
  "deel-vullen-vol": {
    v: v => { const q = Math.floor(v.a / v.b); return { q, filled: v.b * q, r: v.a - v.b * q }; },
    nl: "Kijk hoe vaak {b} in {a} past: {b} × {q} = {filled}. Dat zijn {ans} volle doosjes, en er blijven {r} {obj} over — te weinig voor nog een doosje.",
    en: "See how many times {b} fits into {a}: {b} × {q} = {filled}. That is {ans} full boxes, with {r} {obj} left — not enough for another box.",
    tr: "{b} sayısının {a} içine kaç kez sığdığına bak: {b} × {q} = {filled}. Yani {ans} dolu kutu; geriye {r} {obj} kalır — bir kutuya yetmez."
  },
  "deel-rest-over": {
    v: v => { const q = Math.floor(v.a / v.b); return { q, filled: v.b * q }; },
    nl: "Er passen {q} volle zakjes: {b} × {q} = {filled}. Van de {a} {obj} blijven er dan {a} − {filled} = {ans} over.",
    en: "{q} full bags fit: {b} × {q} = {filled}. Of the {a} {obj}, {a} − {filled} = {ans} are left over.",
    tr: "{q} tam paket olur: {b} × {q} = {filled}. {a} {obj} içinden geriye {a} − {filled} = {ans} kalır."
  },
  "deel-prijs-aantal": {
    v: v => ({ fives: Math.round(v.a / 5) }),
    nl: "Twee bakjes kosten samen € 5. Kijk hoe vaak € 5 in € {a} past: {fives} keer. Elke keer zijn dat 2 bakjes: {fives} × 2 = {ans}.",
    en: "Two portions together cost € 5. See how many times € 5 fits into € {a}: {fives} times. Each time is 2 portions: {fives} × 2 = {ans}.",
    tr: "İki porsiyon birlikte € 5 eder. € 5, € {a} içine {fives} kez sığar. Her seferinde 2 porsiyon: {fives} × 2 = {ans}."
  },

  /* ===================== TWEE BEWERKINGEN ===================== */
  "twee-min-min": {
    v: v => ({ s1: v.a - v.b }),
    nl: "Doe het in twee stappen. Eerst het beltegoed eraf: {a} − {b} = {s1}. Dan het snoep eraf: {s1} − {c} = {ans}.",
    en: "Do it in two steps. First take off the phone credit: {a} − {b} = {s1}. Then the sweets: {s1} − {c} = {ans}.",
    tr: "İki adımda yap. Önce kontörü çıkar: {a} − {b} = {s1}. Sonra şekeri: {s1} − {c} = {ans}."
  },
  "twee-deel-min": {
    v: v => ({ per: v.a / v.b }),
    nl: "Eerst verdelen: {a} : {b} = {per} op iedere schaal. Dan wat opgegeten is eraf: {per} − {c} = {ans}.",
    en: "First divide: {a} : {b} = {per} on each plate. Then take off what was eaten: {per} − {c} = {ans}.",
    tr: "Önce paylaştır: {a} : {b} = {per}. Sonra yeneni çıkar: {per} − {c} = {ans}."
  },
  "twee-deel-plus": {
    v: v => ({ per: v.a / v.b }),
    nl: "Eerst verdelen: {a} : {b} = {per} in ieder bakje. Dan komen er {c} bij: {per} + {c} = {ans}.",
    en: "First divide: {a} : {b} = {per} in each tub. Then {c} are added: {per} + {c} = {ans}.",
    tr: "Önce paylaştır: {a} : {b} = {per}. Sonra {c} tane eklenir: {per} + {c} = {ans}."
  },
  "twee-bus": {
    v: v => ({ s1: v.a - v.b, s2: v.a - v.b - v.c }),
    nl: "Haal er per halte af: {a} − {b} = {s1}, dan {s1} − {c} = {s2}, dan {s2} − {d} = {ans}.",
    en: "Take off stop by stop: {a} − {b} = {s1}, then {s1} − {c} = {s2}, then {s2} − {d} = {ans}.",
    tr: "Durak durak çıkar: {a} − {b} = {s1}, sonra {s1} − {c} = {s2}, sonra {s2} − {d} = {ans}."
  },
  "twee-maal-deel": {
    v: v => ({ tot: v.a * v.b }),
    nl: "Eerst alle boeken tellen: {a} × {b} = {tot}. Dan verdelen over {c} planken: {tot} : {c} = {ans}.",
    en: "First count all the books: {a} × {b} = {tot}. Then divide over {c} shelves: {tot} : {c} = {ans}.",
    tr: "Önce tüm kitapları say: {a} × {b} = {tot}. Sonra {c} rafa paylaştır: {tot} : {c} = {ans}."
  },
  "twee-min-deel": {
    v: v => ({ rest: v.a - v.b }),
    nl: "Eerst wat opgegeten is eraf: {a} − {b} = {rest}. Dan de rest verdelen: {rest} : {c} = {ans}.",
    en: "First take off what was eaten: {a} − {b} = {rest}. Then divide the rest: {rest} : {c} = {ans}.",
    tr: "Önce yeneni çıkar: {a} − {b} = {rest}. Sonra kalanı paylaştır: {rest} : {c} = {ans}."
  },
  "twee-verdubbel": {
    v: v => ({ d1: v.a * 2, d2: v.a * 4 }),
    nl: "Verdubbelen is keer 2, en dat gebeurt drie keer: {a} → {d1} → {d2} → {ans}.",
    en: "Doubling is times 2, and it happens three times: {a} → {d1} → {d2} → {ans}.",
    tr: "İki katına çıkarmak 2 ile çarpmaktır ve üç kez oluyor: {a} → {d1} → {d2} → {ans}."
  },
  "twee-korting-deel": {
    v: v => ({ net: v.a - v.b, people: v.c + 1 }),
    nl: "Eerst de korting eraf: {a} − {b} = {net}. Let op: {name} én {c} vrienden zijn samen {people} personen. Dus {net} : {people} = {ans}.",
    en: "First take off the discount: {a} − {b} = {net}. Careful: {name} plus {c} friends makes {people} people. So {net} : {people} = {ans}.",
    tr: "Önce indirimi düş: {a} − {b} = {net}. Dikkat: {name} artı {c} arkadaş, toplam {people} kişi eder. Yani {net} : {people} = {ans}."
  },
  "twee-koop-twee": {
    nl: "Twee dingen samen afrekenen is optellen: {a} + {b} = {ans} euro.",
    en: "Paying for two things together is adding: {a} + {b} = {ans} euros.",
    tr: "İki şeyi birlikte ödemek toplamaktır: {a} + {b} = {ans} euro."
  },
  "kaal-ketting": {
    v: (v, q) => {
      const parts = [];
      let run;
      if (q.variantIdx === 0) { run = v.a + v.b; parts.push(`${v.a} + ${v.b} = ${run}`); run += v.c; parts.push(`+ ${v.c} = ${run}`); run -= v.d; parts.push(`− ${v.d} = ${run}`); }
      else if (q.variantIdx === 1) { run = v.a + v.b; parts.push(`${v.a} + ${v.b} = ${run}`); run -= v.c; parts.push(`− ${v.c} = ${run}`); run += v.d; parts.push(`+ ${v.d} = ${run}`); }
      else if (q.variantIdx === 2) { run = v.a - v.b; parts.push(`${v.a} − ${v.b} = ${run}`); run += v.c; parts.push(`+ ${v.c} = ${run}`); }
      else { run = v.a + v.b; parts.push(`${v.a} + ${v.b} = ${run}`); run += v.c; parts.push(`+ ${v.c} = ${run}`); }
      return { chain: parts.join(", ") };   // pure arithmetic, readable in every language
    },
    nl: "Reken van links naar rechts, één stap tegelijk: {chain}. Zo kom je op {ans}.",
    en: "Work from left to right, one step at a time: {chain}. That brings you to {ans}.",
    tr: "Soldan sağa, her seferinde tek adım hesapla: {chain}. Böylece {ans} bulunur."
  },
  "twee-kassa-drie": {
    v: v => ({ tot: v.a + v.b + v.c }),
    nl: "Eerst alles bij elkaar: {a} + {b} + {c} = {tot} euro. Terugkrijgen is het verschil met wat je gaf: {d} − {tot} = {ans}.",
    en: "First add everything: {a} + {b} + {c} = {tot} euros. Change is the difference from what you paid: {d} − {tot} = {ans}.",
    tr: "Önce hepsini topla: {a} + {b} + {c} = {tot} euro. Para üstü, verdiğinle arasındaki farktır: {d} − {tot} = {ans}."
  },
  "twee-club-ketting": {
    v: v => ({ s1: v.a + v.b, s2: v.a + v.b + v.c }),
    nl: "Erbij, erbij, eraf — stap voor stap: {a} + {b} = {s1}, dan {s1} + {c} = {s2}, dan {s2} − {d} = {ans}.",
    en: "Join, join, leave — step by step: {a} + {b} = {s1}, then {s1} + {c} = {s2}, then {s2} − {d} = {ans}.",
    tr: "Katıl, katıl, ayrıl — adım adım: {a} + {b} = {s1}, sonra {s1} + {c} = {s2}, sonra {s2} − {d} = {ans}."
  },
  "twee-spaar-ketting": {
    v: v => ({ s1: v.a + v.b, s2: v.a + v.b + v.c }),
    nl: "Erbij, erbij, eraf — stap voor stap: {a} + {b} = {s1}, dan {s1} + {c} = {s2}, dan {s2} − {d} = {ans}.",
    en: "In, in, out — step by step: {a} + {b} = {s1}, then {s1} + {c} = {s2}, then {s2} − {d} = {ans}.",
    tr: "Gelen, gelen, giden — adım adım: {a} + {b} = {s1}, sonra {s1} + {c} = {s2}, sonra {s2} − {d} = {ans}."
  },

  /* ===================== KLOKKIJKEN ===================== */
  "klok-woord-digitaal": {
    v: v => ({ hh: v._h, H: v._h + 12 }),
    nl: "'s Middags en 's avonds tel je bij het uur 12 op: {hh} + 12 = {H}. Dus {klok} is {ans} op de digitale klok.",
    en: "In the afternoon and evening you add 12 to the hour: {hh} + 12 = {H}. So {klok} is {ans} on a digital clock.",
    tr: "Öğleden sonra ve akşam, saate 12 eklenir: {hh} + 12 = {H}. Yani {klok}, dijital saatte {ans} olur."
  },
  "klok-duur-vooruit": {
    v: v => ({ chain: chainFwd(v.t, v.a) }),
    nl: "Tel verder via het hele uur: {chain}. Zo eindig je op {ans}.",
    en: "Count on via the full hour: {chain}. You end at {ans}.",
    tr: "Tam saate uğrayarak ilerle: {chain}. Böylece {ans} olur."
  },
  "klok-duur-terug": {
    v: v => ({ chain: chainBack(v.t, v.a) }),
    nl: "Tel terug via het hele uur: {chain}. Het vertrek was dus om {ans}.",
    en: "Count back via the full hour: {chain}. So it left at {ans}.",
    tr: "Tam saate uğrayarak geriye say: {chain}. Demek ki {ans} olur."
  },
  "klok-hoelang": {
    v: v => ({ chain: chainSpan(v.t, v.t2) }),
    nl: "Reken via het hele uur: {chain}. Samen is dat {ans} minuten.",
    en: "Work via the full hour: {chain}. Together that is {ans} minutes.",
    tr: "Tam saat üzerinden hesapla: {chain}. Toplam {ans} dakika eder."
  },
  "klok-omrekenen": {
    v: v => ({ hours: v.a * 60 }),
    nl: "1 uur = 60 minuten. Dus {a} uur = {a} × 60 = {hours} minuten. Tel de losse minuten erbij: {hours} + {b} = {ans}.",
    en: "1 hour = 60 minutes. So {a} hours = {a} × 60 = {hours} minutes. Add the loose minutes: {hours} + {b} = {ans}.",
    tr: "1 saat = 60 dakika. Yani {a} saat = {a} × 60 = {hours} dakika. Kalan dakikaları ekle: {hours} + {b} = {ans}."
  },
  "klok-twee-stappen": {
    v: v => ({ tot: v.a + v.b, chain: chainFwd(v.t, v.a + v.b) }),
    nl: "Eerst de tijden samen: {a} + {b} = {tot} minuten. Tel dan {tot} minuten verder: {chain}. Thuis om {ans}.",
    en: "First add the times: {a} + {b} = {tot} minutes. Then count {tot} minutes on: {chain}. Home at {ans}.",
    tr: "Önce süreleri topla: {a} + {b} = {tot} dakika. Sonra {tot} dakika ilerle: {chain}. Eve varış: {ans}."
  },

  /* ===================== VERRASSING ===================== */
  "verr-briefjes": {
    v: v => ({ h: v.a * 100, tt: v.b * 10 }),
    nl: "Reken per soort: {a} × 100 = {h}, {b} × 10 = {tt}, en nog {c} losse euro's. Samen: {h} + {tt} + {c} = {ans}.",
    en: "Count per kind: {a} × 100 = {h}, {b} × 10 = {tt}, and {c} loose euros. Together: {h} + {tt} + {c} = {ans}.",
    tr: "Tür tür hesapla: {a} × 100 = {h}, {b} × 10 = {tt}, ve {c} tane 1 euro. Toplam: {h} + {tt} + {c} = {ans}."
  },
  "verr-rekening": {
    nl: "Tel de drie bedragen op: € {a} + € {b} + € {c}. Tel eerst de hele euro's, dan de centen. Samen is dat {ans}.",
    en: "Add the three amounts: € {a} + € {b} + € {c}. First the whole euros, then the cents. Together that is {ans}.",
    tr: "Üç tutarı topla: € {a} + € {b} + € {c}. Önce tam euroları, sonra sentleri topla. Toplam {ans} eder."
  },
  "verr-welkesom": [
    { nl: "De zieke kinderen zijn thuis, dus die gaan van de klas af. Eraf is min: de som is {ans}.",
      en: "The sick children are at home, so they come off the class. Off means minus: the sum is {ans}.",
      tr: "Hasta çocuklar evde, yani sınıftan çıkarılırlar. Çıkarmak eksidir: işlem {ans} olur." },
    { nl: "Er komen stickers bíj, dus je telt op. Erbij is plus: de som is {ans}.",
      en: "Stickers are added, so you add. More means plus: the sum is {ans}.",
      tr: "Çıkartmalar ekleniyor, yani toplarsın. Eklemek artıdır: işlem {ans} olur." }
  ],
  "verr-schatten": {
    v: v => ({ s: v.a + v.b }),
    nl: "Reken eerst precies: {a} + {b} = {s}. Rond dan af op het dichtstbijzijnde honderdtal: {s} wordt {ans}.",
    en: "First work it out exactly: {a} + {b} = {s}. Then round to the nearest hundred: {s} becomes {ans}.",
    tr: "Önce tam hesapla: {a} + {b} = {s}. Sonra en yakın yüzlüğe yuvarla: {s}, {ans} olur."
  },
  "verr-meten-cm": {
    v: v => ({ cm: v.a * 100 }),
    nl: "1 meter = 100 centimeter, dus {a} meter = {cm} cm. Dan het stuk eraf: {cm} − {b} = {ans} cm.",
    en: "1 metre = 100 centimetres, so {a} metres = {cm} cm. Then take off the piece: {cm} − {b} = {ans} cm.",
    tr: "1 metre = 100 santimetre, yani {a} metre = {cm} cm. Sonra kesileni çıkar: {cm} − {b} = {ans} cm."
  },
  "verr-gewicht": [
    { nl: "Het zijn {a} pakken van elk {b} gram. Gelijke pakken is keer: {a} × {b} = {ans} gram.",
      en: "There are {a} bags of {b} grams each. Equal bags means times: {a} × {b} = {ans} grams.",
      tr: "Her biri {b} gram olan {a} paket var. Eşit paketler çarpmadır: {a} × {b} = {ans} gram." },
    { nl: "1 kilo = 1000 gram. Dus {a} kilo = {a} × 1000 = {ans} gram.",
      en: "1 kilo = 1000 grams. So {a} kilos = {a} × 1000 = {ans} grams.",
      tr: "1 kilo = 1000 gram. Yani {a} kilo = {a} × 1000 = {ans} gram." }
  ],
  "verr-prijslijst": {
    v: v => ({ p1: v.a * v.c, p2: v.b * v.d }),
    nl: "Reken per soort. Pennen: {c} × {a} = {p1} euro. Schriften: {d} × {b} = {p2} euro. Samen: {p1} + {p2} = {ans} euro.",
    en: "Work it out per kind. Pens: {c} × {a} = {p1} euros. Notebooks: {d} × {b} = {p2} euros. Together: {p1} + {p2} = {ans} euros.",
    tr: "Tür tür hesapla. Kalemler: {c} × {a} = {p1} euro. Defterler: {d} × {b} = {p2} euro. Toplam: {p1} + {p2} = {ans} euro."
  }
};

/* Eén regel hulp per som — de 💡.

   A hint is not half an answer. It says what KIND of som this is and which
   operation the story is hiding, in the child's own words, and then gets out
   of the way. The numbers stay the child's job. Free to use; quietly noted,
   so the report card can show where help was wanted. */
const HINTS = {

  /* ---- optellen: something comes on top of something ---- */
  "opt-sparen-krijgt": {
    nl: "Er komt geld bíj. Erbij = optellen (+).",
    en: "Money is ADDED on top. More means plus (+).",
    tr: "Paranın üstüne para geliyor. Üstüne gelmek = toplama (+)." },
  "opt-voorraad": {
    nl: "Er waren al pakken, en er komen nieuwe bij. Samen tellen = optellen (+).",
    en: "There were packs, and new ones arrive. Counting together = adding (+).",
    tr: "Zaten paket vardı, yenileri geliyor. Hepsini saymak = toplama (+)." },
  "opt-twee-collecties": {
    nl: "Twee groepen, één verzameling. Alles samen = optellen (+).",
    en: "Two groups, one collection. All together = adding (+).",
    tr: "İki grup, tek koleksiyon. Hepsi birlikte = toplama (+)." },
  "opt-dagdeel": {
    nl: "Eerst een deel, later nog een deel. Samen = optellen (+).",
    en: "First one part, later another. Together = adding (+).",
    tr: "Önce bir kısım, sonra bir kısım daha. Toplam = toplama (+)." },
  "opt-tellen-vooruit": {
    nl: "Tel vier keer dezelfde sprong vooruit. Stap voor stap: {a}, en dan vier sprongen van {b}.",
    en: "Count on with the same jump, four times. Step by step: {a}, then four jumps of {b}.",
    tr: "Aynı adımla dört kez ileri say. Adım adım: {a}, sonra dört kez {b} ekle." },
  "opt-club-erbij": {
    nl: "Er komen leden bíj de club. Erbij = optellen (+).",
    en: "Members JOIN the club. Joining = adding (+).",
    tr: "Kulübe üye katılıyor. Katılmak = toplama (+)." },

  /* ---- aftrekken: something goes away, or a difference is asked ---- */
  "aft-vrijlaten": {
    nl: "Er gaan vogels wég. Weg = eraf halen (−).",
    en: "Birds LEAVE. Leaving = taking away (−).",
    tr: "Kuşlar gidiyor. Gitmek = çıkarma (−)." },
  "aft-korting-verschil": {
    nl: "„Hoeveel goedkoper?” vraagt naar het VERSCHIL: grote prijs min kleine prijs (−).",
    en: "\"How much cheaper?\" asks for the DIFFERENCE: big price minus small price (−).",
    tr: "\"Ne kadar ucuzladı?\" FARKI sorar: büyük fiyattan küçüğü çıkar (−)." },
  "aft-nog-doen": {
    nl: "Wat al klaar is hoeft niet meer. Haal het eraf (−).",
    en: "What is already done is out of the way. Take it off (−).",
    tr: "Biten kısım işten düşer. Onu çıkar (−)." },
  "aft-verliezen": {
    nl: "Verliezen betekent kwijtraken. Kwijt = eraf (−).",
    en: "Losing means they are gone. Gone = minus (−).",
    tr: "Kaybetmek elden gitmek demek. Giden = çıkarma (−)." },
  "aft-tellen-terug": {
    nl: "Tel vier keer dezelfde sprong terúg. Start bij {a} en spring vier keer {b} omlaag.",
    en: "Count BACK with the same jump, four times. Start at {a}, jump down {b} four times.",
    tr: "Aynı adımla dört kez geriye say. {a}'dan başla, dört kez {b} çıkar." },
  "aft-helft": {
    nl: "De helft = verdelen in twee gelijke stukken. Welk getal past twee keer in {a}?",
    en: "Half = two equal parts. What number fits twice into {a}?",
    tr: "Yarısı = iki eşit parça. Hangi sayı {a} içinde iki kez var?" },
  "aft-restant-bellen": {
    nl: "Gebruikte minuten zijn óp. Haal ze van het totaal af (−).",
    en: "Used minutes are gone. Take them off the total (−).",
    tr: "Kullanılan dakikalar bitti. Toplamdan çıkar (−)." },
  "aft-voordat": {
    nl: "Pas op: je rekent terug in de tijd. Ervóór was er minder — haal de opbrengst eraf (−).",
    en: "Careful: you are going BACK in time. Before, there was less — take the earnings off (−).",
    tr: "Dikkat: zamanda geriye gidiyorsun. Öncesinde daha azdı — kazancı çıkar (−)." },

  /* ---- vermenigvuldigen: equal groups ---- */
  "verm-kisten": {
    nl: "Gelijke kisten met steeds evenveel erin. Gelijke groepen = keer (×).",
    en: "Equal crates with the same amount in each. Equal groups = times (×).",
    tr: "Her kasada aynı sayıda var. Eşit gruplar = çarpma (×)." },
  "verm-dagen-afstand": {
    nl: "Elke dag hetzelfde stuk. Zoveel dagen keer dat stuk (×).",
    en: "The same distance every day. Days times distance (×).",
    tr: "Her gün aynı mesafe. Gün sayısı çarpı mesafe (×)." },
  "verm-rijen": {
    nl: "Rijen met steeds evenveel. Rijen keer wat er in één rij staat (×).",
    en: "Rows with the same amount each. Rows times one row (×).",
    tr: "Her sırada aynı sayıda. Sıra sayısı çarpı bir sıra (×)." },
  "verm-hoofdstukken": {
    nl: "Elk hoofdstuk evenveel sommen. Hoofdstukken keer sommen (×).",
    en: "Each chapter has the same number of sums. Chapters times sums (×).",
    tr: "Her bölümde eşit soru. Bölüm sayısı çarpı soru (×)." },
  "verm-loten": {
    nl: "Elk lot kost hetzelfde. Aantal loten keer de prijs (×).",
    en: "Every ticket costs the same. Tickets times the price (×).",
    tr: "Her biletin fiyatı aynı. Bilet sayısı çarpı fiyat (×)." },
  "verm-cola-halve": {
    nl: "€ 1,50 = 1 euro + 50 cent. Reken de euro's en de halve euro's apart.",
    en: "€ 1.50 = 1 euro + 50 cents. Count the euros and the half-euros separately.",
    tr: "€ 1,50 = 1 euro + 50 sent. Euroları ve yarım euroları ayrı hesapla." },

  /* ---- delen: sharing out, or how-many-fit ---- */
  "deel-eerlijk": {
    nl: "Eerlijk verdelen over de honden = delen (:).",
    en: "Sharing fairly among the dogs = dividing (:).",
    tr: "Köpeklere eşit paylaştırmak = bölme (:)." },
  "deel-hoeveel-groepen": {
    nl: "Hoe vaak past een groepje van {b} in {a}? Passen = delen (:).",
    en: "How many groups of {b} fit into {a}? Fitting = dividing (:).",
    tr: "{a} içinde {b} kişilik kaç grup var? Sığdırmak = bölme (:)." },
  "deel-per-stuk": {
    nl: "Het totaal wordt verdeeld over de kinderen. Per stuk = delen (:).",
    en: "The total is shared by the children. Each = dividing (:).",
    tr: "Toplam, çocuklara bölünüyor. Kişi başı = bölme (:)." },
  "deel-boeken-dozen": {
    nl: "Alles eerlijk over de dozen. Verdelen = delen (:).",
    en: "Everything shared over the boxes. Sharing = dividing (:).",
    tr: "Hepsi kutulara eşit dağıtılıyor. Paylaştırmak = bölme (:)." },
  "deel-vullen-vol": {
    nl: "Hoe vaak past {b} in {a}? Alleen de VOLLE doosjes tellen.",
    en: "How many times does {b} fit into {a}? Only FULL boxes count.",
    tr: "{b}, {a} içine kaç kez sığar? Sadece DOLU kutular sayılır." },
  "deel-rest-over": {
    nl: "Vul eerst zoveel mogelijk volle zakjes. De vraag is wat er daarna OVERBLIJFT.",
    en: "First fill as many full bags as you can. The question is what is LEFT OVER.",
    tr: "Önce olabildiğince tam paket yap. Soru, geriye NE KALDIĞI." },
  "deel-prijs-aantal": {
    nl: "Hoe vaak past € 2,50 in het totaal? Tip: twee bakjes samen zijn € 5.",
    en: "How many times does € 2.50 fit into the total? Tip: two portions make € 5.",
    tr: "€ 2,50 toplamın içine kaç kez sığar? İpucu: iki porsiyon € 5 eder." },

  /* ---- tweestap: two operations, in order ---- */
  "twee-min-min": {
    nl: "Twee dingen worden gekocht, allebei eraf. Eerst het één eraf, dan het ander (− −).",
    en: "Two things are bought, both come off. Take off one, then the other (− −).",
    tr: "İki şey harcanıyor, ikisi de düşülür. Önce birini, sonra öbürünü çıkar (− −)." },
  "twee-deel-min": {
    nl: "Twee stappen: éérst verdelen (:), dán wat opgegeten is eraf (−).",
    en: "Two steps: FIRST divide (:), THEN take off what was eaten (−).",
    tr: "İki adım: ÖNCE paylaştır (:), SONRA yeneni çıkar (−)." },
  "twee-deel-plus": {
    nl: "Twee stappen: éérst verdelen (:), dán komt er per bakje wat bij (+).",
    en: "Two steps: FIRST divide (:), THEN some are added to each tub (+).",
    tr: "İki adım: ÖNCE paylaştır (:), SONRA her kaba ekle (+)." },
  "twee-bus": {
    nl: "Bij elke halte stappen er mensen úit. Haal ze er één halte tegelijk af (−).",
    en: "People get OFF at each stop. Take them off one stop at a time (−).",
    tr: "Her durakta insanlar iniyor. Durak durak çıkar (−)." },
  "twee-maal-deel": {
    nl: "Éérst alle boeken tellen (×), dán over de planken verdelen (:).",
    en: "FIRST count all the books (×), THEN divide over the shelves (:).",
    tr: "ÖNCE tüm kitapları say (×), SONRA raflara paylaştır (:)." },
  "twee-min-deel": {
    nl: "Éérst wat opgegeten is eraf (−), dán de rest verdelen (:).",
    en: "FIRST take off what was eaten (−), THEN divide the rest (:).",
    tr: "ÖNCE yeneni çıkar (−), SONRA kalanı paylaştır (:)." },
  "twee-verdubbel": {
    nl: "Verdubbelen = keer 2. Het gebeurt drie keer achter elkaar: vader, oom, opa.",
    en: "Doubling = times 2. It happens three times in a row: dad, uncle, grandpa.",
    tr: "İki katı = 2 ile çarp. Üç kez üst üste oluyor: baba, amca, dede." },
  "twee-korting-deel": {
    nl: "Eerst de korting eraf (−). En let op: {name} doet zélf ook mee met betalen!",
    en: "First take the discount off (−). And careful: {name} also pays a share!",
    tr: "Önce indirimi düş (−). Ve dikkat: {name} de ödemeye katılıyor!" },
  "twee-koop-twee": {
    nl: "Twee prijzen, samen afrekenen. Samen = optellen (+).",
    en: "Two prices, paid together. Together = adding (+).",
    tr: "İki fiyat, birlikte ödeniyor. Birlikte = toplama (+)." },
  "kaal-ketting": {
    nl: "Reken van links naar rechts, één stap tegelijk. Schrijf elke tussenstap op.",
    en: "Work from left to right, one step at a time. Write down each step.",
    tr: "Soldan sağa, her seferinde tek işlem. Her ara sonucu not et." },
  "twee-kassa-drie": {
    nl: "Eerst alles wat gekocht is optellen (+). Terugkrijgen = betaald min totaal (−).",
    en: "First add up everything bought (+). Change = paid minus total (−).",
    tr: "Önce alınanları topla (+). Para üstü = verilen eksi toplam (−)." },
  "twee-club-ketting": {
    nl: "Erbij, erbij, eraf — in die volgorde. Eén stap tegelijk.",
    en: "Join, join, leave — in that order. One step at a time.",
    tr: "Katılan, katılan, ayrılan — bu sırayla. Adım adım." },
  "twee-spaar-ketting": {
    nl: "Erbij, erbij, eraf — in die volgorde. Eén stap tegelijk.",
    en: "In, in, out — in that order. One step at a time.",
    tr: "Gelen, gelen, giden — bu sırayla. Adım adım." },

  /* ---- klok ---- */
  "klok-woord-digitaal": {
    nl: "'s Middags en 's avonds: tel 12 bij het uur op. En pas op met „half”: half zes is vóór zes.",
    en: "Afternoon and evening: add 12 to the hour. And careful with \"half past\".",
    tr: "Öğleden sonra ve akşam: saate 12 ekle. \"Buçuk\"lara dikkat." },
  "klok-duur-vooruit": {
    nl: "Tel vooruit via het hele uur: eerst tot het hele uur, dan de rest.",
    en: "Count on via the full hour: first up to the whole hour, then the rest.",
    tr: "Tam saate uğrayarak ilerle: önce tam saate kadar, sonra kalanı." },
  "klok-duur-terug": {
    nl: "Dit gaat TERUG in de tijd: de aankomst is het einde, jij zoekt het begin.",
    en: "This goes BACK in time: the arrival is the end, you want the start.",
    tr: "Bu soru GERİYE gider: varış son, sen başlangıcı arıyorsun." },
  "klok-hoelang": {
    nl: "Reken via het hele uur: van begin tot het hele uur, en dan verder tot het einde.",
    en: "Work via the full hour: start to the whole hour, then on to the end.",
    tr: "Tam saat üzerinden hesapla: baştan tam saate, oradan sona." },
  "klok-omrekenen": {
    nl: "1 uur = 60 minuten. Eerst de uren omrekenen, dan de losse minuten erbij.",
    en: "1 hour = 60 minutes. Convert the hours first, then add the loose minutes.",
    tr: "1 saat = 60 dakika. Önce saatleri çevir, sonra kalan dakikaları ekle." },
  "klok-twee-stappen": {
    nl: "Twee stukken tijd achter elkaar. Tel ze eerst samen, en tel dan pas verder op de klok.",
    en: "Two stretches of time, one after the other. Add them first, then count on.",
    tr: "Peş peşe iki süre. Önce ikisini topla, sonra saatte ilerle." },

  /* ---- verrassing ---- */
  "verr-briefjes": {
    nl: "Reken per soort: eerst de honderdjes, dan de tientjes, dan de losse euro's.",
    en: "Count per kind: hundreds first, then tens, then loose euros.",
    tr: "Tür tür say: önce yüzlükler, sonra onluklar, sonra tek eurolar." },
  "verr-rekening": {
    nl: "Drie bedragen bij elkaar. Tel eerst de hele euro's, dan de centen.",
    en: "Three amounts together. Add the whole euros first, then the cents.",
    tr: "Üç tutar toplanacak. Önce tam euroları, sonra sentleri topla." },
  "verr-welkesom": [
    { nl: "De zieke kinderen zijn NIET op school. Gaan ze erbij of eraf?",
      en: "The sick children are NOT at school. Do they come on or off?",
      tr: "Hasta çocuklar okulda DEĞİL. Eklenir mi, çıkarılır mı?" },
    { nl: "Er komen stickers BIJ. Komt er dan een plus of een min?",
      en: "Stickers are ADDED. Does that make a plus or a minus?",
      tr: "Çıkartmalar EKLENİYOR. Artı mı olur, eksi mi?" } ],
  "verr-schatten": {
    nl: "Eerst gewoon uitrekenen, daarna afronden op het dichtstbijzijnde honderdtal.",
    en: "Work it out exactly first, then round to the nearest hundred.",
    tr: "Önce normal hesapla, sonra en yakın yüzlüğe yuvarla." },
  "verr-meten-cm": {
    nl: "Zet eerst alles in centimeters: 1 meter = 100 cm. Dan pas eraf halen.",
    en: "Put everything in centimetres first: 1 metre = 100 cm. Then take off.",
    tr: "Önce her şeyi santimetreye çevir: 1 metre = 100 cm. Sonra çıkar." },
  "verr-gewicht": [
    { nl: "Gelijke pakken = keer (×). Aantal pakken keer het gewicht van één pak.",
      en: "Equal bags = times (×). Bags times the weight of one bag.",
      tr: "Eşit paketler = çarpma (×). Paket sayısı çarpı bir paketin ağırlığı." },
    { nl: "1 kilo = 1000 gram. Hoeveel keer 1000 is dat hier?",
      en: "1 kilo = 1000 grams. How many thousands is that here?",
      tr: "1 kilo = 1000 gram. Burada kaç kez 1000 var?" } ],
  "verr-prijslijst": {
    nl: "Twee soorten apart uitrekenen: eerst alle pennen (×), dan alle schriften (×), dan samen (+).",
    en: "Work out each kind on its own: all pens (×), all notebooks (×), then together (+).",
    tr: "İki türü ayrı hesapla: önce kalemler (×), sonra defterler (×), sonra topla (+)." }
};
