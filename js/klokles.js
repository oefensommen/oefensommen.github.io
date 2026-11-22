/* Klok — one clock on its own page, read it or set it, one question at a time.

   Ten clocks in a round. Each question is one of two kinds, drawn at random:
   the clock is shown and two readings sit beneath it (blue or red: pick the
   right one, 30 seconds), or the Dutch time is written beneath and the child
   sets the hands with the − and + controls (minute first, then the hour,
   1 minute). Ten out of ten opens the Champions League; ten out of ten there
   opens the Dinosaurus League. Every wrong answer shows the right time and
   why, in short Dutch. Nothing is written to the cloud: it is practice.

   Dutch clock language (the way the werkblad prints it):
     :00 "3 uur"          :05 "5 over 3"        :10 "10 over 3"
     :15 "kwart over 3"   :20 "10 voor half 4"  :25 "5 voor half 4"
     :30 "half 4"         :35 "5 over half 4"   :40 "10 over half 4"
     :45 "kwart voor 4"   :50 "10 voor 4"       :55 "5 voor 4"
   "half 4" is half past THREE, not four: that is the mistake this teaches. */

const Klokles = (() => {
  const N = 10;
  const sec = tier => window.secsOf("klokles", tier);   // seconds a clock gets, per level (set in the rapport)
  // the level names are the tafels' own: Wandelliga, Kampioensronde, Dinozorenliga
  const tierName = i => [t("sprint_title"), t("champ_title"), t("super_title")][i];
  const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  const C = 110, R = 104;                         // svg geometry, viewBox 220

  let KL = null;                                  // the running round, or null
  let timer = 0, onExitFn = null, wired = false;

  const rnd = n => Math.floor(Math.random() * n);
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const nextH = h => (h === 12 ? 1 : h + 1);
  const prevH = h => (h === 1 ? 12 : h - 1);
  const pad = m => String(m).padStart(2, "0");

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

  /* why it is that time, in short Dutch — shown after a wrong answer */
  function explain(h, m) {
    const nx = nextH(h), hh = `${h}:${pad(m)}`;
    switch (m) {
      case 0:  return `De grote wijzer staat op 12, de kleine op ${h}. Dat is ${h} uur.`;
      case 5:
      case 10: return `${m} minuten na ${h}. "over" betekent: na het uur. Dat is ${hh}.`;
      case 15: return `Kwart is 15 minuten. De grote wijzer staat op 3. Dat is ${hh}: kwart over ${h}.`;
      case 20:
      case 25: return `"half ${nx}" is ${h}:30. ${30 - m} minuten ervoor is ${hh}: "${30 - m} voor half ${nx}".`;
      case 30: return `"half ${nx}" is halverwege tussen ${h} en ${nx}. Dat is ${hh}.`;
      case 35:
      case 40: return `"half ${nx}" is ${h}:30. ${m - 30} minuten erna is ${hh}: "over half ${nx}".`;
      case 45: return `Kwart voor ${nx} is 15 minuten voor ${nx}. Dat is ${hh}.`;
      default: return `${60 - m} minuten voor ${nx}. Dat is ${hh}: "${60 - m} voor ${nx}".`;
    }
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

  /* a face for the clock: hands at h and m; interactive only tints the hands */
  function faceSVG(h, m, live) {
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
    return `<svg viewBox="0 0 220 220" class="klok-face kl-face kl-live" role="img" aria-label="klok">
      <circle cx="${C}" cy="${C}" r="${R}" class="klok-rim"/>
      <g class="klok-ticks">${ticks}</g>${nums}
      <line id="kl-h" x1="${C}" y1="${C}" x2="${C}" y2="${C}" class="klok-hand hour"/>
      <line id="kl-m-c" x1="${C}" y1="${C}" x2="${C}" y2="${C}" class="kl-case"/>
      <line id="kl-m" x1="${C}" y1="${C}" x2="${C}" y2="${C}" class="klok-hand minute"/>
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
    set("kl-m-c", md, R * 0.8);
    set("kl-m", md, R * 0.8);
  }

  /* a random start for the hands: never stacked (at least 30 degrees apart),
     and never already the answer */
  function startPosition(q) {
    for (;;) {
      const h = rnd(12) + 1, m = MINUTES[rnd(MINUTES.length)];
      const hd = ((h % 12) + m / 60) * 30, md = m * 6;
      const gap = Math.abs(hd - md) % 360, apart = Math.min(gap, 360 - gap);
      if (apart >= 30 && !(h === q.h && m === q.m)) return { h, m };
    }
  }

  /* ---- touching the face ----
     Tap the hour or the minute hand: that hand is selected (highlighted, and its
     card lights up). Drag a selected hand to move only that hand. Tap the dial
     anywhere else and the selection goes. The − and + controls keep working. */
  const angDiff = (a, b) => { const x = Math.abs(a - b) % 360; return Math.min(x, 360 - x); };

  /* the angle of a pointer around the face, and its distance from the centre
     in the face's own units (0..220) */
  function faceAt(e) {
    const svg = $("kl-face").querySelector("svg");
    const rect = svg.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2), dy = e.clientY - (rect.top + rect.height / 2);
    const deg = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
    const dist = Math.hypot(dx, dy) * (220 / rect.width);
    return { deg, dist };
  }

  /* which hand, if any, a tap landed on */
  function handAt(deg, dist) {
    const hd = ((KL.cur.h % 12) + KL.cur.m / 60) * 30, md = KL.cur.m * 6;
    const dh = angDiff(deg, hd), dm = angDiff(deg, md);
    if (dist > 10 && dm <= 14 && dist <= R * 0.85 && (dm <= dh || dh > 18)) return "m";
    if (dist > 10 && dh <= 18 && dist <= R * 0.55) return "h";
    return null;
  }

  /* the selection is drawn on the hands and on their cards */
  function showSelection() {
    const sel = KL && KL.sel;
    const h = document.getElementById("kl-h"), m = document.getElementById("kl-m");
    if (h) h.classList.toggle("sel", sel === "h");
    if (m) m.classList.toggle("sel", sel === "m");
    const cm = document.getElementById("kl-card-m"), ch = document.getElementById("kl-card-h");
    if (cm) cm.classList.toggle("picked", sel === "m");
    if (ch) ch.classList.toggle("picked", sel === "h");

    if (cm) cm.classList.toggle("done", KL && KL.step !== "m");
    if (ch) ch.classList.toggle("done", KL && KL.step === "done");
  }

  /* the frames: tap one to choose which hand the + and − move. Minute is the default. */
  function pick(which) {
    if (!KL || KL.locked || !KL.q || KL.q.type !== "set") return;
    KL.sel = which;
    showSelection();
  }

  /* ✓ on the minute: the minute is kept, the hour is picked next.
     ✓ on the hour: the hour is kept; Klaar ✓ checks the whole time. */
  function confirmHand(which) {
    if (!KL || KL.locked || !KL.q || KL.q.type !== "set") return;
    if (which === "m") { KL.step = "h"; KL.sel = "h"; }
    else { KL.step = "done"; KL.sel = "h"; }
    showSelection();
  }

  /* × on the minute: that hand goes back to where it started */
  function resetMinute() {
    if (!KL || KL.locked || !KL.q || KL.q.type !== "set") return;
    KL.cur.m = KL.start.m;
    KL.step = "m"; KL.sel = "m";
    placeHands(KL.cur.h, KL.cur.m);
    showSelection();
  }

  /* × on the hour: back to the minute, to change it again */
  function backToMinute() {
    if (!KL || KL.locked || !KL.q || KL.q.type !== "set") return;
    KL.step = "m"; KL.sel = "m";
    showSelection();
  }

  /* a drag moves the selected hand only, snapped: the hour to the hour, the minute to five minutes */
  function faceMove(e) {
    if (!KL || KL.locked || !KL.dragging) return;
    const { deg } = faceAt(e);
    if (KL.dragging === "h") {
      const hh = Math.round(deg / 30) % 12;
      KL.cur.h = hh === 0 ? 12 : hh;
    } else {
      KL.cur.m = (Math.round(deg / 30) * 5) % 60;
    }
    placeHands(KL.cur.h, KL.cur.m);
  }

  function faceDown(e) {
    if (!KL || KL.locked || !KL.q || KL.q.type !== "set") return;
    const { deg, dist } = faceAt(e);
    const hit = handAt(deg, dist);
    KL.dragging = hit;                  // a tap on the dial away from the hands keeps the current choice
    if (hit) {
      KL.sel = hit;
      showSelection();
      const svg = $("kl-face").querySelector("svg");
      svg.setPointerCapture && svg.setPointerCapture(e.pointerId);
      faceMove(e);
    }
  }

  function faceUp() { if (KL) KL.dragging = null; }

  /* ---- the timer strip ---- */
  /* the same timer bar as the tafels: it fills from the left, and its colour
     goes green, yellow, orange and red as the time runs out */
  function barColour(frac) {
    return frac < 0.4 ? "#2fb35c" : frac < 0.65 ? "#f5c542" : frac < 0.85 ? "#ff8a3d" : "#e0455c";
  }

  function startTimer(secs) {
    clearInterval(timer);
    const bar = $("kl-bar"), total = secs * 1000;
    KL.deadline = Date.now() + total;
    bar.style.transition = "none";
    const paint = () => {
      const left = Math.max(0, KL.deadline - Date.now());
      const frac = 1 - left / total;
      bar.style.width = (frac * 100).toFixed(2) + "%";
      bar.style.backgroundColor = barColour(frac);
      if (left <= 0) { clearInterval(timer); settle(false, "late"); }
    };
    paint();
    timer = setInterval(paint, 50);
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

  /* the tiles on the right: the same marks the sprint shows */
  function renderMarks() {
    const marks = KL.qs.filter(q => q.redo == null).map((_, i) => {
      const ch = KL.tiles[i];
      return ch === "o" ? "ok" : ch === "n" ? "no" : ch === "t" ? "skip" : "";
    });
    $("kl-marks").innerHTML = Live.marksPanelHTML(marks, KL.i);
  }

  /* the set-the-hands controls: always there, and Klaar ✓ and × sit at the bottom */
  function applyStage() {
    const on = !!(KL && KL.q && KL.q.type === "set" && !KL.locked);
    document.querySelectorAll("#kl-nudge button").forEach(b => b.disabled = !on);
    $("kl-final").classList.toggle("hidden", !on);
    showSelection();
  }

  /* move one hand by a step: the hour by one hour, the minute by five minutes.
     Its own − and + move it; the selection stays where it was. */
  /* the one − and + move the selected hand: the hour by one hour, the minute by five minutes */
  function nudge(step) {
    if (!KL || KL.locked || !KL.q || KL.q.type !== "set") return;
    if (KL.sel === "h") KL.cur.h = ((KL.cur.h - 1 + step + 12) % 12) + 1;
    else KL.cur.m = (KL.cur.m + step * 5 + 60) % 60;
    placeHands(KL.cur.h, KL.cur.m);
  }

  function renderQ() {
    const q = KL.qs[KL.i];
    KL.q = q; KL.locked = false;
    KL.cur = q.type === "set" ? startPosition(q) : { h: q.h, m: q.m };
    $("kl-progress").textContent = `${Math.min(KL.i + 1, N)} / ${N}`;
    $("kl-title").textContent = tierName(KL.tier);
    setLevelTheme(KL.tier);                                  // the same background and pictures as the tafels level
    $("kl-face").innerHTML = faceSVG(KL.cur.h, KL.cur.m, q.type === "set");
    if (q.type === "set") {
      placeHands(KL.cur.h, KL.cur.m);
      KL.sel = "m"; KL.step = "m"; KL.dragging = null;   // the minute is picked to start with
      const svgEl = $("kl-face").querySelector("svg");
      svgEl.addEventListener("pointerdown", faceDown);
      svgEl.addEventListener("pointermove", faceMove);
      svgEl.addEventListener("pointerup", faceUp);
      svgEl.addEventListener("pointercancel", faceUp);
      showSelection();
      $("kl-text").textContent = q.text;
      $("kl-opts").innerHTML = "";
      $("kl-nudge").classList.remove("hidden");
      KL.start = { h: KL.cur.h, m: KL.cur.m };
      applyStage();
    } else {
      placeHands(KL.cur.h, KL.cur.m);
      $("kl-text").textContent = "";
      $("kl-opts").innerHTML = q.opts.map((o, i) =>
        `<button class="kl-opt" data-i="${i}">${esc(o.t)}</button>`).join("");
      $("kl-opts").querySelectorAll(".kl-opt").forEach(b =>
        b.addEventListener("click", () => settle(q.opts[+b.dataset.i].ok, "pick", b)));
      $("kl-nudge").classList.add("hidden");
      $("kl-final").classList.add("hidden");
    }
    $("kl-flash").textContent = "";
    $("kl-flash").className = "kl-flash";
    $("kl-next").classList.add("hidden");
    show_panel(false);
    renderMarks();
    startTimer(sec(KL.tier));
  }

  /* answered (or ran out): show it, explain a miss, then the next one */
  function settle(ok, how, btn) {
    if (!KL || KL.locked) return;
    KL.locked = true;
    clearInterval(timer);
    const q = KL.q;
    if (ok) KL.right++;
    if (window.recordKlokLv) window.recordKlokLv(KL.tier, ok);   // the rapport counts it
    if (q.redo != null) {
      if (ok) KL.tiles = KL.tiles.slice(0, q.redo) + "o" + KL.tiles.slice(q.redo + 1);
    } else {
      KL.tiles += ok ? "o" : how === "late" ? "t" : "n";
    }
    if (q.type === "pick") {
      $("kl-opts").querySelectorAll(".kl-opt").forEach(b => {
        const o = q.opts[+b.dataset.i]; b.disabled = true;
        if (o.ok) b.classList.add("right");
        else if (b === btn) b.classList.add("wrong");
      });
    } else {
      placeHands(q.h, q.m);                            // show the answer on the face
      $("kl-nudge").classList.add("hidden");
      $("kl-final").classList.add("hidden");
    }
    const flash = $("kl-flash");
    if (ok) {
      flash.textContent = "Goed zo!";
      flash.className = "kl-flash good";
    } else {
      const lead = how === "late" ? "Te laat!" : "Net niet.";
      flash.innerHTML = `${lead} Het is <b>${esc(q.text)}</b> (${q.h}:${pad(q.m)}).<br>` +
                        `<span class="kl-why">${esc(explain(q.h, q.m))}</span>`;
      flash.className = "kl-flash bad";
    }
    renderMarks();
    if (ok) setTimeout(next, 900);                      // a right one moves on; a wrong one waits to be read
    else { const nb = $("kl-next"); nb.classList.remove("hidden"); nb.onclick = next; }
  }

  function next() {
    if (!KL) return;
    KL.i++;
    if (KL.i < KL.qs.length) return renderQ();
    // the ten clocks are done: the wrong ones come back once, in order
    const asked = new Set(KL.qs.filter(q => q.redo != null).map(q => q.redo));
    const again = [];
    for (let k = 0; k < N; k++) {
      if (!asked.has(k) && "nt".includes(KL.tiles[k])) again.push(k);
    }
    if (again.length) {
      again.forEach(k => KL.qs.push(Object.assign({}, KL.qs[k], { redo: k })));
      return renderQ();
    }
    endRound();
  }

  function endRound() {
    if (KL.right !== N) {
      return panel({
        kicker: `${KL.right} van ${N} goed`,
        title: "Oefen nog een keer",
        text: `Haal 10 van 10 voor de ${tierName(1)}.`,
        go: "Opnieuw", onGo: () => begin(0),
        alt: "Klaar", onAlt: () => exit()
      });
    }
    win(KL.tier);                                 // every level ends on the tafels' own win screen
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
    $("kl-final").classList.add("hidden");
    $("kl-nudge").classList.add("hidden");
    $("kl-bar").style.width = "0%";
    $("kl-count").textContent = "";
    show_panel(true);
  }

  function show_panel(on) {
    $("kl-panel").classList.toggle("hidden", !on);
    $("kl-layout").classList.toggle("hidden", on);
  }

  function begin(tier) {
    KL = { tier, qs: makeQuestions(), i: 0, right: 0, tiles: "", locked: false, cur: null, q: null, stage: null };
    renderQ();
  }

  /* the ready screen is the tafels' own: the same header chips and green Start */
  function intro() {
    clearInterval(timer);
    $("kl-face").innerHTML = ""; $("kl-text").textContent = ""; $("kl-opts").innerHTML = "";
    $("kl-nudge").classList.add("hidden");
    $("kl-final").classList.add("hidden");
    introReady("klok_word", 0, 10, `${sec(0)} s`, () => { show("screen-klokles"); begin(0); });
  }

  /* a level is won: the tafels' own win screen, with the way on or out */
  function win(tier) {
    clearInterval(timer);
    $("kl-face").innerHTML = ""; show_panel(false);
    const last = tier === 2;
    showChampWin(10, 10, tier, exit, last ? null : () => begin(tier + 1));
    $("champ-win-score").textContent = `10 van 10 goed, ${sec(tier)} seconden per klok`;
  }

  function exit() {
    stop();
    const fn = onExitFn; onExitFn = null;
    if (fn) fn();
  }

  /* leaves the page and clears every timer: safe to call any time */
  function stop() {
    clearInterval(timer); timer = 0;
    KL = null;
    setLevelTheme(null);
  }

  return {
    start(onExit) {
      onExitFn = onExit;
      if (!wired) {
        $("kl-check").addEventListener("click", () => {
          if (!KL || KL.locked || !KL.q || KL.q.type !== "set") return;
          settle(KL.cur.h === KL.q.h && KL.cur.m === KL.q.m, "check");
        });
        // one − and one +: they move whichever hand is selected
        $("kl-dn").addEventListener("click", () => nudge(-1));
        $("kl-up").addEventListener("click", () => nudge(1));
        $("kl-card-m").addEventListener("click", () => pick("m"));
        $("kl-card-h").addEventListener("click", () => pick("h"));
        wired = true;
      }
      show("screen-klokles");
      intro();
    },
    stop,
    quit() { exit(); },
    _phrase: phrase, _wrong: wrongTime, _makeQuestions: makeQuestions, _explain: explain, _state: () => KL
  };
})();
