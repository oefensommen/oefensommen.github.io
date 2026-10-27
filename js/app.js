/* Oefensommen — app flow */

/* A phone that kept an old index.html would keep running old code for as long
   as it felt like it, and nobody is going to clear a cache on a tablet. So we
   ask the server for the real index.html and, if it points at newer files than
   the ones we are running, load that version.

   Three things this has to get right, all of them learned the hard way:
   the flag remembers WHICH version it reloaded for, so the next deploy is
   still picked up (a plain "have I reloaded before" flag froze a tablet on an
   old build for the rest of the day); the reload carries the version in the
   address, because a bare reload may be answered from the browser's own copy
   of index.html; and a tab that is simply woken up days later checks again,
   since phones keep tabs alive far longer than anyone reloads them. */
const SelfUpdate = {
  mine: null,
  pending: null,

  async check() {
    try {
      if (!this.mine) {
        const running = (document.querySelector('script[src*="app.js"]') || {}).src || "";
        const m = running.match(/[?&]v=(\d+)/);
        if (!m) return;
        this.mine = m[1];
      }
      const html = await fetch("index.html?u=" + this.mine + "." + Date.now(),
                              { cache: "no-store" }).then(r => r.text());
      const live = (html.match(/app\.js\?v=(\d+)/) || [])[1];
      if (!live || live === this.mine) return;
      if (sessionStorage.getItem("os_selfupdate") === live) return;  // already tried this one
      // never yank a som off the screen — nor a tafel, which until the tenth
      // one has nothing written down anywhere
      if (session || sprint) { this.pending = live; return; }
      this.apply(live);
    } catch (e) { /* offline: keep running what we have */ }
  },

  apply(v) {
    sessionStorage.setItem("os_selfupdate", v);
    location.replace(location.pathname + "?v=" + v);
  },

  /* called when the child is back on the home screen and nothing is running */
  applyIfPending() {
    if (this.pending) this.apply(this.pending);
  }
};

let data = Store.load();
let session = null;           // { questions, idx, firstPass, queue }
let timerInt = null;

SelfUpdate.check();
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) SelfUpdate.check();      // a tablet picked up again
});

const $ = id => document.getElementById(id);

/* ---------- timer (counts up, never down) ---------- */
function fmtTime(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return m + ":" + String(s).padStart(2, "0");
}
function elapsedSec() {
  return session ? Math.floor((Date.now() - session.t0) / 1000) : 0;
}
function tickTimer() {
  if (!session || session.t0 == null) return;   // nothing to count: print nothing
  $("timer").textContent = fmtTime(elapsedSec());
}
function startTimer() {
  if (!session) return;            // the round was put down while the 3·2·1 ran
  session.t0 = Date.now();
  $("timerbox").classList.remove("hidden");
  tickTimer();
  clearInterval(timerInt);
  timerInt = setInterval(tickTimer, 1000);
}
function stopTimer() {
  clearInterval(timerInt);
  timerInt = null;
  $("timerbox").classList.add("hidden");
}

/* ---------- screens ---------- */
function show(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.add("hidden"));
  $(id).classList.remove("hidden");
  $("btn-pause").classList.toggle("hidden", id !== "screen-task");
  $("btn-skip").classList.toggle("hidden", id !== "screen-task");
  $("btn-logout-top").classList.toggle("hidden", id === "screen-login");
  renderLangPicker();          // the menu belongs to whoever is signed in now
}

/* ---------- language ---------- */
const LANG_FLAGS = { nl: "🇳🇱", en: "🇬🇧", tr: "🇹🇷" };

/* The language picker belongs to the parent alone. The child works in Dutch
   and has nothing to choose, so the flag is not there at all — a button that
   does nothing is worse than no button. */
function renderLangPicker() {
  const canSwitch = Store.isParent();
  $("langpick").classList.toggle("hidden", !canSwitch);
  $("lang-flag").textContent = LANG_FLAGS[LANG] || LANG_FLAGS.nl;
  $("lang-current").classList.toggle("switchable", canSwitch);
  $("lang-caret").classList.toggle("hidden", !canSwitch);
  if (!canSwitch) closeLangMenu();
  document.querySelectorAll(".lang-opt").forEach(o =>
    o.classList.toggle("active", o.dataset.lang === LANG));
}

function closeLangMenu() {
  $("lang-menu").classList.add("hidden");
  $("lang-current").classList.remove("open");
  $("lang-current").setAttribute("aria-expanded", "false");
}

function toggleLangMenu() {
  if (!Store.isParent()) return;               // the child has nothing to pick
  const menu = $("lang-menu");
  const opening = menu.classList.contains("hidden");
  menu.classList.toggle("hidden", !opening);
  $("lang-current").classList.toggle("open", opening);
  $("lang-current").setAttribute("aria-expanded", String(opening));
}

/* The parent reads everything in English unless they picked otherwise; the
   choice is remembered per device. The child is untouched — always Dutch. */
function applyRoleLang() {
  if (Store.isParent()) setLang(localStorage.getItem("oefensommen_plang") || "en");
}

function setLang(lang) {
  LANG = lang;
  if (Store.isParent()) localStorage.setItem("oefensommen_plang", lang);
  applyI18n();
  renderLangPicker();
  closeLangMenu();
  // re-render dynamic screens
  renderLoginFields();          // applyI18n resets the hint; restore the right one
  if (!$("screen-task").classList.contains("hidden") && session) renderQuestion();
  if (!$("screen-home").classList.contains("hidden")) renderHome();
  // openReportAt dispatches to renderResult() itself when today is live, so
  // this must not also call renderResult — that would reset the day the parent
  // had picked out of the strip back to today
  if (!$("screen-result").classList.contains("hidden")) openReportAt(reportDay);
  if (!$("screen-mirror").classList.contains("hidden")) Live.rerender();
}

/* ---------- streak ---------- */
/* ---------- what a day is ----------

   A day is one pakket: ten sommen and one round of tafels. Both done and the
   day is green. Each on its own is geoefend — amber — and nothing at all is
   red once the day has passed.

   A second pakket on the same day is extra, and extra is not wasted: it buys
   the NEXT day in advance. That day goes green too, in a green of its own, so
   it can be seen that it was earned ahead of time rather than on the day. A
   day the child then works anyway is green on its own merits, and the credit
   simply rolls on to the day after. */
function tasksOf(rec)   { return rec && rec.tiles ? rec.tiles.length : 0; }

/* How many rounds of one soort were done on a day. A day from before the
   klok round existed has no `kinds` at all: everything it holds was sommen. */
function roundsOf(ds, kind) {
  const rec = data.days[ds];
  const n = tasksOf(rec);
  if (!n) return 0;
  const kinds = rec.kinds || [], open = rec.open || [];
  let c = 0;
  for (let i = 0; i < n; i++) if ((kinds[i] || "sommen") === kind && !open[i]) c++;
  return c;
}
function sommenOf(ds)   { return roundsOf(ds, "sommen"); }
function kloksOf(ds)    { return roundsOf(ds, "klok"); }
function sprintsOf(ds)  { return sprintRounds(ds).length; }

/* One pakket is one of each: the tafels, the sommen and the klok. */
function pakketsOf(ds)  { return Math.min(sommenOf(ds), kloksOf(ds), sprintsOf(ds)); }

/* ---------- what a day adds up to ----------

   Every round writes its seconds under its own door, so a day can say how
   long was actually worked rather than how long the last opdracht took. And
   from the tiles and the tafelrondes comes the one number a parent asks for
   first: how much of it was right, out of a hundred.

   A fout put right by the child's own hand counts as good here, exactly as
   it does everywhere the child can see — see scoreNow. */
function addDaySecs(day, kind, secs) {
  if (!secs) return;
  day.secs = day.secs || {};
  day.secs[kind] = (day.secs[kind] || 0) + secs;
}

function daySecs(ds) {
  const rec = data.days[ds];
  if (!rec) return 0;
  if (rec.secs) return Object.values(rec.secs).reduce((a, b) => a + b, 0);
  // a day from before the clocks were kept per door: the opdrachten only
  return (rec.times || []).reduce((a, b) => a + b, 0);
}

/* Right and asked, counted over everything a day holds. */
function dayTally(ds) {
  const rec = data.days[ds] || {};
  const per = { tafels: { c: 0, n: 0 }, sommen: { c: 0, n: 0 }, klok: { c: 0, n: 0 } };
  (rec.tiles || []).forEach((run, i) => {
    const kind = (rec.kinds || [])[i] || "sommen";
    for (const ch of run) {
      const key = ch.toLowerCase();
      if (key === "t") continue;                 // never reached: not asked
      per[kind].n++;
      if (key === "o" || key === "f") per[kind].c++;
    }
  });
  sprintRounds(ds).forEach(r => { per.tafels.n += r.n || 0; per.tafels.c += r.right || 0; });
  const n = per.tafels.n + per.sommen.n + per.klok.n;
  const c = per.tafels.c + per.sommen.c + per.klok.c;
  return { per, n, c, score: n ? Math.round(100 * c / n) : null };
}

/* The last stretch of days, newest first: everything the merged rapport needs
   to draw a strip instead of a month grid. One row per day, and a day that
   was not practised says so rather than being left out — the gap is the
   point. */
function dayStrip(n) {
  const plan = dayPlan();
  const out = [];
  let ds = todayStr();
  for (let i = 0; i < (n || 14); i++) {
    const rec = data.days[ds] || null;
    const tally = dayTally(ds);
    const mark = (data.marks || {})[ds] || null;
    out.push({
      ds,
      state: (mark && mark.c) || plan[ds] || "",
      note: mark && mark.note ? mark.note : "",
      mins: tally.n ? Math.max(1, Math.round(daySecs(ds) / 60)) : 0,
      score: tally.score,
      per: tally.per,
      asked: tally.n,
      right: tally.c,
      done: DOORS.filter(d => tally.per[d.key].n).map(d => d.key),
      today: ds === todayStr(),
      hasReport: !!(rec && rec.tiles && rec.tiles.length)
    });
    ds = shiftDay(ds, -1);
  }
  return out;
}

/* The three doors of a day, in the order the home screen shows them. */
const DOORS = [
  { key: "tafels", count: ds => sprintsOf(ds) },
  { key: "sommen", count: ds => sommenOf(ds) },
  { key: "klok",   count: ds => kloksOf(ds) }
];

function shiftDay(ds, n) {
  const [y, m, d] = ds.split("-").map(Number);
  return todayStr(new Date(y, m - 1, d + n));
}

/* The status of every day from the first one recorded to wherever the credit
   runs out: "done", "bonus", "partial", "miss" — or nothing for a day still
   to come. Worked out fresh each time it is asked for; it is a few dozen
   dates, not a database. */
function dayPlan() {
  const plan = {};
  const days = Object.keys(data.days || {}).sort();
  if (!days.length) return plan;
  const today = todayStr();
  let ds = days[0], carry = 0, guard = 0;
  const last = days[days.length - 1] > today ? days[days.length - 1] : today;
  while ((ds <= last || carry > 0) && guard++ < 2000) {
    const rec = data.days[ds];
    const own = pakketsOf(ds);
    if (own >= 1)          { plan[ds] = "done"; carry += own - 1; }
    else if (carry > 0)    { plan[ds] = "bonus"; carry--; }
    else if (rec && (rec.solved > 0 || sprintsOf(ds)))  plan[ds] = "partial";
    else if (ds < today)   plan[ds] = "miss";
    else                   plan[ds] = "";
    ds = shiftDay(ds, 1);
  }
  return plan;
}

function dayDone(plan, ds) { return plan[ds] === "done" || plan[ds] === "bonus"; }

/* ---------- home ----------
   Two different homes from the same markup: the child only ever sees the one
   button that matters, the parent gets the watching tools instead. */
function renderHome() {
  const parent = Store.isParent();
  const day = data.days[todayStr()];

  $("home-greeting").textContent = parent
    ? t("parent_hello").replace("{name}", Store.watches().toUpperCase())
    : t("hello").replace("{name}", Store.deviceUser().toUpperCase());

  // an unfinished round takes over ITS OWN door and leaves the other two
  // alone — see openRounds below
  const opens = parent ? {} : { sommen: activeTask("sommen"), klok: activeTask("klok") };
  const halfSprint = parent ? null : activeSprint();
  const open = opens.sommen || opens.klok;
  // an opdracht that was worked through but still has soms put aside is not at
  // "som 11 of 10" — it is back at the report card with a few left to do
  const left = open ? open.questions.filter(q => !q.solved && !q.failed).length : 0;
  const pastEnd = open && open.idx >= open.queue.length;

  // the three doors of the day, and how many times each has been through
  const ds = todayStr();
  const n = { tafels: sprintsOf(ds), sommen: sommenOf(ds), klok: kloksOf(ds) };
  const pakkets = Math.min(n.tafels, n.sommen, n.klok);
  const badge = k => k === 0 ? "" : (k === 1 ? "✓" : `✓ ×${k}`);
  const door = (btn, label, badgeEl, times, half) => {
    const b = $(btn);
    const resume = !!half;
    b.classList.toggle("done", times > 0 && !resume);
    b.classList.toggle("resume", resume);
    // A door with work waiting used to say "Verder gaan" instead of its own
    // name, so the one tile that mattered was the one that had stopped saying
    // what kind of work it held. The name stays; the badge says where it is.
    $(label).textContent = t("home_" + btn.replace("btn-", "")
      .replace("sprint", "tafels").replace("start", "sommen"));
    $(badgeEl).textContent = resume
      ? (half.idx >= half.queue.length ? "▶" : "▶ " + (half.idx + 1) + "/" + half.queue.length)
      : badge(times);
  };
  door("btn-sprint", "sprint-label", "sprint-done", n.tafels,
       halfSprint && { idx: halfSprint.i, queue: halfSprint.qs });
  door("btn-start", "start-label", "start-done", n.sommen, opens.sommen);
  door("btn-klok", "klok-label", "klok-done", n.klok, opens.klok);

  const todo = DOORS.filter(d => n[d.key] === 0);
  const tally = dayTally(ds);
  let status = t("today_todo");
  if (open) status = pastEnd
    ? t("finish_rest").replace("{n}", left)
    : t("today_resume").replace("{n}", open.idx + 1).replace("{t}", open.queue.length);
  else if (pakkets >= 2) status = t("today_extra").replace("{n}", pakkets - 1);
  else if (pakkets === 1) status = t("today_done");
  else if (todo.length < DOORS.length)
    status = t("today_left").replace("{w}", todo.map(d => t("home_" + d.key)).join(" + "));
  if (parent) {
    status = liveBusy ? Store.watches().toUpperCase() + " " + t("live_busy")
                      : Store.watches().toUpperCase() + " " + t("live_idle");
  }
  // Once the chips and the badges are there they say how today went better
  // than a sentence does, so the line goes quiet. But on a fresh morning there
  // are no chips and no badges, and that was exactly when it used to hide the
  // one thing it had to say: that all three doors want opening.
  const saysMore = !!open || parent || pakkets >= 2 || !tally.n || todo.length < DOORS.length;
  $("home-status").textContent = saysMore ? status : "";
  $("home-status").classList.toggle("hidden", !saysMore);

  /* How today is going, without a sentence to read: one line of icons with
     numbers behind them. Nothing here is new information — it is the same
     counts the tiles carry, said compactly enough to take in at a glance. */
  const chips = [];
  for (const d of DOORS) {
    const per = tally.per[d.key];
    if (per.n) chips.push(`${t("door_icon")[d.key]} ${per.c}/${per.n}`);
  }
  if (tally.n) {
    const mins = Math.max(1, Math.round(daySecs(ds) / 60));
    chips.push(`⏱ ${mins}m`);
    // out of a hundred, said the way the rapport says it — a bare number at
    // the end of a row of counts reads like one more count
    chips.push(`<b>${tally.score}<i aria-hidden="true">/100</i></b>`);
  }
  $("home-chips").innerHTML = chips.join('<i aria-hidden="true">·</i>');
  $("home-chips").classList.toggle("hidden", !chips.length);

  // the child practises; the parent watches and reviews — but the kalender
  // belongs to both of them, so the child can see their own week too
  $("btn-start").classList.toggle("hidden", parent);
  $("btn-klok").classList.toggle("hidden", parent);
  $("btn-sprint").classList.toggle("hidden", parent || sprintOff);
  $("btn-watch").classList.toggle("hidden", !parent);
  // the rapport is the one place "how is it going" lives, for both of them
  $("btn-report").classList.remove("hidden");

}

