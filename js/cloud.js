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
  save(u, p, d) { return this.rpc("save_progress", { u, p, d }); }
};
