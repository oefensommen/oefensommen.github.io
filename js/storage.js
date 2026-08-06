/* Storage layer.

   There is ONE record of the child's history and it lives in the cloud. What
   sits in localStorage is a copy of it — fast to read, and enough to keep
   working when the wifi drops — but it is never a second opinion. Whenever the
   two disagree, the cloud is right.

   Two devices used to argue. Both kept a history, and on every open the two
   were merged field by field, taking whichever number was higher so that no
   day's work could be lost. It did protect the work, but it also meant a value
   could never be corrected: a mistake put right in the cloud came back the next
   time a device with the old copy woke up, and there was no way to tell the two
   apart. The higher number simply won, forever.

   So each copy now carries a revision that counts up on every save, and the
   rule is a single line: the copy with the higher revision is the truth. A
   device that has been working offline is ahead, so it pushes; a device that
   has been asleep is behind, so it takes what the cloud has and throws its own
   away. Equal means the same state, and the cloud is taken anyway — which is
   what makes a correction stick. */

const Store = {
  KEY: "oefensommen_v1",
  DAY_KEY: "oefensommen_auth",     // set at the last successful unlock
  USER_KEY: "oefensommen_user",    // username remembered for THIS device
  PASS_KEY: "oefensommen_pass",    // needed to sign each cloud call
  DIRTY_KEY: "oefensommen_dirty",  // local changes not yet pushed
  ROLE_KEY: "oefensommen_role",    // "child" | "parent"
  WATCH_KEY: "oefensommen_watch",  // for a parent: the child it mirrors

  /* Fingerprints of the sommen already asked, so none of them comes round a
     second time. Twenty a day means 9000 covers about 450 school days — more
     than two school years — before the oldest ones start to fall off the end.
     It costs roughly 85 kB in the record that travels between the devices,
     which is why it is a bounded list and not simply everything, forever. */
  SEEN_MAX: 9000,

  _default() {
    return {
      rev: 0,                    // counts up on every save; decides who is right
      level: 1,
      perfectStreak: 0,          // consecutive 100% first-pass tasks (for level-up)
      days: {},                  // "2026-08-01": { solved, firstCorrect, done100, timeSec, times, cats }
      recentTpl: {},             // templateId -> last used date string
      wrongTpl: [],              // template ids answered wrong recently (repeat pool)
      seen: []                   // every som ever asked, so none is asked twice
    };
  },

  rev(d) { return (d && typeof d.rev === "number") ? d.rev : 0; },

  /* Which of the two copies to keep. The cloud wins ties, because a tie is the
     same state — and because a record put right in the cloud has to be able to
     reach a device that still remembers the old one. */
  newer(local, cloud) {
    return this.rev(local) > this.rev(cloud) ? local : cloud;
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
    if (this.isParent()) { this.saveLocal(data); return; }   // the parent never writes history
    data.rev = this.rev(data) + 1;      // this copy is now ahead of the cloud
    data.savedAt = Date.now();
    this.saveLocal(data);
    localStorage.setItem(this.DIRTY_KEY, "1");
    this.pushSoon(data);
  },

  /* ---------- device / session ---------- */
  deviceUser() { return localStorage.getItem(this.USER_KEY) || ""; },

  /* Once a device has been unlocked it stays unlocked. It used to lock itself
     again at midnight, which meant a child sitting down to work first had to
     find out that today's password had changed — a daily obstacle in front of
     the one thing we want to be easy. Signing out is now a deliberate act. */
  isLoggedIn() {
    return !!localStorage.getItem(this.DAY_KEY) &&
           !!localStorage.getItem(this.USER_KEY) &&
           !!localStorage.getItem(this.PASS_KEY);
  },
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
      const cloud = (acct && acct.data) || {};
      let keep;
      if (role === "parent") {
        keep = cloud;                       // the child's history, read-only
      } else {
        // whatever this device remembers only counts if it is ahead of the
        // cloud, which happens when it was last used without a network
        keep = this.newer(this.load(), cloud);
      }
      this.saveLocal(keep);
      this.markUnlocked(user, pass, role, (acct && acct.watches) || "");
      localStorage.removeItem(this.DIRTY_KEY);
      if (role !== "parent" && keep !== cloud) {
        // this device had unsent work: send it, and it becomes the record
        Cloud.save(user, pass, keep).catch(() => localStorage.setItem(this.DIRTY_KEY, "1"));
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

  /* Fetch the record — used when the app is re-opened, so a task done on the
     tablet shows up on the laptop. The cloud is taken as it stands unless this
     device is holding work it has not managed to send yet. */
  async pull() {
    if (!Cloud.configured()) return false;
    const u = localStorage.getItem(this.USER_KEY), p = localStorage.getItem(this.PASS_KEY);
    if (!u || !p) return false;
    try {
      const cloud = (await Cloud.load(u, p)) || {};
      if (this.isParent()) { this.saveLocal(cloud); return cloud; }
      const keep = this.newer(this.load(), cloud);
      this.saveLocal(keep);
      if (keep !== cloud) await this.pushNow(keep);   // we were ahead: catch the cloud up
      else localStorage.removeItem(this.DIRTY_KEY);
      return keep;
    } catch (e) {
      return false;
    }
  }
};

function todayStr(d = new Date()) {
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
