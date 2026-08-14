/* Thin Supabase REST client — plain fetch, no SDK, nothing to install.
   Only two server functions are exposed; both check the password themselves. */

const Cloud = {
  configured() {
    return typeof SUPABASE_URL === "string" && /^https?:\/\//.test(SUPABASE_URL) &&
           typeof SUPABASE_ANON_KEY === "string" && SUPABASE_ANON_KEY.length > 20;
  },

  async rpc(fn, body) {
    const res = await fetch(SUPABASE_URL + "/rest/v1/rpc/" + fn, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: "Bearer " + SUPABASE_ANON_KEY
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = new Error("rpc " + fn + " failed: " + res.status);
      err.status = res.status;              // 4xx = wrong credentials, not offline
      err.authFailed = res.status >= 400 && res.status < 500;
      throw err;
    }
    const txt = await res.text();
    return txt ? JSON.parse(txt) : null;
  },

  load(u, p) { return this.rpc("load_progress", { u, p }); },
  save(u, p, d) { return this.rpc("save_progress", { u, p, d }); },

  /* sign in and find out whether this is the child or the parent side */
  loginAccount(u, p) { return this.rpc("login_account", { u, p }); },

  /* live mirroring: the child publishes, the parent reads */
  pushLive(u, p, s) { return this.rpc("push_live", { u, p, s }); },
  readLive(u, p) { return this.rpc("read_live", { u, p }); },

  /* the parent colours a day by hand and says why. This is the only thing the
     parent side may write, and it cannot reach the child's history. Returns
     the child's whole record back, revision and all. */
  setDayMark(u, p, d, colour, note) {
    return this.rpc("set_day_mark", { u, p, d, colour, note });
  },

  /* the parent says a soort som is too hard or too easy; it shifts one step */
  /* the parent switches a soort som — or a whole property — off and on */
  setRule(u, p, kind, key, blocked) {
    return this.rpc("set_rule", { u, p, kind, key, blocked });
  },

  /* a note in the parent's own words, hung on the soort som it is about */
  addNote(u, p, tpl, note) {
    return this.rpc("add_note", { u, p, tpl, note });
  },

  setTuning(u, p, tpl, verdict) {
    return this.rpc("set_tuning", { u, p, tpl, verdict });
  }
};