/* ---------- task flow ---------- */
/* 3… 2… 1… — the ring empties while the number pops, then we're off.
   Three beats, not five: the child has just tapped a tile, they do not need
   five seconds to be told it worked. BEATS drives the ring maths too, so the
   arc always arrives at empty on the last beat. */
const COUNT_BEATS = 3;

function runCountdown(then) {
  const CIRC = 327;
  const numEl = $("count-number"), arc = $("count-progress");
  let n = COUNT_BEATS;

  arc.style.transition = "none";
  arc.style.stroke = "";
  arc.style.strokeDashoffset = "0";
  $("count-label").textContent = t("get_ready");
  show("screen-count");
  Live.push("count");
  void arc.offsetWidth;                       // let the reset land before animating
  arc.style.transition = "stroke-dashoffset 1s linear, stroke .4s ease";

  const beat = () => {
    numEl.className = "count-number";
    void numEl.offsetWidth;
    if (n > 0) {
      numEl.textContent = n;
      numEl.classList.add("tick");
      arc.style.strokeDashoffset = String(CIRC * (1 - (n - 1) / COUNT_BEATS));
      if (n <= Math.ceil(COUNT_BEATS / 2)) arc.style.stroke = "var(--amber)";
      n--;
      setTimeout(beat, 1000);
    } else {
      numEl.textContent = "🚀";
      numEl.classList.add("go");
      arc.style.stroke = "var(--green)";
      $("count-label").textContent = t("go");
      setTimeout(then, 800);
    }
  };
  beat();
}

/* Ten sommen a day. Not nine, not fifteen: ten, whatever happens in them.
   A day used to grow with its mistakes, and that made every fout cost twice —
   once as a fout and once as more work. Now the length is simply known. */
const TASK_N = 10;

/* The tafels are their own opdracht now, chosen from the home screen like
   the sommen are, and done as often as the child likes. The first round of
   the day is the one that counts towards the day; every further round is
   extra, and extra is what buys the next day in advance. It has never touched
   the niveau or the speeltijd and still does not. */
let sprint = null;
let sprintOff = false;             // no facts to ask: don't offer an empty round

/* every round of tafels played on a day, oldest first — reading the two
   fixed slots an older build wrote as rounds one and two */
function sprintRounds(ds) {
  const d = data.days[ds || todayStr()];
  if (!d) return [];
  if (d.sprints) return d.sprints;
  return [d.sprint, d.sprintEnd].filter(Boolean);
}

/* The tafelronde that was left standing, or nothing. The sommen and the klok
   have kept theirs in `data.actives` since the three doors were built; the
   tafels used to write nothing down at all until the tenth was answered, so
   a round broken off by a notification, a flat battery or simply the way back
   took every tafel with it. */
function activeSprint() {
  recoverSprint();                      // a complete slot is booked, not dropped
  const a = (data.actives || {}).tafels;
  if (!a || !a.qs || !a.qs.length) return null;
  if (a.date !== todayStr()) {
    if (data.actives) delete data.actives.tafels;
    Store.save(data);
    return null;
  }
  return a;
}

function saveSprint() {
  if (!sprint || sprint.finished) return;
  data.actives = data.actives || {};
  data.actives.tafels = {
    at: Date.now(), date: todayStr(), kind: "tafels",
    qs: sprint.qs, i: sprint.i, tiles: sprint.tiles, facts: sprint.facts,
    secs: sprintSecs()
  };
  Store.save(data);
}

/* Seconds on this tafelronde, the ones before it was put down included */
function sprintSecs() {
  if (!sprint) return 0;
  const live = Math.max(0, Math.round((Date.now() - (sprint.t0 || Date.now())) / 1000));
  return (sprint.secsBefore || 0) + live;
}

function startSprint(then) {
  if (opening) return;                 // see startTask: two doors, one burst
  opening = true;
  setTimeout(() => { opening = false; }, 250);
  const open = activeSprint();
  if (open) return resumeSprintRound(open, then);
  // a round never repeats a tafel already asked today, as long as there are
  // enough left — after that the table simply comes round again
  const today = [].concat(...sprintRounds().map(r => r.facts || []));
  let qs = Sprint.build(data, today);
  if (qs.length < Sprint.N) qs = Sprint.build(data, []);
  if (!qs.length) { sprintOff = true; return then(); }
  sprint = { qs, i: 0, tiles: "", facts: [], then, tick: null, locked: true,
             t0: Date.now(), secsBefore: 0 };
  Live.startHeartbeat();
  // a beat to look up before the first clock starts
  $("sprint-progress").textContent = `1 / ${qs.length}`;
  $("sprint-question").textContent = "⚡";
  $("sprint-badge-label").textContent = t("sprint_title");
  $("sprint-answers").innerHTML = "";
  $("sprint-count").textContent = Sprint.SECS;
  ["sprint-sep", "sprint-count", "sprint-unit"].forEach(id => $(id).classList.remove("hidden"));
  $("sprint-paused").classList.add("hidden");
  document.querySelector("#screen-sprint .sprint-body").classList.remove("hidden");
  $("sprint-marks").innerHTML = "";
  $("sprint-flash").className = "sprint-flash think";
  $("sprint-flash").innerHTML =
    `<span class="sprint-ready">${esc(t("sprint_ready").replace("{n}", Sprint.N)
                                                       .replace("{s}", Sprint.SECS))}</span>
     <button id="sprint-go" class="btn primary">${esc(t("sprint_go"))}</button>`;
  // The line that says how this works used to be on screen for 1600ms and was
  // then replaced by a ticking clock — seven words, gone before a child of
  // eight has read them, and never shown again. Now the clock waits for a tap,
  // which also means a ⚡ hit by accident costs one tap, not 200 seconds.
  $("sprint-go").addEventListener("click", () => { if (sprint) renderSprint(); });
  show("screen-sprint");
  Live.push("sprint");
}

/* Back into a tafelronde where it was left: the tafels already answered keep
   their marks, and the clock starts again on the one that was on screen. */
function resumeSprintRound(open, then) {
  sprint = { qs: open.qs, i: open.i, tiles: open.tiles || "", facts: open.facts || [],
             then, tick: null, locked: true, t0: Date.now(), secsBefore: open.secs || 0 };
  Live.startHeartbeat();
  $("sprint-badge-label").textContent = t("sprint_title");
  $("sprint-paused").classList.add("hidden");
  document.querySelector("#screen-sprint .sprint-body").classList.remove("hidden");
  show("screen-sprint");
  renderSprint();
}

/* A tafel is answered in three beats, and the clock runs through all of them.

   The first five seconds there is nothing on screen but the som: no answers
   to weigh up, so the only way forward is to work it out. The next five the
   answers appear but may not be touched — time to find your own answer among
   them, and to notice when it is not there. The last ten are for answering.

   Without the first two beats a child with two answers in front of them is
   right half the time by guessing, and the tafel never has to be known. */
const SPRINT_BLIND = 5;     // seconds with the som alone
const SPRINT_READ = 10;     // seconds before the answers open (blind included)

function sprintPhase(left) {
  const total = Sprint.SECS * 1000;
  if (left > total - SPRINT_BLIND * 1000) return 0;      // the som alone
  if (left > total - SPRINT_READ * 1000) return 1;       // answers, looking only
  return 2;                                              // answer away
}

/* Move the som into a beat. Idempotent: the clock calls it on every tick and
   only a real change is drawn. */
function applySprintPhase(ph) {
  if (!sprint || sprint.phase === ph) return;
  sprint.phase = ph;
  sprint.locked = ph < 2;
  const box = $("sprint-answers"), flash = $("sprint-flash");
  box.classList.toggle("blind", ph === 0);
  box.classList.toggle("shut", ph < 2);
  // Not `disabled`: a disabled button in Safari fires nothing at all, so a
  // tap during the reading beat produced no answer of any kind. The round
  // already refuses the answer itself (see answerSprint) — this way the tap
  // is at least felt.
  box.querySelectorAll(".sprint-opt").forEach(b => {
    b.setAttribute("aria-disabled", String(ph < 2));
    if (ph === 2) b.classList.remove("nudge");   // the too-early shake is spent
  });
  // an icon for the beat, the words small beneath it: 👀 look, 🤔 choose
  const beat = ph === 0 ? ["👀", t("sprint_blind")]
             : ph === 1 ? ["🤔", t("sprint_think")] : ["👉", t("sprint_now")];
  flash.innerHTML =
    `<span class="beat-icon" aria-hidden="true">${beat[0]}</span> ${esc(beat[1])}`;
  flash.className = "sprint-flash" + (ph < 2 ? " think" : "");
}

function renderSprint() {
  const q = sprint.qs[sprint.i];
  sprint.locked = true;
  sprint.phase = null;                        // so the first beat is always drawn
  $("sprint-progress").textContent = `${sprint.i + 1} / ${sprint.qs.length}`;
  $("sprint-question").textContent = `${q.a} × ${q.b}`;
  ["sprint-sep", "sprint-count", "sprint-unit"].forEach(id => $(id).classList.remove("hidden"));

  const box = $("sprint-answers");
  box.innerHTML = "";
  q.options.forEach((v, i) => {
    const b = document.createElement("button");
    b.className = "sprint-opt";
    b.textContent = v;
    b.setAttribute("aria-disabled", "true");
    b.addEventListener("click", () => answerSprint(i, b));
    box.appendChild(b);
  });
  applySprintPhase(0);

  renderSprintMarks();
  startSprintClock();
  Live.push("sprint");
}

/* the whole round beside the tafel, exactly as the sommen have it */
function renderSprintMarks() {
  const marks = sprint.qs.map((_, i) => {
    const ch = sprint.tiles[i];
    return ch === "o" ? "ok" : ch === "n" ? "no" : ch === "t" ? "skip" : "";
  });
  $("sprint-marks").innerHTML = Live.marksPanelHTML(marks, sprint.i);
}

/* the answers open, mid-question */
function openSprintAnswers() {
  if (!sprint || sprint.settled) return;
  applySprintPhase(2);
}

/* The clock is a hairline under the header that drains away, plus the seconds
   themselves in small type next to the title. A bar says "time passing" at a
   glance without competing with the som for attention, which is what the ring
   it replaces was doing. Kept as one deadline in wall-clock time, so a pause
   is simply a deadline pushed forward by however long the break lasted. */
function startSprintClock(msLeft) {
  const bar = $("sprint-bar"), num = $("sprint-count");
  const total = Sprint.SECS * 1000;
  const left0 = msLeft == null ? total : msLeft;
  sprint.endAt = Date.now() + left0;
  bar.style.transition = "none";
  bar.style.width = (left0 / total * 100) + "%";
  bar.classList.remove("low");
  void bar.offsetWidth;
  bar.style.transition = `width ${left0}ms linear`;
  bar.style.width = "0%";

  clearInterval(sprint.tick);
  let handle;
  const mine = sprint;                  // this clock times THIS round, no other
  const paint = () => {
    // A round can be left and a new one started while a tick is still in
    // flight. Such a tick must not paint, and must certainly not time out,
    // the round that came after it — so a clock that no longer belongs to the
    // sprint on screen stops itself.
    if (!sprint || sprint !== mine) return clearInterval(handle);
    const left = Math.max(0, sprint.endAt - Date.now());
    // never paint a 0: the tick that reaches zero is up to 100ms ahead of the
    // tick that settles the question, and "0s" flashing once a question reads
    // as a fault rather than as the end of the time
    num.textContent = Math.max(1, Math.ceil(left / 1000));
    const low = left <= total / 3;
    num.classList.toggle("low", low);
    bar.classList.toggle("low", low);
    if (!sprint.settled) applySprintPhase(sprintPhase(left));
    if (left <= 0) { clearInterval(sprint.tick); timeoutSprint(); }
  };
  paint();
  handle = setInterval(paint, 100);
  sprint.tick = handle;
}

/* Freeze the bar where the CLOCK says it is, not where the browser happens to
   have drawn it — a tab in the background never runs the animation. */
function stopSprintClock() {
  clearInterval(sprint.tick);
  const left = Math.max(0, sprint.endAt - Date.now());
  const bar = $("sprint-bar");
  bar.style.transition = "none";
  bar.style.width = (left / (Sprint.SECS * 1000) * 100) + "%";
}

/* A break in the middle of a round. The clock stops and the tafel goes off
   screen — a break is a break, not a chance to keep working the som out. */
/* Put the tafelronde down. Whatever was answered is already written into the
   day; what is left is simply not asked. */
function stopSprint() {
  if (!sprint) return;
  clearInterval(sprint.tick);
  sprint = null;
}

function pauseSprint() {
  if (!sprint || sprint.paused || sprint.settled) return;
  sprint.paused = Math.max(0, sprint.endAt - Date.now());
  stopSprintClock();
  document.querySelector("#screen-sprint .sprint-body").classList.add("hidden");
  $("sprint-paused").classList.remove("hidden");
  Live.push("pause");
}

function resumeSprint() {
  if (!sprint || sprint.paused == null) return;
  const left = sprint.paused;
  sprint.paused = null;
  $("sprint-paused").classList.add("hidden");
  document.querySelector("#screen-sprint .sprint-body").classList.remove("hidden");
  startSprintClock(left);
  Live.push("sprint");
}

function answerSprint(i, btn) {
  if (sprint.locked || sprint.paused != null) {
    // too early: say so. But a tap that lands on a tafel already answered is
    // not too early, it is just late — and a shake there would read as "wrong"
    if (!sprint.settled && sprint.paused == null) {
      btn.classList.remove("nudge");
      void btn.offsetWidth;                    // so a second tap shakes again
      btn.classList.add("nudge");
    }
    return;
  }
  sprint.locked = true;
  stopSprintClock();
  const q = sprint.qs[sprint.i];
  const ok = i === q.answerIdx;
  btn.classList.add(ok ? "right" : "wrong");
  if (!ok) markRightOption();
  settleSprintQ(ok ? "o" : "n", ok ? t("sprint_yes") : t("sprint_no"), ok);
}

function timeoutSprint() {
  if (sprint.settled || sprint.paused != null) return;
  sprint.locked = true;
  $("sprint-answers").querySelectorAll(".sprint-opt").forEach(b => b.disabled = true);
  markRightOption();
  settleSprintQ("t", t("sprint_late"), false);
}

