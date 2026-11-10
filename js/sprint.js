/* Tafelsprint — the five tafels that open the day.

   This is not one of the twenty sommen and it is not meant to be. There is no
   thinking time, no hint and no second go: five seconds, three answers, tap.
   Knowing 6 × 8 is 48 is something you either have by heart or you do not, and
   the only way to get it by heart is to be asked it under a clock, every day,
   until the answer arrives before the sum does.

   What went wrong yesterday comes round sooner: every fact keeps a small tally
   and the ones that were missed are weighted up, so the sprint quietly circles
   the tafels this particular child does not have yet. */

const Sprint = {
  N: 20,            // twenty facts a round — the tafel half of a day's pakket
  SECS: 4,          // four seconds a tafel, spent in three: one to work it
                    // out with nothing to look at, one to read the answers
                    // without touching them, two to answer
  OPTS: 4,          // four answers, and the wrong ones are neighbours in the
                    // table — near enough that only knowing it settles it
  PASS: 0.9,        // 90% right opens the kampioensronde, and 90% there wins it
  CHAMP_SECS: 3,    // the kampioensronde: three seconds, question and answers
                    // together, tappable from the first moment
  MIN: 6, MAX: 10,  // only the hard tafels: 6 to 10, both factors. Anything
                    // with a 1 to 5 in it is too easy and is never asked.

  key(a, b) { return Math.min(a, b) + "x" + Math.max(a, b); },

  /* the whole round, built up front so the clock never waits on anything.
     Only 15 facts sit between 6 and 10, so a round of twenty asks both ways
     round (6 × 8 and 8 × 6) — 25 different questions, twenty of them drawn —
     and never the same question twice in a round. The same fact twice in a row
     is avoided as long as anything else is left. */
  build(data, avoid) {
    const seen = new Set((avoid || []).map(f => {
      const [a, b] = String(f).split("x").map(Number);
      return this.key(a, b);
    }));
    const used = new Set();                      // ordered pairs, this round
    const out = [];
    let last = null;
    while (out.length < this.N) {
      const f = this.pick(data, seen, used, last) || this.pick(data, seen, used, null);
      if (!f) break;
      used.add(f.a + "x" + f.b);
      last = this.key(f.a, f.b);
      out.push(this.question(f.a, f.b));
    }
    return out;
  },

  /* how many right it takes, out of n */
  need(n) { return Math.ceil(this.PASS * n - 1e-9); },

  /* A weighted draw: a fact that was missed comes up several times in the hat,
     a fact never asked once more than the rest, everything else once. */
  pick(data, seen, used, last) {
    const tally = data.tafel || {};
    const hat = [];
    for (let a = this.MIN; a <= this.MAX; a++) {
      for (let b = this.MIN; b <= this.MAX; b++) {
        const k = this.key(a, b);
        if (seen.has(k) || used.has(a + "x" + b) || k === last) continue;
        const m = tally[k] || { n: 0, w: 0 };
        let weight = 1 + 3 * Math.min(m.w, 3);
        if (!m.n) weight += 1;                    // never asked: give it a turn
        for (let i = 0; i < weight; i++) hat.push({ a, b });
      }
    }
    if (!hat.length) return null;
    return hat[Math.floor(Math.random() * hat.length)];
  },

  /* The wrong answers are the mistakes that are actually made: the neighbours
     in the table. 6 × 8 sits between 6 × 7 and 6 × 9, and next to 5 × 8 and
     7 × 8 — a slip of one row, never a number that can be dismissed at a
     glance. */
  question(a, b) {
    const answer = a * b;
    const near = [a * (b - 1), a * (b + 1), (a - 1) * b, (a + 1) * b]
      .filter(v => v > 0 && v !== answer);
    const uniq = [...new Set(near)];
    const shuffle = arr => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };
    shuffle(uniq);
    // 6 × 6 and 7 × 7 have too few neighbours: a slip of ten is the next
    // most real mistake, so it fills the gap before anything random does
    const tens = shuffle([answer - 10, answer + 10].filter(v => v > 0 && !uniq.includes(v)));
    const opts = [answer].concat(uniq.concat(tens).slice(0, this.OPTS - 1));
    let guard = 0;
    while (opts.length < this.OPTS && guard++ < 40) {    // 2 × 2 has few neighbours
      const v = answer + (Math.floor(Math.random() * 5) + 1) * (Math.random() < 0.5 ? -1 : 1);
      if (v > 0 && !opts.includes(v)) opts.push(v);
    }
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    return { a, b, answer, options: opts, answerIdx: opts.indexOf(answer) };
  },

  /* One fact, judged. Right on the clock counts; too late counts as missed,
     because a tafel you have to work out is a tafel you do not know yet. */
  remember(data, q, ok) {
    data.tafel = data.tafel || {};
    const k = this.key(q.a, q.b);
    const m = data.tafel[k] || { n: 0, w: 0 };
    m.n++;
    m.w = ok ? Math.max(0, m.w - 1) : Math.min(9, m.w + 1);
    data.tafel[k] = m;
  }
};
