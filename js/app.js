/* Oefensommen — app flow */

let data = Store.load();
let session = null;           // { questions, idx, firstPass, queue }
let calMonth = null;          // Date of shown calendar month
let taskCount = 20;
let timerInt = null;

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
  $("timer").textContent = "⏱ " + fmtTime(elapsedSec());
}
function startTimer() {
  session.t0 = Date.now();
  $("timer").classList.remove("hidden");
  tickTimer();
  clearInterval(timerInt);
  timerInt = setInterval(tickTimer, 1000);
}
function stopTimer() {
  clearInterval(timerInt);
  timerInt = null;
  $("timer").classList.add("hidden");
}

/* ---------- screens ---------- */
function show(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.add("hidden"));
  $(id).classList.remove("hidden");
}

/* ---------- language ---------- */
function setLang(lang) {
  LANG = lang;
  document.querySelectorAll(".flag").forEach(f =>
    f.classList.toggle("active", f.dataset.lang === lang));
  applyI18n();
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

  let status = t("today_todo");
  if (day && day.done100) status = t("today_done");
  else if (day && day.solved > 0) status = t("today_partial");
  if (parent) {
    status = liveBusy ? Store.watches().toUpperCase() + " " + t("live_busy")
                      : Store.watches().toUpperCase() + " " + t("live_idle");
  }
  $("home-status").textContent = status;

  // the child practises; the parent watches and reviews
  $("btn-start").classList.toggle("hidden", parent);
  $("btn-watch").classList.toggle("hidden", !parent);
  $("nav-row").classList.toggle("hidden", !parent);

  renderLevelChip(parent);

  // speeltijd die vandaag verdiend is en nog niet op
  const playLeftSec = parent ? 0 : Reward.remaining(data);
  $("btn-play").classList.toggle("hidden", playLeftSec <= 0);
  $("home-play-left").textContent = playLeftSec > 0 ? fmtTime(playLeftSec) : "";
}

/* The level the user sees: one number for the six categories together, with a
   bar for how far the rest have come and a line saying what is left to do. */
function renderLevelChip(parent) {
  const chip = $("level-chip");
  if (parent) { chip.classList.add("hidden"); return; }
  const st = Levels.overall(data);
  chip.classList.remove("hidden");
  chip.classList.toggle("maxed", st.level >= Levels.MAX);
  $("level-num").textContent = st.level;
  $("level-num-text").textContent = st.level;
  $("level-fill").style.width = Math.round(st.progress * 100) + "%";
  $("level-next").textContent = st.level >= Levels.MAX
    ? t("level_max")
    : t("level_next").replace("{n}", st.atNext).replace("{t}", st.total);
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
  runCountdown(() => {
    startTimer();
    renderQuestion();
    show("screen-task");
  });
}

function currentQ() {
  return session.questions[session.queue[session.idx]];
}

function renderQuestion() {
  const q = currentQ();
  $("btn-skip").disabled = false;
  $("progress-text").textContent = `${session.idx + 1}/${session.queue.length}`;
  $("progress-bar").style.width = `${(session.idx / session.queue.length) * 100}%`;
  $("question-text").textContent = Engine.text(q, LANG);
  const box = $("answers");
  box.innerHTML = "";
  box.classList.add("fresh");     // no answer may look chosen before it is touched
  q.options.forEach((opt, i) => {
    const b = document.createElement("button");
    b.className = "answer";
    b.textContent = opt;
    b.onclick = () => answer(i, b);
    box.appendChild(b);
  });
  Live.push("task");
}

function answer(i, btn) {
  const q = currentQ();
  const correct = i === q.answerIdx;
  document.querySelectorAll(".answer").forEach(b => b.disabled = true);
  $("btn-skip").disabled = true;
  btn.classList.add(correct ? "correct" : "wrong");

  if (session.firstPass) {
    q.chosen = i;
    q.correctFirst = correct;
    q.solved = correct;
  } else {
    if (correct) q.solved = true;
  }

  Live.push("task");                     // let the parent see the pick land
  setTimeout(advance, correct ? 600 : 900);
}

function skip() {
  const q = currentQ();
  q.skipped = true;
  if (session.firstPass) {
    q.chosen = null;
    q.correctFirst = false;   // counts as not-correct on first try
    q.solved = false;         // stays unsolved → returns in the correction round
  }
  advance();
}

function advance() {
  session.idx++;
  $("progress-bar").style.width = `${(session.idx / session.queue.length) * 100}%`;
  if (session.idx >= session.queue.length) finishPass();
  else renderQuestion();
}

