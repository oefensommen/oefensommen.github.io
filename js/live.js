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
  /* How each som stands, in one short word per question, so the parent can see
     the whole opdracht at a glance instead of only the som on screen. */
  marksOf(questions) {
    return questions.map(q =>
      q.correctFirst ? "ok"                   // right first time
        : (q.fixed ? "fix"                    // wrong, then put right — good, and
                                              // shown as such to the child; the
                                              // parent's mirror keeps the ✔️
          : (q.solved ? "ok2"                 // (legacy) right on a later go
            : (q.failed
              ? (q.explained ? "exp"          // wrong twice; the uitleg was shown
                : "no")                       // wrong, not yet gone over
              : (q.skipped ? "skip" : "")))));  // "" = not reached yet
  },

  snapshot(screen, extra) {
    const s = Object.assign({ screen: screen, at: Date.now() }, extra || {});
    if (session && session.questions) s.marks = this.marksOf(session.questions);
    if (screen === "games" || screen === "play") {
      s.left = Reward.remaining(data);
      if (screen === "play" && playing) s.game = playing.key;   // which spelletje
      return s;
    }
    if (screen === "sprint" && sprint) {
      const q = sprint.qs[sprint.i];
      s.n = sprint.i + 1; s.total = sprint.qs.length;
      s.tiles = sprint.tiles;
      if (q) s.fact = q.a + "×" + q.b;
      return s;
    }
    if (session && (screen === "task" || screen === "pause")) {
      const cur = currentIdx();
      const q = session.questions[cur];
      if (!q) return s;      // between soms; the parent just sees "busy"
      // a som opened from the report card is one of the twenty, not one of one
      s.n = (session.viewOne != null ? session.viewOne : session.idx) + 1;
      s.total = session.viewOne != null ? session.questions.length : session.queue.length;
      s.cur = cur;                              // which of the twenty, for the panel
                                                // (not "at" — that is the timestamp)
      s.round = session.firstPass ? 1 : 2;
      s.elapsed = session.pausedSec != null ? session.pausedSec : elapsedSec();
      if (screen === "pause") return s;      // paused: the counters, not the som
      s.q = {
        tplId: q.tplId, variantIdx: q.variantIdx, vars: q.vars,
        name: q.name, name2: q.name2, obj: q.obj, obj2: q.obj2,
        options: q.options, answerIdx: q.answerIdx,
        chosen: (q.chosen === undefined ? null : q.chosen),
        skipped: !!q.skipped,
        hinted: !!q.hinted
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

  /* The whole opdracht beside the som on screen: what is right, what went
     wrong, what was put aside, and where the child is now. */
  /* Shared by both sides: the child sees it beside the som it is working on,
     the parent sees the same thing in the mirror. `at` is the question being
     looked at, counted from zero. */
  /* forParent keeps the ✔️ that tells a som put right apart from one that was
     right straight away. The child is shown no such difference — a fout they
     corrected themselves is simply good. */
  marksPanelHTML(marks, at, forParent) {
    if (!marks || !marks.length) return "";
    // to the child a som put right is simply good; the parent's copy keeps the
    // difference, and does it in colour rather than in a second symbol
    if (!forParent) marks = marks.map(m => m === "fix" ? "ok" : m);
    const cls = { ok: "ok", ok2: "fix", fix: "fix", exp: "no", no: "no", skip: "skip" };
    return `<ol class="mark-list">` + marks.map((m, i) =>
      `<li class="mark-cell ${cls[m] || "open"}${i === at ? " here" : ""}">${i + 1}</li>`
    ).join("") + `</ol>`;
  },

  marksPanel(state) {
    const html = this.marksPanelHTML(state.marks, state.cur, true);   // parent side
    return html ? `<aside class="marks-panel">${html}</aside>` : "";
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

    if (state.screen === "games" || state.screen === "play") {
      const name = state.game ? t(state.game) : "";
      el("mirror-status").textContent = state.screen === "play"
        ? t("live_playing").replace("{game}", name)
        : t("live_games");
      el("mirror-time").textContent = state.left != null ? "🎮 " + fmtTime(state.left) : "";
      el("mirror-body").innerHTML =
        `<div class="mirror-idle"><div class="big-emoji">🎮</div>${
          name ? `<p>${name}</p>` : ""}</div>`;
      return;
    }

    if (state.screen === "sprint") {
      el("mirror-status").textContent = t("live_sprint");
      el("mirror-time").textContent = `${state.n || 1}/${state.total || 5}`;
      const icon = { o: "✅", n: "❌", t: "⏱" };
      const done = (state.tiles || "").split("").map(c => icon[c] || "❌").join(" ");
      el("mirror-body").innerHTML =
        `<div class="mirror-idle"><div class="big-emoji">⚡</div>
           <p class="sprint-q">${esc(state.fact || "")}</p>
           <p class="status">${done}</p></div>`;
      return;
    }

    if (state.screen === "result") {
      el("mirror-status").textContent = t("live_done");
      el("mirror-time").textContent = state.elapsed ? "⏱ " + fmtTime(state.elapsed) : "";
      const marks = state.marks || (state.grid || []).map(ok => ok ? "ok" : "no");
      const icon = { ok: "✅", ok2: "✔️", fix: "✔️", exp: "💡", no: "❌", skip: "⏭" };
      const tiles = marks.map((m, i) =>
        `<div class="result-tile ${m === "skip" ? "todo" : (m || "no")}">` +
        `<span class="num">${i + 1}</span><span class="mark">${icon[m] || "❌"}</span></div>`).join("");
      const sc = state.score || { solved: 0, total: 0 };
      el("mirror-body").innerHTML =
        `<p class="status" style="text-align:center">${
          t("result_score").replace("{c}", sc.solved).replace("{t}", sc.total)}</p>
         <div class="result-grid">${tiles}</div>`;
      return;
    }

    // a question is on screen
    const q = state.q;
    if (!q) {                       // a beat arrived without a som in it —
      el("mirror-status").textContent = t("live_busy");   // say so rather than
      el("mirror-time").textContent = "";                 // leave an empty card
      el("mirror-body").innerHTML = `<div class="mirror-idle"><div class="big-emoji">⏳</div></div>`;
      return;
    }
    el("mirror-status").textContent =
      t("live_question").replace("{n}", state.n).replace("{t}", state.total);
    el("mirror-time").textContent = state.elapsed ? "⏱ " + fmtTime(state.elapsed) : "";

    // The answer stays covered until asked for — otherwise a glance at the
    // parent's screen gives it away. Every new som covers it again.
    const key = state.n + "/" + q.tplId;
    if (this._revealKey !== key) { this._revealKey = key; this.hideAnswer(); }

    const text = Engine.text(q, LANG);          // rendered in the PARENT's language
    const opts = q.options.map((o, i) => {
      let cls = "mirror-opt";
      if (q.chosen !== null && q.chosen !== undefined && i === q.chosen) {
        cls += (i === q.answerIdx) ? " picked-ok" : " picked-no";
      }
      return `<div class="${cls}">${o}</div>`;
    }).join("");

    // once a choice is made, say plainly how it went — colour alone is easy to
    // miss from across the room
    const picked = q.chosen !== null && q.chosen !== undefined;
    const right = picked && q.chosen === q.answerIdx;
    const verdict = picked
      ? `<div class="mirror-verdict ${right ? "right" : "wrong"}">${
           right ? "✅ " + t("verdict_right") : "❌ " + t("verdict_wrong")}</div>`
      : "";

    // the same button both ways: press to see it, press again to put it away
    const footer = this._revealed
      ? `<button id="mirror-reveal" class="mirror-key shown" title="${t("hide_answer")}">
           ${t("live_answer")}: <b>${q.options[q.answerIdx]}</b> <span class="tuck">🙈</span>
         </button>`
      : `<button id="mirror-reveal" class="mirror-reveal">👁️ ${t("show_answer")}</button>`;

    el("mirror-body").innerHTML =
      `<div class="mirror-split">
         <div class="mirror-main">
           <p class="mirror-q">${text}</p>
           <div class="mirror-options">${opts}</div>
           ${verdict}
           ${q.skipped ? `<div class="mirror-note">⏭ ${t("skip")}</div>` : ""}
           ${q.hinted ? `<div class="mirror-note">💡 ${t("hint_used")}</div>` : ""}
           ${footer}
         </div>
         ${this.marksPanel(state)}
       </div>`;

    const reveal = el("mirror-reveal");
    if (reveal) reveal.onclick = () => { this._revealed = !this._revealed; this.rerender(); };
  },

  hideAnswer() { this._revealed = false; }
};
