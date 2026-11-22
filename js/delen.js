/* Delen — whole divisions against the clock, for groep 5-6.

   Same screen, same backgrounds and the same three leagues as the tafels, but
   the sum is a division: 8 ÷ 2, 10 ÷ 5. Only whole answers are asked: the
   dividend is always divisor × quotient, so nothing ever has a remainder.

   Seconds a sum: the kikkerliga 10, the kampioensliga 8, the dinozorenliga 6.
   The wrong answers are the neighbouring quotients, so a slip of one is what
   has to be ruled out, not a number that can be dismissed at a glance. */

const Delen = {
  N: 10,                       // ten sums a round
  SECS: [10, 8, 6],            // seconds a sum, per league: 0 kikker, 1 champions, 2 dinozaur
  OPTS: 4,
  MIN: 2, MAX: 10,             // divisor and quotient: 2 to 10, so 4 to 100 as dividend

  secsFor(level) { return this.SECS[level || 0]; },

  /* how many right it takes, out of n, and whether that was enough: the same
     rule as the tafels — every one of them */
  need(n) { return n; },
  passed(right, n) { return n > 0 && right >= this.need(n); },

  /* the whole round, drawn without repeating a sum inside the round */
  build(data, avoid, n = this.OPTS) {
    const pairs = [];
    for (let b = this.MIN; b <= this.MAX; b++) {
      for (let q = this.MIN; q <= this.MAX; q++) pairs.push({ b, q });
    }
    for (let i = pairs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
    }
    return pairs.slice(0, this.N).map(p => this.question(p.b, p.q, n));
  },

  /* a is the dividend, b the divisor, answer the quotient */
  question(b, q, n = this.OPTS) {
    const a = b * q;
    const near = [q - 1, q + 1, q - 2, q + 2, q + 3, q - 3]
      .filter(v => v >= 1 && v !== q);
    for (let i = near.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [near[i], near[j]] = [near[j], near[i]];
    }
    const opts = [q, ...near.slice(0, n - 1)];
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    return { a, b, text: `${a} ÷ ${b}`, answer: q, options: opts, answerIdx: opts.indexOf(q) };
  }
};