function finishPass() {
  if (session.firstPass) {
    recordFirstPass();
  } else {
    // keep only questions that are still not solved for the next retry round
    const stillWrong = session.queue.filter(qi => !session.questions[qi].solved);
    if (stillWrong.length === 0) markDone100();
    else session.nextQueue = stillWrong;
  }
  renderResult();
  show("screen-result");
}

function recordFirstPass() {
  const secs = elapsedSec();
  session.lastSec = secs;
  stopTimer();
  const ds = todayStr();
  const day = data.days[ds] || { solved: 0, firstCorrect: 0, done100: false, cats: {} };
  let nCorrect = 0;
  const perCat = {};                      // this task only, for the level rules
  session.questions.forEach(q => {
    day.solved++;
    if (q.correctFirst) { day.firstCorrect++; nCorrect++; }
    const c = day.cats[q.cat] || { n: 0, c: 0 };
    c.n++; if (q.correctFirst) c.c++;
    day.cats[q.cat] = c;
    const t = perCat[q.cat] || { n: 0, c: 0 };
    t.n++; if (q.correctFirst) t.c++;
    perCat[q.cat] = t;
    // wrong-template pool for future repeat
    if (!q.correctFirst && q.cat !== "verrassing") {
      data.wrongTpl = [q.tplId, ...data.wrongTpl.filter(id => id !== q.tplId)].slice(0, 6);
    }
  });
  // time log: how long the 20 questions took (first pass)
  day.timeSec = secs;
  day.times = (day.times || []).concat(secs);
  const nSkipped = session.questions.filter(q => q.skipped).length;
  data.days[ds] = day;
  console.log(`[Oefensommen] ${ds}: ${session.questions.length} sommen in ${fmtTime(secs)} — ${nCorrect} goed (1e keer), ${nSkipped} overgeslagen`);

  // three clean runs in a category and that category gets a bit harder
  session.levelUps = Levels.record(data, perCat);
  session.score = { correct: nCorrect, total: session.questions.length };

  // wrong + skipped questions both return in the correction round
  const wrongs = session.questions.map((q, i) => i).filter(i => !session.questions[i].solved);
  if (wrongs.length === 0) markDone100();
  else session.nextQueue = wrongs;

  Store.save(data);
}

function markDone100() {
  const ds = todayStr();
  const day = data.days[ds] || { solved: 0, firstCorrect: 0, done100: false, cats: {} };
  day.done100 = true;
  data.days[ds] = day;
  session.nextQueue = null;
  session.celebrate = true;
  // speeltijd verdiend, puur op het cijfer van de eerste poging
  const sc = session.score || { correct: 0, total: session.questions.length };
  session.rewardMin = Reward.grant(data, sc.correct, sc.total);
  Store.save(data);
}