function markRightOption() {
  const q = sprint.qs[sprint.i];
  const btns = $("sprint-answers").querySelectorAll(".sprint-opt");
  if (btns[q.answerIdx]) btns[q.answerIdx].classList.add("right");
}

function settleSprintQ(tile, msg, ok) {
  if (sprint.settled) return;
  sprint.settled = true;
  clearInterval(sprint.tick);                 // no tick may reopen a settled som
  const q = sprint.qs[sprint.i];
  sprint.tiles += tile;
  renderSprintMarks();
  sprint.facts.push(`${q.a}x${q.b}`);
  Sprint.remember(data, q, ok);
  sprint.i++;                                 // so what is saved is where we go next
  saveSprint();
  sprint.i--;                                 // nextSprint moves it on for real
  const flash = $("sprint-flash");
  flash.textContent = msg;
  flash.className = "sprint-flash " + (ok ? "good" : "bad");
  Live.push("sprint");
  setTimeout(nextSprint, ok ? 650 : 1100);
}

function nextSprint() {
  if (!sprint || sprint.finished) return;       // a late timer after the end
  sprint.settled = false;
  sprint.i++;
  if (sprint.i < sprint.qs.length) return renderSprint();
  finishSprint();
}

/* Write a finished tafelronde into the day. Its own function because a round
   can reach its tenth tafel and still not be booked: there is about a second
   between the last answer and the end of the round, and a tablet put to sleep
   in that second used to leave ten answered tafels in the slot with nothing
   willing to take them. */
function bookSprintRound(qs, tiles, facts, secs) {
  const ds = todayStr();
  const right = tiles.split("").filter(c => c === "o").length;
  const day = data.days[ds] || { solved: 0, firstCorrect: 0, done100: false, cats: {} };
  if (data.actives) delete data.actives.tafels;
  day.sprints = sprintRounds(ds).slice();
  day.sprints.push({ n: qs.length, right, tiles, facts, secs });
  delete day.sprint; delete day.sprintEnd;        // the two old slots, folded in
  addDaySecs(day, "tafels", secs);
  data.days[ds] = day;
  Store.save(data);
  return right;
}

/* A round whose tenth tafel was answered but which never got as far as being
   written down. Booked on the way past, so the day is right before anything
   is drawn. */
function recoverSprint() {
  const a = (data.actives || {}).tafels;
  if (!a || !a.qs || a.date !== todayStr() || a.i < a.qs.length) return;
  bookSprintRound(a.qs, a.tiles || "", a.facts || [], a.secs || 0);
}

function finishSprint() {
  if (sprint.finished) return;                   // written down exactly once
  sprint.finished = true;
  const right = bookSprintRound(sprint.qs, sprint.tiles, sprint.facts, sprintSecs());

  const all = right === sprint.qs.length;
  $("sprint-question").textContent = `${right}/${sprint.qs.length}`;
  $("sprint-answers").innerHTML = "";
  renderSprintMarks();
  // Ten tafels under a clock, and the score used to be on screen for 1400ms
  // before the child was put back on the home screen. The row of tafels is
  // right there beside it; this waits until it has been looked at.
  // nothing is being timed any more, so the header stops saying it is
  ["sprint-sep", "sprint-count", "sprint-unit"].forEach(id => $(id).classList.add("hidden"));
  const bar = $("sprint-bar");
  bar.classList.remove("low");
  bar.style.transition = "none";
  bar.style.width = "100%";
  const flash = $("sprint-flash");
  flash.className = "sprint-flash " + (all ? "good" : "");
  flash.innerHTML = `<span>${esc(all ? t("sprint_all") : t("sprint_done"))}</span>
     <button id="sprint-done-btn" class="btn primary">${esc(t("sprint_close"))}</button>`;
  clearInterval(sprint.tick);
  sprint.tick = null;
  const then = sprint.then;
  $("sprint-done-btn").addEventListener("click", () => {
    if (sprint) clearInterval(sprint.tick);
    sprint = null;
    then();
  });
}

/* one line of tafels, for the report card and for the parent's kalender */
function sprintStripHTML(sp, label) {
  const icon = { o: "✅", n: "❌", t: "⏱" };
  const tiles = (sp.facts || []).map((f, i) => {
    const ch = (sp.tiles || "")[i] || "n";
    const [a, b] = f.split("x");
    return `<span class="sprint-chip ${ch}">${icon[ch] || "❌"} ${a}×${b}</span>`;
  }).join("");
  return `<div class="sprint-line"><b>⚡ ${esc(label)}</b>
            <span>${sp.right}/${sp.n}</span></div>
          <div class="sprint-chips">${tiles}</div>`;
}

/* every round of a day, in the order they were played */
function sprintStripsHTML(ds) {
  const rounds = sprintRounds(ds);
  return rounds.map((sp, i) =>
    sprintStripHTML(sp, rounds.length > 1 ? `${t("sprint_title")} ${i + 1}` : t("sprint_title"))).join("");
}

let opening = false;              // a door is being opened right now

/* The day has three doors, and two of them come through here: ten
   redactiesommen, or ten clock faces. Same runner, same report card, same
   second chance — only the bank the ten are drawn from differs. */
function startTask(kind) {
  kind = kind === "klok" ? "klok" : "sommen";
  // Two tiles sit side by side and both stay live until the countdown lands,
  // so a quick pair of taps used to build two rounds and park the first one
  // unopened — a door advertising work that was never on screen.
  if (opening) return;
  opening = true;
  setTimeout(() => { opening = false; }, 250);
  if (activeTask(kind)) return resumeActive(kind);     // this door was left open
  const built = kind === "klok" ? Engine.buildFaceTask(TASK_N, data)
                                : Engine.buildTask(TASK_N, data);
  session = {
    questions: built,
    pool: [],
    idx: 0,
    kind,
    firstPass: true,
    round: 1,                   // 1 = eerste poging, 2+ = verbeterrondes
    queue: null,
    lastSec: null
  };
  session.queue = session.questions.map((_, i) => i);
  saveActive();                   // resumable from the very first som
  Live.startHeartbeat();          // keep the parent's mirror alive while thinking
  runCountdown(() => {
    // walking out during the countdown puts the round down; what is counted
    // in then belongs to nothing
    if (!session || session.kind !== kind || sprint) return;
    startTimer();
    renderQuestion();
    show("screen-task");
  });
}

/* Which som is on screen. Normally it is the one the queue points at, but the
   report card can open any single som on its own, off to one side of the
   queue — and that view must never be mistaken for where the opdracht stands. */
function currentIdx() {
  return session.viewOne != null ? session.viewOne : session.queue[session.idx];
}

function currentQ() {
  return session.questions[currentIdx()];
}

/* ---------- an unfinished task travels with the account ----------
   The whole task is written into the progress blob after every answer, so it
   rides the normal cloud sync: pause on the phone, open the tablet, carry on
   at the same som. Only today's counts — an abandoned task does not follow
   the child into tomorrow. */
function snapQ(q) {
  return {
    tplId: q.tplId, cat: q.cat, variantIdx: q.variantIdx, vars: q.vars,
    name: q.name, name2: q.name2, obj: q.obj, obj2: q.obj2,
    options: q.options, answerIdx: q.answerIdx,
    chosen: q.chosen === undefined ? null : q.chosen,
    correctFirst: q.correctFirst === undefined ? null : q.correctFirst,   // null = still waiting
    tries: q.tries || 0,
    solved: !!q.solved,
    failed: !!q.failed,
    skipped: !!q.skipped,
    booked: !!q.booked,            // already counted in today's record
    hinted: !!q.hinted,            // the 💡 was used on this som
    fixed: !!q.fixed,              // put right on the second chance
    retried: !!q.retried,          // the second chance was spent during the opdracht
    explained: !!q.explained,      // second chance also went wrong; uitleg shown
    chosen2: q.chosen2 === undefined ? null : q.chosen2
  };
}

function snapshotActive() {
  if (!session || !session.questions) return null;
  return {
    at: Date.now(),
    date: todayStr(),
    kind: session.kind || "sommen",
    idx: session.idx,
    queue: session.queue,
    firstPass: session.firstPass,
    round: session.round || 1,
    elapsed: session.pausedSec != null ? session.pausedSec : elapsedSec(),
    paused: session.pausedSec != null,
    lastSec: session.lastSec || null,
    banked: !!session.banked,          // whether the score has already been booked
    tileSlot: session.tileSlot == null ? null : session.tileSlot,
    hintsUsed: session.hintsUsed || 0,
    score: session.score || null,
    questions: session.questions.map(snapQ),
    pool: (session.pool || []).map(snapQ)   // the sommen still held in reserve
  };
}

/* Write every som that is settled but not yet counted into today's record.
   A som counts from the moment it is answered, not when the opdracht happens
   to reach its end — so an opdracht that is broken off halfway, a tablet that
   runs out of battery or a tab that is simply closed all leave the work the
   child really did standing. Each som carries a flag saying it has been
   counted, and that flag travels with the opdracht, so picking the same work
   up on another device counts nothing twice. */
function bankSettled() {
  if (!session || !session.questions) return;
  const ds = todayStr();
  const day = data.days[ds] || { solved: 0, firstCorrect: 0, done100: false, cats: {} };
  let added = 0;
  session.questions.forEach(q => {
    if (!finished(q) || q.booked) return;
    q.booked = true;
    added++;
    day.solved++;
    if (q.correctFirst) day.firstCorrect++;
    const c = day.cats[q.cat] || { n: 0, c: 0 };
    c.n++; if (q.correctFirst) c.c++;
    day.cats[q.cat] = c;
    // the soort som that went wrong comes back in a later opdracht
    if (!q.correctFirst && q.cat !== "verrassing") {
      data.wrongTpl = [q.tplId, ...data.wrongTpl.filter(id => id !== q.tplId)].slice(0, 6);
    }
  });
  if (added) data.days[ds] = day;
}

function saveActive(pushNow) {
  if (!session || !session.questions) return;
  bankSettled();                         // count it first, then write it down,
  // The marks go into the day before the snapshot is taken, because that is
  // where the round's slot in the day is handed out — a snapshot taken first
  // carries no slot, and the round comes back from a reload believing it is
  // a new one and writes itself into the day a second time.
  if (session.questions.some(finished)) writeTiles(!session.questions.every(finished));
  const snap = snapshotActive();         // so the snapshot carries the flags
  if (!snap) return;
  // an opdracht with nothing left to answer is not something to carry on with —
  // unless the mistakes just earned it extra sommen that have not appeared yet
  const kind = session.kind || "sommen";
  data.actives = data.actives || {};
  carryLegacyActive();                   // never drop the older build's slot
  if (session.questions.every(finished) && !storedExtension(session)) delete data.actives[kind];
  else data.actives[kind] = snap;
  Store.save(data);
  if (pushNow) Store.pushNow(data);      // a pause should reach the other device at once
}

/* An opdracht no longer grows. Kept so an opdracht saved by an older build,
   reserve sommen and all, still ends cleanly where it stands. */
function storedExtension(a) { return 0; }

/* Every unfinished round, by soort. Each door keeps its own: leaving the
   klok at four of ten must not cost the sommen their place, and starting the
   sommen must not quietly throw the klok away. An older build kept a single
   slot for the whole day — it is read here as the soort it belonged to. */
/* The older build kept one unfinished round for the whole day in
   `data.active`. Move it into the slot of its own soort before anything
   clears it, or a round parked by yesterday's code would vanish the moment
   another door is opened. */
function carryLegacyActive() {
  const legacy = data.active;
  if (!legacy || !legacy.questions) { delete data.active; return; }
  data.actives = data.actives || {};
  const k = legacy.kind || "sommen";
  if (!data.actives[k]) data.actives[k] = legacy;
  delete data.active;
}

function allActives() {
  const out = Object.assign({}, data.actives || {});
  const legacy = data.active;
  if (legacy && legacy.questions) {
    const k = legacy.kind || "sommen";
    if (!out[k]) out[k] = legacy;
  }
  return out;
}

/* The round of this soort to carry on with, or nothing */
function activeTask(kind) {
  kind = kind || "sommen";
  const a = allActives()[kind];
  if (!a || !a.questions || !a.questions.length) return null;
  if (a.date !== todayStr()) {
    // yesterday's leftovers. The sommen the child actually made were counted
    // on the day itself, so nothing is lost by letting the rest go.
    carryLegacyActive();
    if (data.actives) delete data.actives[kind];
    Store.save(data);
    return null;
  }
  // An older build recorded a wrong answer without writing down that the som
  // was settled. Carried over as it stands, such a som counts as never reached:
  // it shows up blank in the overview and the opdracht can never finish. Say
  // plainly what it was — wrong.
  a.questions.forEach(q => {
    if (!q.solved && !q.failed && !q.skipped && q.correctFirst === false && !q.tries) {
      q.failed = true;
      q.tries = ATTEMPTS;
    }
  });
  // nothing left to do: a som is done whether it went right or wrong — but an
  // opdracht whose mistakes have earned it extra sommen is not done yet
  if (a.questions.every(q => q.solved || q.failed) && !storedExtension(a)) return null;
  return a;
}

function resumeActive(kind) {
  const a = activeTask(kind);
  if (!a) return goHome();
  // the opdracht had already been worked all the way through — what was left
  // open is on the report card, which is where it should come back
  const pastEnd = a.idx >= a.queue.length;
  session = {
    questions: a.questions,
    pool: a.pool || [],
    kind: a.kind || "sommen",
    queue: a.queue,
    idx: pastEnd ? a.queue.length : Math.min(a.idx, a.queue.length - 1),
    firstPass: a.firstPass,
    round: a.round || 1,
    lastSec: a.lastSec,
    banked: !!a.banked,
    tileSlot: a.tileSlot == null ? null : a.tileSlot,
    hintsUsed: a.hintsUsed || 0,
    score: a.score,
    pausedSec: null,
    t0: Date.now() - (a.elapsed || 0) * 1000                // the clock carries on
  };
  Live.startHeartbeat();
  if (pastEnd) {
    finishPass();       // draws the report card — or deals the extra sommen
    return;
  }
  ensureTimer(true);
  renderQuestion();
  show("screen-task");
}

/* The clock on the wall: make sure it is visible and ticking. */
function ensureTimer(restart) {
  if (!session || session.pausedSec != null) return;
  $("timerbox").classList.remove("hidden");
  if (restart) clearInterval(timerInt), timerInt = null;
  if (!timerInt) { tickTimer(); timerInt = setInterval(tickTimer, 1000); }
}

/* ---------- pause ----------
   The clock stops and the som goes off screen, so a break is a real break and
   not a chance to keep reading the question. */
function pauseTask() {
  if (!session || !isOn("screen-task")) return;
  session.pausedSec = elapsedSec();
  clearInterval(timerInt);
  timerInt = null;
  // the card says the clock stands still, so the header may not go on showing
  // one — a second behind the card's own number, at that
  $("timerbox").classList.add("hidden");
  $("pause-at").textContent = `${session.idx + 1}/${session.queue.length}`;
  $("pause-time").textContent = "⏱ " + fmtTime(session.pausedSec);
  saveActive(true);                   // straight to the cloud: the tablet may be next
  Live.push("pause");
  show("screen-pause");
}

