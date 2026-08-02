/* Niveaus per soort som.
   Elke categorie heeft een eigen niveau van 1 tot 5. De regel is hard en
   telbaar, geen gevoelskwestie:

     drie opdrachten op rij foutloos in een categorie  -> een niveau erbij
     onder de 60% in een categorie                     -> een niveau eraf

   "Foutloos" telt alleen de eerste poging, en alleen als er die opdracht
   minstens twee sommen van die soort in zaten — één goede som zegt te weinig.
   De verrassingssommen tellen niet mee: die zijn expres een allegaartje.

   Het niveau dat de gebruiker ziet is het gemiddelde van de zes categorieën,
   naar beneden afgerond, met de rest als voortgang naar het volgende niveau. */

const Levels = {
  MAX: 5,
  CLEAN_RUNS_NEEDED: 3,     // opdrachten op rij foutloos
  MIN_TO_JUDGE: 2,          // minder sommen dan dit zegt niets
  DROP_BELOW: 0.6,

  /* older saves only had one level for everything */
  ensure(data) {
    if (!data.catLevel) {
      data.catLevel = {};
      CATS.forEach(c => { data.catLevel[c] = data.level || 1; });
    }
    if (!data.catStreak) data.catStreak = {};
    CATS.forEach(c => {
      if (typeof data.catLevel[c] !== "number") data.catLevel[c] = data.level || 1;
      if (typeof data.catStreak[c] !== "number") data.catStreak[c] = 0;
    });
    return data;
  },

  of(data, cat) {
    if (!data || !data.catLevel) return (data && data.level) || 1;
    return data.catLevel[cat] || data.level || 1;
  },

  /* What the user sees: one number, plus how far along to the next one. */
  overall(data) {
    this.ensure(data);
    const levels = CATS.map(c => data.catLevel[c]);
    const avg = levels.reduce((a, b) => a + b, 0) / levels.length;
    const level = Math.max(1, Math.min(this.MAX, Math.floor(avg)));
    const progress = level >= this.MAX ? 1 : avg - level;   // 0..1
    const atNext = levels.filter(l => l > level).length;
    return { level, progress, atNext, total: levels.length, levels };
  },

  /* Book one finished task. `perCat` is {cat: {n, c}} of the FIRST pass.
     Returns the categories that just went up, so the result screen can say so. */
  record(data, perCat) {
    this.ensure(data);
    const wentUp = [];
    for (const cat of CATS) {
      const tally = perCat[cat];
      if (!tally || tally.n < this.MIN_TO_JUDGE) continue;   // not enough to judge
      if (tally.c === tally.n) {
        data.catStreak[cat]++;
        if (data.catStreak[cat] >= this.CLEAN_RUNS_NEEDED && data.catLevel[cat] < this.MAX) {
          data.catLevel[cat]++;
          data.catStreak[cat] = 0;
          wentUp.push(cat);
        }
      } else {
        data.catStreak[cat] = 0;
        if (tally.c / tally.n < this.DROP_BELOW && data.catLevel[cat] > 1) data.catLevel[cat]--;
      }
    }
    data.level = this.overall(data).level;    // keep the old field in step
    return wentUp;
  },

  /* how many clean runs still to go in this category */
  toGo(data, cat) {
    this.ensure(data);
    if (data.catLevel[cat] >= this.MAX) return 0;
    return this.CLEAN_RUNS_NEEDED - data.catStreak[cat];
  }
};
