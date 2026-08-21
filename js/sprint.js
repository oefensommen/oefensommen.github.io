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
  N: 10,            // ten facts a round — the tafel half of a day's pakket
  SECS: 15,         // fifteen seconds each: room to count back from a tafel you
                    // do know, which is the working that stops being needed
  OPTS: 2,          // two answers, and the wrong one is a neighbour in the
                    // table — near enough that only knowing it settles it
  MIN: 2, MAX: 10,  // the tafels of groep 5 — 1 and beyond 10 are not sport

  key(a, b) { return Math.min(a, b) + "x" + Math.max(a, b); },

  /* the whole round, built up front so the clock never waits on anything */
  build(data, avoid) {
    const seen = new Set((avoid || []).map(f => {
      const [a, b] = String(f).split("x").map(Number);
      return this.key(a, b);
    }));
    const out = [];
    while (out.length < this.N) {
      const f = this.pick(data, seen);
      if (!f) break;
      seen.add(this.key(f.a, f.b));
      out.push(this.question(f.a, f.b));
    }
    return out;
  },

  /* A weighted draw: a fact that was missed comes up several times in the hat,
     a fact never asked once more than the rest, everything else once. */
  pick(data, seen) {
    const tally = data.tafel || {};
    const hat = [];
    for (let a = this.MIN; a <= this.MAX; a++) {
      for (let b = this.MIN; b <= this.MAX; b++) {
        const k = this.key(a, b);
        if (seen.has(k)) continue;
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
    for (let i = uniq.length - 1; i > 0; i--) {          // shuffle the neighbours
      const j = Math.floor(Math.random() * (i + 1));
      [uniq[i], uniq[j]] = [uniq[j], uniq[i]];
    }
    const opts = [answer].concat(uniq.slice(0, this.OPTS - 1));
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