function resumeTask() {
  if (!session) return goHome();
  session.t0 = Date.now() - (session.pausedSec || 0) * 1000;   // carry on, not from zero
  session.pausedSec = null;
  $("timerbox").classList.remove("hidden");
  clearInterval(timerInt);
  timerInt = setInterval(tickTimer, 1000);
  tickTimer();
  renderQuestion();
  show("screen-task");
}

function tplOf(q) { return TEMPLATES.find(tp => tp.id === q.tplId); }

function renderQuestion() {
  const q = currentQ();
  // the countdown's callback can land after the opdracht it belonged to is
  // gone — a second tap, a back arrow, a sign-out. Nothing to draw, so go home
  // rather than throw into an empty screen.
  if (!q) return goHome();
  // it has been seen now, so it is asked and will never come round again — and
  // the sommen of an opdracht that is broken off before reaching them stay
  // unasked, waiting, instead of being spent
  if (Engine.remember(data, q)) Store.save(data);
  $("btn-skip").disabled = false;
  $("btn-pause").disabled = false;
  $("btn-skip").classList.toggle("hidden", !!session.review || !!session.midRetry);   // nothing to skip when looking back
  // one som opened from the report card is "som 5 of 20", not "1 of 1"
  const at = session.viewOne != null ? session.viewOne : session.idx;
  const of = session.viewOne != null ? session.questions.length : session.queue.length;
  $("progress-text").textContent = `${at + 1} / ${of}`;
  $("progress-bar").style.width = `${(at / of) * 100}%`;
  $("question-text").textContent = Engine.text(q, LANG);
  // a clock question IS its dial, so it is drawn rather than described
  const face = $("question-clock");
  if (q.vars && q.vars._h !== undefined && tplOf(q) && tplOf(q).face) {
    face.innerHTML = q.vars._h2 !== undefined
      ? Klok.facePairSVG(q.vars._h, q.vars._m, q.vars._h2, q.vars._m2)
      : Klok.faceSVG(q.vars._h, q.vars._m);
    face.classList.remove("hidden");
  } else {
    face.innerHTML = "";
    face.classList.add("hidden");
  }
  // a som shaped like the ones on the school's werkblad wears the school's
  // little logo, so the child knows: this one you will meet in class too
  const tplNow = tplOf(q);
  $("school-badge").classList.toggle("hidden", !(tplNow && tplNow.school));
  $("school-badge").title = t("school_badge");
  const box = $("answers");
  box.innerHTML = "";
  box.classList.add("fresh");     // no answer may look chosen before it is touched
  // a fout gets one second go before anything is given away — reached from
  // the report card, or during the opdracht from the list beside the sommen.
  // Once that go is spent the som is a page to read, nothing more.
  const correcting = (session.review || session.midRetry) &&
                     q.failed && !q.fixed && !q.explained && !q.retried;
  // some klok questions ask the other way round: the time is in the sentence
  // and the four answers are dials. The option itself stays a plain "4:30", so
  // the mirror, the report card and the second chance all keep reading it.
  const faceOpts = tplNow && tplNow.faceOptions;
  q.options.forEach((opt, i) => {
    const b = document.createElement("button");
    b.className = "answer" + (faceOpts ? " answer-face" : "");
    if (faceOpts) {
      const [fh, fm] = String(opt).split(":").map(Number);
      b.innerHTML = Klok.faceSVG(fh, fm, 150, true);   // compact: a dial this size
      b.setAttribute("aria-label", String(opt));
    } else {
      b.textContent = opt;
    }
    if (correcting) {
      if (i === q.chosen) { b.disabled = true; b.classList.add("wrong"); }
      else b.onclick = () => secondChance(i, b);
    } else if (session.review) {
      // looking back at a som that is settled and dealt with
      b.disabled = true;
      if (i === q.chosen) b.classList.add(q.solved ? "correct" : "wrong");
      if (q.chosen2 != null && i === q.chosen2 && i !== q.answerIdx) b.classList.add("wrong");
      if (q.failed && i === q.answerIdx) b.classList.add("correct");
    } else {
      b.onclick = () => answer(i, b);
    }
    box.appendChild(b);
  });

  // the 💡: help with understanding the som, never the answer, and rationed
  renderHintButton(q);
  $("hint-bubble").classList.add("hidden");

  if (correcting) {
    showExplainBox(`<p class="fix-hint">${esc(t("fix_hint"))}</p>`, false);
  } else if (session.review && q.explained) {
    // the uitleg stays readable whenever the som is opened again
    showExplainBox(
      `<b class="explain-title">${esc(t("explain_title"))}</b>
       <p class="explain-text">${esc(Engine.explain(q, LANG))}</p>`, false);
  } else {
    hideExplainBox();
  }

  renderTaskMarks();
  if (!session.review) Live.push("task");
}

/* The whole opdracht beside the som being worked on, so the child can see how
   it is going without waiting for the report card. A red vakje in this list is
   also a door: tap it and the som opens for one more go — get it right and it
   counts exactly as if it had gone right the first time. */
function renderTaskMarks() {
  if (!session) return;
  const box = $("task-marks");
  box.innerHTML = Live.marksPanelHTML(Live.marksOf(session.questions), currentIdx());
  if (session.review || session.viewOne != null) return;   // looking, not working
  const cells = box.querySelectorAll(".mark-cell");
  session.questions.forEach((q, i) => {
    if (!canMidRetry(i) || !cells[i]) return;
    cells[i].classList.add("can-fix");
    cells[i].title = t("fix_tap");
    cells[i].addEventListener("click", () => openMidRetry(i));
  });
}

/* May this som be reopened right now? Failed, its second chance unspent, and
   not the som already on the screen. */
function canMidRetry(i) {
  const q = session.questions[i];
  return q && q.failed && !q.fixed && !q.explained && !q.retried &&
         session.queue[session.idx] !== i;
}

/* One more go at a fout, in the middle of the opdracht. The queue stands
   still — viewOne points the screen at the old som, and when it is settled
   the screen goes back to exactly where the child was. */
function openMidRetry(i) {
  if (!session || session.hopping || session.review || session.viewOne != null) return;
  if (!canMidRetry(i)) return;
  session.midRetry = true;
  session.viewOne = i;
  renderQuestion();
  Live.push("task");
}

function closeMidRetry() {
  session.midRetry = false;
  session.viewOne = null;
  hideExplainBox();
  if (session.idx >= session.queue.length) return finishPass();
  renderQuestion();
}

/* One go at a som during the opdracht. The moment an answer is touched the som
   is settled — right is right, wrong is wrong. The good answer is NOT shown
   here: the report card gives a second chance at every fout, and that second
   chance is only worth something if the answer has not been given away. */
function answer(i, btn) {
  const q = currentQ();
  if (finished(q)) return;        // a settled som cannot be answered a second time
  const correct = i === q.answerIdx;

  document.querySelectorAll(".answer").forEach(b => b.disabled = true);
  $("btn-skip").disabled = true;
  $("btn-pause").disabled = true;      // the next som is already on its way in

  q.tries = 1;
  q.correctFirst = correct;
  q.chosen = i;
  btn.classList.add(correct ? "correct" : "wrong");
  if (!correct) {
    q.failed = true;
    // the day's shock absorber: this soort gets a notch easier, and the next
    // sommen come from the same soort so the footing comes back right away
    comfortSwap(q.cat);
  } else {
    q.solved = true;
  }

  renderTaskMarks();
  Live.push("task");
  // while the screen is mid-hop to the next som, the list is not a door
  session.hopping = true;
  const mine = session;
  setTimeout(() => {
    if (session !== mine) return;      // the opdracht was left during the hop
    session.hopping = false;
    advance();
  }, correct ? 600 : 1100);
}

/* Right after a fout, the next one or two UNSHOWN sommen are quietly swapped
   for fresh ones of the same soort at the dial's new, gentler level. The som
   that was about to come simply never appears (unshown, so not spent), and in
   its place comes one the child can win — that is where the confidence comes
   back. Only during the linear first sweep; the report card is its own world. */
function comfortSwap(cat) {
  if (!session.firstPass || session.viewOne != null) return;
  // A klok round is ten dials and nothing else. The swap draws from the soorten
  // the redactiesommen are mixed from, so letting it run here dropped a
  // word problem into the middle of the clocks — and a breather from clocks is
  // not something a klok round can give.
  if ((session.kind || "sommen") !== "sommen") return;
  const avoid = new Set(session.questions.concat(session.pool || []).map(q => Engine.sig(q)));

  // the open slots still ahead, in order
  const slots = [];
  for (let k = session.idx + 1; k < session.queue.length; k++) {
    const slot = session.queue[k];
    if (!finished(session.questions[slot]) && !session.questions[slot].skipped) slots.push(slot);
  }
  if (!slots.length) return;

  // A breather first. Coming straight back with the same soort right after a
  // fout reads as being kept behind on it — and the child has not had a moment
  // to shake the mistake off. So the very next som is deliberately something
  // else; only after that do the gentler sommen of the difficult soort come.
  const others = CATS.filter(c => c !== cat);
  if (session.questions[slots[0]].cat === cat) {
    const away = Engine.oneFrom(others[Math.floor(Math.random() * others.length)], data, avoid);
    if (away) { avoid.add(Engine.sig(away)); session.questions[slots[0]] = away; }
  }

  // then up to two of the difficult soort, at the dial's gentler level
  let swapped = 0;
  for (let k = 1; k < slots.length && swapped < 2; k++) {
    const fresh = Engine.oneFrom(cat, data, avoid);
    if (!fresh) break;
    avoid.add(Engine.sig(fresh));
    session.questions[slots[k]] = fresh;
    swapped++;
  }
}

/* The second chance, on the report card. The wrong pick stands there in red;
   every other answer is open. Get it right and the som is verbeterd. Get it
   wrong again and the good answer is shown with one short uitleg of how the
   som is actually solved — read it, press begrepen, and on to the next. */
function secondChance(i, btn) {
  const q = currentQ();
  if (!q.failed || q.fixed || q.explained || q.retried) return;
  q.chosen2 = i;
  document.querySelectorAll(".answer").forEach(b => b.disabled = true);
  const mid = !!session.midRetry;

  if (i === q.answerIdx) {
    q.fixed = true;
    btn.classList.add("correct");
    showExplainBox(`<p class="fix-praise">🎯 ${esc(t("fixed_msg"))}</p>`, false);
    persistCorrection();
    Live.push("task");
    setTimeout(mid ? closeMidRetry : backToResult, 1200);
    return;
  }

  if (mid) {
    // wrong again, in the middle of the opdracht: the som is spent, but the
    // answer is NOT shown here — it waits on the report card, where the
    // uitleg can do the explaining while the opdracht is no longer waiting
    q.retried = true;
    btn.classList.add("wrong");
    showExplainBox(`<p class="fix-hint">${esc(t("fix_later"))}</p>`, false);
    persistCorrection();
    Live.push("task");
    setTimeout(closeMidRetry, 1400);
    return;
  }

  q.explained = true;
  btn.classList.add("wrong");
  const right = document.querySelectorAll(".answer")[q.answerIdx];
  if (right) right.classList.add("correct");
  showExplainBox(
    `<b class="explain-title">${esc(t("explain_title"))}</b>
     <p class="explain-text">${esc(Engine.explain(q, LANG))}</p>`, true);
  persistCorrection();
  Live.push("task");
}

/* A correction has to outlive this screen: into the running opdracht if there
   still is one, into the day's report card once the opdracht is done. */
function persistCorrection() {
  if (session.banked) {
    // `banked` means every som has been faced, so the round is not standing
    writeTiles(false);
    settleTask();
    writeReport();
  } else saveActive();
}

/* One 💡 per five sommen, earned as the opdracht goes on rather than handed
   over all at once. A child who could ask for help on every som never has to
   read the story properly; a child with one hint in their pocket spends it on
   the som that really has them stuck. The count is per opdracht and travels
   with it, so switching devices does not top it up. */
const HINTS_PER = 5;

function hintsAllowed() {
  if (!session) return 0;
  const shown = Math.min(session.idx, session.queue.length);
  return Math.floor(shown / HINTS_PER) + 1;
}

function hintsLeft() {
  return Math.max(0, hintsAllowed() - (session.hintsUsed || 0));
}

function toggleHint() {
  const q = currentQ();
  const bubble = $("hint-bubble");
  if (!bubble.classList.contains("hidden")) { bubble.classList.add("hidden"); return; }
  const text = Engine.hint(q, LANG);
  if (!text) return;
  // already open on this som once: reading it again is free
  if (!q.hinted && hintsLeft() <= 0) {
    // A spent lamp used to be a disabled button: pressing it did nothing at
    // all, and why it was grey was written in a `title` no tablet ever shows.
    bubble.textContent = "💡 " + t("hint_none").replace("{n}", HINTS_PER);
    bubble.classList.remove("hidden");
    return;
  }

  bubble.textContent = "💡 " + text;
  bubble.classList.remove("hidden");
  if (!q.hinted) {
    q.hinted = true;                 // quietly noted, so the parent can see
    session.hintsUsed = (session.hintsUsed || 0) + 1;
    renderHintButton(q);
    if (session.banked) writeReport(); else saveActive();
    Live.push("task");
  }
}

/* the 💡 itself: how many are left, and whether it can be pressed at all */
function renderHintButton(q) {
  const btn = $("btn-hint");
  const text = Engine.hint(q, LANG);
  const inTask = !session.review;
  if (!text || !inTask) { btn.classList.add("hidden"); return; }
  const left = hintsLeft();
  const usable = q.hinted || left > 0;
  btn.classList.remove("hidden");
  btn.classList.toggle("spent", !usable);
  btn.setAttribute("aria-disabled", String(!usable));
  $("hint-count").textContent = q.hinted ? "" : String(left);
  // the lamp carries no word any more, so the word lives where a screen
  // reader and a long-press can still find it
  btn.setAttribute("aria-label", t("hint_btn"));
  btn.title = usable ? t("hint_btn") : t("hint_none").replace("{n}", HINTS_PER);
}

function showExplainBox(html, withButton) {
  $("explain-body").innerHTML = html;
  $("btn-gotit").textContent = t("got_it");
  $("btn-gotit").classList.toggle("hidden", !withButton);
  $("explain-box").classList.remove("hidden");
}

function hideExplainBox() {
  $("explain-box").classList.add("hidden");
  $("explain-body").innerHTML = "";
}

const ATTEMPTS = 1;                 // one go per som, and it is settled

/* A som nobody has answered yet: no verdict, neither right nor wrong. */
function undecided(q) {
  return q.correctFirst === null || q.correctFirst === undefined;
}

/* Nothing more can happen to this som: it was answered right, or the two
   chances are gone. */
function finished(q) {
  return !!q.solved || !!q.failed;
}

function skip() {
  const q = currentQ();
  if (finished(q)) return;        // a settled som cannot be un-answered
  q.skipped = true;
  q.chosen = null;
  q.solved = false;           // it comes back until it is answered
  advance();                  // correctFirst stays undecided on purpose
}

function advance() {
  // a som answered from the report card belongs to no queue: settle it and go
  // straight back to the card, leaving the opdracht's own place untouched
  if (session.viewOne != null) {
    session.viewOne = null;
    session.fromResult = false;
    saveActive();
    finishPass();
    return;
  }
  session.idx++;
  saveActive();                       // so another device can pick it up here
  $("progress-bar").style.width = `${(session.idx / session.queue.length) * 100}%`;
  if (session.idx >= session.queue.length) finishPass();
  else renderQuestion();
}

