/* Turkish suffix helper — vowel harmony + buffer letters, with apostrophe for
   proper names. Used only for {name_in} / {name_de} / {name_e} / {name_i} tokens
   in Turkish phrasings, so names read naturally (Milan'ın, Lea'nın, Emma'nın). */
function trEk(name, type) {
  const vowels = "aeıioöuüâîû";
  let lv = "";
  for (let i = name.length - 1; i >= 0; i--) {
    const c = name[i].toLowerCase();
    if (vowels.includes(c)) { lv = c; break; }
  }
  const lastChar = name[name.length - 1].toLowerCase();
  // names ending in -y (Romy, Britney, Joey) inflect like a front vowel ending
  const yEnd = lastChar === "y";
  if (yEnd) lv = "i";
  const back = "aıouâû".includes(lv);           // kalın ünlü
  const hi = ({ a: "ı", "â": "ı", "ı": "ı", o: "u", u: "u", "û": "u",
                e: "i", i: "i", "î": "i", "ö": "ü", "ü": "ü" })[lv] || "i"; // I-tipi
  const lo = back ? "a" : "e";                   // A-tipi
  const endsVowel = vowels.includes(lastChar) || yEnd;
  const hard = "pçtksşfh".includes(lastChar);
  let suf;
  if (type === "in") suf = (endsVowel ? "n" : "") + hi + "n";        // genitif
  else if (type === "i") suf = (endsVowel ? "y" : "") + hi;          // belirtme
  else if (type === "e") suf = (endsVowel ? "y" : "") + lo;          // yönelme
  else if (type === "de") suf = (hard ? "t" : "d") + lo;             // bulunma
  else suf = "";
  return name + "'" + suf;
}

/* ---------- clock helpers (CITO/DIA: klokkijken) ----------
   Note the language trap this exists to teach: 3:30 is "half VIER" in Dutch
   (half TO four), "half past three" in English, "üç buçuk" in Turkish.
   Times are stored numerically and spoken per language at render time. */
