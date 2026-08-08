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