/* Deal the extra sommen the mistakes have earned, if any. */
function maybeExtend() {
  const add = storedExtension(session);
  if (!add) return false;
  // the reserve was dealt at the morning's level; the afternoon may need a
  // gentler hand, so every extra som is dealt again at the dial's level now
  const avoid = new Set(session.questions.concat(session.pool).map(q => Engine.sig(q)));
  const extra = session.pool.splice(0, add).map(q => {
    const f = Engine.refresh(q, data, avoid);
    avoid.add(Engine.sig(f));
    return f;
  });
  const base = session.questions.length;
  extra.forEach((q, i) => { session.questions.push(q); session.queue.push(base + i); });
  // land on the first som that still needs answering. The sweep leaves idx at
  // the end of the old queue, but an extension reached from the report card —
  // a skip resolved from its tile — leaves it pointing at an already-settled
  // som, and the child would stand in front of buttons that do nothing.
  const firstOpen = session.queue.findIndex(qi => !finished(session.questions[qi]));
  session.idx = firstOpen === -1 ? session.queue.length : firstOpen;
  session.review = false;
  session.fromResult = false;
  session.viewOne = null;
  saveActive();
  return true;
}

function finishPass() {
  // only soms that were put aside can still be done; a failed one is settled
  const open = session.questions.map((q, i) => i).filter(i => !finished(session.questions[i]));

  // every som faced — but the mistakes may have earned extra sommen, and then
  // the opdracht simply carries on instead of ending
  if (open.length === 0 && maybeExtend()) {
    ensureTimer();
    renderQuestion();
    show("screen-task");
    return;
  }

  recordFirstPass();                 // waits until every som has been faced
  if (open.length === 0) {
    markDone100();          // this clears the active task — do not write it back
  } else {
    session.nextQueue = open;
    // The round is not over, so nothing is booked yet — and the clock must
    // not keep running while the child sits on the report card, or goes off
    // and comes back at bedtime. Forty idle minutes used to be written down
    // as forty minutes of practice.
    if (session.pausedSec == null) session.pausedSec = elapsedSec();
    writeTiles(true);       // the sommen already made count from now, not later
    saveActive();           // still soms to do, so it stays resumable
    Store.save(data);
  }

  stopTimer();
  openReportAt(todayStr());
}

/* Close the books on a whole opdracht: the time it took, the level and the
   score it is judged on. The sommen themselves were already counted one by one
   as they were answered; this is what can only be said once every one of them
   has been faced — a som still put aside has no verdict yet and must not be
   read as a mistake. */
function recordFirstPass() {
  if (session.banked) return;
  if (!session.questions.every(finished)) return;      // a som is still waiting
  session.banked = true;

  bankSettled();                       // whatever is not counted yet
  const secs = session.lastSec != null ? session.lastSec
             : session.pausedSec != null ? session.pausedSec : elapsedSec();
  session.lastSec = secs;              // the moment the opdracht was completed
  const ds = todayStr();
  const day = data.days[ds] || { solved: 0, firstCorrect: 0, done100: false, cats: {} };
  const nCorrect = session.questions.filter(q => q.correctFirst).length;

  // time log: how long the whole opdracht took, and under which soort
  day.timeSec = secs;
  day.times = (day.times || []).concat(secs);
  addDaySecs(day, session.kind || "sommen", secs);
  const nSkipped = session.questions.filter(q => q.skipped).length;
  data.days[ds] = day;
  console.log(`[Oefensommen] ${ds}: ${session.questions.length} sommen in ${fmtTime(secs)} — ${nCorrect} goed (1e keer), ${nSkipped} overgeslagen`);

  session.score = { correct: nCorrect, total: session.questions.length, first: nCorrect, fixed: 0 };
  // the niveau waits for settleTask: a fout that is still going to be put
  // right must not be judged as a fout
  Store.save(data);
}

/* How the opdracht stands, the way the CHILD is told it.

   A som that went wrong and was then put right on the second chance counts as
   good. Not as a favour: the child looked at the mistake, worked out what it
   should have been and got there — which is the whole point of the exercise.
   Telling them it still counts as a fout would teach that correcting yourself
   is pointless.

   The honest split is kept underneath — first is what went right straight
   away, fixed is what was put right afterwards — because the parent should be
   able to see the difference even when the child is not shown one. */
function scoreNow(qs) {
  const first = qs.filter(q => q.correctFirst).length;
  const fixed = qs.filter(q => !q.correctFirst && q.fixed).length;
  return { first, fixed, correct: first + fixed, total: qs.length };
}

/* One letter per som, kept in the day record so a report card can still be
   drawn for a day long after the opdracht itself is gone:
   o = right away, f = put right, e = uitleg read, n = fout, t = not done.
   A capital says the 💡 was used on that som. */
function tilesOf(qs) {
  return qs.map(q => {
    const c = q.correctFirst ? "o" : q.fixed ? "f" : q.explained ? "e" : q.failed ? "n" : "t";
    return q.hinted ? c.toUpperCase() : c;
  }).join("");
}

function tileState(ch) {
  return { key: ch.toLowerCase(), hinted: ch !== ch.toLowerCase() };
}

/* How many days of question lists to keep. The parent looks back at yesterday,
   not at March, and only the soort som is needed to judge it — but two months
   of template ids still costs only a few kilobytes, where the whole opdracht
   would cost a great deal more. */
const TPLS_KEEP_DAYS = 60;

/* `open` means the round is still standing: its sommen are written down so
   that the work shows in the rapport and in today's score, but the door it
   came through has not been through yet. A round broken off with one som
   skipped used to write nothing at all — nine right answers that the day
   record, the chips, the doors and the parent's rapport all read as zero. */
function writeTiles(open) {
  const day = data.days[todayStr()];
  if (!day) return;
  day.tiles = day.tiles || [];
  day.tpls = day.tpls || [];
  day.kinds = day.kinds || [];
  day.open = day.open || [];
  if (session.tileSlot == null) { day.tiles.push(""); session.tileSlot = day.tiles.length - 1; }
  day.tiles[session.tileSlot] = tilesOf(session.questions);
  day.tpls[session.tileSlot] = session.questions.map(q => q.tplId);
  day.kinds[session.tileSlot] = session.kind || "sommen";
  day.open[session.tileSlot] = !!open;
  day.secs = day.secs || {};               // seconds worked, per soort opdracht
  day.fixed = day.tiles.join("").toLowerCase().split("").filter(c => c === "f").length;

  // let the older question lists go; the tiles themselves stay forever
  const cut = new Date(); cut.setDate(cut.getDate() - TPLS_KEEP_DAYS);
  const cutStr = todayStr(cut);
  for (const ds in data.days) if (ds < cutStr && data.days[ds].tpls) delete data.days[ds].tpls;
  return scoreNow(session.questions);
}

/* The score of a whole opdracht, as the child is told it: a fout put right
   on the second chance counts as good. Held back until every fout has been
   gone over, because that verdict is not in until the child has had their
   second look. Idempotent. */
function settleTask() {
  const qs = session.questions;
  if (!qs.every(finished)) return;
  if (qs.some(q => q.failed && !q.fixed && !q.explained)) return;   // still to review
  const sc = scoreNow(qs);
  session.score = { correct: sc.correct, total: sc.total, first: sc.first, fixed: sc.fixed };
}

function markDone100() {
  if (session.rewarded) return;      // one opdracht is written down once
  session.rewarded = true;
  const ds = todayStr();
  const day = data.days[ds] || { solved: 0, firstCorrect: 0, done100: false, cats: {} };
  day.done100 = true;
  data.days[ds] = day;
  session.nextQueue = null;
  session.celebrate = true;
  carryLegacyActive();             // whatever belonged to another door stays
  if (data.actives) delete data.actives[session.kind || "sommen"];   // this round is done
  writeTiles();                    // a report card that outlives the opdracht
  settleTask();                    // niveau and speeltijd, if nothing is left to review
  writeReport();                   // saves; the report card outlives the session
}

/* The report card is kept for the rest of the day. Without this, closing the
   app after the last som lost the way back to it — and with it the fouten
   still to be verbeterd and the door to the spelletjes. It rides the normal
   sync, so a correction made on the phone shows on the tablet. */
/* One slot per door. There used to be exactly one, so finishing the klok
   wrote over the sommen — and a fout the child had been told to go and put
   right simply stopped being reachable from anywhere, without a word. */
function reportsOf() {
  data.reports = data.reports || {};
  if (data.report && data.report.kind && !data.reports[data.report.kind]) {
    data.reports[data.report.kind] = data.report;      // the single slot, moved in
  }
  delete data.report;
  const ds = todayStr();
  for (const k in data.reports) {
    if (!data.reports[k] || data.reports[k].date !== ds) delete data.reports[k];
  }
  return data.reports;
}

/* The round of today still worth opening: one with a fout nobody has been
   back to, otherwise simply the last one finished. */
function liveReport() {
  const all = Object.values(reportsOf())
    .filter(r => r && r.date === todayStr() && r.questions && r.questions.length);
  const open = all.filter(r => r.questions.some(q => q.failed && !q.fixed && !q.explained));
  const pick = open.length ? open : all;
  return pick.sort((a, b) => (b.at || 0) - (a.at || 0))[0] || null;
}

function writeReport() {
  const kind = session.kind || "sommen";
  reportsOf()[kind] = {
    at: Date.now(),
    date: todayStr(),
    kind: session.kind || "sommen",
    score: session.score || null,
    lastSec: session.lastSec != null ? session.lastSec : null,
    floor: !!session.floorGiven,
    tileSlot: session.tileSlot == null ? null : session.tileSlot,
    levelJudged: !!session.levelJudged,
    questions: session.questions.map(snapQ)
  };
  Store.save(data);
}

/* The door into the rapport.

   For the CHILD a round finished earlier today is rebuilt into a session
   first, so its red vakjes still open for the second chance. The PARENT never
   gets that session: the report they are looking at is the child's, and a
   parent tapping a red vakje would spend a second chance that is not theirs —
   it would write "put right" into the child's record and take the chance away
   before the child ever saw it. The parent reads the stored day instead, which
   is where their own tools live anyway. */
function openReport() {
  const r = liveReport();
  if (Store.isParent() || !r) {
    return openReportAt(todayStr());
  }
  session = {
    questions: r.questions.map(q => Object.assign({}, q)),
    pool: [],
    queue: r.questions.map((_, i) => i),
    idx: r.questions.length,
    firstPass: false,
    banked: true, rewarded: true,          // the day is already counted
    tileSlot: r.tileSlot == null ? null : r.tileSlot,
    score: r.score, lastSec: r.lastSec,
    kind: r.kind || "sommen"
  };
  Live.startHeartbeat();
  openReportAt(todayStr());
}

/* ---------- the rapport ----------

   One destination for "how is it going": today's round, every day before it,
   and — for the parent — the tools that belong to a day. The month grid is
   gone; a day is picked from a strip of the last fortnight.

   Region C has two renderers writing into the same node. Today with a live
   opdracht is drawn by renderResult(), because the tiles there are the LIVE
   questions and tapping a red one is the child's second chance, which only
   exists on the session. Every other day is drawn by showDay() out of the
   stored record. */
const STRIP_DAYS = 14;

function openReportAt(ds) {
  reportDay = ds || todayStr();
  const live = reportDay === todayStr() && session && session.questions;
  renderReportStrip();
  if (live) renderResult(); else showDay(reportDay);
  show("screen-result");
}

let reportDay = null;

/* The last fortnight as one line of days: weekday, number, and a dot for how
   the day went. Today sits at the end, where the eye lands, and is selected
   when the rapport opens. */
function renderReportStrip() {
  const strip = $("report-strip");
  const days = dayStrip(STRIP_DAYS).reverse();      // oldest first, today last
  const wd = t("weekdays");
  strip.innerHTML = days.map(d => {
    const [y, m, dd] = d.ds.split("-").map(Number);
    const date = new Date(y, m - 1, dd);
    // the first of a month says which month, or the strip reads 29 30 31 1 2 3
    const head = dd === 1 ? t("months")[m - 1].slice(0, 3).toLowerCase()
                          : wd[(date.getDay() + 6) % 7];
    return `<button class="strip-day${d.ds === reportDay ? " on" : ""}${d.today ? " today" : ""}${dd === 1 ? " month" : ""}"
              data-day="${d.ds}"${d.today ? ' aria-current="date"' : ""}>
              <span class="sd-wd">${head}</span>
              <span class="sd-n">${dd}</span>
              <i class="sd-dot ${d.state || "none"}"></i>
            </button>`;
  }).join("");
  strip.querySelectorAll(".strip-day").forEach(b =>
    b.addEventListener("click", () => openReportAt(b.dataset.day)));
  const on = strip.querySelector(".strip-day.on");
  if (on) on.scrollIntoView({ block: "nearest", inline: "center" });
}

function renderResult() {
  const qs = session.questions;
  const allDone = qs.every(finished);
  const sc = scoreNow(qs);
  const perfect = allDone && sc.correct === sc.total;
  const ds = todayStr();
  reportDay = ds;

  // the tiles of the round just worked: these are the LIVE questions, so a red
  // one can still be opened for its second chance
  const tiles = qs.map((q, i) => {
    // A som put right on the second go carries the same ✅ — it is good, and
    // the child should see it as good — on a green of its own, which is what
    // the kalender has always done and what this card used to flatten away.
    const state = q.correctFirst ? "ok" : q.fixed ? "fix"
      : q.solved ? "ok2" : q.failed ? (q.explained ? "exp" : "no") : "todo";
    const icon = { ok: "✅", fix: "✅", ok2: "✅", exp: "📖", no: "❌", todo: "⏭" }[state];
    const tip = t({ ok: "tile_done", fix: "tile_fixed", ok2: "tile_second",
                    exp: "tile_explained", no: "tile_wrong", todo: "tile_todo" }[state]) +
                (q.hinted ? " · 💡" : "");
    return `<button class="result-tile ${state}" data-q="${i}" title="${esc(tip)}">
              <span class="num">${i + 1}</span><span class="mark">${icon}</span>
              ${q.hinted ? `<span class="tile-hint">💡</span>` : ""}
            </button>`;
  }).join("");

  const left = qs.filter(q => !finished(q)).length;
  const unreviewed = qs.filter(q => q.failed && !q.fixed && !q.explained).length;
  const marks = legendFor(tiles);
  const praise = perfect ? `🎉 ${esc(partyMessage(LANG))}`
    : allDone ? `💪 ${esc(t("result_score").replace("{c}", sc.correct).replace("{t}", qs.length))}`
    : `⏭ ${esc(t("finish_rest").replace("{n}", left))}`;

  const box = $("report-day");
  box.innerHTML =
    daySummaryHTML(ds) +
    `<p class="day-praise${perfect ? " perfect" : ""}">${praise}</p>
     <p class="day-run">${t("door_icon")[session.kind || "sommen"]} ${esc(t("home_" + (session.kind || "sommen")))}</p>
     <div class="result-grid">${tiles}</div>` +
    (left && !Store.isParent() ? `<button id="btn-retry" class="btn primary">${esc(t("retry_btn"))}</button>` : "") +
    (allDone && unreviewed ? `<p class="review-hint">${esc(t("fix_first_noplay"))}</p>` : "") +
    marks +
    dayExtrasHTML(ds);

  if (!Store.isParent()) {
    box.querySelectorAll(".result-tile[data-q]").forEach(tile =>
      tile.addEventListener("click", () => openQuestion(+tile.dataset.q)));
    const retry = $("btn-retry");
    if (retry) retry.addEventListener("click", startRetry);
  }
  wireDayExtras(ds, box);

  Live.push("result");
  if (perfect && session.celebrate) { session.celebrate = false; fireConfetti(); }
}

