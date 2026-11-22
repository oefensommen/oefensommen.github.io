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
  const SECS = { set: 60, pick: 30 };             // a set-the-hands clock: 1 minute; two readings: 30 seconds
  const TIERS = ["Klok", "Champions League", "Dinosaurus League"];
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
    return `<svg viewBox="0 0 220 220" class="klok-face kl-face ${live ? "kl-live" : ""}" role="img"
              aria-label="klok" style="width:min(74vw,320px);height:min(74vw,320px);display:block;margin:0 auto">
      <circle cx="${C}" cy="${C}" r="${R}" class="klok-rim"/>
      <g class="klok-ticks">${ticks}</g>${nums}
      <line id="kl-h" x1="${C}" y1="${C}" class="klok-hand hour"/>
      <line id="kl-m" x1="${C}" y1="${C}" class="klok-hand minute"/>
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
        // position 0 is always blue, position 1 always red
        q.opts = shuffle([{ t: q.text, ok: true }, { t: phrase(w.h, w.m), ok: false }]);
      }
      qs.push(q);
    }
    return qs;
  }

  /* the tiles on the right: the same marks the sprint shows */
  function renderMarks() {
    const marks = KL.qs.map((_, i) => {
      const ch = KL.tiles[i];
      return ch === "o" ? "ok" : ch === "n" ? "no" : ch === "t" ? "skip" : "";
    });
    $("kl-marks").innerHTML = Live.marksPanelHTML(marks, KL.i);
  }

  /* which card may be changed now: the minutes, then the hour, then the check */
  function applyStage() {
    const st = KL ? KL.stage : null;
    $("kl-card-m").classList.toggle("active", st === "m");
    $("kl-card-m").classList.toggle("locked", st !== "m");
    $("kl-card-h").classList.toggle("active", st === "h");
    $("kl-card-h").classList.toggle("locked", st !== "h");
    $("kl-card-m").querySelectorAll("button").forEach(b => b.disabled = st !== "m");
    $("kl-card-h").querySelectorAll("button:not(#kl-h-x)").forEach(b => b.disabled = st !== "h");
    $("kl-h-x").disabled = false;                     // × stays usable: back to the minute
    $("kl-h-x").classList.toggle("hidden", st !== "h" && st !== "done");
    $("kl-m-ok").classList.toggle("hidden", st !== "m");
    $("kl-h-ok").classList.toggle("hidden", st !== "h");
    $("kl-check").classList.toggle("hidden", st !== "done");
  }

  function confirmStage(which) {
    if (!KL || KL.locked || !KL.q || KL.q.type !== "set" || KL.stage !== which) return;
    KL.stage = which === "m" ? "h" : "done";
    applyStage();
  }

  /* × on the hour card: back to the minute, the hour kept as it was */
  function backToMinute() {
    if (!KL || KL.locked || !KL.q || KL.q.type !== "set") return;
    if (KL.stage !== "h" && KL.stage !== "done") return;
    KL.stage = "m";
    applyStage();
  }

  /* move one hand by a step: the hour by one hour, the minute by five minutes */
  function nudge(which, step) {
    if (!KL || KL.locked || !KL.q || KL.q.type !== "set" || KL.stage !== which) return;
    if (which === "h") KL.cur.h = ((KL.cur.h - 1 + step + 12) % 12) + 1;
    else KL.cur.m = (KL.cur.m + step * 5 + 60) % 60;
    placeHands(KL.cur.h, KL.cur.m);
  }

  function renderQ() {
    const q = KL.qs[KL.i];
    KL.q = q; KL.locked = false;
    KL.cur = q.type === "set" ? startPosition(q) : { h: q.h, m: q.m };
    $("kl-progress").textContent = `${KL.i + 1} / ${N}`;
    $("kl-title").textContent = TIERS[KL.tier];
    document.body.classList.toggle("kl-t1", KL.tier === 1);
    document.body.classList.toggle("kl-t2", KL.tier === 2);
    $("screen-klokles").classList.toggle("kl-t1", KL.tier === 1);
    $("screen-klokles").classList.toggle("kl-t2", KL.tier === 2);
    $("kl-face").innerHTML = faceSVG(KL.cur.h, KL.cur.m, q.type === "set");
    if (q.type === "set") {
      placeHands(KL.cur.h, KL.cur.m);
      $("kl-text").textContent = q.text;
      $("kl-opts").innerHTML = "";
      $("kl-nudge").classList.remove("hidden");
      KL.stage = "m";                                  // minutes first, then the hour
      applyStage();
    } else {
      $("kl-text").textContent = "";
      $("kl-opts").innerHTML = q.opts.map((o, i) =>
        `<button class="kl-opt ${i === 0 ? "kl-opt-b" : "kl-opt-r"}" data-i="${i}">${esc(o.t)}</button>`).join("");
      $("kl-opts").querySelectorAll(".kl-opt").forEach(b =>
        b.addEventListener("click", () => settle(q.opts[+b.dataset.i].ok, "pick", b)));
      $("kl-nudge").classList.add("hidden");
      $("kl-check").classList.add("hidden");
    }
    $("kl-flash").textContent = "";
    $("kl-flash").className = "kl-flash";
    show_panel(false);
    renderMarks();
    startTimer(SECS[q.type]);
  }

  /* answered (or ran out): show it, explain a miss, then the next one */
  function settle(ok, how, btn) {
    if (!KL || KL.locked) return;
    KL.locked = true;
    clearInterval(timer);
    const q = KL.q;
    if (ok) KL.right++;
    KL.tiles += ok ? "o" : how === "late" ? "t" : "n";
    if (q.type === "pick") {
      $("kl-opts").querySelectorAll(".kl-opt").forEach(b => {
        const o = q.opts[+b.dataset.i]; b.disabled = true;
        if (o.ok) b.classList.add("right");
        else if (b === btn) b.classList.add("wrong");
      });
    } else {
      placeHands(q.h, q.m);                            // show the answer on the face
      $("kl-nudge").classList.add("hidden");
      $("kl-check").classList.add("hidden");
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
    setTimeout(next, ok ? 900 : 4200);
  }

  function next() {
    if (!KL) return;
    KL.i++;
    if (KL.i < N) return renderQ();
    endRound();
  }

  function endRound() {
    if (KL.right !== N) {
      return panel({
        kicker: `${KL.right} van ${N} goed`,
        title: "Oefen nog een keer",
        text: `Haal 10 van 10 voor de ${TIERS[1]}.`,
        go: "Opnieuw", onGo: () => begin(0),
        alt: "Klaar", onAlt: () => exit()
      });
    }
    if (KL.tier === 0) return panel({
      kicker: "10 van 10!", title: "Klaar voor de Champions League?",
      text: "Haal er weer 10 van 10 en je gaat door naar de Dinosaurus League.",
      go: "Naar de Champions League 🏆", onGo: () => begin(1)
    });
    if (KL.tier === 1) return win(1);
    win(2);
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

  function intro() {
    panel({
      kicker: "Klok",
      title: "Lees de klok, of zet de wijzers",
      text: "10 klokken. Bij een keuze heb je 30 seconden, bij de wijzers 1 minuut. Alles goed? Dan de Champions League!",
      go: "Start", onGo: () => begin(0)
    });
  }

  /* a cup is won: fireworks, and the way on, or the end of the road */
  function win(tier) {
    clearInterval(timer);
    $("kl-face").innerHTML = ""; show_panel(false);
    const box = $("champ-win");
    const last = tier === 2;
    box.classList.add("mega");
    $("champ-win-trophy").textContent = last ? "🦖" : "🏆";
    $("champ-win-title").textContent = last ? "DINOSAURUS KAMPIOEN!" : "CHAMPIONS LEAGUE!";
    $("champ-win-sub").textContent = last ? "Jij bent de koning van de klok! 🦖👑" : "Je kent de klok! Nu de dinosaurussen! 🦕";
    $("champ-win-score").textContent = "10 van 10 goed";
    const go = $("champ-win-close"), later = $("champ-win-later");
    go.textContent = last ? "Verder" : "Naar de Dinosaurus League 🦖";
    later.textContent = "Verder";
    later.classList.toggle("hidden", last);
    box.classList.remove("hidden");
    Fireworks.start($("champ-fw"), $("champ-float"), { mega: true });
    const close = after => () => {
      Fireworks.stop(); box.classList.add("hidden"); box.classList.remove("mega");
      after();
    };
    go.onclick = close(last ? exit : () => begin(2));
    later.onclick = close(exit);
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
    document.body.classList.remove("kl-t1", "kl-t2");
  }

  return {
    start(onExit) {
      onExitFn = onExit;
      if (!wired) {
        $("kl-check").addEventListener("click", () => {
          if (!KL || KL.locked || !KL.q || KL.q.type !== "set" || KL.stage !== "done") return;
          settle(KL.cur.h === KL.q.h && KL.cur.m === KL.q.m, "check");
        });
        [["kl-h-dn", "h", -1], ["kl-h-up", "h", 1], ["kl-m-dn", "m", -1], ["kl-m-up", "m", 1]]
          .forEach(([id, w, st]) => $(id).addEventListener("click", () => nudge(w, st)));
        $("kl-m-ok").addEventListener("click", () => confirmStage("m"));
        $("kl-h-ok").addEventListener("click", () => confirmStage("h"));
        $("kl-h-x").addEventListener("click", backToMinute);
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
