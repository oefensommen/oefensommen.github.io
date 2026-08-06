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
let taskCount = 20;
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
  if (id === "screen-login") $("level-pill").classList.add("hidden");
  else renderLevelChip(Store.isParent());
}

/* ---------- language ---------- */
const LANG_FLAGS = { nl: "🇳🇱", en: "🇬🇧", tr: "🇹🇷" };

/* Only the parent may read a som in another language; the child works in Dutch,
   so the child simply sees the flag with nothing behind it. */
function renderLangPicker() {
  const canSwitch = Store.isParent();
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

function setLang(lang) {
  LANG = lang;
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
  if (!$("screen-mirror").classList.contains("hidden")) Live.rerender();
}

/* ---------- streak ---------- */
function currentStreak() {
  let streak = 0;
  const d = new Date();
  // today counts if done100, otherwise start from yesterday
  if (!(data.days[todayStr(d)] || {}).done100) d.setDate(d.getDate() - 1);
  while ((data.days[todayStr(d)] || {}).done100) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function bestStreak() {
  const dates = Object.keys(data.days).filter(k => data.days[k].done100).sort();
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
  $("streak-count").textContent = currentStreak();

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

  let status = t("today_todo");
  if (open) status = pastEnd
    ? t("finish_rest").replace("{n}", left)
    : t("today_resume").replace("{n}", open.idx + 1).replace("{t}", open.queue.length);
  else if (day && day.done100) status = t("today_done");
  else if (day && day.solved > 0) status = t("today_partial");
  if (parent) {
    status = liveBusy ? Store.watches().toUpperCase() + " " + t("live_busy")
                      : Store.watches().toUpperCase() + " " + t("live_idle");
  }
  $("home-status").textContent = status;

  // the child practises; the parent watches and reviews
  $("btn-start").classList.toggle("hidden", parent || !!open);
  $("btn-watch").classList.toggle("hidden", !parent);
  $("nav-row").classList.toggle("hidden", !parent);

  renderLevelChip(parent);
  // spelen hoort bij het rapport van een afgeronde opdracht, niet hier
}

/* The level lives in the top bar as a small badge: the number for the six
   categories together, with the details in the tooltip. */
function renderLevelChip(parent) {
  const pill = $("level-pill");
  if (parent) { pill.classList.add("hidden"); return; }
  const st = Levels.overall(data);
  pill.classList.remove("hidden");
  pill.classList.toggle("maxed", st.level >= Levels.MAX);
  $("level-num").textContent = st.level;
  pill.title = t("level") + " " + st.level + " · " + (st.level >= Levels.MAX
    ? t("level_max")
    : (st.toGo === 1 ? t("level_togo_one") : t("level_togo").replace("{n}", st.toGo)));
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

function startTask() {
  session = {
    questions: Engine.buildTask(taskCount, data),
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
    score: session.score || null,
    levelUp: session.levelUp || null,
    rewardMin: session.rewardMin || 0,
    questions: session.questions.map(q => ({
      tplId: q.tplId, cat: q.cat, variantIdx: q.variantIdx, vars: q.vars,
      name: q.name, name2: q.name2, obj: q.obj, obj2: q.obj2,
      options: q.options, answerIdx: q.answerIdx,
      chosen: q.chosen === undefined ? null : q.chosen,
      correctFirst: q.correctFirst === undefined ? null : q.correctFirst,   // null = still waiting
      tries: q.tries || 0,
      solved: !!q.solved,
      failed: !!q.failed,
      skipped: !!q.skipped,
      booked: !!q.booked           // already counted in today's record
    }))
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
  // an opdracht with nothing left to answer is not something to carry on with;
  // writing it back here is what kept a finished one sitting in the slot
  if (session.questions.every(finished)) delete data.active;
  else data.active = snap;
  Store.save(data);
  if (pushNow) Store.pushNow(data);      // a pause should reach the other device at once
}

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
  // nothing left to do: a som is done whether it went right or wrong. Asking
  // only about q.solved kept a finished opdracht hanging around all day, which
  // took the start button away from a child who wanted to practise again.
  if (a.questions.every(q => q.solved || q.failed)) return null;
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
    queue: a.queue,
    idx: pastEnd ? a.queue.length : Math.min(a.idx, a.queue.length - 1),
    firstPass: a.firstPass,
    round: a.round || 1,
    lastSec: a.lastSec,
    banked: !!a.banked,
    score: a.score,
    levelUp: a.levelUp || null,
    rewardMin: a.rewardMin || 0,
    pausedSec: null,
    t0: Date.now() - (a.elapsed || 0) * 1000                // the clock carries on
  };
  Live.startHeartbeat();
  if (pastEnd) {
    finishPass();                 // rebuilds what is left and draws the card
    show("screen-result");
    return;
  }
  clearInterval(timerInt);
  $("timerbox").classList.remove("hidden");
  tickTimer();
  timerInt = setInterval(tickTimer, 1000);
  renderQuestion();
  show("screen-task");
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
  $("btn-skip").classList.toggle("hidden", !!session.review);   // nothing to skip when looking back
  // one som opened from the report card is "som 5 of 20", not "1 of 1"
  const at = session.viewOne != null ? session.viewOne : session.idx;
  const of = session.viewOne != null ? session.questions.length : session.queue.length;
  $("progress-text").textContent = `${at + 1}/${of}`;
  $("progress-bar").style.width = `${(at / of) * 100}%`;
  $("question-text").textContent = Engine.text(q, LANG);
  const box = $("answers");
  box.innerHTML = "";
  box.classList.add("fresh");     // no answer may look chosen before it is touched
  q.options.forEach((opt, i) => {
    const b = document.createElement("button");
    b.className = "answer";
    b.textContent = opt;
    if (session.review) {
      // looking back from the report card: what was picked, and what it should
      // have been — this is where a wrong som is there to be learned from
      b.disabled = true;
      if (i === q.chosen) b.classList.add(q.solved ? "correct" : "wrong");
      if (q.failed && i === q.answerIdx) b.classList.add("correct");
    } else {
      b.onclick = () => answer(i, b);
    }
    box.appendChild(b);
  });
  renderTaskMarks();
  if (!session.review) Live.push("task");
}

/* The whole opdracht beside the som being worked on, so the child can see how
   it is going without waiting for the report card. */
function renderTaskMarks() {
  if (!session) return;
  $("task-marks").innerHTML =
    Live.marksPanelHTML(Live.marksOf(session.questions), currentIdx());
}

/* One go at a som. The moment an answer is touched the som is settled — right
   is right, wrong is wrong, and there is no going back over it. A wrong som
   shows what it should have been before moving on, and can be opened again
   from the report card afterwards. */
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

  if (correct) {
    q.solved = true;
  } else {
    q.failed = true;
    const right = document.querySelectorAll(".answer")[q.answerIdx];
    if (right) right.classList.add("correct");   // so the good one is seen at least once
  }

  renderTaskMarks();
  Live.push("task");
  setTimeout(advance, correct ? 600 : 1800);
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

function finishPass() {
  if (session.firstPass) {
    // a pass that was already timed keeps its time; coming back to the report
    // card later must not stretch it
    if (session.lastSec == null) session.lastSec = elapsedSec();
    stopTimer();
  }
  recordFirstPass();                 // waits until every som has been faced

  // only soms that were put aside can still be done; a failed one is settled
  const open = session.questions.map((q, i) => i).filter(i => !finished(session.questions[i]));
  if (open.length === 0) {
    markDone100();          // this clears the active task — do not write it back
  } else {
    session.nextQueue = open;
    saveActive();           // still soms to do, so it stays resumable
  }

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
  const secs = session.lastSec || elapsedSec();
  const ds = todayStr();
  const day = data.days[ds] || { solved: 0, firstCorrect: 0, done100: false, cats: {} };
  const nCorrect = session.questions.filter(q => q.correctFirst).length;

  // time log: how long the 20 questions took (first pass)
  day.timeSec = secs;
  day.times = (day.times || []).concat(secs);
  const nSkipped = session.questions.filter(q => q.skipped).length;
  data.days[ds] = day;
  console.log(`[Oefensommen] ${ds}: ${session.questions.length} sommen in ${fmtTime(secs)} — ${nCorrect} goed (1e keer), ${nSkipped} overgeslagen`);

  session.score = { correct: nCorrect, total: session.questions.length };
  // five faultless days and everything gets a bit harder; five days with four
  // or more mistakes and it gets easier again
  session.levelUp = Levels.record(data, session.score);
  Store.save(data);
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
  // speeltijd verdiend, puur op het cijfer van de eerste poging
  const sc = session.score || { correct: 0, total: session.questions.length };
  session.rewardMin = Reward.grant(data, sc.correct, sc.total);
  Store.save(data);
}

/* ---------- result ---------- */
function renderResult() {
  const qs = session.questions;
  const allDone = qs.every(finished);                       // nothing left to answer
  const perfect = allDone && qs.every(q => q.correctFirst);  // right first time, all of them
  const nRight = qs.filter(q => q.correctFirst).length;

  $("result-title").textContent =
    perfect ? t("result_perfect") : (allDone ? t("result_done") : t("result_almost"));
  $("result-emoji").textContent = perfect ? partyEmoji() : "💪";
  $("result-emoji").classList.toggle("party", perfect);
  $("result-score").textContent = perfect
    ? partyMessage(LANG)
    : t("result_score").replace("{c}", nRight).replace("{t}", qs.length);

  // numbered grid: right, wrong, or still to be done. No answers are given
  // away here — a som has to be opened to see how it should have gone.
  const grid = $("result-grid");
  grid.innerHTML = "";
  qs.forEach((q, i) => {
    const state = q.correctFirst ? "ok" : (q.solved ? "ok2" : (q.failed ? "no" : "todo"));
    const icon  = { ok: "✅", ok2: "✔️", no: "❌", todo: "⏭" }[state];
    const cell = document.createElement("button");
    cell.className = "result-tile " + state;
    cell.title = t({ ok: "tile_done", ok2: "tile_second", no: "tile_wrong", todo: "tile_todo" }[state]);
    cell.innerHTML = `<span class="num">${i + 1}</span><span class="mark">${icon}</span>`;
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
  $("result-hint").classList.toggle("hidden", !qs.some(q => q.failed));

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
  // The game waits until THIS opdracht is finished — every som answered or put
  // aside and then done. What it is worth is the score itself: faultless is
  // twenty minutes, up to three mistakes five, and beyond that none.
  const playLeftSec = Reward.remaining(data);
  $("btn-play-result").classList.toggle("hidden", !(allDone && playLeftSec > 0));
  $("result-play-left").textContent = playLeftSec > 0 ? fmtTime(playLeftSec) : "";

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

/* ---------- calendar ---------- */
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
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(y, m, d);
    const ds = todayStr(date);
    const rec = data.days[ds];
    const c = document.createElement("button");
    c.className = "cal-cell";
    // green means the day's opdracht was finished — all twenty made. Fewer than
    // that is a day that was practised but not seen through.
    if (rec && rec.solved >= taskCount) c.classList.add("done");
    else if (rec && rec.solved > 0) c.classList.add("partial");
    if (ds === today) c.classList.add("today");
    c.innerHTML = `<span class="wd">${wd[(date.getDay() + 6) % 7]}</span>` +
                  `<span class="dnum">${d}</span>`;
    if (rec && rec.solved > 0) c.title = `${d} · ${rec.firstCorrect}/${rec.solved}`;
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

  if (!rec || !rec.solved) {
    box.innerHTML = `<b>${head}</b><p class="day-none">${t("legend_empty")}</p>`;
  } else {
    const wrong = rec.solved - rec.firstCorrect;
    const time = rec.timeSec ? `<span class="day-pill">⏱ ${fmtTime(rec.timeSec)}</span>` : "";
    const cats = Object.keys(rec.cats || {})
      .map(c => `<div class="day-cat"><span>${t("cats")[c] || c}</span><b>${rec.cats[c].c}/${rec.cats[c].n}</b></div>`)
      .join("");
    box.innerHTML =
      `<div class="day-head"><b>${head}</b>${time}</div>
       <div class="day-counts">
         <span class="day-pill ok">✅ ${rec.firstCorrect} ${t("day_right")}</span>
         <span class="day-pill no">❌ ${wrong} ${t("day_wrong")}</span>
         <span class="day-pill">${t("result_score").replace("{c}", rec.firstCorrect).replace("{t}", rec.solved)}</span>
       </div>
       ${cats ? `<div class="day-cats">${cats}</div>` : ""}`;
  }
  box.dataset.day = ds;
  box.classList.remove("hidden");
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
}