/* What every day says first: the score out of a hundred, the minutes worked,
   and which of the three doors were opened. Shared by today and by any day
   picked out of the strip — a day is a day. */
function daySummaryHTML(ds) {
  const tally = dayTally(ds);
  if (!tally.n) return "";
  const mins = Math.max(1, Math.round(daySecs(ds) / 60));
  const doors = DOORS.filter(d => tally.per[d.key].n)
    .map(d => `<span class="day-door"><i>${t("door_icon")[d.key]}</i>${esc(t("home_" + d.key))}
                 <b>${tally.per[d.key].c}/${tally.per[d.key].n}</b></span>`).join("");
  return `<div class="day-score">
            <span class="score-ring${tally.score >= 80 ? " good" : tally.score >= 50 ? " mid" : " low"}">
              <b>${tally.score}</b><em>/100</em></span>
            <span class="score-side">
              <span class="day-pill">⏱ ${esc(t("day_minutes").replace("{n}", mins))}</span>
              <span class="day-pill">✅ ${tally.c} / ${tally.n}</span>
            </span>
          </div>
          <div class="day-doors">${doors}</div>`;
}

/* Everything that hangs under a day: the tafels as they stand, and — for the
   parent — the day's colour, its note, the rateable sommen and the overview. */
/* Which of the parent's disclosures are open. Rating a som redraws the whole
   day — that is what keeps the verdicts honest — but it must not shut the list
   the parent was working through and throw them back to the top. */
const openPanels = {};

function dayExtrasHTML(ds) {
  let out = "";
  const strips = sprintStripsHTML(ds);
  if (strips) out += `<div class="sprint-strip">${strips}</div>`;

  // the tafelgrid belongs to BOTH of them: the child was promised it
  const tsc = tafelScore();
  if (ds === todayStr() && tsc.asked) {
    const weak = tafelWeakHTML();
    out += `<div class="sprint-strip">
              <div class="sprint-line"><b>${esc(t("tafel_title"))}</b>
                <span>${tsc.known}/${tsc.total}</span></div>
              <div class="tafel-grid small">${tafelGridHTML()}</div>
              <p class="tafel-weak${weak.good ? " good" : ""}">${esc(weak.text)}</p>
            </div>`;
  }

  const mark = (data.marks || {})[ds];
  if (!Store.isParent()) {
    if (mark && mark.note) out += `<p class="day-note">📝 ${esc(mark.note)}</p>`;
    return out;
  }

  out += `<div class="parent-block">${dayEditorHTML(ds, mark)}`;
  const rec = data.days[ds];
  const qs = dayQuestionsHTML(ds, rec);
  if (qs) out += `<details class="more" data-panel="sommen"${openPanels.sommen ? " open" : ""}>
                    <summary>${esc(t("sommen"))}</summary>
                    <p class="lessons-sub">${esc(t("rate_sub"))}</p>${qs}</details>`;
  else if (rec && rec.tiles) out += `<p class="day-nosom">${esc(t("day_no_sommen"))}</p>`;
  out += `<details class="more" data-panel="stats"${openPanels.stats ? " open" : ""}>
            <summary>${esc(t("stats"))}</summary>
            <div id="stats-body"></div></details>
          <div id="lessons" class="lessons"></div></div>`;
  return out;
}

function wireDayExtras(ds, box) {
  if (!Store.isParent()) return;
  box.querySelectorAll("details[data-panel]").forEach(d =>
    d.addEventListener("toggle", () => { openPanels[d.dataset.panel] = d.open; }));
  wireDayEditor(ds);
  wireRateButtons(box);
  box.querySelectorAll(".result-tile[data-open]").forEach(tile =>
    tile.addEventListener("click", () => openSomByKey(box, tile.dataset.open)));
  renderStats();
  renderLessons();
  // the row the parent was looking at should still be under their thumb
  if (openSom) {
    const row = box.querySelector(`.som-row[data-key="${openSom}"]`);
    if (row) { fillSomRow(row, true); row.scrollIntoView({ block: "center" }); }
  }
}

/* Open one som straight from the report card. Still waiting to be answered →
   answer it now; already finished → look at it without changing anything. */
function openQuestion(i) {
  const q = session.questions[i];
  // a fout whose second chance was already spent during the opdracht goes
  // straight to the uitleg — the third look is for reading, not for guessing
  if (q.failed && q.retried && !q.fixed && !q.explained) {
    q.explained = true;
    persistCorrection();
  }
  session.fromResult = true;
  session.review = finished(q);       // settled soms are read-only, right or wrong
  session.viewOne = i;                // beside the queue, not instead of it
  renderQuestion();
  show("screen-task");
  $("btn-pause").classList.add("hidden");     // no clock is running here
}

function backToResult() {
  session.review = false;
  session.fromResult = false;
  session.viewOne = null;
  hideExplainBox();
  openReportAt(todayStr());
}

function startRetry() {
  if (!session.nextQueue || !session.nextQueue.length) return;
  if (session.pausedSec != null) {                  // the clock picks up again
    session.t0 = Date.now() - session.pausedSec * 1000;
    session.pausedSec = null;
  }
  session.queue = session.nextQueue;
  session.nextQueue = null;
  session.idx = 0;
  session.firstPass = false;
  session.review = false;
  session.fromResult = false;
  session.round = (session.round || 1) + 1;
  saveActive();                    // the correction round is resumable too
  ensureTimer(true);
  renderQuestion();
  show("screen-task");
}

/* ---------- sommen: the parent's say over the questions themselves ----------

   The app can see THAT a som went wrong. It cannot see whether the child was
   beaten by the arithmetic, by the story, or simply by a bad morning. A parent
   sitting beside them can. Every som of today can be marked too hard or too
   easy, and each verdict shifts that SOORT som — not just this one — a step
   for good. What has been marked collects at the bottom: the lessons learned,
   with a way to take any of them back. */

/* One som as the parent sees it: how it went, what it was, and the two words
   that tune it. `q` may be a whole question (today, with its real numbers) or
   just a template id with a tile letter (an earlier day, where only the soort
   was kept). */
function somRowHTML(i, opts) {
  const { state, hinted, cat, text, tplId, key, qIdx } = opts;
  const icon = { o: "✅", f: "✅", e: "📖", n: "❌", t: "⏭" }[state] || "❌";
  const adj = Tuning.of(data, tplId);
  const tpl = TEMPLATES.find(x => x.id === tplId);
  const off = tpl && !Rules.allows(data, tpl);
  return `<div class="som-row${off ? " off" : ""}" data-key="${esc(key || "")}"
               data-tpl="${esc(tplId)}"${qIdx == null ? "" : ` data-q="${qIdx}"`}>
            <div class="som-head">
              <span class="som-n">${icon} ${i + 1}</span>
              <span class="som-cat">${esc(cat)}</span>
              ${hinted ? `<span class="som-hint">💡</span>` : ""}
              ${tpl && tpl.school ? `<img class="school-badge row" src="img/school.svg" alt="school" title="${esc(t("school_badge"))}">` : ""}
              ${off ? `<span class="som-off">${esc(t("rule_is_off"))}</span>` : ""}
              <span class="som-more">▾</span>
            </div>
            <p class="som-text">${esc(text)}</p>
            <div class="som-rate">
              <button class="rate-btn hard${adj < 0 ? " on" : ""}" data-tpl="${esc(tplId)}" data-v="hard">😓 ${esc(t("too_hard"))}</button>
              <button class="rate-btn easy${adj > 0 ? " on" : ""}" data-tpl="${esc(tplId)}" data-v="easy">😀 ${esc(t("too_easy"))}</button>
              ${adj ? `<span class="rate-now">${esc(adjLabel(adj))}</span>` : ""}
            </div>
            <div class="som-detail hidden"></div>
          </div>`;
}

/* ---------- what the parent may do with one som ----------

   Opening a som shows it whole: the answers as the child saw them, which one
   was picked, and how it is worked out. Underneath are the three ways a parent
   can act on it, in rising order of how far it reaches:

     the verdict   — too hard, too easy: this soort som moves a level
     the switch    — this soort som, or everything with this property, stops
                     being asked at all
     the note      — what does not fit in a switch, in their own words

   The note does not change the bank by itself; it is a record, and it is what
   a new rule gets written from. */
let openSom = null;                       // which som is unfolded, across renders
const sampleQ = {};                       // one worked example per soort som

function sampleQuestion(tplId) {
  if (sampleQ[tplId]) return sampleQ[tplId];
  const tpl = TEMPLATES.find(x => x.id === tplId);
  if (!tpl) return null;
  const q = Engine.freshFrom(tpl, Engine.levelFor(tpl, data), new Set(), new Set());
  if (q) sampleQ[tplId] = q;
  return q;
}

function somDetailHTML(tplId, q) {
  const tpl = TEMPLATES.find(x => x.id === tplId);
  if (!tpl) return "";
  const real = !!q;
  const shown = q || sampleQuestion(tplId);
  let body = "";

  if (shown) {
    if (tpl.face && shown.vars && shown.vars._h !== undefined) {
      body += `<div class="det-clock">${shown.vars._h2 !== undefined
        ? Klok.facePairSVG(shown.vars._h, shown.vars._m, shown.vars._h2, shown.vars._m2)
        : Klok.faceSVG(shown.vars._h, shown.vars._m, 150)}</div>`;
    }
    if (!real) body += `<p class="det-label">${esc(t("q_sample"))}</p>
                        <p class="det-q">${esc(Engine.text(shown, LANG))}</p>`;
    body += `<div class="det-opts">` + shown.options.map((o, j) => {
      const right = j === shown.answerIdx;
      const picked = real && shown.chosen === j;
      return `<span class="det-opt${right ? " right" : ""}${picked && !right ? " picked" : ""}">
                ${esc(String(o))}${right ? " ✅" : (picked ? " ❌" : "")}
              </span>`;
    }).join("") + `</div>`;
    if (real && shown.chosen != null) {
      body += `<p class="det-label">${esc(shown.chosen === shown.answerIdx
        ? t("verdict_right") : t("q_picked").replace("{a}", shown.options[shown.chosen]))}</p>`;
    }
    const ex = Engine.explain(shown, LANG);
    if (ex) body += `<div class="det-explain"><b>${esc(t("explain_title"))}</b> ${ex}</div>`;
  }

  // the switches: this soort som, and every property it happens to have
  const rows = [{ kind: "tpl", key: tplId, label: t("rule_this_som") }]
    .concat(Traits.of(tpl).map(tr => ({ kind: "trait", key: tr, label: t("traits")[tr] || tr })));
  body += `<div class="det-rules"><b>${esc(t("rules_head"))}</b>` + rows.map(r => {
    const off = Rules.blocked(data, r.kind, r.key);
    return `<label class="det-rule">
              <input type="checkbox" class="rule-box" data-kind="${r.kind}" data-key="${esc(r.key)}"${off ? " checked" : ""}>
              <span>${esc(r.label)}</span>
              ${off ? `<i class="det-off">${esc(t("rule_is_off"))}</i>` : ""}
            </label>`;
  }).join("") + `<p class="det-hint">${esc(t("rules_hint"))}</p></div>`;

  // and what does not fit in a switch
  const notes = Rules.notes(data, tplId);
  body += `<div class="det-note"><b>${esc(t("note_head"))}</b>
             ${notes.map(n => `<p class="det-note-line">“${esc(n.text)}”</p>`).join("")}
             <textarea class="note-box" rows="2" data-tpl="${esc(tplId)}"
                       placeholder="${esc(t("note_ph_som"))}"></textarea>
             <div class="det-note-btns">
               <button class="btn ghost small note-save" data-tpl="${esc(tplId)}">${esc(t("note_save"))}</button>
               ${notes.length ? `<button class="btn ghost small note-clear" data-tpl="${esc(tplId)}">${esc(t("note_clear"))}</button>` : ""}
             </div>
           </div>`;
  return body;
}

/* The sommen of one particular day, for the parent to rate. Today comes from
   the report card, with the numbers the child actually saw; an earlier day
   comes from the template ids kept with that day, so the phrasing is shown
   with … where the numbers were. Either way the verdict lands on the soort
   som, which is what tuning acts on. */
/* Today's rounds with the numbers the child actually saw, one entry per run
   of the day — or nothing, if they cannot all be told apart.

   There is one report slot per soort, so two sommen rounds in one day cannot
   both be matched to their run and the whole day falls back to the phrasing
   with … where the numbers were. One round of each, which is what a day is,
   lines up exactly. This used to give up the moment a day had a second run at
   all, so on every completed day — three doors, three runs — the parent could
   no longer see a single real som. */
function todayRuns(ds, rec) {
  if (ds !== todayStr() || !rec || !rec.tiles || !rec.tiles.length) return null;
  const kinds = rec.tiles.map((_, i) => (rec.kinds || [])[i] || "sommen");
  if (new Set(kinds).size !== kinds.length) return null;      // the same door twice
  const reports = reportsOf(), open = allActives();
  const runs = [];
  for (let ri = 0; ri < kinds.length; ri++) {
    // a round that is finished kept its report; one still standing is in the
    // slot its door left it in, and the parent can read that just as well
    const r = reports[kinds[ri]] || open[kinds[ri]];
    if (!r || r.date !== ds || !r.questions || !r.questions.length) return null;
    if (r.questions.length !== rec.tiles[ri].length) return null;
    runs.push({ kind: kinds[ri], questions: r.questions });
  }
  return runs.length ? runs : null;
}

function dayRowsSource(ds, rec) {
  if (todayRuns(ds, rec)) return "today";
  if (rec && rec.tpls && rec.tpls.length) return "tpls";
  return null;                       // a day from before the sommen were kept
}

/* Which row on this day's list belongs to tile number i of run ri — so that
   tapping a vakje on the report card lands on the som it stands for. One
   shape for both sources, so nothing has to know which one it came from. */
function somKeyFor(ds, rec, ri, i) {
  return `${ds}|${ri}|${i}`;
}

/* Every som of today, in the order the rows are drawn, so a row's number is
   its place in this list. */
function todayRunQuestions(ds, rec) {
  const runs = todayRuns(ds, rec);
  return runs ? [].concat(...runs.map(r => r.questions)) : [];
}

