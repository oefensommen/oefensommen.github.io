/* Klok — one clock on its own page, read or set, one question at a time.

   Ten clocks, a minute each. Each question is one of two kinds, drawn at
   random: the clock is shown and two Dutch readings sit beneath it (pick the
   right one), or the Dutch time is written beneath and the child sets the
   hands by dragging them (mouse or finger). Ten out of ten opens the
   Kampioenenliga: the same ten, thirty seconds each. Ten out of ten there is
   the biggest celebration. Nothing is written to the cloud: it is practice.

   Dutch clock language (the way the werkblad prints it):
     :00 "3 uur"          :05 "5 over 3"        :10 "10 over 3"
     :15 "kwart over 3"   :20 "10 voor half 4"  :25 "5 voor half 4"
     :30 "half 4"         :35 "5 over half 4"   :40 "10 over half 4"
     :45 "kwart voor 4"   :50 "10 voor 4"       :55 "5 voor 4"
   "half 4" is half past THREE, not four: that is the mistake this teaches. */

const Klokles = (() => {
  const ROUND_SECS = 60, LEAGUE_SECS = 30, N = 10;
  const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  const C = 110, R = 104;                       // svg geometry, viewBox 220

  let KL = null;                                // the running round, or null
  let timer = 0, dragging = null, svgEl = null, onExitFn = null;

  const rnd = n => Math.floor(Math.random() * n);
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const $ = id => document.getElementById(id);
  const nextH = h => (h === 12 ? 1 : h + 1);
  const prevH = h => (h === 1 ? 12 : h - 1);

  /* the Dutch words for a clock time, h 1..12, m a multiple of five */
  function phrase(h, m) {
    const nx = nextH(h);
    return ({
      0: `${h} uur`, 5: `5 over ${h}`, 10: `10 over ${h}`, 15: `kwart over ${h}`,
      20: `10 voor half ${nx}`, 25: `5 voor half ${nx}`, 30: `half ${nx}`,
      35: `5 over half ${nx}`, 40: `10 over half ${nx}`, 45: `kwart voor ${nx}`,
      50: `10 voor ${nx}`, 55: `5 voor ${nx}`
    })[m];
  }

  /* the wrong reading for a pick question: the confusions children really make
     (hour off by one, the half that points the other way, voor and over swapped) */
  function wrongTime(h, m) {
    const cands = shuffle([
      { h: nextH(h), m }, { h: prevH(h), m },
      { h, m: (60 - m) % 60 }, { h, m: (m + 30) % 60 }
    ]);
    const right = phrase(h, m);
    return cands.find(c => phrase(c.h, c.m) !== right && phrase(c.h, c.m));
  }

  /* a face drawn for a clock: hands at h and m, optionally the one to drag */
  function faceSVG(h, m, interactive) {
    let ticks = "";
    for (let i = 0; i < 60; i++) {
      const big = i % 5 === 0, a = (i * 6) * Math.PI / 180;
      const r1 = R - (big ? 13 : 7), r2 = R - 2;
      ticks += `<line x1="${(C + r1 * Math.sin(a)).toFixed(1)}" y1="${(C - r1 * Math.cos(a)).toFixed(1)}"
                 x2="${(C + r2 * Math.sin(a)).toFixed(1)}" y2="${(C - r2 * Math.cos(a)).toFixed(1)}"
                 stroke-width="${big ? 2.4 : 1.1}"/>`;
    }
    let nums = "";
    for (let n = 1; n <= 12; n++) {
      const a = n * 30 * Math.PI / 180, r = R - 30;
      nums += `<text x="${(C + r * Math.sin(a)).toFixed(1)}" y="${(C - r * Math.cos(a)).toFixed(1)}"
                 text-anchor="middle" dominant-baseline="central" class="klok-num">${n}</text>`;
    }
    const hand = (cls, len) => `<line id="kl-${cls}" x1="${C}" y1="${C}" class="klok-hand ${cls === "h" ? "hour" : "minute"}"/>`;
    return `<svg viewBox="0 0 220 220" class="klok-face kl-face ${interactive ? "kl-live" : ""}" role="img"
              aria-label="klok" style="width:min(74vw,320px);height:min(74vw,320px);display:block;margin:0 auto">
      <circle cx="${C}" cy="${C}" r="${R}" class="klok-rim"/>
      <g class="klok-ticks">${ticks}</g>${nums}
      ${hand("h")}${hand("m")}
      <circle cx="${C}" cy="${C}" r="4.5" class="klok-pin"/>
    </svg>`;
  }

  /* put the hands where h and m say */
  function placeHands(h, m) {
    const hd = ((h % 12) + m / 60) * 30, md = m * 6;
    const set = (id, deg, len) => {
      const el = document.getElementById(id); if (!el) return;
      const a = deg * Math.PI / 180;
      el.setAttribute("x2", (C + len * Math.sin(a)).toFixed(1));
      el.setAttribute("y2", (C - len * Math.cos(a)).toFixed(1));
    };
    set("kl-h", hd, R * 0.5);
    set("kl-m", md, R * 0.8);
  }

  /* the angle of a pointer around the face, clockwise from twelve */
  function pointerTo(e) {
    const rect = svgEl.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2), dy = e.clientY - (rect.top + rect.height / 2);
    const deg = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
    const dist = Math.hypot(dx, dy) / (rect.width / 2) * R;
    return { deg, near: dist < R * 0.45 };
  }

  function dragMove(e) {
    if (!dragging || !KL || KL.locked) return;
    const { deg } = pointerTo(e);
    if (dragging === "h") {
      const hh = Math.round(deg / 30) % 12;
      KL.cur.h = hh === 0 ? 12 : hh;                         // the hour hand snaps to the hour
    } else {
      KL.cur.m = (Math.round(deg / 30) * 5) % 60;            // the minute hand snaps to five minutes
    }
    placeHands(KL.cur.h, KL.cur.m);
  }

  function onDown(e) {
    if (!KL || KL.locked) return;
    dragging = pointerTo(e).near ? "h" : "m";
    svgEl.setPointerCapture && svgEl.setPointerCapture(e.pointerId);
    dragMove(e);
  }
  function onUp() { dragging = null; }

  /* ---- the timer strip ---- */
  function startTimer(secs) {
    clearInterval(timer);
    const bar = $("kl-bar"), total = secs * 1000;
    KL.deadline = Date.now() + total;
    bar.style.transition = "none"; bar.style.width = "100%"; void bar.offsetWidth;
    bar.style.transition = `width ${total}ms linear`; bar.style.width = "0%";
    timer = setInterval(() => {
      const left = KL.deadline - Date.now();
      $("kl-count").textContent = Math.max(0, Math.ceil(left / 1000));
      if (left <= 0) { clearInterval(timer); settle(false, "late"); }
    }, 200);
    $("kl-count").textContent = secs;
  }

  /* ---- questions ---- */
  function makeQuestions() {
    const seen = new Set(), qs = [];
    while (qs.length < N) {
      const h = rnd(12) + 1, m = MINUTES[rnd(MINUTES.length)];
      const key = h + ":" + m;
      if (seen.has(key)) continue;
      seen.add(key);
      const type = Math.random() < 0.5 ? "pick" : "set";
      const q = { h, m, type, text: phrase(h, m) };
      if (type === "pick") {
        const w = wrongTime(h, m);
        q.opts = shuffle([{ t: q.text, ok: true }, { t: phrase(w.h, w.m), ok: false }]);
      }
      qs.push(q);
    }
    return qs;
  }

  function renderQ() {
    const q = KL.qs[KL.i];
    KL.q = q; KL.locked = false;
    KL.cur = q.type === "set" ? { h: 12, m: 0 } : { h: q.h, m: q.m };
    $("kl-progress").textContent = `${KL.i + 1} / ${N}`;
    $("kl-title").textContent = KL.league ? "Kampioenenliga" : "Klok";
    $("kl-face").innerHTML = faceSVG(KL.cur.h, KL.cur.m, q.type === "set");
    svgEl = $("kl-face").querySelector("svg");
    if (q.type === "set") {
      placeHands(KL.cur.h, KL.cur.m);
      svgEl.addEventListener("pointerdown", onDown);
      svgEl.addEventListener("pointermove", dragMove);
      $("kl-text").textContent = q.text;
      $("kl-opts").innerHTML = "";
      $("kl-check").classList.remove("hidden");
    } else {
      $("kl-text").textContent = "";
      $("kl-opts").innerHTML = q.opts.map((o, i) =>
        `<button class="kl-opt" data-i="${i}">${o.t}</button>`).join("");
      $("kl-opts").querySelectorAll(".kl-opt").forEach(b =>
        b.addEventListener("click", () => settle(q.opts[+b.dataset.i].ok, "pick", b)));
      $("kl-check").classList.add("hidden");
    }
    $("kl-flash").textContent = "";
    $("kl-flash").className = "kl-flash";
    show_panel(false);
    startTimer(KL.league ? LEAGUE_SECS : ROUND_SECS);
  }

  /* answered (or ran out): show it, then the next one */
  function settle(ok, how, btn) {
    if (!KL || KL.locked) return;
    KL.locked = true;
    clearInterval(timer);
    const q = KL.q;
    if (ok) KL.right++;
    KL.tiles += ok ? "o" : "n";
    if (q.type === "pick") {
      $("kl-opts").querySelectorAll(".kl-opt").forEach(b => {
        const o = q.opts[+b.dataset.i]; b.disabled = true;
        if (o.ok) b.classList.add("right");
        else if (b === btn) b.classList.add("wrong");
      });
    } else {
      placeHands(q.h, q.m);                               // show the answer on the face
      $("kl-check").classList.add("hidden");
    }
    const msg = ok ? "Goed zo!" : how === "late" ? `Te laat! Het was: ${q.text}` : `Net niet. Het was: ${q.text}`;
    $("kl-flash").textContent = msg;
    $("kl-flash").className = "kl-flash " + (ok ? "good" : "bad");
    setTimeout(next, ok ? 900 : 1600);
  }

  function next() {
    if (!KL) return;
    KL.i++;
    if (KL.i < N) return renderQ();
    endRound();
  }

  function endRound() {
    if (!KL.league && KL.right === N) return panel({
      kicker: "10 van 10!", title: "Klaar voor de Kampioenenliga?",
      text: "Elke klok 30 seconden. Haal er 10 van 10 en je wordt kampioen!",
      go: "Naar de Kampioenenliga 🏆", onGo: () => begin(true)
    });
    if (KL.league && KL.right === N) return win();
    panel({
      kicker: `${KL.right} van ${N} goed`,
      title: KL.league ? "Bijna kampioen!" : "Oefen nog een keer",
      text: KL.league ? "Je hebt 10 van 10 nodig. Probeer het nog eens!"
                      : "Haal 10 van 10 voor de Kampioenenliga.",
      go: "Opnieuw", onGo: () => begin(false),
      alt: "Klaar", onAlt: () => exit()
    });
  }

  /* the intro card and the result card share one panel */
  function panel(p) {
    clearInterval(timer);
    $("kl-panel").innerHTML = `
      <p class="kl-kicker">${p.kicker}</p>
      <h3 class="kl-ptitle">${p.title}</h3>
      <p class="kl-ptext">${p.text}</p>
      <button id="kl-go" class="btn primary big">${p.go}</button>
      ${p.alt ? `<button id="kl-alt" class="kl-alt">${p.alt}</button>` : ""}`;
    $("kl-go").addEventListener("click", p.onGo);
    if (p.alt) $("kl-alt").addEventListener("click", p.onAlt);
    $("kl-face").innerHTML = ""; $("kl-text").textContent = ""; $("kl-opts").innerHTML = "";
    $("kl-check").classList.add("hidden");
    $("kl-bar").style.width = "0%";
    $("kl-count").textContent = "";
    show_panel(true);
  }

  function show_panel(on) {
    $("kl-panel").classList.toggle("hidden", !on);
    $("kl-body").classList.toggle("hidden", on);
  }

  /* "Klaar": the hands against the time written beneath the clock */
  function check() {
    if (!KL || KL.locked || !KL.q || KL.q.type !== "set") return;
    settle(KL.cur.h === KL.q.h && KL.cur.m === KL.q.m, "check");
  }

  function begin(league) {
    KL = { league, qs: makeQuestions(), i: 0, right: 0, tiles: "", locked: false, cur: null, q: null };
    renderQ();
  }

  function intro() {
    panel({
      kicker: "Klok",
      title: "Lees de klok, of zet de wijzers",
      text: "10 klokken, elk 1 minuut. Kies de juiste tekst, of draai de wijzers naar de tijd. Alles goed? Dan de Kampioenenliga!",
      go: "Start", onGo: () => begin(false)
    });
  }

  /* the cup, with the same fireworks as the sprint */
  function win() {
    clearInterval(timer);
    $("kl-face").innerHTML = ""; show_panel(false);
    const box = $("champ-win");
    box.classList.add("mega");
    $("champ-win-trophy").textContent = "👑";
    $("champ-win-title").textContent = "KLOKKAMPIOEN!";
    $("champ-win-sub").textContent = "Jij kent de klok! 🕐";
    $("champ-win-score").textContent = `10 van 10, ${LEAGUE_SECS} seconden per klok`;
    $("champ-win-close").textContent = "Verder";
    $("champ-win-later").classList.add("hidden");
    box.classList.remove("hidden");
    Fireworks.start($("champ-fw"), $("champ-float"), { mega: true });
    $("champ-win-close").onclick = () => {
      Fireworks.stop(); box.classList.add("hidden"); box.classList.remove("mega");
      exit();
    };
  }

  function exit() {
    stop();
    const fn = onExitFn; onExitFn = null;
    if (fn) fn();
  }

  /* leaves the page and clears every timer: safe to call any time */
  function stop() {
    clearInterval(timer); timer = 0;
    dragging = null; KL = null;
    if (svgEl) { svgEl = null; }
  }

  let wired = false;
  return {
    start(onExit) {
      onExitFn = onExit;
      if (!wired) { $("kl-check").addEventListener("click", check); wired = true; }
      show("screen-klokles");
      intro();
    },
    stop,
    quit() { exit(); },
    /* exposed for tests */
    _phrase: phrase, _wrong: wrongTime, _makeQuestions: makeQuestions, _state: () => KL
  };
})();
