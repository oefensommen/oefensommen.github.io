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
  ROLE_KEY: "oefensommen_role",    // "child" | "parent"
  WATCH_KEY: "oefensommen_watch",  // for a parent: the child it mirrors

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
    if (this.isParent()) return;        // the parent side never writes history
    localStorage.setItem(this.DIRTY_KEY, "1");
    this.pushSoon(data);
  },

  /* ---------- device / session ---------- */
  deviceUser() { return localStorage.getItem(this.USER_KEY) || ""; },
  isLoggedIn() { return localStorage.getItem(this.DAY_KEY) === todayStr(); },
  role() { return localStorage.getItem(this.ROLE_KEY) || "child"; },
  isParent() { return this.role() === "parent"; },
  watches() { return localStorage.getItem(this.WATCH_KEY) || ""; },
  creds() {
    return { u: localStorage.getItem(this.USER_KEY), p: localStorage.getItem(this.PASS_KEY) };
  },

  markUnlocked(user, pass, role, watches) {
    localStorage.setItem(this.DAY_KEY, todayStr());
    localStorage.setItem(this.USER_KEY, user);
    localStorage.setItem(this.PASS_KEY, pass);
    localStorage.setItem(this.ROLE_KEY, role || "child");
    if (watches) localStorage.setItem(this.WATCH_KEY, watches);
    else localStorage.removeItem(this.WATCH_KEY);
  },

  logout() {
    // full sign-out: this device forgets the account, next login needs both fields
    [this.DAY_KEY, this.USER_KEY, this.PASS_KEY, this.ROLE_KEY, this.WATCH_KEY]
      .forEach(k => localStorage.removeItem(k));
  },

  /* ---------- login ----------
     Returns "ok" | "bad" (wrong credentials) | "offline" */
  async login(user, pass) {
    user = (user || "").trim();
    if (!user || !pass) return "bad";

    const parentName = /-ouder$/i.test(user);

    if (!Cloud.configured()) {
      // local-only development mode, before the Supabase project exists
      if (pass !== (parentName ? "2020" : "2026")) return "bad";
      this.markUnlocked(user, pass, parentName ? "parent" : "child",
                        parentName ? user.replace(/-ouder$/i, "") : "");
      return "ok";
    }

    try {
      let acct;
      try {
        acct = await Cloud.loginAccount(user, pass);
      } catch (e) {
        if (e.status !== 404) throw e;
        // the live/parent SQL hasn't been installed yet — fall back to the
        // original single-account login so the app keeps working
        const d = await Cloud.load(user, pass);
        acct = { role: parentName ? "parent" : "child",
                 watches: parentName ? user.replace(/-ouder$/i, "") : null,
                 data: d };
      }
      const role = (acct && acct.role) || "child";
      const merged = role === "parent"
        ? (acct.data || {})                                  // the child's history, read-only
        : mergeProgress(this.load(), (acct && acct.data) || {});
      this.saveLocal(merged);
      this.markUnlocked(user, pass, role, (acct && acct.watches) || "");
      localStorage.removeItem(this.DIRTY_KEY);
      if (role !== "parent") {
        // push the merge back so the other devices see it too
        Cloud.save(user, pass, merged).catch(() => localStorage.setItem(this.DIRTY_KEY, "1"));
      }
      return "ok";
    } catch (e) {
      if (e.authFailed) return "bad";
      // no network: allow in if this device already knows these credentials
      const known = localStorage.getItem(this.USER_KEY) === user &&
                    localStorage.getItem(this.PASS_KEY) === pass;
      if (known) { this.markUnlocked(user, pass, this.role(), this.watches()); return "ok"; }
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
    if (!Cloud.configured() || this.isParent()) return;
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
      // the parent mirrors the child's history as-is; the child merges its own
      const merged = this.isParent() ? (cloud || {}) : mergeProgress(this.load(), cloud || {});
      this.saveLocal(merged);
      if (!this.isParent() && localStorage.getItem(this.DIRTY_KEY)) await this.pushNow(merged);
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
      cats,
      reward: mergeReward(x.reward, y.reward)
    };
  }
  return out;
}

/* Speeltijd. De verdiende minuten zijn per dag hetzelfde, maar er kan op twee
   apparaten gespeeld zijn — de hoogste stand telt, anders levert overstappen
   naar de tablet gratis speeltijd op. */
function mergeReward(a, b) {
  if (!a) return b;
  if (!b) return a;
  return {
    sec: Math.max(a.sec || 0, b.sec || 0),
    used: Math.max(a.used || 0, b.used || 0)
  };
}

function todayStr(d = new Date()) {
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