function dayQuestionsHTML(ds, rec) {
  const runs = todayRuns(ds, rec);
  if (runs) {
    let flat = 0;
    return runs.map((run, ri) => {
      const head = `<p class="day-run">${t("door_icon")[run.kind]} ${esc(t("home_" + run.kind))}` +
                   (runs.length > 1 ? ` · ${t("day_run").replace("{n}", ri + 1)}` : "") + `</p>`;
      return head + run.questions.map((q, i) => somRowHTML(i, {
        state: q.correctFirst ? "o" : q.fixed ? "f" : q.explained ? "e" : q.failed ? "n" : "t",
        hinted: !!q.hinted, cat: t("cats")[q.cat] || q.cat,
        text: Engine.text(q, LANG), tplId: q.tplId,
        key: somKeyFor(ds, rec, ri, i), qIdx: flat++
      })).join("");
    }).join("");
  }
  if (!rec || !rec.tpls || !rec.tpls.length) return "";
  return rec.tpls.map((run, ri) => {
    const kind = (rec.kinds || [])[ri] || "sommen";
    const head = `<p class="day-run">${t("door_icon")[kind]} ${esc(t("home_" + kind))}` +
                 (rec.tpls.length > 1 ? ` · ${t("day_run").replace("{n}", ri + 1)}` : "") + `</p>`;
    return head + run.map((id, i) => {
      const tpl = TEMPLATES.find(x => x.id === id);
      const { key, hinted } = tileState(((rec.tiles || [])[ri] || "")[i] || "n");
      return somRowHTML(i, {
        state: key, hinted,
        cat: tpl ? (t("cats")[tpl.cat] || tpl.cat) : id,
        text: tpl ? sampleText(tpl) : id, tplId: id,
        key: somKeyFor(ds, rec, ri, i)
      });
    }).join("");
  }).join("");
}

function adjLabel(adj) {
  return (adj < 0 ? t("tuned_easier") : t("tuned_harder")).replace("{n}", Math.abs(adj));
}

/* Everything the parent has said, in one place, and every bit of it can be
   taken back: the levels that were nudged, the sommen that were switched off,
   and the notes that were left. */
function renderLessons() {
  const box = $("lessons");
  const marked = Tuning.list(data);
  const rules = Rules.list(data);
  const notes = Rules.allNotes(data);
  if (!marked.length && !rules.length && !notes.length) {
    box.innerHTML = ""; box.classList.add("hidden"); return;
  }
  box.classList.remove("hidden");
  const what = id => {
    const tpl = TEMPLATES.find(x => x.id === id);
    return { cat: tpl ? (t("cats")[tpl.cat] || tpl.cat) : id, sample: tpl ? sampleText(tpl) : id };
  };

  let html = "";
  if (marked.length) {
    html += `<h3>${esc(t("lessons_title"))}</h3>
             <p class="lessons-sub">${esc(t("lessons_sub"))}</p>` +
      marked.map(m => {
        const w = what(m.id);
        return `<div class="lesson">
                  <div class="lesson-what"><b>${esc(w.cat)}</b><span>${esc(w.sample)}</span></div>
                  <span class="lesson-adj ${m.adj < 0 ? "easier" : "harder"}">${esc(adjLabel(m.adj))}</span>
                  <button class="lesson-undo" data-tpl="${esc(m.id)}" title="${esc(t("undo"))}">✕</button>
                </div>`;
      }).join("");
  }
  if (rules.length) {
    html += `<h3>${esc(t("rules_title"))}</h3>` +
      rules.map(r => {
        const w = r.kind === "tpl" ? what(r.key)
                                   : { cat: t("traits")[r.key] || r.key, sample: t("rule_everywhere") };
        return `<div class="lesson">
                  <div class="lesson-what"><b>${esc(w.cat)}</b><span>${esc(w.sample)}</span></div>
                  <span class="lesson-adj off">${esc(t("rule_is_off"))}</span>
                  <button class="lesson-undo" data-kind="${r.kind}" data-key="${esc(r.key)}" title="${esc(t("undo"))}">✕</button>
                </div>`;
      }).join("");
  }
  if (notes.length) {
    html += `<h3>${esc(t("notes_title"))}</h3>` +
      notes.map(n => {
        const w = what(n.tplId);
        return `<div class="lesson note">
                  <div class="lesson-what"><b>${esc(w.cat)}</b><span>“${esc(n.text)}”</span></div>
                  <button class="lesson-undo" data-note="${esc(n.tplId)}" title="${esc(t("undo"))}">✕</button>
                </div>`;
      }).join("");
  }
  box.innerHTML = html;

  box.querySelectorAll(".lesson-undo").forEach(b => b.addEventListener("click", () => {
    if (b.dataset.tpl) return rateSom(b.dataset.tpl, null);
    if (b.dataset.note) return saveNote(b.dataset.note, null);
    setRule(b.dataset.kind, b.dataset.key, false);
  }));
}

/* the bare phrasing of a template, tokens and all, shortened — enough for the
   parent to recognise which som it was without generating a whole new one */
function sampleText(tpl) {
  const s = (tpl.variants[0][LANG] || tpl.variants[0].nl)
    .replace(/\{[a-zA-Z_0-9]+\}/g, "…")
    .replace(/…(\s*…)+/g, "…");               // one ellipsis, not a row of them
  return s.length > 74 ? s.slice(0, 72) + "…" : s;
}

function wireRateButtons(root) {
  root.querySelectorAll(".rate-btn").forEach(b =>
    b.addEventListener("click", e => { e.stopPropagation(); rateSom(b.dataset.tpl, b.dataset.v); }));
  root.querySelectorAll(".som-row").forEach(row => {
    const open = () => toggleSomRow(row);
    row.querySelector(".som-head").addEventListener("click", open);
    row.querySelector(".som-text").addEventListener("click", open);
    if (row.dataset.key && row.dataset.key === openSom) fillSomRow(row, true);
  });
}

function fillSomRow(row, on) {
  const box = row.querySelector(".som-detail");
  row.classList.toggle("open", !!on);
  box.classList.toggle("hidden", !on);
  if (!on) { box.innerHTML = ""; return; }
  const q = row.dataset.q != null
    ? todayRunQuestions(reportDay, data.days[reportDay])[+row.dataset.q] : null;
  box.innerHTML = somDetailHTML(row.dataset.tpl, q);
  wireSomDetail(box);
}

/* Open the som with this key and bring it into view — what a vakje on the
   report card does when the parent taps it. */
function openSomByKey(root, key) {
  const row = root.querySelector(`.som-row[data-key="${key}"]`);
  if (!row) return;
  if (openSom !== key) toggleSomRow(row);
  row.scrollIntoView({ behavior: "smooth", block: "center" });
}

function toggleSomRow(row) {
  const on = openSom !== row.dataset.key;
  document.querySelectorAll(".som-row.open").forEach(r => fillSomRow(r, false));
  openSom = on ? row.dataset.key : null;
  fillSomRow(row, on);
}

function wireSomDetail(box) {
  box.querySelectorAll(".rule-box").forEach(b =>
    b.addEventListener("change", () => setRule(b.dataset.kind, b.dataset.key, b.checked)));
  box.querySelectorAll(".note-save").forEach(b =>
    b.addEventListener("click", () => {
      const ta = box.querySelector(".note-box");
      if (ta && ta.value.trim()) saveNote(b.dataset.tpl, ta.value.trim());
    }));
  box.querySelectorAll(".note-clear").forEach(b =>
    b.addEventListener("click", () => saveNote(b.dataset.tpl, null)));
}

/* whichever of the two parent screens is showing the sommen redraws itself,
   with the som that was open still open */
function redrawSoms() {
  if (isOn("screen-result")) openReportAt(reportDay);   // keeps the open day open
}

async function rateSom(tplId, verdict) {
  const { u, p } = Store.creds();
  if (!u || !p || !Store.isParent()) return;
  try {
    const fresh = await Cloud.setTuning(u, p, tplId, verdict);
    if (fresh) { data = Store.dress(fresh); Store.saveLocal(data); }
    redrawSoms();
  } catch (e) { /* offline: leave the screen as it was */ }
}

/* A soort som, or a whole property, on or off. Switching something off that
   would leave a category with nothing to ask is allowed — but not by accident,
   so it is said out loud first. */
async function setRule(kind, key, blocked) {
  const { u, p } = Store.creds();
  if (!u || !p || !Store.isParent()) return;
  if (blocked) {
    const empty = Rules.wouldEmpty(data, kind, key);
    if (empty.length) {
      const cats = empty.map(c => t("cats")[c] || c).join(", ");
      if (!confirm(t("rule_warn_empty").replace("{c}", cats))) return redrawSoms();
    }
  }
  try {
    const fresh = await Cloud.setRule(u, p, kind, key, blocked);
    if (fresh) { data = Store.dress(fresh); Store.saveLocal(data); }
  } catch (e) { /* offline: the switch springs back on the redraw */ }
  redrawSoms();
}

async function saveNote(tplId, text) {
  const { u, p } = Store.creds();
  if (!u || !p || !Store.isParent()) return;
  try {
    const fresh = await Cloud.addNote(u, p, tplId, text);
    if (fresh) { data = Store.dress(fresh); Store.saveLocal(data); }
  } catch (e) { /* offline: the note is not lost, it is simply not saved */ }
  redrawSoms();
}

/* ---------- calendar ---------- */

/* What colour a day is.

   Green means the opdracht was finished, amber that there was oefenen but not
   a whole one, red that a school day went by with nothing done. Red only goes
   back as far as the first day there is a record of — before that the child
   was simply not using this yet — and never lands on today or on a day still
   to come, which have not had their chance.

   The parent has the last word. Not every day of oefenen happens in this app:
   a day out of the book counts too, and the app has no way of knowing. A
   colour set by hand beats anything worked out here. */
function dayColour(ds, rec, plan) {
  const mark = (data.marks || {})[ds];
  if (mark && mark.c) return mark.c;
  return (plan || dayPlan())[ds] || "";
}

/* One day as the rapport tells it: everything that was done, what went right
   and what went wrong, and — for the parent — the tools that belong to it.
   Writes into the rapport's day region; today with a live opdracht is drawn by
   renderResult() instead, because only that has the live questions. */
function showDay(ds) {
  const box = $("report-day");
  reportDay = ds;
  const rec = data.days[ds];
  const [y, m, d] = ds.split("-").map(Number);
  const head = `${d} ${t("months")[m - 1]}`;

  const mark = (data.marks || {})[ds];

  /* The head of every day that was worked: how long, how much of it was right,
     and which of the three doors were opened. The same block for the child
     and for the parent — a day is a day. */
  const tally = dayTally(ds);
  const secs = daySecs(ds);
  const summary = () => {
    if (!tally.n) return "";
    const mins = Math.max(1, Math.round(secs / 60));
    const doors = DOORS.filter(d => tally.per[d.key].n)
      .map(d => `<span class="day-door"><i>${t("door_icon")[d.key]}</i>${esc(t("home_" + d.key))}
                   <b>${tally.per[d.key].c}/${tally.per[d.key].n}</b></span>`).join("");
    return `<div class="day-score">
              <span class="score-ring${tally.score >= 80 ? " good" : tally.score >= 50 ? " mid" : " low"}">
                <b>${tally.score}</b><em>/100</em></span>
              <span class="score-side">
                <span class="day-pill">⏱ ${t("day_minutes").replace("{n}", mins)}</span>
                <span class="day-pill">✅ ${tally.c} / ${tally.n}</span>
              </span>
            </div>
            <div class="day-doors">${doors}</div>`;
  };

  let body;
  if (rec && rec.tiles && rec.tiles.length) {
    // the same report card the child saw, kept for the parent — and here the
    // ✔️ stays visible, because a parent should be able to tell a som that was
    // right straight away from one that was put right afterwards
    const wrong = rec.solved - rec.firstCorrect;
    const time = rec.timeSec ? `<span class="day-pill">⏱ ${fmtTime(rec.timeSec)}</span>` : "";
    const icon = { o: "✅", f: "✅", e: "📖", n: "❌", t: "⏭" };
    const cls  = { o: "ok", f: "fix", e: "exp", n: "no", t: "todo" };
    const tip  = { o: "tile_done", f: "tile_fixed", e: "tile_explained",
                   n: "tile_wrong", t: "tile_todo" };
  const canOpen = Store.isParent() && !!dayRowsSource(ds, rec);
    const grids = rec.tiles.map((run, ri) => {
      const tiles = run.split("").map((ch, i) => {
        const { key, hinted } = tileState(ch);
        const tag = canOpen ? "button" : "div";
        const at = canOpen ? ` data-open="${esc(somKeyFor(ds, rec, ri, i))}"` : "";
        return `<${tag} class="result-tile ${cls[key] || "no"}${canOpen ? "" : " flat"}"${at}` +
               ` title="${esc(t(tip[key] || "tile_wrong"))}">` +
               `<span class="num">${i + 1}</span><span class="mark">${icon[key] || "❌"}</span>` +
               (hinted ? `<span class="tile-hint">💡</span>` : "") + `</${tag}>`;
      }).join("");
      const kind = (rec.kinds || [])[ri] || "sommen";
      // a round still standing shows its ⏭ for the sommen it has not reached
      // yet, which is not the same thing as a som that was passed over
      const head = `<p class="day-run">${t("door_icon")[kind]} ${esc(t("home_" + kind))}` +
                   (rec.tiles.length > 1 ? ` · ${t("day_run").replace("{n}", ri + 1)}` : "") +
                   ((rec.open || [])[ri] ? ` · ${esc(t("day_open"))}` : "") + `</p>`;
      return head + `<div class="result-grid">${tiles}</div>`;
    }).join("");
    const fixed = rec.fixed || 0;
    body =
      `<div class="day-head"><b>${head}</b>${time}</div>
       ${summary()}
       ${grids}
       <div class="day-counts">
         <span class="day-pill ok">✅ ${rec.firstCorrect} ${t("day_first_try")}</span>
         ${fixed ? `<span class="day-pill fix">✔️ ${fixed} ${t("day_fixed")}</span>` : ""}
         <span class="day-pill no">❌ ${wrong - fixed} ${t("day_wrong")}</span>
       </div>
       <p class="day-aschild">${t("day_as_child").replace("{c}", rec.firstCorrect + fixed).replace("{t}", rec.solved)}</p>`;
    // The rateable list lives in the parent's own block below, behind its
    // disclosure. It used to be drawn here as well, so a parent scrolled past
    // ten rateable sommen and then found the same ten again — two lists with
    // the same keys, and a tap on a vakje landing on whichever came first.
  } else if (!rec || (!rec.solved && !tally.n)) {
    const bonus = dayPlan()[ds] === "bonus";
    body = `<div class="day-head"><b>${head}</b></div>
            <p class="day-none">${t(bonus ? "day_bonus" : "day_nothing")}</p>`;
  } else if (!rec.solved) {
    body = `<div class="day-head"><b>${head}</b></div>${summary()}`;
  } else {                        // a day from before the report cards were kept
    const wrong = rec.solved - rec.firstCorrect;
    const time = rec.timeSec ? `<span class="day-pill">⏱ ${fmtTime(rec.timeSec)}</span>` : "";
    const cats = Object.keys(rec.cats || {})
      .map(c => `<div class="day-cat"><span>${t("cats")[c] || c}</span><b>${rec.cats[c].c}/${rec.cats[c].n}</b></div>`)
      .join("");
    body =
      `<div class="day-head"><b>${head}</b>${time}</div>
       <div class="day-counts">
         <span class="day-pill ok">✅ ${rec.firstCorrect} ${t("day_right")}</span>
         <span class="day-pill no">❌ ${wrong} ${t("day_wrong")}</span>
         <span class="day-pill">${t("result_score").replace("{c}", rec.firstCorrect).replace("{t}", rec.solved)}</span>
       </div>
       ${cats ? `<div class="day-cats">${cats}</div>` : ""}`;
  }

  box.innerHTML = body + dayExtrasHTML(ds);
  box.dataset.day = ds;
  box.classList.remove("hidden");
  wireDayExtras(ds, box);
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, ch =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
}