const HOUR_WORDS = {
  nl: ["twaalf", "een", "twee", "drie", "vier", "vijf", "zes", "zeven", "acht", "negen", "tien", "elf"],
  en: ["twelve", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven"]
};
const TR_HOUR     = ["on iki", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz", "on", "on bir"];
const TR_HOUR_ACC = ["on ikiyi", "biri", "ikiyi", "üçü", "dördü", "beşi", "altıyı", "yediyi", "sekizi", "dokuzu", "onu", "on biri"];
const TR_HOUR_DAT = ["on ikiye", "bire", "ikiye", "üçe", "dörde", "beşe", "altıya", "yediye", "sekize", "dokuza", "ona", "on bire"];

/* Turkish locative on a clock reading: 16:40'ta, 17:00'de, 14:10'da, 18:25'te.
   The suffix harmonises with how the time is SPOKEN, so read the number first. */
const TR_UNITS = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"];
const TR_TENS  = ["", "on", "yirmi", "otuz", "kırk", "elli"];
function trReadNum(n) {
  if (n === 0) return "sıfır";
  const t = Math.floor(n / 10), u = n % 10;
  return [TR_TENS[t], TR_UNITS[u]].filter(Boolean).join(" ");
}
function trTimeLoc(timeStr) {
  const [hh, mm] = String(timeStr).split(":").map(Number);
  const spoken = mm === 0 ? trReadNum(hh) : trReadNum(mm);
  const word = spoken.split(" ").pop();
  const vowels = "aeıioöuü";
  let lv = "e";
  for (let i = word.length - 1; i >= 0; i--) {
    if (vowels.includes(word[i])) { lv = word[i]; break; }
  }
  const back = "aıou".includes(lv);
  const hard = "pçtkfhsş".includes(word[word.length - 1]);
  return timeStr + "'" + (hard ? "t" : "d") + (back ? "a" : "e");
}

function tAdd(h, m, add) {
  let tot = ((h * 60 + m + add) % 1440 + 1440) % 1440;
  return { h: Math.floor(tot / 60), m: tot % 60 };
}
function tFmt(h, m) { return h + ":" + String(m).padStart(2, "0"); }

/* Spoken time. h = 1..12 (12-hour clock), m = multiple of 5. */
function timeWords(h, m, lang) {
  const cur = h % 12, nxt = (h + 1) % 12;
  if (lang === "tr") {
    const A = TR_HOUR_ACC[cur], D = TR_HOUR_DAT[nxt];
    switch (m) {
      case 0:  return "saat " + TR_HOUR[cur];
      case 5:  return A + " beş geçe";
      case 10: return A + " on geçe";
      case 15: return A + " çeyrek geçe";
      case 20: return A + " yirmi geçe";
      case 25: return A + " yirmi beş geçe";
      case 30: return TR_HOUR[cur] + " buçuk";
      case 35: return D + " yirmi beş kala";
      case 40: return D + " yirmi kala";
      case 45: return D + " çeyrek kala";
      case 50: return D + " on kala";
      case 55: return D + " beş kala";
    }
  }
  const W = HOUR_WORDS[lang] || HOUR_WORDS.nl;
  if (lang === "en") {
    switch (m) {
      case 0:  return W[cur] + " o'clock";
      case 5:  return "five past " + W[cur];
      case 10: return "ten past " + W[cur];
      case 15: return "quarter past " + W[cur];
      case 20: return "twenty past " + W[cur];
      case 25: return "twenty-five past " + W[cur];
      case 30: return "half past " + W[cur];
      case 35: return "twenty-five to " + W[nxt];
      case 40: return "twenty to " + W[nxt];
      case 45: return "quarter to " + W[nxt];
      case 50: return "ten to " + W[nxt];
      case 55: return "five to " + W[nxt];
    }
  }
  switch (m) {                                   // nl
    case 0:  return W[cur] + " uur";
    case 5:  return "vijf over " + W[cur];
    case 10: return "tien over " + W[cur];
    case 15: return "kwart over " + W[cur];
    case 20: return "tien voor half " + W[nxt];
    case 25: return "vijf voor half " + W[nxt];
    case 30: return "half " + W[nxt];
    case 35: return "vijf over half " + W[nxt];
    case 40: return "tien over half " + W[nxt];
    case 45: return "kwart voor " + W[nxt];
    case 50: return "tien voor " + W[nxt];
    case 55: return "vijf voor " + W[nxt];
  }
  return tFmt(h, m);
}

/* Question engine: builds a task (list of questions) from templates.
   Mix per task: ~70% main category of the day, ~20% mixed (prefers templates
   the child got wrong recently), ~10% surprise format. */

const Engine = {

  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },

  /* Build the 4 answer options (1 correct + 3 plausible mistakes) */
  buildOptions(gen) {
    if (gen.textCorrect) {
      const seen = new Set([gen.textCorrect]);
      const picked = [];
      for (const w of gen.textWrongs) {
        if (picked.length >= 3) break;
        if (!seen.has(w)) { seen.add(w); picked.push(w); }
      }
      const opts = this.shuffle([gen.textCorrect, ...picked]);
      return { options: opts, answerIdx: opts.indexOf(gen.textCorrect) };
    }
    const ans = gen.answer;
    const set = new Set([ans]);
    const out = [];
    const candidates = (gen.wrongs || []).concat([ans + 1, ans - 1, ans + 10, ans - 10, ans + 2, ans + 5]);
    for (const w of candidates) {
      if (out.length >= 3) break;
      const v = Math.round(w);
      if (v > 0 && !set.has(v)) { set.add(v); out.push(v); }
    }
    const unit = gen.unit || "";
    const all = this.shuffle([ans, ...out]).map(v => unit + v);
    return { options: all, answerIdx: all.indexOf(unit + ans) };
  },

  /* What makes a som that som: which template, which phrasing, which numbers.
     Names and objects are deliberately left out — the same sum with another
     child's name in front of it is the same sum, and asking it again would be
     asking the same question. Kept as a short fingerprint rather than the whole
     thing, because this list is carried between devices. */
  sig(q) {
    const s = q.tplId + "|" + q.variantIdx + "|" + JSON.stringify(q.vars);
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  },

  /* A som out of this template that has never been asked before — or nothing,
     when the template has no new som left to give at this level. */
  freshFrom(tpl, level, seen, taken) {
    for (let i = 0; i < 40; i++) {
      const q = this.makeQuestion(tpl, level);
      const s = this.sig(q);
      if (!seen.has(s) && !taken.has(s)) { taken.add(s); return q; }
    }
    return null;
  },

  /* Pick a template of a category, avoiding ones used in the last 2 days when possible */
  pickTemplate(cat, data, usedInTask) {
    let pool = TEMPLATES.filter(tp => tp.cat === cat);
    const today = new Date();
    const fresh = pool.filter(tp => {
      if (usedInTask.includes(tp.id)) return false;
      const last = data.recentTpl[tp.id];
      if (!last) return true;
      const diff = (today - new Date(last)) / 86400000;
      return diff >= 2;
    });
    const notInTask = pool.filter(tp => !usedInTask.includes(tp.id));
    const from = fresh.length ? fresh : (notInTask.length ? notInTask : pool);
    return from[Math.floor(Math.random() * from.length)];
  },

  makeQuestion(tpl, level) {
    const variantIdx = Math.floor(Math.random() * tpl.variants.length);
    const gen = tpl.gen(level, variantIdx);
    const { options, answerIdx } = this.buildOptions(gen);
    const name = NAMES[Math.floor(Math.random() * NAMES.length)];
    let name2 = name;
    while (name2.n === name.n) name2 = NAMES[Math.floor(Math.random() * NAMES.length)];
    const obj = tpl.objects ? tpl.objects[Math.floor(Math.random() * tpl.objects.length)] : null;
    let obj2 = null;
    if (tpl.objects2) {
      obj2 = tpl.objects2[Math.floor(Math.random() * tpl.objects2.length)];
      while (tpl.objects2.length > 1 && obj2 === obj) obj2 = tpl.objects2[Math.floor(Math.random() * tpl.objects2.length)];
    }
    return {
      tplId: tpl.id, cat: tpl.cat, variantIdx,
      vars: gen.vars, name, name2, obj, obj2,
      options, answerIdx,
      chosen: null, correctFirst: null
    };
  },

  /* Render question text in the current language */
  text(q, lang) {
    const tpl = TEMPLATES.find(tp => tp.id === q.tplId);
    let s = tpl.variants[q.variantIdx][lang] || tpl.variants[q.variantIdx].nl;
    const pron = {
      nl: { cap: q.name.g === "f" ? "Zij" : "Hij", low: q.name.g === "f" ? "zij" : "hij" },
      en: { cap: q.name.g === "f" ? "She" : "He", low: q.name.g === "f" ? "she" : "he" },
      tr: { cap: "O", low: "o" }
    }[lang] || { cap: "?", low: "?" };
    // Turkish name + clock-time suffixes (only appear in tr phrasings)
    if (lang === "tr") {
      s = s.replace(/\{name_(in|de|e|i)\}/g, (_, t) => trEk(q.name.n, t));
      s = s.replace(/\{name2_(in|de|e|i)\}/g, (_, t) => trEk(q.name2.n, t));
      s = s.replace(/\{(t2?)_de\}/g, (_, k) => trTimeLoc(q.vars[k]));
    }
    s = s.replace(/\{name2\}/g, q.name2.n).replace(/\{name\}/g, q.name.n);
    s = s.replace(/\{Hij\}|\{He\}/g, pron.cap).replace(/\{hij\}|\{he\}/g, pron.low);
    // spoken clock time, rendered per language ({_h} = 1..12, {_m} = minutes)
    if (q.vars && q.vars._h !== undefined) {
      s = s.replace(/\{klok\}/g, timeWords(q.vars._h, q.vars._m, lang));
    }
    const cap = w => w ? w.charAt(0).toUpperCase() + w.slice(1) : w;
    if (q.obj2) { const w = q.obj2[lang] || q.obj2.nl; s = s.replace(/\{Obj2\}/g, cap(w)).replace(/\{obj2\}/g, w); }
    if (q.obj) { const w = q.obj[lang] || q.obj.nl; s = s.replace(/\{Obj\}/g, cap(w)).replace(/\{obj\}/g, w); }
    for (const k in q.vars) s = s.replace(new RegExp("\\{" + k + "\\}", "g"), q.vars[k]);
    return s;
  },

  /* Build a full task of n questions */
  buildTask(n, data) {
    const dayIdx = Math.floor(new Date() / 86400000);
    const mainCat = CATS[dayIdx % CATS.length];
    const nMain = Math.round(n * 0.7);
    const nSurprise = Math.max(1, Math.round(n * 0.1));
    const nMixed = n - nMain - nSurprise;

    const usedInTask = [];
    const questions = [];
    const seen = new Set(data.seen || []);   // every som already asked
    // an opdracht that was left half done is still lying there with sommen the
    // child has not seen yet; those are not "asked", but they must not be
    // handed out twice either
    if (data.active && data.active.date === todayStr() && data.active.questions) {
      data.active.questions.forEach(q => seen.add(this.sig(q)));
    }
    const taken = new Set();                 // the ones picked just now
    let repeats = 0;

    const fromTpl = (tpl) => this.freshFrom(tpl, Levels.of(data), seen, taken);

    // every category carries its own level, so being good at tables does not
    // make the clock questions harder
    const add = (cat) => {
      let tpl = null, q = null;
      const tried = [];
      // a template can run out of sommen it has not asked before at this level,
      // so look in its neighbours before giving up on the category
      for (let k = 0; k < 8 && !q; k++) {
        tpl = this.pickTemplate(cat, data, usedInTask.concat(tried));
        tried.push(tpl.id);
        q = fromTpl(tpl);
      }
      if (!q) {
        // Nothing new left anywhere in this category. A som asked long ago is
        // better than an opdracht that comes up short — but twice in the SAME
        // opdracht is never acceptable, so keep drawing until it is at least
        // not one of today's.
        const level = Levels.of(data);
        for (let i = 0; i < 200; i++) {
          q = this.makeQuestion(tpl, level);
          if (!taken.has(this.sig(q))) break;
        }
        taken.add(this.sig(q));
        repeats++;
      }
      usedInTask.push(tpl.id);
      questions.push(q);
    };

    for (let i = 0; i < nMain; i++) add(mainCat);

    // Telling the clock is a known weak spot (CITO/DIA), so every task keeps a
    // couple of clock questions even on days when it is not the main category.
    const klokQuota = mainCat === "klok" ? 0 : Math.min(2, nMixed);
    for (let i = 0; i < klokQuota; i++) add("klok");

    // mixed: prefer recently-wrong templates, else random other categories
    const otherCats = CATS.filter(c => c !== mainCat && c !== "klok");
    for (let i = 0; i < nMixed - klokQuota; i++) {
      const wrongId = data.wrongTpl[i];
      const wrongTpl = wrongId && TEMPLATES.find(tp => tp.id === wrongId && tp.cat !== "verrassing");
      const q = wrongTpl && fromTpl(wrongTpl);
      if (q) {
        usedInTask.push(wrongTpl.id);
        questions.push(q);
      } else {
        add(otherCats[Math.floor(Math.random() * otherCats.length)]);
      }
    }

    for (let i = 0; i < nSurprise; i++) add("verrassing");

    // Which templates were used is remembered here, but NOT the sommen. A som
    // counts as asked when the child has actually seen it — see remember()
    // below. Writing all twenty down now would burn the ones an opdracht that
    // is broken off halfway never got round to showing.
    const today = todayStr();
    usedInTask.forEach(id => { data.recentTpl[id] = today; });
    if (repeats) console.log(`[Oefensommen] ${repeats} som(men) waren op: niets nieuws meer in die soort`);
    Store.save(data);

    return this.shuffle(questions);
  },

  /* This som has now been in front of the child, so it is asked and will never
     come round again. Returns true when it was not already written down. */
  remember(data, q) {
    const s = this.sig(q);
    if (!data.seen) data.seen = [];
    if (data.seen.indexOf(s) !== -1) return false;
    data.seen.push(s);
    if (data.seen.length > Store.SEEN_MAX) {
      data.seen = data.seen.slice(-Store.SEEN_MAX);
    }
    return true;
  }
};
