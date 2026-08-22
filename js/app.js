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
      if (session) { this.pending = live; return; }   // never yank a som off the screen
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
let calMonth = null;          // Date of shown calendar month
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
  $("timer").textContent = fmtTime(elapsedSec());
}
function startTimer() {
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
  if (!$("screen-result").classList.contains("hidden") && session) renderResult();
  if (!$("screen-games").classList.contains("hidden")) renderGames();
  if (!$("screen-calendar").classList.contains("hidden")) renderCalendar();
  if (!$("screen-stats").classList.contains("hidden")) renderStats();
  if (!$("screen-sommen").classList.contains("hidden")) renderSommen();
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
function sprintsOf(ds)  { return sprintRounds(ds).length; }
function pakketsOf(ds)  { return Math.min(tasksOf(data.days[ds]), sprintsOf(ds)); }

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

function currentStreak() {
  const plan = dayPlan();
  let streak = 0;
  let ds = todayStr();
  if (!dayDone(plan, ds)) ds = shiftDay(ds, -1);     // today counts once it is done
  while (dayDone(plan, ds)) { streak++; ds = shiftDay(ds, -1); }
  return streak;
}

function bestStreak() {
  const plan = dayPlan();
  const dates = Object.keys(plan).filter(k => dayDone(plan, k)).sort();
  let best = 0, run = 0, prev = null;
  for (const ds of dates) {
    if (prev) {
      const diff = (new Date(ds) - new Date(prev)) / 86400000;
      run = diff === 1 ? run + 1 : 1;
    } else run = 1;
    best = Math.max(best, run);
    prev = ds;
  }
  return best;
}

/* ---------- home ----------
   Two different homes from the same markup: the child only ever sees the one
   button that matters, the parent gets the watching tools instead. */
function renderHome() {
  const parent = Store.isParent();
  const day = data.days[todayStr()];

  $("home-greeting").textContent = parent
    ? t("parent_hello").replace("{name}", Store.watches().toUpperCase())
    : t("hello").replace("{name}", Store.deviceUser().toUpperCase());

  // an unfinished task takes over the button, so it cannot be thrown away by
  // accidentally starting a second one
  const open = parent ? null : activeTask();
  $("btn-continue").classList.toggle("hidden", !open);
  // an opdracht that was worked through but still has soms put aside is not at
  // "som 21 of 20" — it is back at the report card with a few left to do
  const left = open ? open.questions.filter(q => !q.solved && !q.failed).length : 0;
  const pastEnd = open && open.idx >= open.queue.length;
  if (open) {
    $("continue-at").textContent = pastEnd ? "" : (open.idx + 1) + "/" + open.queue.length;
  }

  // the two halves of the day, and how many times each has been done
  const nTasks = tasksOf(day), nSprints = sprintsOf(todayStr());
  const pakkets = Math.min(nTasks, nSprints);
  const badge = n => n === 0 ? "" : (n === 1 ? "✓" : `✓ ×${n}`);
  $("start-done").textContent = badge(nTasks);
  $("sprint-done").textContent = badge(nSprints);
  $("btn-start").classList.toggle("done", nTasks > 0);
  $("btn-sprint").classList.toggle("done", nSprints > 0);

  let status = t("today_todo");
  if (open) status = pastEnd
    ? t("finish_rest").replace("{n}", left)
    : t("today_resume").replace("{n}", open.idx + 1).replace("{t}", open.queue.length);
  else if (pakkets >= 2) status = t("today_extra").replace("{n}", pakkets - 1);
  else if (pakkets === 1) status = t("today_done");
  else if (nTasks || nSprints) status = t(nTasks ? "today_half_sommen" : "today_half_tafels");
  if (parent) {
    status = liveBusy ? Store.watches().toUpperCase() + " " + t("live_busy")
                      : Store.watches().toUpperCase() + " " + t("live_idle");
  }
  $("home-status").textContent = status;

  // the child practises; the parent watches and reviews
  $("btn-start").classList.toggle("hidden", parent || !!open);
  $("btn-sprint").classList.toggle("hidden", parent || sprintOff);
  $("btn-watch").classList.toggle("hidden", !parent);
  $("nav-row").classList.toggle("hidden", !parent);
  // the day's report card stays reachable — the fouten to verbeter and the
  // door to the spelletjes live there
  $("btn-report").classList.toggle("hidden",
    parent || !!open || !(data.report && data.report.date === todayStr()));

  renderLadder(parent);
  // spelen hoort bij het rapport van een afgeronde opdracht, niet hier
}

/* Where the child stands, all of it in one block under the start button:
   five vakjes for the five foutloze dagen a niveau costs, then the niveau
   itself and the reeks, then in words what the vakjes are for.

   It used to be scattered — the reeks on its own line at the top, the niveau
   as a badge in the bar that could only be read by hovering, which on a
   tablet means never. One place, three lines, nothing to hunt for. */
function renderLadder(parent) {
  const box = $("streak-ticks");
  if (parent) { box.classList.add("hidden"); return; }
  const st = Levels.overall(data);
  const maxed = st.level >= Levels.MAX;
  const done = Math.min(st.streak, Levels.DAYS_NEEDED);
  const ticks = Array.from({ length: Levels.DAYS_NEEDED }, (_, i) =>
    `<span class="tick${i < done ? " on" : ""}${i === done - 1 ? " fresh" : ""}">✓</span>`).join("");
  const goal = maxed
    ? t("level_max")
    : (st.toGo === 1 ? t("level_togo_one") : t("level_togo").replace("{n}", st.toGo)) +
      ` → ${t("level")} ${st.level + 1}`;
  const days = currentStreak();

  box.innerHTML =
    `${maxed ? "" : `<div class="ticks">${ticks}</div>`}
     <div class="standing">
       <span class="chip lv${maxed ? " maxed" : ""}"><i>⭐</i><b>${t("level")} ${st.level}</b></span>
       <span class="chip reeks"><i>🔥</i><b>${days}</b><em>${t("streak_days")}</em></span>
     </div>
     <p class="ladder-goal">${goal}</p>`;
  box.classList.remove("hidden");
}

/* ---------- task flow ---------- */
/* 5… 4… 3… 2… 1… — the ring empties while the number pops, then we're off. */
function runCountdown(then) {
  const CIRC = 327;
  const numEl = $("count-number"), arc = $("count-progress");
  let n = 5;

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
      arc.style.strokeDashoffset = String(CIRC * (1 - (n - 1) / 5));
      if (n <= 2) arc.style.stroke = "var(--amber)";
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

function startSprint(then) {
  // a round never repeats a tafel already asked today, as long as there are
  // enough left — after that the table simply comes round again
  const today = [].concat(...sprintRounds().map(r => r.facts || []));
  let qs = Sprint.build(data, today);
  if (qs.length < Sprint.N) qs = Sprint.build(data, []);
  if (!qs.length) { sprintOff = true; return then(); }
  sprint = { qs, i: 0, tiles: "", facts: [], then, tick: null, locked: true };
  Live.startHeartbeat();
  // a beat to look up before the first clock starts
  $("sprint-progress").textContent = `1/${qs.length}`;
  $("sprint-question").textContent = "⚡";
  $("sprint-badge-label").textContent = t("sprint_title");
  $("sprint-answers").innerHTML = "";
  $("sprint-count").textContent = Sprint.SECS;
  $("sprint-paused").classList.add("hidden");
  document.querySelector("#screen-sprint .sprint-body").classList.remove("hidden");
  $("sprint-marks").innerHTML = "";
  $("sprint-flash").textContent = t("sprint_ready").replace("{n}", Sprint.N).replace("{s}", Sprint.SECS);
  $("sprint-flash").className = "sprint-flash";
  show("screen-sprint");
  Live.push("sprint");
  setTimeout(() => { if (sprint) renderSprint(); }, 1600);
}

/* The first seconds of a tafel belong to the tafel, not to the buttons. With
   two answers on screen a child can be right half the time by tapping the
   moment the som appears — so the answers stay shut until the som has been
   looked at, and only then open. The clock runs through it: thinking time is
   part of the time. */
const SPRINT_THINK = 5;

function renderSprint() {
  const q = sprint.qs[sprint.i];
  sprint.locked = true;                       // shut until the thinking beat ends
  $("sprint-progress").textContent = `${sprint.i + 1}/${sprint.qs.length}`;
  $("sprint-question").textContent = `${q.a} × ${q.b}`;
  $("sprint-flash").textContent = t("sprint_think");
  $("sprint-flash").className = "sprint-flash think";

  const box = $("sprint-answers");
  box.innerHTML = "";
  box.classList.add("shut");
  q.options.forEach((v, i) => {
    const b = document.createElement("button");
    b.className = "sprint-opt";
    b.textContent = v;
    b.disabled = true;
    b.addEventListener("click", () => answerSprint(i, b));
    box.appendChild(b);
  });

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
  sprint.locked = false;
  sprint.opened = true;
  $("sprint-answers").classList.remove("shut");
  $("sprint-answers").querySelectorAll(".sprint-opt").forEach(b => b.disabled = false);
  $("sprint-flash").textContent = "";
  $("sprint-flash").className = "sprint-flash";
}

/* The ring sits next to the badge and empties while the tafel is on screen.
   Kept as one deadline in wall-clock time, so a pause is simply a deadline
   pushed forward by however long the break lasted. */
const SPRINT_CIRC = 107;                       // 2πr, r = 17

function startSprintClock(msLeft) {
  const arc = $("sprint-arc"), num = $("sprint-count");
  const total = Sprint.SECS * 1000;
  const left0 = msLeft == null ? total : msLeft;
  sprint.endAt = Date.now() + left0;
  sprint.opened = sprint.opened && msLeft != null;      // a fresh som shuts again
  arc.style.transition = "none";
  arc.style.strokeDashoffset = String(SPRINT_CIRC * (1 - left0 / total));
  arc.classList.remove("low");
  void arc.offsetWidth;
  arc.style.transition = `stroke-dashoffset ${left0}ms linear`;
  arc.style.strokeDashoffset = String(SPRINT_CIRC);

  clearInterval(sprint.tick);
  const paint = () => {
    const left = Math.max(0, sprint.endAt - Date.now());
    num.textContent = Math.ceil(left / 1000);
    const low = left <= total / 3;
    num.classList.toggle("low", low);
    arc.classList.toggle("low", low);
    if (!sprint.opened && left <= total - SPRINT_THINK * 1000) openSprintAnswers();
    if (left <= 0) { clearInterval(sprint.tick); timeoutSprint(); }
  };
  paint();
  sprint.tick = setInterval(paint, 100);
}

/* Freeze the ring where the CLOCK says it is, not where the browser happens
   to have drawn it — a tab in the background never runs the animation, and
   reading the computed style there gives the end of it. */
function stopSprintClock() {
  clearInterval(sprint.tick);
  const arc = $("sprint-arc");
  const left = Math.max(0, sprint.endAt - Date.now());
  arc.style.transition = "none";
  arc.style.strokeDashoffset = String(SPRINT_CIRC * (1 - left / (Sprint.SECS * 1000)));
}

/* A break in the middle of a round. The clock stops and the tafel goes off
   screen — a break is a break, not a chance to keep working the som out. */
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
  if (sprint.locked || sprint.paused != null) return;
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
  const q = sprint.qs[sprint.i];
  sprint.tiles += tile;
  renderSprintMarks();
  sprint.facts.push(`${q.a}x${q.b}`);
  Sprint.remember(data, q, ok);
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

function finishSprint() {
  if (sprint.finished) return;                   // written down exactly once
  sprint.finished = true;
  const ds = todayStr();
  const right = sprint.tiles.split("").filter(c => c === "o").length;
  const day = data.days[ds] || { solved: 0, firstCorrect: 0, done100: false, cats: {} };
  day.sprints = sprintRounds(ds).slice();
  day.sprints.push({ n: sprint.qs.length, right, tiles: sprint.tiles, facts: sprint.facts });
  delete day.sprint; delete day.sprintEnd;        // the two old slots, folded in
  data.days[ds] = day;
  Store.save(data);

  const all = right === sprint.qs.length;
  $("sprint-question").textContent = `${right}/${sprint.qs.length}`;
  $("sprint-answers").innerHTML = "";
  renderSprintMarks();
  const flash = $("sprint-flash");
  flash.textContent = all ? t("sprint_all") : t("sprint_done");
  flash.className = "sprint-flash " + (all ? "good" : "");
  clearInterval(sprint.tick);
  const then = sprint.then;
  setTimeout(() => { sprint = null; then(); }, 1400);
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

function startTask() {
  const built = Engine.buildTask(TASK_N, data);
  session = {
    questions: built,
    pool: [],
    idx: 0,
    firstPass: true,
    round: 1,                   // 1 = eerste poging, 2+ = verbeterrondes
    queue: null,
    lastSec: null
  };
  session.queue = session.questions.map((_, i) => i);
  saveActive();                   // resumable from the very first som
  Live.startHeartbeat();          // keep the parent's mirror alive while thinking
  runCountdown(() => {
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
    idx: session.idx,
    queue: session.queue,
    firstPass: session.firstPass,
    round: session.round || 1,
    elapsed: session.pausedSec != null ? session.pausedSec : elapsedSec(),
    paused: session.pausedSec != null,
    lastSec: session.lastSec || null,
    banked: !!session.banked,          // whether the score has already been booked
    hintsUsed: session.hintsUsed || 0,
    score: session.score || null,
    levelUp: session.levelUp || null,
    rewardMin: session.rewardMin || 0,
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
  const snap = snapshotActive();         // so the snapshot carries the flags
  if (!snap) return;
  // an opdracht with nothing left to answer is not something to carry on with —
  // unless the mistakes just earned it extra sommen that have not appeared yet
  if (session.questions.every(finished) && !storedExtension(session)) delete data.active;
  else data.active = snap;
  Store.save(data);
  if (pushNow) Store.pushNow(data);      // a pause should reach the other device at once
}

/* An opdracht no longer grows. Kept so an opdracht saved by an older build,
   reserve sommen and all, still ends cleanly where it stands. */
function storedExtension(a) { return 0; }

/* The task to carry on with, or nothing */
function activeTask() {
  const a = data.active;
  if (!a || !a.questions || !a.questions.length) return null;
  if (a.date !== todayStr()) {
    // yesterday's leftovers. The sommen the child actually made were counted
    // on the day itself, so nothing is lost by letting the rest go.
    delete data.active;
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

function resumeActive() {
  const a = activeTask();
  if (!a) return goHome();
  // the opdracht had already been worked all the way through — what was left
  // open is on the report card, which is where it should come back
  const pastEnd = a.idx >= a.queue.length;
  session = {
    questions: a.questions,
    pool: a.pool || [],
    queue: a.queue,
    idx: pastEnd ? a.queue.length : Math.min(a.idx, a.queue.length - 1),
    firstPass: a.firstPass,
    round: a.round || 1,
    lastSec: a.lastSec,
    banked: !!a.banked,
    hintsUsed: a.hintsUsed || 0,
    score: a.score,
    levelUp: a.levelUp || null,
    rewardMin: a.rewardMin || 0,
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
  clearInterval(timerInt);
  timerInt = setInterval(tickTimer, 1000);
  tickTimer();
  renderQuestion();
  show("screen-task");
}

function renderQuestion() {
  const q = currentQ();
  // it has been seen now, so it is asked and will never come round again — and
  // the sommen of an opdracht that is broken off before reaching them stay
  // unasked, waiting, instead of being spent
  if (Engine.remember(data, q)) Store.save(data);
  $("btn-skip").disabled = false;
  $("btn-skip").classList.toggle("hidden", !!session.review || !!session.midRetry);   // nothing to skip when looking back
  // one som opened from the report card is "som 5 of 20", not "1 of 1"
  const at = session.viewOne != null ? session.viewOne : session.idx;
  const of = session.viewOne != null ? session.questions.length : session.queue.length;
  $("progress-text").textContent = `${at + 1}/${of}`;
  $("progress-bar").style.width = `${(at / of) * 100}%`;
  $("question-text").textContent = Engine.text(q, LANG);
  // a som shaped like the ones on the school's werkblad wears the school's
  // little logo, so the child knows: this one you will meet in class too
  const tplNow = TEMPLATES.find(tp => tp.id === q.tplId);
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
  q.options.forEach((opt, i) => {
    const b = document.createElement("button");
    b.className = "answer";
    b.textContent = opt;
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

  q.tries = 1;
  q.correctFirst = correct;
  q.chosen = i;
  btn.classList.add(correct ? "correct" : "wrong");
  if (!correct) {
    q.failed = true;
    // the day's shock absorber: this soort gets a notch easier, and the next
    // sommen come from the same soort so the footing comes back right away
    Dial.wrong(data, q.cat);
    comfortSwap(q.cat);
  } else {
    q.solved = true;
    Dial.right(data, q.cat);   // two right in a row wind the notch back up
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
    writeTiles();                  // the day's report card follows the correction
    settleTask();                  // a fout put right can raise both niveau and time
    maybeGrantFloor();
    writeReport();
  } else saveActive();
}

/* The floor under a hard day. Four or more fout earns no speeltijd from the
   tiers — but a child who finished the whole opdracht AND went over every
   fout on the report card has done the real work, and gets three minutes for
   it. Once per opdracht, remembered in the report so it survives a reload. */
function maybeGrantFloor() {
  if (session.floorGiven) return;
  const qs = session.questions;
  if (!qs.every(finished)) return;
  if (qs.filter(q => q.failed).length < 4) return;         // the tiers paid already
  if (qs.some(q => q.failed && !q.fixed && !q.explained)) return;
  if ((session.rewardMin || 0) > 0) return;    // the tiers already paid
  session.floorGiven = true;
  session.rewardMin = 3;
  Reward.grantFloor(data);
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
  if (!q.hinted && hintsLeft() <= 0) return;

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
  btn.disabled = !usable;
  $("hint-count").textContent = q.hinted ? "" : String(left);
  btn.title = usable ? "" : t("hint_none").replace("{n}", HINTS_PER);
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
    saveActive();           // still soms to do, so it stays resumable
  }

  stopTimer();
  renderResult();
  show("screen-result");
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
  const secs = session.lastSec != null ? session.lastSec : elapsedSec();
  session.lastSec = secs;              // the moment the opdracht was completed
  const ds = todayStr();
  const day = data.days[ds] || { solved: 0, firstCorrect: 0, done100: false, cats: {} };
  const nCorrect = session.questions.filter(q => q.correctFirst).length;

  // time log: how long the whole opdracht took
  day.timeSec = secs;
  day.times = (day.times || []).concat(secs);
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

function writeTiles() {
  const day = data.days[todayStr()];
  if (!day) return;
  day.tiles = day.tiles || [];
  day.tpls = day.tpls || [];
  if (session.tileSlot == null) { day.tiles.push(""); session.tileSlot = day.tiles.length - 1; }
  day.tiles[session.tileSlot] = tilesOf(session.questions);
  day.tpls[session.tileSlot] = session.questions.map(q => q.tplId);
  day.fixed = day.tiles.join("").toLowerCase().split("").filter(c => c === "f").length;

  // let the older question lists go; the tiles themselves stay forever
  const cut = new Date(); cut.setDate(cut.getDate() - TPLS_KEEP_DAYS);
  const cutStr = todayStr(cut);
  for (const ds in data.days) if (ds < cutStr && data.days[ds].tpls) delete data.days[ds].tpls;
  return scoreNow(session.questions);
}

/* Everything that can only be judged once the opdracht is really done with:
   the niveau and the speeltijd. Held back until every fout has been gone over,
   because a fout put right counts as good — and that verdict is not in until
   the child has had their second look. Idempotent: it only ever tops up. */
function settleTask() {
  const qs = session.questions;
  if (!qs.every(finished)) return;
  if (qs.some(q => q.failed && !q.fixed && !q.explained)) return;   // still to review

  const sc = scoreNow(qs);
  session.score = { correct: sc.correct, total: sc.total, first: sc.first, fixed: sc.fixed };

  if (!session.levelJudged) {
    session.levelJudged = true;
    session.levelUp = Levels.record(data, sc);
  }
  const deserved = Reward.deserved(sc.correct, sc.total);
  const given = session.rewardMin || 0;
  if (deserved > given) {
    session.rewardMin = deserved;
    Reward.top(data, deserved - given);
  }
}

function markDone100() {
  if (session.rewarded) return;      // one opdracht earns its speeltijd once
  session.rewarded = true;
  const ds = todayStr();
  const day = data.days[ds] || { solved: 0, firstCorrect: 0, done100: false, cats: {} };
  day.done100 = true;
  data.days[ds] = day;
  session.nextQueue = null;
  session.celebrate = true;
  delete data.active;              // the day is done; nothing left to carry on with
  writeTiles();                    // a report card that outlives the opdracht
  settleTask();                    // niveau and speeltijd, if nothing is left to review
  writeReport();                   // saves; the report card outlives the session
}

/* The report card is kept for the rest of the day. Without this, closing the
   app after the last som lost the way back to it — and with it the fouten
   still to be verbeterd and the door to the spelletjes. It rides the normal
   sync, so a correction made on the phone shows on the tablet. */
function writeReport() {
  data.report = {
    date: todayStr(),
    score: session.score || null,
    lastSec: session.lastSec != null ? session.lastSec : null,
    floor: !!session.floorGiven,
    tileSlot: session.tileSlot == null ? null : session.tileSlot,
    levelJudged: !!session.levelJudged,
    rewardMin: session.rewardMin || 0,
    questions: session.questions.map(snapQ)
  };
  Store.save(data);
}

function openReport() {
  const r = data.report;
  if (!r || r.date !== todayStr() || !r.questions || !r.questions.length) return;
  session = {
    questions: r.questions.map(q => Object.assign({}, q)),
    pool: [],
    queue: r.questions.map((_, i) => i),
    idx: r.questions.length,
    firstPass: false,
    banked: true, rewarded: true,          // the day is already booked and paid
    floorGiven: !!r.floor,
    tileSlot: r.tileSlot == null ? null : r.tileSlot,
    levelJudged: !!r.levelJudged,
    rewardMin: r.rewardMin || 0,
    score: r.score, lastSec: r.lastSec,
    levelUp: null, rewardMin: 0
  };
  Live.startHeartbeat();
  renderResult();
  show("screen-result");
}

/* ---------- result ---------- */
function renderResult() {
  const qs = session.questions;
  const allDone = qs.every(finished);                       // nothing left to answer
  const sc = scoreNow(qs);                 // a fout put right counts as good
  const perfect = allDone && sc.correct === sc.total;
  const nRight = sc.correct;

  $("result-title").textContent =
    perfect ? t("result_perfect") : (allDone ? t("result_done") : t("result_almost"));
  $("result-emoji").textContent = perfect ? partyEmoji() : "💪";
  $("result-emoji").classList.toggle("party", perfect);
  $("result-score").textContent = perfect
    ? partyMessage(LANG)
    : t("result_score").replace("{c}", nRight).replace("{t}", qs.length);

  // numbered grid: right, wrong, corrected, explained, or still to be done.
  // No answers are given away here — a wrong som has to be opened, and there
  // the child gets a second go at it before the answer is shown.
  const strip = $("result-sprint");
  strip.innerHTML = sprintStripsHTML(todayStr());
  strip.classList.toggle("hidden", !strip.innerHTML);

  // the tafels as they stand today: the two sprints above are what happened,
  // this is what they add up to
  const tbox = $("result-tafels");
  const tsc = tafelScore();
  if (tsc.asked) {
    const weak = tafelWeakHTML();
    tbox.innerHTML =
      `<div class="sprint-line"><b>✖️ ${esc(t("tafel_title"))}</b>
         <span>${tsc.known}/${tsc.total}</span></div>
       <div class="tafel-grid small">${tafelGridHTML()}</div>
       <p class="tafel-weak${weak.good ? " good" : ""}">${esc(weak.text)}</p>`;
  } else {
    tbox.innerHTML = "";
  }
  tbox.classList.toggle("hidden", !tsc.asked);

  const grid = $("result-grid");
  grid.innerHTML = "";
  qs.forEach((q, i) => {
    // to the child a som is good or it is not — a som put right is good, and
    // it looks it. The parent sees the difference on their own screens.
    const state = (q.correctFirst || q.fixed) ? "ok"
      : q.solved ? "ok2"
      : q.failed ? (q.explained ? "exp" : "no")
      : "todo";
    const icon  = { ok: "✅", ok2: "✅", exp: "❌", no: "❌", todo: "⏭" }[state];
    const cell = document.createElement("button");
    cell.className = "result-tile " + state;
    cell.title = t({ ok: q.fixed ? "tile_fixed" : "tile_done", ok2: "tile_second",
                     exp: "tile_explained", no: "tile_wrong", todo: "tile_todo" }[state]) +
                 (q.hinted ? " · 💡" : "");
    cell.innerHTML = `<span class="num">${i + 1}</span><span class="mark">${icon}</span>` +
                     (q.hinted ? `<span class="tile-hint">💡</span>` : "");
    cell.addEventListener("click", () => openQuestion(i));
    grid.appendChild(cell);
  });

  // show how long the 20 questions took (first pass)
  const timeEl = $("result-time");
  if (session.lastSec != null) {
    timeEl.textContent = `⏱ ${t("done_in")} ${fmtTime(session.lastSec)}`;
    timeEl.classList.remove("hidden");
  } else {
    timeEl.classList.add("hidden");
  }

  // a wrong som is worth going back to: this is the only place the good answer
  // can be seen, and it changes nothing about the score

  // only the soms that were put aside can still be done
  const left = qs.filter(q => !finished(q)).length;
  $("btn-retry").textContent = left ? t("finish_rest").replace("{n}", left) : "";
  $("btn-retry").classList.toggle("hidden", !left);

  // de beloning: de melding alleen de ronde waarin hij verdiend is, de knop
  // zolang er vandaag nog speeltijd over is
  const earned = session.rewardMin || 0;
  // a level gained is worth saying out loud
  const ups = $("result-levelups");
  ups.innerHTML = "";
  if (session.levelUp) {
    const p = document.createElement("p");
    p.className = "levelup-line";
    p.textContent = "⭐ " + t("level_up").replace("{n}", session.levelUp);
    ups.appendChild(p);
  }

  const rewardEl = $("result-reward");
  rewardEl.textContent = earned > 0 ? t("reward_earned").replace("{m}", earned) : "";
  rewardEl.classList.toggle("hidden", earned <= 0);

  // The game waits for two things: the opdracht finished, and every fout gone
  // over — a second try, or the uitleg read. Mistakes are not a wall, they are
  // the doorstep: look at them properly and the spelletjes open.
  const unreviewed = qs.filter(q => q.failed && !q.fixed && !q.explained).length;
  const playLeftSec = Reward.remaining(data);
  $("btn-play-result").classList.toggle("hidden", !(allDone && !unreviewed && playLeftSec > 0));
  $("result-play-left").textContent = playLeftSec > 0 ? fmtTime(playLeftSec) : "";

  const hint = $("result-hint");
  if (allDone && unreviewed > 0) {
    hint.textContent = playLeftSec > 0 ? t("fix_first") : t("fix_first_noplay");
    hint.classList.remove("hidden");
  } else {
    hint.classList.add("hidden");
  }

  Live.push("result");

  // confetti belongs to a faultless run, not merely a finished one
  if (perfect && session.celebrate) {
    session.celebrate = false;
    fireConfetti();
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
  renderResult();
  show("screen-result");
}

function startRetry() {
  session.queue = session.nextQueue;
  session.nextQueue = null;
  session.idx = 0;
  session.firstPass = false;
  session.review = false;
  session.fromResult = false;
  session.round = (session.round || 1) + 1;
  saveActive();                    // the correction round is resumable too
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
function todaysQuestions() {
  const r = data.report;
  if (r && r.date === todayStr() && r.questions && r.questions.length) return r.questions;
  const a = data.active;
  if (a && a.date === todayStr() && a.questions) return a.questions.filter(q => q.chosen != null || finished(q));
  return [];
}

/* One som as the parent sees it: how it went, what it was, and the two words
   that tune it. `q` may be a whole question (today, with its real numbers) or
   just a template id with a tile letter (an earlier day, where only the soort
   was kept). */
function somRowHTML(i, opts) {
  const { state, hinted, cat, text, tplId, key, qIdx } = opts;
  const icon = { o: "✅", f: "✅", e: "❌", n: "❌", t: "⏭" }[state] || "❌";
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
function dayRowsSource(ds, rec) {
  const runs = (rec && rec.tiles) ? rec.tiles.length : 0;
  if (ds === todayStr() && runs <= 1 && todaysQuestions().length) return "today";
  if (rec && rec.tpls && rec.tpls.length) return "tpls";
  return null;                       // a day from before the sommen were kept
}

/* Which row on this day's list belongs to tile number i of run ri — so that
   tapping a vakje on the report card lands on the som it stands for. */
function somKeyFor(ds, rec, ri, i) {
  return dayRowsSource(ds, rec) === "today" ? `${ds}|${i}` : `${ds}|${ri}|${i}`;
}

function dayQuestionsHTML(ds, rec) {
  if (dayRowsSource(ds, rec) === "today") {
    const qs = todaysQuestions();
    if (qs.length) {
      return qs.map((q, i) => somRowHTML(i, {
        state: q.correctFirst ? "o" : q.fixed ? "f" : q.explained ? "e" : q.failed ? "n" : "t",
        hinted: !!q.hinted, cat: t("cats")[q.cat] || q.cat,
        text: Engine.text(q, LANG), tplId: q.tplId,
        key: ds + "|" + i, qIdx: i
      })).join("");
    }
  }
  if (!rec || !rec.tpls || !rec.tpls.length) return "";
  return rec.tpls.map((run, ri) => {
    const head = rec.tpls.length > 1
      ? `<p class="day-run">${t("day_run").replace("{n}", ri + 1)}</p>` : "";
    return head + run.map((id, i) => {
      const tpl = TEMPLATES.find(x => x.id === id);
      const { key, hinted } = tileState(((rec.tiles || [])[ri] || "")[i] || "n");
      return somRowHTML(i, {
        state: key, hinted,
        cat: tpl ? (t("cats")[tpl.cat] || tpl.cat) : id,
        text: tpl ? sampleText(tpl) : id, tplId: id,
        key: ds + "|" + ri + "|" + i
      });
    }).join("");
  }).join("");
}

function renderSommen() {
  const qs = todaysQuestions();
  const list = $("sommen-list");
  $("sommen-sub").textContent = qs.length
    ? t("sommen_sub").replace("{n}", qs.length)
    : t("sommen_none");
  list.innerHTML = "";

  list.innerHTML = dayQuestionsHTML(todayStr(), data.days[todayStr()]);
  wireRateButtons(list);

  renderLessons();
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
  const q = row.dataset.q != null ? todaysQuestions()[+row.dataset.q] : null;
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
  if (isOn("screen-calendar")) renderCalendar();       // keeps the open day open
  else if (isOn("screen-sommen")) renderSommen();
}

async function rateSom(tplId, verdict) {
  const { u, p } = Store.creds();
  if (!u || !p || !Store.isParent()) return;
  try {
    const fresh = await Cloud.setTuning(u, p, tplId, verdict);
    if (fresh) { data = fresh; Store.saveLocal(data); }
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
    if (fresh) { data = fresh; Store.saveLocal(data); }
  } catch (e) { /* offline: the switch springs back on the redraw */ }
  redrawSoms();
}

async function saveNote(tplId, text) {
  const { u, p } = Store.creds();
  if (!u || !p || !Store.isParent()) return;
  try {
    const fresh = await Cloud.addNote(u, p, tplId, text);
    if (fresh) { data = fresh; Store.saveLocal(data); }
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

function renderCalendar() {
  if (!calMonth) calMonth = new Date();
  const y = calMonth.getFullYear(), m = calMonth.getMonth();
  $("cal-title").textContent = `${t("months")[m]} ${y}`;
  const grid = $("cal-grid");
  grid.innerHTML = "";
  // The month runs straight through, 1 to the end, with no empty squares in
  // front of the first. The weekday is written on each day itself, so it is
  // still there to be read without pushing the numbers out of line.
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = todayStr();
  const wd = t("weekdays");
  const plan = dayPlan();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(y, m, d);
    const ds = todayStr(date);
    const rec = data.days[ds];
    const c = document.createElement("button");
    c.className = "cal-cell";
    const mark = (data.marks || {})[ds];
    const colour = dayColour(ds, rec, plan);
    if (colour) c.classList.add(colour);
    if (ds === today) c.classList.add("today");
    c.innerHTML = `<span class="wd">${wd[(date.getDay() + 6) % 7]}</span>` +
                  `<span class="dnum">${d}</span>` +
                  (mark ? `<span class="by-hand" aria-hidden="true"></span>` : "");
    c.title = (rec && rec.solved > 0 ? `${d} · ${rec.firstCorrect}/${rec.solved}` : `${d}`) +
              (mark && mark.note ? ` · ${mark.note}` : "");
    c.addEventListener("click", () => showDay(ds));
    grid.appendChild(c);
  }
  // a day that was open stays open when the month is redrawn
  const box = $("cal-detail");
  const open = box.dataset.day;
  delete box.dataset.day;
  if (open && open.slice(0, 7) === `${y}-${String(m + 1).padStart(2, "0")}`) showDay(open);
  else hideDay();
}

function hideDay() {
  const box = $("cal-detail");
  box.classList.add("hidden");
  box.innerHTML = "";
  delete box.dataset.day;
  document.querySelectorAll(".cal-cell.picked").forEach(c => c.classList.remove("picked"));
}

/* One day's report, right under the month: what was made, what went right and
   what went wrong, and per soort som — the same reading the child gets on the
   report card, kept for every day that was practised. */
function showDay(ds) {
  const box = $("cal-detail");
  if (box.dataset.day === ds) return hideDay();      // tapping it again closes it
  const rec = data.days[ds];
  const [y, m, d] = ds.split("-").map(Number);
  const head = `${d} ${t("months")[m - 1]}`;

  document.querySelectorAll(".cal-cell.picked").forEach(c => c.classList.remove("picked"));
  const cells = [...document.querySelectorAll("#cal-grid .cal-cell")];
  if (cells[d - 1]) cells[d - 1].classList.add("picked");

  const mark = (data.marks || {})[ds];
  let body;
  if (rec && rec.tiles && rec.tiles.length) {
    // the same report card the child saw, kept for the parent — and here the
    // ✔️ stays visible, because a parent should be able to tell a som that was
    // right straight away from one that was put right afterwards
    const wrong = rec.solved - rec.firstCorrect;
    const time = rec.timeSec ? `<span class="day-pill">⏱ ${fmtTime(rec.timeSec)}</span>` : "";
    const icon = { o: "✅", f: "✅", e: "❌", n: "❌", t: "⏭" };
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
      const head = rec.tiles.length > 1
        ? `<p class="day-run">${t("day_run").replace("{n}", ri + 1)}</p>` : "";
      return head + `<div class="result-grid">${tiles}</div>`;
    }).join("");
    const fixed = rec.fixed || 0;
    body =
      `<div class="day-head"><b>${head}</b>${time}</div>
       ${grids}
       <div class="day-counts">
         <span class="day-pill ok">✅ ${rec.firstCorrect} ${t("day_first_try")}</span>
         ${fixed ? `<span class="day-pill fix">✔️ ${fixed} ${t("day_fixed")}</span>` : ""}
         <span class="day-pill no">❌ ${wrong - fixed} ${t("day_wrong")}</span>
       </div>
       <p class="day-aschild">${t("day_as_child").replace("{c}", rec.firstCorrect + fixed).replace("{t}", rec.solved)}</p>`;
    const qs = Store.isParent() ? dayQuestionsHTML(ds, rec) : "";
    if (qs) body += `<div class="day-sommen"><h3>${esc(t("sommen"))}</h3>
                     <p class="lessons-sub">${esc(t("rate_sub"))}</p>${qs}</div>`;
    else if (Store.isParent()) body += `<p class="day-nosom">${esc(t("day_no_sommen"))}</p>`;
  } else if (!rec || !rec.solved) {
    const bonus = dayPlan()[ds] === "bonus";
    body = `<div class="day-head"><b>${head}</b></div>
            <p class="day-none">${t(bonus ? "day_bonus" : "day_nothing")}</p>`;
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

  const strips = rec ? sprintStripsHTML(ds) : "";
  if (strips) body += `<div class="sprint-strip">${strips}</div>`;

  // a note the parent left stands above whatever the app worked out — but not
  // twice, so when the editor is open the note is only in the box you type in
  if (mark && mark.note && !Store.isParent()) {
    body += `<p class="day-note">📝 ${esc(mark.note)}</p>`;
  }
  if (Store.isParent()) body += dayEditorHTML(ds, mark);

  box.innerHTML = body;
  box.dataset.day = ds;
  box.classList.remove("hidden");
  if (Store.isParent()) {
    wireDayEditor(ds);
    wireRateButtons(box);
    box.querySelectorAll(".result-tile[data-open]").forEach(tile =>
      tile.addEventListener("click", () => openSomByKey(box, tile.dataset.open)));
  }
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
  const box = $("cal-detail");
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
    data = fresh || data;
    Store.saveLocal(data);
    renderCalendar();                       // the day takes its new colour
    const ok = $("day-saved");
    if (ok) { ok.classList.remove("hidden"); setTimeout(() => ok.classList.add("hidden"), 1600); }
  } catch (e) {
    btn.textContent = t("note_failed");
  } finally {
    btn.disabled = false;
  }
}

/* ---------- stats ---------- */
function renderStats() {
  let total = 0, correct = 0;
  const cats = {};
  let daysPracticed = 0;
  for (const ds in data.days) {
    const day = data.days[ds];
    if (day.solved > 0) daysPracticed++;
    total += day.solved;
    correct += day.firstCorrect;
    for (const c in day.cats) {
      const agg = cats[c] || { n: 0, c: 0 };
      agg.n += day.cats[c].n;
      agg.c += day.cats[c].c;
      cats[c] = agg;
    }
  }
  $("stat-total").textContent = total;
  $("stat-acc").textContent = total ? Math.round((correct / total) * 100) + "%" : "—";
  $("stat-days").textContent = daysPracticed;
  $("stat-best").textContent = bestStreak();
  $("stat-level").textContent = Levels.overall(data).level;

  const box = $("cat-bars");
  box.innerHTML = "";
  const order = [...CATS, "verrassing"];
  order.forEach(cat => {
    const agg = cats[cat];
    if (!agg || !agg.n) return;
    const pct = Math.round((agg.c / agg.n) * 100);
    const cls = pct >= 80 ? "" : (pct >= 60 ? "mid" : "low");
    // the level is one number for all the sommen together; it belongs in the
    // line under this list, not beside every soort
    const row = document.createElement("div");
    row.className = "cat-bar-row";
    row.innerHTML =
      `<div class="cat-bar-label"><span>${t("cats")[cat]}</span><b>${pct}% · ${agg.c}/${agg.n}</b></div>
       <div class="cat-bar-track"><div class="cat-bar-fill ${cls}" style="width:${pct}%"></div></div>`;
    box.appendChild(row);
  });

  renderTafels();
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

function renderTafels() {
  const box = $("tafel-grid");
  if (!box) return;
  box.innerHTML = tafelGridHTML();
  const sc = tafelScore();
  $("tafel-score").textContent = t("tafel_score")
    .replace("{k}", sc.known).replace("{t}", sc.total);
  const weak = tafelWeakHTML();
  const line = $("tafel-weak");
  line.textContent = weak.text;
  line.classList.toggle("good", weak.good);
}

/* ---------- magic door (login) ---------- */
function resetDoor() {
  $("door-scene").classList.remove("open", "denied");
  $("door-lock").classList.remove("unlocking", "deny");
  $("sparkles").innerHTML = "";
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

function spawnSparkles() {
  const box = $("sparkles");
  box.innerHTML = "";
  const colors = ["#fff3b0", "#ffd451", "#ffffff", "#ffe89a", "#ffbf47"];
  for (let i = 0; i < 20; i++) {
    const s = document.createElement("div");
    s.className = "spark";
    const ang = Math.random() * Math.PI * 2;
    const dist = 55 + Math.random() * 80;
    s.style.setProperty("--dx", Math.cos(ang) * dist + "px");
    s.style.setProperty("--dy", Math.sin(ang) * dist + "px");
    s.style.background = colors[i % colors.length];
    s.style.animationDelay = Math.random() * 0.15 + "s";
    box.appendChild(s);
  }
}

function openDoor(done) {
  const scene = $("door-scene"), lock = $("door-lock");
  $("btn-login").disabled = true;
  lock.classList.add("unlocking");
  setTimeout(() => { scene.classList.add("open"); spawnSparkles(); }, 450);
  setTimeout(() => { $("btn-login").disabled = false; done(); }, 1750);
}

function denyDoor(msgKey) {
  const scene = $("door-scene"), lock = $("door-lock");
  const err = $("login-error");
  err.textContent = t(msgKey || "login_err");
  err.classList.remove("hidden");
  scene.classList.add("denied");
  lock.classList.add("deny");
  setTimeout(() => { scene.classList.remove("denied"); lock.classList.remove("deny"); }, 550);
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

/* ---------- speeltijd ----------
   Het spelletje draait in een eigen pagina in de kaart (games/<id>/index.html),
   dus het kan nooit bij de sommen of de voortgang. De klok hoort hier, niet in
   het spel: de tijd loopt door of het nu goed of slecht gaat, en hij wordt elke
   tien seconden weggeschreven — een dichtgeklapte tablet levert geen gratis
   minuten op. */
let playInt = null, playT0 = 0, playLeft = 0, playing = null;

function openGames() {
  renderGames();
  show("screen-games");
  Live.push("games");                 // the parent sees the playing too
  Live.startHeartbeat();
}

function renderGames() {
  const left = Reward.remaining(data);
  $("games-left").textContent = "🎮 " + fmtTime(left);
  $("games-sub").textContent = left > 0 ? t("games_pick") : t("games_none");

  const grid = $("games-grid");
  grid.innerHTML = "";
  GAMES.forEach(g => {
    const tile = document.createElement("button");
    tile.className = "game-tile";
    tile.disabled = left <= 0;
    tile.innerHTML = `<span class="emoji">${g.emoji}</span><span class="name">${t(g.key)}</span>`;
    tile.addEventListener("click", () => startPlay(g));
    grid.appendChild(tile);
  });
}

function startPlay(game) {
  playLeft = Reward.remaining(data);
  if (playLeft <= 0) return;
  playT0 = Date.now();
  $("play-title").textContent = game.emoji + " " + t(game.key);
  $("play-frame").style.aspectRatio = game.frame || "1 / 1.2";
  $("play-frame").src = `games/${game.id}/index.html?lang=${LANG}`;
  $("play-left").textContent = "🎮 " + fmtTime(playLeft);
  clearInterval(playInt);
  playInt = setInterval(tickPlay, 1000);
  show("screen-play");
  playing = game;
  Live.push("play");
}

function tickPlay() {
  const spent = Math.floor((Date.now() - playT0) / 1000);
  const left = Math.max(0, playLeft - spent);
  $("play-left").textContent = "🎮 " + fmtTime(left);
  if (left <= 0) timeIsUp();
  else if (spent >= 10) bookPlayTime();
}

/* The minutes are gone: shut the game and say so, rather than leaving it
   running with a clock on zero. */
function timeIsUp() {
  bookPlayTime();
  leavePlay();
}

/* write the seconds played into the day record (and so into the cloud) */
function bookPlayTime() {
  if (!playInt) return;
  const spent = Math.floor((Date.now() - playT0) / 1000);
  if (spent <= 0) return;
  playT0 += spent * 1000;
  playLeft = Math.max(0, playLeft - spent);
  Reward.spend(data, spent);
  Store.save(data);
}

function stopPlay() {
  bookPlayTime();
  clearInterval(playInt);
  playInt = null;
  $("play-frame").src = "about:blank";
}

function leavePlay() {
  stopPlay();
  renderGames();
  show("screen-games");
}

/* ---------- wiring ---------- */
function goHome() {
  stopTimer();
  stopPlay();
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
  $("login-pass").addEventListener("keydown", e => {
    if (e.key === "Enter") tryLogin();
  });

  // the logo is the way back everywhere
  $("btn-brand").addEventListener("click", () => {
    if (!Store.isLoggedIn()) return goLogin();
    if (session && isOn("screen-task") && !confirm(t("quit_confirm"))) return;
    goHome();
  });

  // home
  $("btn-start").addEventListener("click", startTask);
  $("btn-sprint").addEventListener("click", () => startSprint(goHome));
  $("sprint-pause").addEventListener("click", pauseSprint);
  $("sprint-resume").addEventListener("click", resumeSprint);
  $("btn-continue").addEventListener("click", resumeActive);
  $("btn-watch").addEventListener("click", () => openMirror());
  $("btn-calendar").addEventListener("click", () => { calMonth = new Date(); renderCalendar(); show("screen-calendar"); });
  $("btn-stats").addEventListener("click", () => { renderStats(); show("screen-stats"); });
  $("btn-logout-top").addEventListener("click", () => {
    // walking out mid-task throws the answers away, so ask first
    if (session && (isOn("screen-task") || isOn("screen-pause")) && !confirm(t("quit_confirm"))) return;
    Store.logout();
    goLogin();
  });

  // task
  $("btn-quit").addEventListener("click", () => {
    if (session && session.fromResult) return backToResult();   // came from the report
    // Stopping puts the opdracht down; it does not throw it away. It used to
    // delete it outright, which left the child with sommen half made, no way
    // back to them and no "Verder gaan" — the opdracht had simply vanished.
    if (confirm(t("quit_confirm"))) { saveActive(true); goHome(); }
  });
  $("btn-skip").addEventListener("click", skip);
  $("btn-pause").addEventListener("click", pauseTask);
  $("btn-resume").addEventListener("click", resumeTask);
  // the cursor has to move before hovering means anything again
  $("answers").addEventListener("pointermove", () => $("answers").classList.remove("fresh"));

  // result
  $("btn-retry").addEventListener("click", startRetry);
  $("btn-report").addEventListener("click", openReport);
  $("btn-gotit").addEventListener("click", backToResult);
  $("btn-hint").addEventListener("click", toggleHint);
  $("btn-sommen").addEventListener("click", () => { renderSommen(); show("screen-sommen"); });
  $("sommen-back").addEventListener("click", goHome);

  // speeltijd
  $("btn-play-result").addEventListener("click", openGames);
  // back out of the games to the report card, so the remaining minutes stay
  // reachable; only leaving that screen ends the play session for today
  $("games-back").addEventListener("click", () => {
    if (session) { renderResult(); show("screen-result"); } else goHome();
  });
  $("play-back").addEventListener("click", leavePlay);

  // calendar nav
  $("cal-prev").addEventListener("click", () => { calMonth.setMonth(calMonth.getMonth() - 1); renderCalendar(); });
  $("cal-next").addEventListener("click", () => { calMonth.setMonth(calMonth.getMonth() + 1); renderCalendar(); });

  document.addEventListener("visibilitychange", () => {
    // leaving the screen mid-task: bank it so the next device gets the same som
    if (document.hidden) { if (session) saveActive(); bookPlayTime(); Store.pushNow(data); return; }
    // signed out from another tab on this device
    if (!Store.isLoggedIn()) { if (!isOn("screen-login")) goLogin(); return; }
    // a backgrounded tab stops ticking, so the time may have run out unnoticed
    if (isOn("screen-play") && Reward.remaining(data) <= 0) { timeIsUp(); return; }
    refreshFromCloud();
  });
  window.addEventListener("pagehide", () => {
    if (session) saveActive();
    bookPlayTime();
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
  data = merged;
  if (isOn("screen-home")) renderHome();
  else if (isOn("screen-calendar")) renderCalendar();
  else if (isOn("screen-stats")) renderStats();
  else if (isOn("screen-sommen")) renderSommen();
}
