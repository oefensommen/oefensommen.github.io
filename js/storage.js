/* Storage layer.
   localStorage is the working copy (instant, works offline); Supabase is the
   shared copy so phone / tablet / laptop all continue where the last one left off.

   Flow: login → pull cloud → merge with local → save both. Every later save
   writes locally at once and pushes to the cloud debounced. If the network is
   down the app keeps working and pushes on the next successful save. */

const Store = {
  KEY: "oefensommen_v1",
  DAY_KEY: "oefensommen_auth",     // date string of the last successful unlock
  USER_KEY: "oefensommen_user",    // username remembered for THIS device
  PASS_KEY: "oefensommen_pass",    // needed to sign each cloud call
  DIRTY_KEY: "oefensommen_dirty",  // local changes not yet pushed

  _default() {
    return {
      level: 1,
      perfectStreak: 0,          // consecutive 100% first-pass tasks (for level-up)
      days: {},                  // "2026-08-01": { solved, firstCorrect, done100, timeSec, times, cats }
      recentTpl: {},             // templateId -> last used date string
      wrongTpl: []               // template ids answered wrong recently (repeat pool)
    };
  },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return this._default();
      return Object.assign(this._default(), JSON.parse(raw));
    } catch (e) {
      return this._default();
    }
  },

  saveLocal(data) {
    localStorage.setItem(this.KEY, JSON.stringify(data));
  },

  save(data) {
    this.saveLocal(data);
    localStorage.setItem(this.DIRTY_KEY, "1");
    this.pushSoon(data);
  },

  /* ---------- device / session ---------- */
  deviceUser() { return localStorage.getItem(this.USER_KEY) || ""; },
  isLoggedIn() { return localStorage.getItem(this.DAY_KEY) === todayStr(); },

  markUnlocked(user, pass) {
    localStorage.setItem(this.DAY_KEY, todayStr());
    localStorage.setItem(this.USER_KEY, user);
    localStorage.setItem(this.PASS_KEY, pass);
  },

  logout() {
    // full sign-out: this device forgets the account, next login needs both fields
    [this.DAY_KEY, this.USER_KEY, this.PASS_KEY].forEach(k => localStorage.removeItem(k));
  },

  /* ---------- login ----------
     Returns "ok" | "bad" (wrong credentials) | "offline" */
  async login(user, pass) {
    user = (user || "").trim();
    if (!user || !pass) return "bad";

    if (!Cloud.configured()) {
      // local-only development mode, before the Supabase project exists
      if (pass !== "2026") return "bad";
      this.markUnlocked(user, pass);
      return "ok";
    }

    try {
      const cloud = await Cloud.load(user, pass);
      const merged = mergeProgress(this.load(), cloud || {});
      this.saveLocal(merged);
      this.markUnlocked(user, pass);
      localStorage.removeItem(this.DIRTY_KEY);
      // push the merge back so the other devices see it too
      Cloud.save(user, pass, merged).catch(() => localStorage.setItem(this.DIRTY_KEY, "1"));
      return "ok";
    } catch (e) {
      if (e.authFailed) return "bad";
      // no network: allow in if this device already knows these credentials
      const known = localStorage.getItem(this.USER_KEY) === user &&
                    localStorage.getItem(this.PASS_KEY) === pass;
      if (known) { this.markUnlocked(user, pass); return "ok"; }
      return "offline";
    }
  },

  /* ---------- cloud push ---------- */
  _timer: null,
  pushSoon(data) {
    if (!Cloud.configured()) return;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.pushNow(data), 1200);
  },

  async pushNow(data) {
    if (!Cloud.configured()) return;
    const u = localStorage.getItem(this.USER_KEY), p = localStorage.getItem(this.PASS_KEY);
    if (!u || !p) return;
    try {
      await Cloud.save(u, p, data || this.load());
      localStorage.removeItem(this.DIRTY_KEY);
    } catch (e) {
      localStorage.setItem(this.DIRTY_KEY, "1");   // retry on the next save / app open
    }
  },

  /* Pull the shared copy and merge it in — used when the app is re-opened,
     so a task done on the tablet shows up on the laptop. */
  async pull() {
    if (!Cloud.configured()) return false;
    const u = localStorage.getItem(this.USER_KEY), p = localStorage.getItem(this.PASS_KEY);
    if (!u || !p) return false;
    try {
      const cloud = await Cloud.load(u, p);
      const merged = mergeProgress(this.load(), cloud || {});
      this.saveLocal(merged);
      if (localStorage.getItem(this.DIRTY_KEY)) await this.pushNow(merged);
      return merged;
    } catch (e) {
      return false;
    }
  }
};

/* Merge two progress objects without losing a day's work.
   Days are merged field by field (best of both), so two devices used on the
   same day still end up with one sensible record. */
function mergeProgress(a, b) {
  a = a || {}; b = b || {};
  const out = {
    level: Math.max(a.level || 1, b.level || 1),
    perfectStreak: Math.max(a.perfectStreak || 0, b.perfectStreak || 0),
    days: {},
    recentTpl: Object.assign({}, b.recentTpl || {}, a.recentTpl || {}),
    wrongTpl: Array.from(new Set([...(a.wrongTpl || []), ...(b.wrongTpl || [])])).slice(0, 6)
  };
  const dates = new Set([...Object.keys(a.days || {}), ...Object.keys(b.days || {})]);
  for (const d of dates) {
    const x = (a.days || {})[d], y = (b.days || {})[d];
    if (!x) { out.days[d] = y; continue; }
    if (!y) { out.days[d] = x; continue; }
    const cats = {};
    for (const c of new Set([...Object.keys(x.cats || {}), ...Object.keys(y.cats || {})])) {
      const cx = (x.cats || {})[c] || { n: 0, c: 0 }, cy = (y.cats || {})[c] || { n: 0, c: 0 };
      cats[c] = { n: Math.max(cx.n, cy.n), c: Math.max(cx.c, cy.c) };
    }
    out.days[d] = {
      solved: Math.max(x.solved || 0, y.solved || 0),
      firstCorrect: Math.max(x.firstCorrect || 0, y.firstCorrect || 0),
      done100: !!(x.done100 || y.done100),
      timeSec: x.timeSec || y.timeSec,
      times: Array.from(new Set([...(x.times || []), ...(y.times || [])])),
      cats
    };
  }
  return out;
}

function todayStr(d = new Date()) {
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