/* The parent's say over a day: three colours, a short note, and a way back to
   letting the app decide. */
function dayEditorHTML(ds, mark) {
  const cur = mark && mark.c;
  const btn = (c, label) =>
    `<button class="mark-btn ${c}${cur === c ? " on" : ""}" data-c="${c}">${label}</button>`;
  return `<div class="day-edit">
            <div class="mark-row">
              ${btn("done", t("mark_green"))}
              ${btn("partial", t("mark_amber"))}
              ${btn("miss", t("mark_red"))}
              <button class="mark-btn auto${cur ? "" : " on"}" data-c="">${t("mark_auto")}</button>
            </div>
            <input id="day-note" class="day-note-input" maxlength="140"
                   placeholder="${t("note_ph")}" value="${esc((mark && mark.note) || "")}">
            <button id="day-save" class="btn ghost day-save">${t("note_save")}</button>
            <span id="day-saved" class="day-saved hidden">✓</span>
          </div>`;
}

function wireDayEditor(ds) {
  const box = $("report-day");
  let colour = ((data.marks || {})[ds] || {}).c || "";
  box.querySelectorAll(".mark-btn").forEach(b => {
    b.addEventListener("click", () => {
      colour = b.dataset.c;
      box.querySelectorAll(".mark-btn").forEach(x => x.classList.toggle("on", x === b));
    });
  });
  $("day-save").addEventListener("click", () => saveDayMark(ds, colour, $("day-note").value));
  $("day-note").addEventListener("keydown", e => {
    if (e.key === "Enter") saveDayMark(ds, colour, $("day-note").value);
  });
}

async function saveDayMark(ds, colour, note) {
  const btn = $("day-save");
  const { u, p } = Store.creds();
  if (!u || !p) return;
  btn.disabled = true;
  try {
    const fresh = await Cloud.setDayMark(u, p, ds, colour || null, note || null);
    data = fresh ? Store.dress(fresh) : data;
    Store.saveLocal(data);
    openReportAt(ds);                       // the day takes its new colour
    const ok = $("day-saved");
    if (ok) { ok.classList.remove("hidden"); setTimeout(() => ok.classList.add("hidden"), 1600); }
  } catch (e) {
    btn.textContent = t("note_failed");
  } finally {
    btn.disabled = false;
  }
}

/* ---------- the overview, now a disclosure inside the rapport ---------- */
function renderStats() {
  const box = $("stats-body");
  if (!box) return;
  let total = 0, correct = 0, daysPracticed = 0;
  const cats = {};
  for (const ds in data.days) {
    const day = data.days[ds];
    if (day.solved > 0) daysPracticed++;
    total += day.solved;
    correct += day.firstCorrect;
    for (const c in day.cats) {
      const agg = cats[c] || { n: 0, c: 0 };
      agg.n += day.cats[c].n; agg.c += day.cats[c].c;
      cats[c] = agg;
    }
  }
  const bars = [...ALL_CATS, "verrassing", "klokkijken"].map(cat => {
    const agg = cats[cat];
    if (!agg || !agg.n) return "";
    const pct = Math.round((agg.c / agg.n) * 100);
    const cls = pct >= 80 ? "" : (pct >= 60 ? "mid" : "low");
    return `<div class="cat-bar-row">
              <div class="cat-bar-label"><span>${esc(t("cats")[cat] || cat)}</span><b>${pct}% · ${agg.c}/${agg.n}</b></div>
              <div class="cat-bar-track"><div class="cat-bar-fill ${cls}" style="width:${pct}%"></div></div>
            </div>`;
  }).join("");
  box.innerHTML =
    `<div class="stat-grid">
       <div class="stat"><b>${total}</b><span>${esc(t("total_solved"))}</span></div>
       <div class="stat"><b>${total ? Math.round((correct / total) * 100) + "%" : "—"}</b><span>${esc(t("accuracy"))}</span></div>
       <div class="stat"><b>${daysPracticed}</b><span>${esc(t("done_days"))}</span></div>
     </div>${bars}`;
}

/* ---------- the tafels, as the child actually has them ----------

   Every sprint answer leaves a mark on the fact it was about, so after a week
   of five-a-day there is a picture of which tafels are really in there and
   which are still being worked out on the way. Green is answered inside the
   five seconds and stayed answered; amber slipped once; red keeps slipping;
   pale has simply not come round yet.

   It is the parent's screen, and it is deliberately not the child's: a wall
   of red is a to-do list to a grown-up and a verdict to an eight-year-old. */
function tafelState(m) {
  if (!m || !m.n) return "none";
  return m.w === 0 ? "ok" : (m.w === 1 ? "mid" : "low");
}

function tafelGridHTML() {
  const tally = data.tafel || {};
  const lo = Sprint.MIN, hi = Sprint.MAX;
  let html = `<div class="tafel-row head"><span class="tafel-cell corner">×</span>`;
  for (let b = lo; b <= hi; b++) html += `<span class="tafel-cell head">${b}</span>`;
  html += `</div>`;
  for (let a = lo; a <= hi; a++) {
    html += `<div class="tafel-row"><span class="tafel-cell head">${a}</span>`;
    for (let b = lo; b <= hi; b++) {
      const m = tally[Sprint.key(a, b)];
      const tip = `${a} × ${b} = ${a * b}` +
                  (m && m.n ? ` · ${t("tafel_asked").replace("{n}", m.n)}` : ` · ${t("tafel_new")}`);
      html += `<span class="tafel-cell ${tafelState(m)}" title="${esc(tip)}">${a * b}</span>`;
    }
    html += `</div>`;
  }
  return html;
}

/* How the tafels stand overall: how many of the 45 are answered on the clock
   and stay answered. Counted over every pair from 2 to 10 once — 6 × 8 and
   8 × 6 are one tafel, not two. */
function tafelScore() {
  const tally = data.tafel || {};
  let known = 0, asked = 0;
  const total = ((Sprint.MAX - Sprint.MIN + 1) * (Sprint.MAX - Sprint.MIN + 2)) / 2;
  for (let a = Sprint.MIN; a <= Sprint.MAX; a++) {
    for (let b = a; b <= Sprint.MAX; b++) {
      const m = tally[Sprint.key(a, b)];
      if (m && m.n) { asked++; if (m.w === 0) known++; }
    }
  }
  return { known, asked, total };
}

/* The handful worth ten minutes at the kitchen table tonight */
function tafelWeakHTML() {
  const tally = data.tafel || {};
  const weak = Object.keys(tally)
    .filter(k => (tally[k].w || 0) > 0)
    .sort((x, y) => tally[y].w - tally[x].w)
    .slice(0, 8)
    .map(k => k.replace("x", "×"));
  return weak.length
    ? { text: t("tafel_weak") + " " + weak.join(" · "), good: false }
    : { text: t("tafel_all_ok"), good: true };
}


/* What the marks on a report card mean, said once under the grid — and only
   for the marks that are actually up there. Every one of them used to live in
   a `title`, which on a tablet is a place nothing is ever read from. */
function legendFor(html) {
  const has = icon => html.indexOf(">" + icon + "<") !== -1;
  // ✅ and ❌ explain themselves. The line is only worth its space when one of
  // the other two is up there, and then it explains all four at once.
  if (!has("📖") && !has("⏭")) return "";
  const says = [["✅", "mark_ok"], ["❌", "mark_no"],
                ["📖", "mark_exp"], ["⏭", "mark_todo"]]
    .filter(([icon]) => has(icon))
    .map(([icon, key]) => `<i aria-hidden="true">${icon}</i>${esc(t(key))}`);
  return `<p class="mark-legend">${says.join(" · ")}</p>`;
}

/* ---------- login ---------- */
function resetDoor() {
  $("login-pass").value = "";
  $("login-error").classList.add("hidden");
  renderLoginFields();
}

/* A device remembers its account: the name is only asked the first time
   (or after a real logout). Every following day just needs the password. */
function renderLoginFields() {
  const known = Store.deviceUser();
  $("welkom-name").textContent = known ? ", " + known : "";
  $("login-user").classList.toggle("hidden", !!known);
  $("login-sub").textContent = known ? t("login_hint") : t("login_hint_new");
  if (!known) $("login-user").value = "";
}

/* The password was right: say so for a beat, then go. The 1.75 seconds of
   door animation that used to sit here bought nothing — the child has already
   told us they know the password. */
function openDoor(done) {
  $("btn-login").disabled = true;
  setTimeout(() => { $("btn-login").disabled = false; done(); }, 180);
}

function denyDoor(msgKey) {
  const err = $("login-error");
  err.textContent = t(msgKey || "login_err");
  err.classList.remove("hidden");
  const wrap = document.querySelector(".login-wrap");
  wrap.classList.add("denied");
  setTimeout(() => wrap.classList.remove("denied"), 420);
}

async function tryLogin() {
  const btn = $("btn-login");
  if (btn.disabled) return;
  const user = Store.deviceUser() || $("login-user").value;
  const pass = $("login-pass").value;
  btn.disabled = true;
  const result = await Store.login(user, pass);
  btn.disabled = false;

  if (result === "ok") {
    $("login-error").classList.add("hidden");
    data = Store.load();                    // may have just been merged with the cloud
    openDoor(() => {
      applyRoleLang();               // the parent lands in their own language
      goHome();
      if (Store.isParent()) startParentWatch();
    });
  } else {
    denyDoor(result === "offline" ? "login_offline" : "login_err");
    $("login-pass").select();
  }
}

/* ---------- parent watching ---------- */
let liveBusy = false;
let leftMirror = false;      // parent walked away from the mirror on purpose

/* The parent keeps a quiet eye on the child from the home screen, and the
   mirror opens by itself the moment the child starts. */
function startParentWatch() {
  Live.startWatching((state, age) => {
    liveBusy = Live.isBusy(state, age);
    if (!liveBusy) leftMirror = false;                 // a new session may open it again
    if (isOn("screen-mirror")) Live.render(state, age);
    else if (isOn("screen-home")) {
      renderHome();
      // follow the child automatically, unless the parent chose to step away
      if (liveBusy && !leftMirror) openMirror(state, age);
    }
  }, 2500);
}

function openMirror(state, age) {
  if (state) Live.render(state, age);
  show("screen-mirror");
}

/* ---------- wiring ---------- */
function goHome() {
  opening = false;                 // back and in again is not a double tap
  stopTimer();
  stopSprint();
  Live.stopHeartbeat();
  if (Store.isParent() && isOn("screen-mirror")) leftMirror = true;
  // the child always works in Dutch, whatever the parent last picked here
  if (!Store.isParent() && LANG !== "nl") setLang("nl");
  session = null;
  if (!Store.isParent()) Live.push("home");
  renderHome();
  show("screen-home");
  SelfUpdate.applyIfPending();   // an update that waited for the opdracht to end
}

function goLogin() {
  stopTimer();
  stopSprint();
  Live.stopHeartbeat();
  Live.stopWatching();
  liveBusy = false;
  session = null;
  resetDoor();
  show("screen-login");
}

document.addEventListener("DOMContentLoaded", () => {
  applyI18n();

  // language: one flag, with a menu behind it for the parent
  renderLangPicker();
  $("lang-current").addEventListener("click", e => { e.stopPropagation(); toggleLangMenu(); });
  document.querySelectorAll(".lang-opt").forEach(o =>
    o.addEventListener("click", () => setLang(o.dataset.lang)));
  document.addEventListener("click", closeLangMenu);
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeLangMenu(); });

  // login (magic door)
  $("btn-login").addEventListener("click", tryLogin);
  ["login-pass", "login-user"].forEach(id =>
    $(id).addEventListener("keydown", e => { if (e.key === "Enter") tryLogin(); }));

  // the logo is the way back everywhere
  $("btn-brand").addEventListener("click", () => {
    if (!Store.isLoggedIn()) return goLogin();
    // the same road out as the ‹ on the card, so the two exits from one
    // screen cannot leave the opdracht in two different states
    if (session && (isOn("screen-task") || isOn("screen-pause"))) return leaveTask();
    goHome();
  });

  // home
  $("btn-start").addEventListener("click", () => startTask("sommen"));
  $("btn-klok").addEventListener("click", () => startTask("klok"));
  $("btn-sprint").addEventListener("click", () => startSprint(goHome));
  $("sprint-pause").addEventListener("click", pauseSprint);
  $("sprint-resume").addEventListener("click", resumeSprint);
  $("btn-watch").addEventListener("click", () => openMirror());
  $("btn-logout-top").addEventListener("click", () => {
    // walking out mid-task throws the answers away, so ask first
    if (session && (isOn("screen-task") || isOn("screen-pause")) && !confirm(t("quit_confirm"))) return;
    Store.logout();
    goLogin();
  });

  // task
  // Stopping puts the opdracht down; it does not throw it away. It used to
  // delete it outright, which left the child with sommen half made, no way
  // back to them and no "Verder gaan" — the opdracht had simply vanished.
  // That is also why there is no longer anything to ask about: the dialog
  // guarded a loss that cannot happen any more, in a system alert whose two
  // buttons name neither outcome.
  const leaveTask = () => {
    if (session && session.fromResult) return backToResult();   // came from the report
    saveActive(true);
    goHome();
  };
  $("btn-quit").addEventListener("click", leaveTask);
  $("sprint-quit").addEventListener("click", goHome);   // goHome stops the clock
  $("mirror-back").addEventListener("click", goHome);
  $("btn-skip").addEventListener("click", skip);
  $("btn-pause").addEventListener("click", pauseTask);
  $("btn-resume").addEventListener("click", resumeTask);
  // the cursor has to move before hovering means anything again
  $("answers").addEventListener("pointermove", () => $("answers").classList.remove("fresh"));

  // result
  $("btn-report").addEventListener("click", openReport);
  $("report-back").addEventListener("click", goHome);
  $("btn-gotit").addEventListener("click", backToResult);
  $("btn-hint").addEventListener("click", toggleHint);


  // Safari on iOS is not reliable about visibilitychange when the tab is
  // being torn down; pagehide is the one it always sends.
  window.addEventListener("pagehide", () => {
    if (session) saveActive();
    if (sprint) saveSprint();
    Store.pushNow(data);
  });

  document.addEventListener("visibilitychange", () => {
    // leaving the screen mid-task: bank it so the next device gets the same som
    if (document.hidden) {
      if (session) saveActive();
      if (sprint) saveSprint();
      Store.pushNow(data);
      return;
    }
    // signed out from another tab on this device
    if (!Store.isLoggedIn()) { if (!isOn("screen-login")) goLogin(); return; }
    refreshFromCloud();
  });
  window.addEventListener("pagehide", () => {
    if (session) saveActive();
    Store.pushNow(data);
  });

  // entry
  if (Store.isLoggedIn()) {
    applyRoleLang();
    goHome();
    refreshFromCloud();
    if (Store.isParent()) startParentWatch();
  } else goLogin();
});

function isOn(id) { return !$(id).classList.contains("hidden"); }

/* Pick up work done on another device. Only refreshes idle screens, so it can
   never yank the ground out from under a task in progress. */
async function refreshFromCloud() {
  const merged = await Store.pull();
  if (!merged) return;
  data = Store.dress(merged);
  if (isOn("screen-home")) renderHome();
  else if (isOn("screen-result")) openReportAt(reportDay);
}