/* ---------- result ---------- */
function renderResult() {
  const qs = session.questions;
  const allSolved = qs.every(q => q.solved);
  const nSolved = qs.filter(q => q.solved).length;

  $("result-title").textContent = allSolved ? t("result_perfect") : t("result_almost");
  $("result-emoji").textContent = allSolved ? partyEmoji() : "💪";
  $("result-emoji").classList.toggle("party", allSolved);
  $("result-score").textContent = allSolved
    ? partyMessage(LANG)
    : t("result_score").replace("{c}", nSolved).replace("{t}", qs.length);

  // numbered grid: number + ✓/✗ only (no question text, no answer revealed)
  const grid = $("result-grid");
  grid.innerHTML = "";
  qs.forEach((q, i) => {
    const cell = document.createElement("div");
    cell.className = "result-tile " + (q.solved ? "ok" : "no");
    cell.innerHTML = `<span class="num">${i + 1}</span><span class="mark">${q.solved ? "✅" : "❌"}</span>`;
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

  $("btn-retry").classList.toggle("hidden", allSolved);

  // de beloning: de melding alleen de ronde waarin hij verdiend is, de knop
  // zolang er vandaag nog speeltijd over is
  const earned = session.rewardMin || 0;
  // a category that just went up a level is worth saying out loud
  const ups = $("result-levelups");
  ups.innerHTML = "";
  (session.levelUps || []).forEach(cat => {
    const p = document.createElement("p");
    p.className = "levelup-line";
    p.textContent = "⭐ " + t("level_up")
      .replace("{cat}", t("cats")[cat])
      .replace("{n}", Levels.of(data, cat));
    ups.appendChild(p);
  });

  const rewardEl = $("result-reward");
  rewardEl.textContent = earned > 0 ? t("reward_earned").replace("{m}", earned) : "";
  rewardEl.classList.toggle("hidden", earned <= 0);
  $("btn-play-result").classList.toggle("hidden", Reward.remaining(data) <= 0);

  Live.push("result");

  // fire confetti once, right when the task becomes perfect
  if (allSolved && session.celebrate) {
    session.celebrate = false;
    fireConfetti();
  }
}

function startRetry() {
  session.queue = session.nextQueue;
  session.nextQueue = null;
  session.idx = 0;
  session.firstPass = false;
  session.round = (session.round || 1) + 1;
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
  t("weekdays").forEach(w => {
    const c = document.createElement("div");
    c.className = "cal-cell head";
    c.textContent = w;
    grid.appendChild(c);
  });
  const first = new Date(y, m, 1);
  const offset = (first.getDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  for (let i = 0; i < offset; i++) {
    const c = document.createElement("div");
    c.className = "cal-cell out";
    grid.appendChild(c);
  }
  const today = todayStr();
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = todayStr(new Date(y, m, d));
    const rec = data.days[ds];
    const c = document.createElement("div");
    c.className = "cal-cell";
    if (rec && rec.done100) c.classList.add("done");
    else if (rec && rec.solved > 0) c.classList.add("partial");
    if (ds === today) c.classList.add("today");
    c.textContent = d;
    grid.appendChild(c);
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
    // the surprise mix has no level of its own
    const lvl = cat === "verrassing" ? 0 : Levels.of(data, cat);
    const pips = lvl
      ? `<span class="cat-level" title="${t("level")} ${lvl}">` +
        [1, 2, 3, 4, 5].map(i => `<i class="${i <= lvl ? "on" : ""}"></i>`).join("") +
        `</span>` : "";
    const row = document.createElement("div");
    row.className = "cat-bar-row";
    row.innerHTML =
      `<div class="cat-bar-label"><span>${t("cats")[cat]}${pips}</span><b>${pct}% · ${agg.c}/${agg.n}</b></div>
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

/* The parent keeps a quiet eye on the child from the home screen, and the
   mirror opens by itself the moment the child starts. */
function startParentWatch() {
  Live.startWatching((state, age) => {
    const wasBusy = liveBusy;
    liveBusy = Live.isBusy(state, age);
    if (isOn("screen-mirror")) Live.render(state, age);
    else if (isOn("screen-home")) {
      renderHome();
      if (liveBusy && !wasBusy) openMirror(state, age);   // the child just began
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
let playInt = null, playT0 = 0, playLeft = 0;

function openGames() {
  renderGames();
  show("screen-games");
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
}

function tickPlay() {
  const spent = Math.floor((Date.now() - playT0) / 1000);
  const left = Math.max(0, playLeft - spent);
  $("play-left").textContent = "🎮 " + fmtTime(left);
  if (left <= 0) leavePlay();
  else if (spent >= 10) bookPlayTime();
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
  session = null;
  if (!Store.isParent()) Live.push("home");
  renderHome();
  show("screen-home");
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

  // flags
  document.querySelectorAll(".flag").forEach(f =>
    f.addEventListener("click", () => setLang(f.dataset.lang)));

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
  $("btn-watch").addEventListener("click", () => openMirror());
  $("btn-calendar").addEventListener("click", () => { calMonth = new Date(); renderCalendar(); show("screen-calendar"); });
  $("btn-stats").addEventListener("click", () => { renderStats(); show("screen-stats"); });
  $("btn-logout").addEventListener("click", () => { Store.logout(); goLogin(); });

  // task
  $("btn-quit").addEventListener("click", () => {
    if (confirm(t("quit_confirm"))) goHome();
  });
  $("btn-skip").addEventListener("click", skip);
  // the cursor has to move before hovering means anything again
  $("answers").addEventListener("pointermove", () => $("answers").classList.remove("fresh"));

  // result
  $("btn-retry").addEventListener("click", startRetry);

  // speeltijd
  $("btn-play").addEventListener("click", openGames);
  $("btn-play-result").addEventListener("click", openGames);
  $("games-back").addEventListener("click", goHome);
  $("play-back").addEventListener("click", leavePlay);

  // calendar nav
  $("cal-prev").addEventListener("click", () => { calMonth.setMonth(calMonth.getMonth() - 1); renderCalendar(); });
  $("cal-next").addEventListener("click", () => { calMonth.setMonth(calMonth.getMonth() + 1); renderCalendar(); });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { bookPlayTime(); Store.pushNow(data); return; }
    // the day may have rolled over while the app sat open → lock again (00:00 reset)
    if (!Store.isLoggedIn()) { if (!isOn("screen-login")) goLogin(); return; }
    refreshFromCloud();
  });
  window.addEventListener("pagehide", () => { bookPlayTime(); Store.pushNow(data); });

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
