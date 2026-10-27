/* What the parent said about a particular soort som.

   This used to sit beside an automatic niveau that climbed on faultless days
   and a dial that dropped a notch after every fout. Both are gone: the work
   is the same every day, and the only hand on the difficulty is the parent's.

   A verdict walks one soort som two steps easier or two steps harder, for
   good, until the parent says otherwise. */

const Tuning = {
  of(data, tplId) {
    const t = (data.tuning || {})[tplId];
    const adj = t && typeof t.adj === "number" ? t.adj : 0;
    return Math.max(-2, Math.min(2, adj));
  },

  /* Everything the parent has marked, newest first — the lessons learned. */
  list(data) {
    const tun = data.tuning || {};
    return Object.keys(tun)
      .map(id => ({ id, adj: this.of(data, id), at: tun[id].at || 0 }))
      .filter(x => x.adj !== 0)
      .sort((a, b) => b.at - a.at);
  }
};
