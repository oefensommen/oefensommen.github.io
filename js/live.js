/* Live mirroring.
   The child publishes what is on its screen as DATA (which template, which
   numbers, which options, what was picked) — never as finished text. The parent
   renders that data in its own language, so the parent can read the very same
   question in Turkish while the child keeps working in Dutch. */

const Live = {
  MIN_GAP_MS: 600,          // don't spam the API while a child clicks quickly
  HEARTBEAT_MS: 8000,       // keep saying "still here" while a question is read
  STALE_SEC: 75,            // only call it idle once the heartbeat really stopped

  _last: 0, _pending: null, _timer: null,
  _beat: null, _lastScreen: null,

  /* ---------------- child side ---------------- */

  /* Build a snapshot of the current screen from the running session. */
  snapshot(screen, extra) {
    const s = Object.assign({ screen: screen, at: Date.now() }, extra || {});
    if (session && (screen === "task" || screen === "pause")) {
      const q = session.questions[session.queue[session.idx]];
      s.n = session.idx + 1;
      s.total = session.queue.length;
      s.round = session.firstPass ? 1 : 2;
      s.elapsed = session.pausedSec != null ? session.pausedSec : elapsedSec();
      if (screen === "pause") return s;      // paused: the counters, not the som
      s.q = {
        tplId: q.tplId, variantIdx: q.variantIdx, vars: q.vars,
        name: q.name, name2: q.name2, obj: q.obj, obj2: q.obj2,
        options: q.options, answerIdx: q.answerIdx,
        chosen: (q.chosen === undefined ? null : q.chosen),
        skipped: !!q.skipped
      };
    }
    if (session && screen === "result") {
      s.grid = session.questions.map(q => !!q.solved);
      s.score = { solved: session.questions.filter(q => q.solved).length,
                  total: session.questions.length };
      s.elapsed = session.lastSec || 0;
    }
    return s;
  },

  push(screen, extra) {
    if (!Cloud.configured() || Store.isParent()) return;
    this._lastScreen = screen;
    this._pending = this.snapshot(screen, extra);
    const wait = Math.max(0, this.MIN_GAP_MS - (Date.now() - this._last));
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this._send(), wait);
  },

  async _send() {
    const state = this._pending;
    if (!state) return;
    this._pending = null;
    this._last = Date.now();
    const { u, p } = Store.creds();
    if (!u || !p) return;
    try { await Cloud.pushLive(u, p, state); } catch (e) { /* offline: skip a beat */ }
  },

  /* Reading a word problem takes a child a long time, and nothing happens on
     screen meanwhile. Without this the parent would decide the child had
     stopped and close the mirror halfway through a question. */
  startHeartbeat() {
    this.stopHeartbeat();
    this._beat = setInterval(() => {
      if (this._lastScreen) this.push(this._lastScreen);
    }, this.HEARTBEAT_MS);
  },

  stopHeartbeat() {
    if (this._beat) { clearInterval(this._beat); this._beat = null; }
  },

  /* ---------------- parent side ---------------- */

  _poll: null,

  startWatching(onUpdate, everyMs) {
    this.stopWatching();
    const tick = async () => {
      const { u, p } = Store.creds();
      if (!u || !p) return;
      try {
        const res = await Cloud.readLive(u, p);
        onUpdate(res && res.state ? res.state : {}, res ? Number(res.age) : 99999);
      } catch (e) { /* keep the last picture on a hiccup */ }
    };
    tick();
    this._poll = setInterval(tick, everyMs || 2500);
  },

  stopWatching() {
    if (this._poll) { clearInterval(this._poll); this._poll = null; }
  },

  isBusy(state, age) {
    return !!state && !!state.screen && state.screen !== "home" && age < this.STALE_SEC;
  },

  /* Redraw the last picture — used when the parent flips the language flag. */
  rerender() {
    if (this._lastState) this.render(this._lastState, this._lastAge);
  },

  /* Render the child's screen into the mirror, in the PARENT's language. */
  render(state, age) {
    this._lastState = state; this._lastAge = age;
    const el = id => document.getElementById(id);
    const who = Store.watches().toUpperCase() || "?";
    el("mirror-who").textContent = who;

    const busy = this.isBusy(state, age);
    el("mirror-body").innerHTML = "";
    document.querySelector(".live-dot").classList.toggle("idle", !busy);

    if (!busy) {
      el("mirror-status").textContent = t("live_idle");
      el("mirror-time").textContent = "";
      el("mirror-body").innerHTML =
        `<div class="mirror-idle"><div class="big-emoji">💤</div><p>${
          t("live_waiting").replace("{name}", who)}</p></div>`;
      return;
    }

    if (state.screen === "count") {
      el("mirror-status").textContent = t("get_ready");
      el("mirror-time").textContent = "";
      el("mirror-body").innerHTML = `<div class="mirror-idle"><div class="big-emoji">⏳</div></div>`;
      return;
    }

    if (state.screen === "pause") {
      el("mirror-status").textContent = t("live_paused");
      el("mirror-time").textContent = state.elapsed ? "⏱ " + fmtTime(state.elapsed) : "";
      el("mirror-body").innerHTML =
        `<div class="mirror-idle"><div class="big-emoji">⏸️</div><p>${
          t("live_question").replace("{n}", state.n || "?").replace("{t}", state.total || "?")}</p></div>`;
      return;
    }

    if (state.screen === "result") {
      el("mirror-status").textContent = t("live_done");
      el("mirror-time").textContent = state.elapsed ? "⏱ " + fmtTime(state.elapsed) : "";
      const tiles = (state.grid || []).map((ok, i) =>
        `<div class="result-tile ${ok ? "ok" : "no"}"><span class="num">${i + 1}</span>` +
        `<span class="mark">${ok ? "✅" : "❌"}</span></div>`).join("");
      const sc = state.score || { solved: 0, total: 0 };
      el("mirror-body").innerHTML =
        `<p class="status" style="text-align:center">${
          t("result_score").replace("{c}", sc.solved).replace("{t}", sc.total)}</p>
         <div class="result-grid">${tiles}</div>`;
      return;
    }

    // a question is on screen
    const q = state.q;
    if (!q) return;
    el("mirror-status").textContent =
      t("live_question").replace("{n}", state.n).replace("{t}", state.total);
    el("mirror-time").textContent = state.elapsed ? "⏱ " + fmtTime(state.elapsed) : "";

    const text = Engine.text(q, LANG);          // rendered in the PARENT's language
    const opts = q.options.map((o, i) => {
      let cls = "mirror-opt";
      if (q.chosen !== null && q.chosen !== undefined) {
        if (i === q.chosen) cls += (i === q.answerIdx) ? " picked-ok" : " picked-no";
        else if (i === q.answerIdx) cls += " is-answer";
      }
      return `<div class="${cls}">${o}</div>`;
    }).join("");

    el("mirror-body").innerHTML =
      `<p class="mirror-q">${text}</p>
       <div class="mirror-options">${opts}</div>
       <div class="mirror-key">${t("live_answer")}: <b>${q.options[q.answerIdx]}</b>${
         q.skipped ? " · ⏭" : ""}</div>`;
  }
};
