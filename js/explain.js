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


/* De 💡 — hulp bij het BEGRIJPEN, niet bij het rekenen.

   Deze sommen zijn redactiesommen: het rekenwerk is zelden het probleem, het
   verhaal is dat. Een hint die "eerst keer, dan delen" zegt geeft een recept
   zonder inzicht — het kind volgt de stappen en snapt de volgende som net zo
   min. Daarom staat hier geen recept maar de redenering: wat weet je, wat
   wordt er eigenlijk gevraagd, en waar zit het addertje.

   De getallen blijven het werk van het kind. */
const HINTS = {

  /* ---- optellen ---- */
  "opt-sparen-krijgt": {
    nl: "Er is een beginbedrag, en daar komt iets bovenop. Gevraagd wordt de stand aan het eind — het eerste getal blijft dus gewoon staan, er komt alleen iets bij.",
    en: "There is a starting amount, and something comes on top of it. The question asks where you end up — the first number stays, something is only added to it.",
    tr: "Bir başlangıç miktarı var, üstüne bir şey ekleniyor. Soru sonundaki durumu istiyor — ilk sayı olduğu gibi kalır, sadece üzerine eklenir." },
  "opt-voorraad": {
    nl: "Er lag al voorraad en er komt nieuwe bij. Beide getallen horen bij hetzelfde soort ding, dus kun je ze bij elkaar leggen.",
    en: "There is stock already and new stock arrives. Both numbers count the same kind of thing, so they can be put together.",
    tr: "Zaten stok vardı, yenisi geldi. İki sayı da aynı şeyi sayıyor, o yüzden bir araya konabilirler." },
  "opt-twee-collecties": {
    nl: "Eén verzameling, verdeeld in twee soorten. De vraag gaat over de hele verzameling, dus de twee stukken horen weer aan elkaar geplakt.",
    en: "One collection, split into two kinds. The question is about the whole collection, so the two parts belong back together.",
    tr: "Tek bir koleksiyon, iki türe ayrılmış. Soru koleksiyonun tamamını istiyor, yani iki parça yeniden birleşmeli." },
  "opt-dagdeel": {
    nl: "Twee momenten, twee getallen, en de vraag gaat over allebei samen. Let op: het tweede getal komt erbíj, het vervangt het eerste niet.",
    en: "Two moments, two numbers, and the question covers both. Careful: the second number is added to the first, it does not replace it.",
    tr: "İki ayrı an, iki sayı; soru ikisini birden istiyor. Dikkat: ikinci sayı birincinin üstüne eklenir, onun yerine geçmez." },
  "opt-tellen-vooruit": {
    nl: "Vier sprongen, elke sprong even groot. Je kunt ze één voor één maken, maar sneller is: reken uit hoe groot vier sprongen samen zijn en doe het in één keer.",
    en: "Four jumps, each the same size. You can take them one at a time, but it is quicker to work out how far four jumps go together and do it in one step.",
    tr: "Dört adım, hepsi eşit. Tek tek atabilirsin ama daha hızlısı: dört adımın toplamda ne kadar ettiğini bul ve tek seferde ekle." },
  "opt-club-erbij": {
    nl: "De club heeft al leden en er komen er nieuwe bij. De oude leden gaan niet weg — die tellen gewoon mee.",
    en: "The club already has members and new ones join. The old members do not leave — they still count.",
    tr: "Kulüpte zaten üyeler var, yenileri katılıyor. Eskiler gitmiyor — onlar da sayılır." },

  /* ---- aftrekken ---- */
  "aft-vrijlaten": {
    nl: "Er was een groep en daar gaat een deel uit. Gevraagd wordt wat er achterblijft, dus je zoekt de rest van de groep.",
    en: "There was a group and part of it leaves. The question is what stays behind, so you are looking for the rest of the group.",
    tr: "Bir grup vardı, bir kısmı ayrıldı. Soru geriye kalanı istiyor — yani grubun kalan kısmını arıyorsun." },
  "aft-korting-verschil": {
    nl: "Er staan twee prijzen: die van vroeger en die van nu. De vraag is niet wat je betaalt, maar hoeveel je bespaart — dat is het gat tussen die twee getallen.",
    en: "Two prices are given: the old one and the new one. The question is not what you pay, but how much you save — that is the gap between the two numbers.",
    tr: "İki fiyat var: eski ve yeni. Soru ne ödediğini değil, ne kadar kâr ettiğini soruyor — yani iki sayı arasındaki boşluğu." },
  "aft-nog-doen": {
    nl: "Er is een totaal dat af moet, en een deel is al gedaan. Wat af is hoeft niet meer, dus dat gaat van het totaal af.",
    en: "There is a total that must be done, and part of it is finished. What is finished no longer counts, so it comes off the total.",
    tr: "Yapılması gereken bir toplam var, bir kısmı bitmiş. Biten kısım artık iş değil, o yüzden toplamdan düşer." },
  "aft-verliezen": {
    nl: "Je begint met een aantal en raakt er onderweg een deel van kwijt. Gevraagd wordt wat je nog in handen hebt.",
    en: "You start with an amount and lose part of it along the way. The question is what you still hold.",
    tr: "Bir sayıyla başlıyorsun ve yolda bir kısmını kaybediyorsun. Soru elinde ne kaldığını istiyor." },
  "aft-tellen-terug": {
    nl: "Vier sprongen, maar deze keer de andere kant op. Elke sprong is even groot — reken ze samen uit, dan hoef je maar één keer terug te tellen.",
    en: "Four jumps, but this time the other way. Every jump is the same size — add them up and you only have to count back once.",
    tr: "Dört adım, ama bu kez ters yöne. Her adım eşit — toplamını bul, o zaman bir kez geriye saymak yeter." },
  "aft-helft": {
    nl: "De helft gaat weg, dus de andere helft blijft staan — en die twee zijn even groot. Zoek het getal dat precies twee keer in {a} past.",
    en: "Half goes, so the other half stays — and those two are the same size. Find the number that fits exactly twice into {a}.",
    tr: "Yarısı gidiyor, yarısı kalıyor — ve bu ikisi eşit. {a} içine tam iki kez sığan sayıyı bul." },
  "aft-restant-bellen": {
    nl: "Er is een maximum, en een deel daarvan is opgebruikt. Wat op is kun je niet meer gebruiken, dus dat gaat van het maximum af.",
    en: "There is a maximum, and part of it is used up. What is gone cannot be used again, so it comes off the maximum.",
    tr: "Bir üst sınır var ve bir kısmı harcanmış. Harcanan geri gelmez, o yüzden sınırdan düşer." },
  "aft-voordat": {
    nl: "Let op de volgorde! Het bedrag dat je krijgt is van NÁ de markt. De vraag gaat over ervóór — en toen zat de opbrengst er nog niet bij.",
    en: "Watch the order! The amount you are given is from AFTER the sale. The question is about before — and back then the earnings were not in there yet.",
    tr: "Sıralamaya dikkat! Verilen tutar pazardan SONRAKİ. Soru öncesini istiyor — o sırada kazanç henüz kasada değildi." },

  /* ---- vermenigvuldigen ---- */
  "verm-kisten": {
    nl: "Alle kisten zijn hetzelfde gevuld. Je hoeft dus niet kist voor kist te tellen: als je weet wat er in één kist zit, weet je genoeg.",
    en: "Every crate holds the same amount. You do not have to count crate by crate: knowing one crate is enough.",
    tr: "Bütün kasalarda aynı sayıda var. Tek tek saymana gerek yok: bir kasayı bilmek yeter." },
  "verm-dagen-afstand": {
    nl: "Elke dag precies dezelfde afstand. Dat is steeds hetzelfde stukje, zoveel keer herhaald als er dagen zijn.",
    en: "The same distance every single day. It is one piece, repeated as many times as there are days.",
    tr: "Her gün tam olarak aynı mesafe. Aynı parça, gün sayısı kadar tekrarlanıyor." },
  "verm-rijen": {
    nl: "Alle rijen zijn even lang — dat is het hele idee. Weet je wat er in één rij staat, dan hoef je alleen nog te weten hoeveel rijen er zijn.",
    en: "Every row is the same length — that is the whole point. If you know one row, you only need to know how many rows there are.",
    tr: "Bütün sıralar eşit uzunlukta — bütün mesele bu. Bir sırayı bilirsen, geriye sadece kaç sıra olduğunu bilmek kalır." },
  "verm-hoofdstukken": {
    nl: "Ieder hoofdstuk heeft evenveel sommen. Zoek eerst wat er in één hoofdstuk zit, en bedenk dan hoe vaak dat terugkomt.",
    en: "Every chapter has the same number of sums. Find what is in one chapter first, then think how often that repeats.",
    tr: "Her bölümde eşit sayıda soru var. Önce bir bölümde ne olduğuna bak, sonra bunun kaç kez tekrarlandığını düşün." },
  "verm-loten": {
    nl: "Elk lot brengt hetzelfde op. De opbrengst van één lot, zo vaak als er loten verkocht zijn.",
    en: "Every ticket brings in the same. One ticket's takings, as many times as tickets were sold.",
    tr: "Her bilet aynı parayı getiriyor. Bir biletin getirisi, satılan bilet sayısı kadar." },
  "verm-cola-halve": {
    nl: "€ 1,50 is een lastig getal om mee te rekenen. Splits het: elk flesje is 1 hele euro én een halve. Reken die twee apart uit en leg ze aan het eind bij elkaar.",
    en: "€ 1.50 is an awkward number to work with. Split it: each bottle is 1 whole euro plus a half. Work those two out separately and put them together at the end.",
    tr: "€ 1,50 ile hesap yapmak zor. Böl: her şişe 1 tam euro artı yarım euro. İkisini ayrı hesapla, sonunda birleştir." },

  /* ---- delen ---- */
  "deel-eerlijk": {
    nl: "Eerlijk delen betekent: iedereen precies evenveel, en er blijft niets liggen. Je zoekt dus hoe vaak het aantal honden in de hele stapel past.",
    en: "Sharing fairly means: everyone gets exactly the same, and nothing is left. So you are looking for how many times the number of dogs fits into the whole pile.",
    tr: "Eşit paylaşmak demek: herkese tam olarak aynı, geriye hiçbir şey kalmıyor. Yani köpek sayısının tüm yığına kaç kez sığdığını arıyorsun." },
  "deel-hoeveel-groepen": {
    nl: "Niet iedereen past in één busje, dus er zijn er meer nodig. De vraag is hoe vaak zo'n vol busje van de groep af kan — net zolang tot er niemand meer staat.",
    en: "Not everyone fits in one van, so more are needed. The question is how many times a full van can be taken out of the group — until nobody is left standing.",
    tr: "Herkes tek minibüse sığmıyor, daha fazlası gerek. Soru: gruptan kaç kez dolu bir minibüs çıkarılabilir — kimse kalmayana kadar." },
  "deel-per-stuk": {
    nl: "Je weet wat álles samen kost, en met hoeveel ze zijn. Gevraagd wordt de prijs van één — dus het totaal moet eerlijk over iedereen verdeeld worden.",
    en: "You know what everything costs together, and how many they are. The question asks the price of one — so the total has to be shared out evenly.",
    tr: "Hepsinin toplam fiyatını ve kaç kişi olduklarını biliyorsun. Soru bir tanesinin fiyatını istiyor — yani toplam herkese eşit dağıtılmalı." },
  "deel-boeken-dozen": {
    nl: "Alles moet weg, en elke doos krijgt evenveel. Je zoekt wat er in één doos terechtkomt, niet hoeveel dozen er zijn.",
    en: "Everything has to be packed, and every box gets the same. You want what ends up in one box, not how many boxes there are.",
    tr: "Hepsi paketlenecek ve her kutuya eşit gidecek. Aradığın: bir kutuya ne düştüğü — kaç kutu olduğu değil." },
  "deel-vullen-vol": {
    nl: "Er zijn er méér dan er precies in hele doosjes passen. En let op het woord VOL: een doosje dat maar half gevuld is telt niet mee.",
    en: "There are more than fit neatly into whole boxes. And mind the word FULL: a box that is only half filled does not count.",
    tr: "Tam kutulara sığandan fazlası var. Ve DOLU kelimesine dikkat: yarı dolu bir kutu sayılmaz." },
  "deel-rest-over": {
    nl: "Deze vraag gaat níét over hoeveel zakjes je krijgt. Vul in gedachten zoveel mogelijk volle zakjes, en kijk dan naar wat er in je hand overblijft.",
    en: "This question is NOT about how many bags you get. Fill as many full bags as you can in your head, then look at what is left in your hand.",
    tr: "Bu soru kaç paket olduğunu sormuyor. Zihninde olabildiğince çok tam paket doldur, sonra elinde ne kaldığına bak." },
  "deel-prijs-aantal": {
    nl: "€ 2,50 is een vervelend getal om door te delen. Maar twee bakjes samen zijn precies € 5 — en met vijven rekenen gaat een stuk makkelijker.",
    en: "€ 2.50 is an awkward number to divide by. But two portions together are exactly € 5 — and counting in fives is much easier.",
    tr: "€ 2,50 ile bölmek zahmetli. Ama iki porsiyon tam € 5 eder — beşerli saymak çok daha kolay." },

  /* ---- tweestap ---- */
  "twee-min-min": {
    nl: "Er wordt twee keer iets uitgegeven van hetzelfde bedrag. Beide uitgaven gaan eraf — de tweede van wat er ná de eerste nog over was.",
    en: "Money is spent twice out of the same amount. Both go off — the second one from what was left after the first.",
    tr: "Aynı paradan iki kez harcama yapılıyor. İkisi de düşer — ikincisi, birincisinden sonra kalandan." },
  "twee-deel-min": {
    nl: "Twee dingen gebeuren na elkaar. Je weet nog niet wat er op één schaal ligt — dat moet je eerst uitzoeken, want pas dáárvan wordt er gegeten.",
    en: "Two things happen one after the other. You do not know yet what is on one plate — find that first, because it is from that plate that snacks are eaten.",
    tr: "İki şey arka arkaya oluyor. Bir tabakta ne olduğunu henüz bilmiyorsun — önce onu bul, çünkü yenilenler o tabaktan." },
  "twee-deel-plus": {
    nl: "Eerst wordt alles verdeeld, en pas daarna komt er per bakje iets bij. De vraag gaat over de stand aan het eind, dus je hebt allebei de stappen nodig.",
    en: "First everything is shared out, and only then does each tub get some more. The question is about the end state, so you need both steps.",
    tr: "Önce her şey paylaştırılıyor, ancak sonra her kaba ekleme yapılıyor. Soru sondaki durumu istiyor, yani iki adım da gerekli." },
  "twee-bus": {
    nl: "Bij elke halte verandert het aantal — en altijd naar beneden. Doe het halte voor halte in plaats van alles tegelijk, dan raak je niet in de war.",
    en: "The number changes at every stop — and always downwards. Do it stop by stop instead of all at once, and you will not get muddled.",
    tr: "Her durakta sayı değişiyor — ve hep azalıyor. Hepsini birden değil, durak durak yap; o zaman karışmaz." },
  "twee-maal-deel": {
    nl: "Je weet hoeveel dozen er zijn en wat er in één doos zit — maar niet hoeveel boeken er in totaal zijn. Dat getal moet je eerst hebben, want dát wordt over de planken verdeeld.",
    en: "You know how many boxes there are and what is in one box — but not how many books there are altogether. You need that number first, because that is what gets shared over the shelves.",
    tr: "Kaç kutu olduğunu ve bir kutuda ne olduğunu biliyorsun — ama toplam kaç kitap olduğunu bilmiyorsun. Önce o sayı lazım, çünkü raflara paylaştırılan o." },
  "twee-min-deel": {
    nl: "Niet alles wordt verdeeld! Er gaat eerst een deel af, en pas wat daarna overblijft gaat naar de borden.",
    en: "Not everything gets shared out! Some go first, and only what is left after that goes onto the plates.",
    tr: "Her şey paylaştırılmıyor! Önce bir kısmı gidiyor, tabaklara ancak ondan sonra kalan dağıtılıyor." },
  "twee-verdubbel": {
    nl: "Verdubbelen gebeurt drie keer achter elkaar, en elke keer over het níeuwe bedrag — niet over het bedrag van het begin. Het groeit dus sneller dan je denkt.",
    en: "The doubling happens three times in a row, and each time on the NEW amount — not on the starting amount. So it grows faster than you would think.",
    tr: "İki katına çıkarma üç kez üst üste oluyor ve her seferinde YENİ tutar üzerinden — başlangıç tutarı üzerinden değil. Yani sandığından hızlı büyüyor." },
  "twee-korting-deel": {
    nl: "Eerst wordt de prijs lager, en dat lagere bedrag wordt gedeeld. En tel goed wie er meebetalen: {name} hoort er zelf ook bij, dus het is er één meer dan het aantal vrienden.",
    en: "First the price goes down, and it is that lower amount that gets shared. And count who pays: {name} is one of them too, so it is one more than the number of friends.",
    tr: "Önce fiyat düşüyor, paylaşılan da o düşük tutar. Ve kimlerin ödediğini iyi say: {name} de dahil, yani arkadaş sayısından bir fazla." },
  "twee-koop-twee": {
    nl: "Twee dingen, twee prijzen, één kassa. Je zoekt wat er in totaal betaald wordt.",
    en: "Two things, two prices, one till. You want what is paid in total.",
    tr: "İki şey, iki fiyat, tek kasa. Aradığın toplamda ne ödendiği." },
  "kaal-ketting": {
    nl: "Hier zit geen verhaal in, alleen volgorde. Werk van links naar rechts en schrijf elke tussenuitkomst op — juist bij deze sommen raak je anders halverwege de draad kwijt.",
    en: "There is no story here, only order. Work from left to right and write down each in-between answer — with these it is exactly halfway that you lose track.",
    tr: "Burada hikâye yok, sadece sıra var. Soldan sağa ilerle ve her ara sonucu yaz — bu tür sorularda tam ortada dağılırsın yoksa." },
  "twee-kassa-drie": {
    nl: "Er zijn drie dingen gekocht, maar met één bedrag betaald. Zoek eerst wat het samen kost — anders weet je niet waar het wisselgeld vandaan komt.",
    en: "Three things were bought, but paid for with one amount. Find what they cost together first — otherwise you cannot tell where the change comes from.",
    tr: "Üç şey alındı ama tek bir tutarla ödendi. Önce hepsinin ne ettiğini bul — yoksa para üstünün nereden çıktığını göremezsin." },
  "twee-club-ketting": {
    nl: "Er komen mensen bij en er gaan mensen weg, in die volgorde. Elke verandering geldt voor de stand van dát moment, dus doe ze één voor één.",
    en: "People join and people leave, in that order. Every change applies to the count at that moment, so take them one at a time.",
    tr: "Önce katılanlar, sonra ayrılanlar — bu sırayla. Her değişiklik o anki duruma uygulanır, o yüzden tek tek yap." },
  "twee-spaar-ketting": {
    nl: "Er komt geld bij en er gaat geld af, in die volgorde. Reken stap voor stap door — het bedrag aan het eind hangt van alle stappen samen af.",
    en: "Money comes in and money goes out, in that order. Work through it step by step — the final amount depends on all the steps together.",
    tr: "Önce para giriyor, sonra çıkıyor — bu sırayla. Adım adım ilerle; sondaki tutar bütün adımların birleşimi." },

  /* ---- klok ---- */
  "klok-woord-digitaal": {
    nl: "Twee dingen tegelijk. „Half zes” betekent een half uur vóór zes — dus 5 uur en 30 minuten, niet 6.30. En omdat het 's middags of 's avonds is, telt de digitale klok door na twaalf.",
    en: "Two things at once. \"Half past five\" is five o'clock plus thirty minutes. And because it is afternoon or evening, a digital clock keeps counting past twelve.",
    tr: "Aynı anda iki şey. \"Beş buçuk\" beşi otuz geçe demek. Ve öğleden sonra ya da akşam olduğu için, dijital saat on ikiden sonra saymaya devam eder." },
  "klok-duur-vooruit": {
    nl: "Je begint op een tijd en telt een stuk vooruit. Minuten stoppen bij 60 en niet bij 100 — spring daarom eerst naar het hele uur, en tel de rest daarna.",
    en: "You start at a time and count forwards. Minutes stop at 60, not 100 — so jump to the whole hour first, then count the rest.",
    tr: "Bir saatten başlayıp ileri sayıyorsun. Dakikalar 100'de değil 60'ta biter — o yüzden önce tam saate sıçra, kalanı sonra say." },
  "klok-duur-terug": {
    nl: "De tijd die je krijgt is de AANKOMST, dus het einde van de reis. Gevraagd wordt het vertrek, en dat ligt eerder op de dag — je rekent hier dus terug in de tijd.",
    en: "The time you are given is the ARRIVAL — the end of the journey. The question asks about the departure, which is earlier in the day, so here you count backwards.",
    tr: "Verilen saat VARIŞ, yani yolculuğun sonu. Soru kalkışı istiyor ve o daha erken — yani burada zamanda geriye sayıyorsun." },
  "klok-hoelang": {
    nl: "Twee tijden, en gevraagd wordt het stuk ertussen. Reken niet met de losse cijfers, maar spring van de ene tijd naar de andere — via het hele uur gaat dat het makkelijkst.",
    en: "Two times, and the question is the stretch between them. Do not calculate with the loose digits — hop from one time to the other, easiest via the whole hour.",
    tr: "İki saat var, soru aradaki süreyi istiyor. Rakamlarla değil, bir saatten diğerine sıçrayarak hesapla — tam saat üzerinden en kolayı." },
  "klok-omrekenen": {
    nl: "Uren en minuten zijn niet hetzelfde soort getal — je mag ze dus niet achter elkaar zetten. Maak er eerst allemaal minuten van, dan pas kun je optellen.",
    en: "Hours and minutes are not the same kind of number — you cannot just write them next to each other. Turn everything into minutes first, and only then add.",
    tr: "Saat ve dakika aynı tür sayı değil — yan yana yazamazsın. Önce hepsini dakikaya çevir, ancak ondan sonra topla." },
  "klok-twee-stappen": {
    nl: "Er zijn twee stukken tijd achter elkaar, en pas na allebei is {name} thuis. Tel de twee stukken eerst bij elkaar op — dan hoef je maar één keer op de klok verder te tellen.",
    en: "There are two stretches of time one after the other, and only after both is {name} home. Add the two stretches together first — then you only have to move the clock once.",
    tr: "Peş peşe iki süre var; {name} ancak ikisinden sonra evde. Önce iki süreyi topla — o zaman saatte sadece bir kez ilerlemen yeter." },

  /* ---- verrassing ---- */
  "verr-briefjes": {
    nl: "Niet elk briefje is evenveel waard — daar zit hem de vraag. Reken elke soort apart uit en leg die bedragen pas op het eind bij elkaar.",
    en: "Not every note is worth the same — that is the whole question. Work out each kind on its own and only add those amounts at the end.",
    tr: "Her banknot aynı değerde değil — soru tam da bu. Her türü ayrı hesapla, tutarları ancak sonunda topla." },
  "verr-rekening": {
    nl: "Drie bedragen met komma's. Tel eerst alleen de hele euro's bij elkaar, dan alleen de centen — zo raak je de komma niet kwijt.",
    en: "Three amounts with decimals. Add the whole euros first, then the cents on their own — that way you never lose the comma.",
    tr: "Virgüllü üç tutar. Önce sadece tam euroları topla, sonra sadece sentleri — böylece virgülü kaybetmezsin." },
  "verr-welkesom": [
    { nl: "Hier hoef je niets uit te rekenen — je moet de juiste som kiezen. Vraag jezelf af of het er meer of minder worden, dan weet je het teken al.",
      en: "You do not have to calculate here — you have to choose the right sum. Ask yourself whether it becomes more or fewer, and you know the sign.",
      tr: "Burada hesap yapmana gerek yok — doğru işlemi seçeceksin. Kendine sor: sayı artıyor mu azalıyor mu? İşareti bu belirler." },
    { nl: "Hier hoef je niets uit te rekenen — je moet de juiste som kiezen. Vraag jezelf af of het er meer of minder worden, dan weet je het teken al.",
      en: "You do not have to calculate here — you have to choose the right sum. Ask yourself whether it becomes more or fewer, and you know the sign.",
      tr: "Burada hesap yapmana gerek yok — doğru işlemi seçeceksin. Kendine sor: sayı artıyor mu azalıyor mu? İşareti bu belirler." } ],
  "verr-schatten": {
    nl: "„Ongeveer” betekent: je hoeft niet precies te zijn. Rond elk getal eerst af op een mooi honderdtal — dan kun je de som zo uit je hoofd doen.",
    en: "\"About\" means you do not need to be exact. Round each number to a nice hundred first — then the sum is easy in your head.",
    tr: "\"Yaklaşık\" demek tam olması gerekmiyor demek. Önce her sayıyı güzel bir yüzlüğe yuvarla — sonra işlem kafadan yapılır." },
  "verr-meten-cm": {
    nl: "Er staan twee verschillende maten in de som: meters en centimeters. Je mag ze niet van elkaar aftrekken zolang ze niet dezelfde maat zijn.",
    en: "The sum uses two different units: metres and centimetres. You cannot take one from the other until they are the same unit.",
    tr: "Soruda iki farklı birim var: metre ve santimetre. Aynı birime çevirmeden birini diğerinden çıkaramazsın." },
  "verr-gewicht": [
    { nl: "Alle pakken wegen evenveel. Je zoekt het gewicht van alles samen, dus het gewicht van één pak komt zo vaak terug als er pakken zijn.",
      en: "Every bag weighs the same. You want the weight of all of them together, so one bag's weight repeats as many times as there are bags.",
      tr: "Bütün paketler eşit ağırlıkta. Hepsinin toplam ağırlığını arıyorsun — yani bir paketin ağırlığı, paket sayısı kadar tekrarlanır." },
    { nl: "Kilo's en grammen zijn twee namen voor gewicht, maar niet even groot: in één kilo zitten er duizend gram. Je zet het dus om naar een kleinere maat.",
      en: "Kilos and grams both measure weight, but they are not the same size: one kilo holds a thousand grams. So you are converting to a smaller unit.",
      tr: "Kilo ve gram ikisi de ağırlık ölçer ama aynı büyüklükte değil: bir kiloda bin gram var. Yani daha küçük bir birime çeviriyorsun." } ],
  "verr-prijslijst": {
    nl: "Twee verschillende dingen met elk hun eigen prijs. Haal ze niet door elkaar: reken eerst één soort helemaal uit, dan de andere, en pas daarna samen.",
    en: "Two different things, each with its own price. Do not mix them up: work one kind out completely, then the other, and only then together.",
    tr: "İki farklı şey, her birinin kendi fiyatı. Karıştırma: önce bir türü baştan sona hesapla, sonra diğerini, en son ikisini topla." }
};
