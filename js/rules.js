/* What the bank is allowed to ask.

   Tuning says how hard a som may be; this says whether it may be asked at all.
   The app can see that a som went wrong — it cannot see that the school has
   not done prices with a comma in them yet, or that remainders only muddle
   things at this stage. A parent sitting beside the child can see exactly
   that, so they get a switch for it.

   Two levels, because objections come at two sizes:

     one soort som   — "these box-filling sums, not for now"
     one property    — "nothing with 1,50 and 2,50 in it, wherever it lives"

   The property is the interesting one. It is not a hand-kept list that goes
   stale the moment a template is added: a template is asked what it actually
   produces — its phrasings in all three languages plus a few generated draws —
   and the properties are read off that. Add a template with money in it
   tomorrow and it is caught by yesterday's rule. */

const TRAIT_DEFS = [
  // 1,50 · 2,50 — a comma number anywhere in the som or its answers
  { id: "komma", test: s => /\d\s?[.,]\d/.test(s) },
  { id: "geld",  test: s => /€|\beuro/i.test(s) },
  { id: "groot", test: s => /\b\d{4,}\b/.test(s) },
  // what a template does cannot always be read off its text: dividing with
  // something left over looks like any other division until you see the sum
  { id: "rest",  ids: ["deel-rest-over"] }
];

const Traits = {
  _cache: {},

  /* Everything this template can be recognised by. Worked out once per
     template per session — the draws are random, so a handful of them are
     taken to see what the template really tends to produce. */
  of(tpl) {
    if (this._cache[tpl.id]) return this._cache[tpl.id];
    // every value on its own: numbers put into one string would sit next to
    // each other with a comma between them and read as 1,50 when they are not
    const bits = tpl.variants.map(v => [v.nl, v.en, v.tr].join(" "));
    for (const level of [0, 1, 2, 3, 4, 5]) {
      for (let k = 0; k < 4; k++) {
        try {
          const g = tpl.gen(level, Math.floor(Math.random() * tpl.variants.length));
          for (const key in (g.vars || {})) bits.push(String(g.vars[key]));
          if (g.answer != null) bits.push(String(g.answer));
          (g.wrongs || []).forEach(w => bits.push(String(w)));
          if (g.textCorrect) bits.push(String(g.textCorrect));
          (g.textWrongs || []).forEach(w => bits.push(String(w)));
        } catch (e) { /* a generator that dislikes this level tells us nothing */ }
      }
    }
    const sample = bits.join(" ");
    const out = TRAIT_DEFS
      .filter(d => (d.ids ? d.ids.includes(tpl.id) : d.test(sample)))
      .map(d => d.id);
    this._cache[tpl.id] = out;
    return out;
  },

  /* The properties of the som in front of the parent, so the switches offered
     are the ones that would actually have kept THIS som off the screen. */
  ofQuestion(q) {
    const tpl = TEMPLATES.find(tp => tp.id === q.tplId);
    return tpl ? this.of(tpl) : [];
  }
};

const Rules = {
  _of(data, kind) { return ((data.rules || {})[kind]) || {}; },

  blocked(data, kind, key) { return !!this._of(data, kind)[key]; },

  /* May the engine build a som out of this template? */
  allows(data, tpl) {
    if (this.blocked(data, "tpl", tpl.id)) return false;
    return !Traits.of(tpl).some(tr => this.blocked(data, "trait", tr));
  },

  /* The templates of a category that are still allowed. Never used to make a
     category impossible: the caller falls back to the whole pool, because an
     opdracht that cannot be built helps nobody — see Engine.pickTemplate. */
  allowedIn(data, cat) {
    return TEMPLATES.filter(tp => tp.cat === cat && this.allows(data, tp));
  },

  /* Would switching this off leave a category with nothing to ask? The parent
     is told before they do it, not after the sommen start repeating. */
  wouldEmpty(data, kind, key) {
    const probe = { rules: JSON.parse(JSON.stringify(data.rules || {})) };
    probe.rules[kind] = probe.rules[kind] || {};
    probe.rules[kind][key] = { at: 0 };
    return CATS.filter(c => this.allowedIn(probe, c).length === 0);
  },

  /* Everything the parent has switched off, for the overview */
  list(data) {
    const out = [];
    for (const kind of ["tpl", "trait"]) {
      for (const key in this._of(data, kind)) out.push({ kind, key });
    }
    return out;
  },

  notes(data, tplId) { return ((data.notes || {})[tplId]) || []; },

  allNotes(data) {
    const out = [];
    for (const id in (data.notes || {})) {
      for (const n of data.notes[id]) out.push(Object.assign({ tplId: id }, n));
    }
    return out.sort((a, b) => (b.at || 0) - (a.at || 0));
  }
};
