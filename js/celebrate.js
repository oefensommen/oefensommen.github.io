/* Daily celebration for a perfect (100%) task.
   A different fun emoji + message each day, plus a confetti burst.
   Deterministic per calendar day so it feels "new every day" but stable within the day. */


const PARTY_MSG = {
  nl: [
    "Alles goed! Jij bent een rekenbaas! 🧠",
    "Foutloos! Superknap gedaan! 💪",
    "20 uit 20 — helemaal top!",
    "Wauw, alles goed! Jij kan het! ✨",
    "Perfect! Wat een rekenheld!",
    "Helemaal goed! Trots op jou! 🌟",
    "Top gedaan! Alle sommen goed!"
  ],
  en: [
    "All correct! You're a math boss! 🧠",
    "Flawless! Amazing job! 💪",
    "20 out of 20 — awesome!",
    "Wow, all correct! You've got this! ✨",
    "Perfect! What a math hero!",
    "All right! So proud of you! 🌟",
    "Great job! Every problem correct!"
  ],
  tr: [
    "Hepsi doğru! Matematik ustasısın! 🧠",
    "Kusursuz! Harika iş çıkardın! 💪",
    "20'de 20 — muhteşem!",
    "Vay, hepsi doğru! Sen yaparsın! ✨",
    "Mükemmel! Tam bir matematik kahramanı!",
    "Hepsi doğru! Seninle gurur duyuyorum! 🌟",
    "Süper! Bütün sorular doğru!"
  ]
};

const CONFETTI_COLORS = ["#3b6ef6", "#22a95c", "#f5b301", "#e5484d", "#8b5cf6", "#ec4899", "#06b6d4"];

function dayIndex() {
  const d = new Date();
  return Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}


function partyMessage(lang) {
  const list = PARTY_MSG[lang] || PARTY_MSG.nl;
  return list[dayIndex() % list.length];
}

function fireConfetti() {
  const box = document.getElementById("confetti");
  if (!box) return;
  box.innerHTML = "";
  const N = 90;
  for (let i = 0; i < N; i++) {
    const p = document.createElement("div");
    p.className = "confetti-piece";
    p.style.left = Math.random() * 100 + "vw";
    p.style.background = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    const dur = 2.2 + Math.random() * 1.8;
    p.style.animationDuration = dur + "s";
    p.style.animationDelay = Math.random() * 0.5 + "s";
    p.style.transform = `translateY(-10px) scale(${0.7 + Math.random() * 0.8})`;
    if (Math.random() > 0.5) p.style.borderRadius = "50%";
    box.appendChild(p);
  }
  setTimeout(() => { box.innerHTML = ""; }, 4800);
}


/* Fireworks for the kampioen: bursts of dots, stars and hearts on a canvas,
   trophies and medals drifting up behind them. Started when a cup is won and
   stopped when the child taps Verder — nothing keeps running after that.
   { mega: true } is the superfinale: several bursts at once, bigger ones,
   rings, a finale volley every few seconds and a rain of gold glitter. */
const Fireworks = (() => {
  const COLORS = ["#ffd54a", "#ff6b6b", "#4dd0e1", "#b388ff", "#69f0ae", "#ff8a65", "#ffffff", "#ff5ea8"];
  const FLOATERS = ["🏆", "⭐", "🥇", "🎉", "👑", "✨", "🎆"];
  const FLOATERS_MEGA = ["👑", "🏆", "🌟", "🥇", "🎆", "🎇", "💫", "🔥", "🎉", "⭐"];
  let raf = 0, cvs = null, ctx = null, parts = [], last = 0, nextBurst = 0, nextFinale = 0,
      floatBox = null, floatTimer = 0, mega = false;

  const calm = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rnd = (a, b) => a + Math.random() * (b - a);

  function size() {
    const r = window.devicePixelRatio || 1;
    cvs.width = Math.round(innerWidth * r);
    cvs.height = Math.round(innerHeight * r);
    ctx.setTransform(r, 0, 0, r, 0, 0);
  }

  function burst(x, y) {
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const shape = ["dot", "star", "heart"][Math.floor(Math.random() * 3)];
    const ring = mega && Math.random() < 0.35;          // a perfect circle, all one speed
    const n = calm() ? 24 : mega ? 90 + Math.floor(Math.random() * 50) : 56 + Math.floor(Math.random() * 30);
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + (ring ? 0 : Math.random() * 0.2);
      const v = ring ? (mega ? 5 : 3.5) : (1.6 + Math.random() * (mega ? 6 : 4.4));
      parts.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: 1, decay: 0.008 + Math.random() * 0.008,
        color: Math.random() < 0.25 ? "#ffd54a" : color,
        size: (2.2 + Math.random() * 2.6) * (mega ? 1.35 : 1),
        shape: Math.random() < 0.5 ? shape : "dot", g: 0.05
      });
    }
  }

  function glitter() {
    parts.push({
      x: rnd(0, innerWidth), y: -6, vx: rnd(-0.3, 0.3), vy: rnd(0.8, 2.2),
      life: 1, decay: 0.0035, color: Math.random() < 0.7 ? "#ffd54a" : "#ffffff",
      size: rnd(1.6, 3.4), shape: "star", g: 0.004
    });
  }

  function star(x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 ? r * 0.45 : r;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      ctx[i ? "lineTo" : "moveTo"](x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    ctx.closePath(); ctx.fill();
  }

  function heart(x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y + r * 0.9);
    ctx.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.7, y - r * 1.3, x, y - r * 0.4);
    ctx.bezierCurveTo(x + r * 0.7, y - r * 1.3, x + r * 1.6, y - r * 0.2, x, y + r * 0.9);
    ctx.fill();
  }

  function frame(ts) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(3, (ts - (last || ts)) / 16.67);
    last = ts;
    // fade the last frame instead of wiping it: that is the trail
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(0, 0, innerWidth, innerHeight);
    ctx.globalCompositeOperation = "lighter";
    if (ts >= nextBurst) {
      const k = mega && !calm() ? 1 + Math.floor(Math.random() * 3) : 1;
      for (let i = 0; i < k; i++)
        burst(innerWidth * rnd(0.1, 0.9), innerHeight * rnd(0.1, mega ? 0.62 : 0.52));
      nextBurst = ts + (calm() ? 1400 : mega ? rnd(150, 380) : rnd(320, 740));
    }
    if (mega && !calm()) {
      if (ts >= nextFinale) {                       // a volley across the whole sky
        for (let i = 0; i < 7; i++)
          setTimeout(() => raf && burst(innerWidth * (0.08 + i * 0.14), innerHeight * rnd(0.12, 0.5)), i * 90);
        nextFinale = ts + 3200;
      }
      if (Math.random() < 0.6) glitter();
    }
    parts = parts.filter(p => p.life > 0 && p.y < innerHeight + 20);
    for (const p of parts) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.985; p.vy = p.vy * 0.985 + p.g * dt;
      p.life -= p.decay * dt;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      if (p.shape === "star") star(p.x, p.y, p.size * 1.7);
      else if (p.shape === "heart") heart(p.x, p.y, p.size * 1.1);
      else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 0.7, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }

  function floater() {
    if (!floatBox) return;
    const list = mega ? FLOATERS_MEGA : FLOATERS;
    const s = document.createElement("span");
    s.textContent = list[Math.floor(Math.random() * list.length)];
    s.style.left = Math.random() * 94 + "vw";
    s.style.fontSize = (mega ? 1.8 : 1.4) + Math.random() * (mega ? 2.6 : 1.8) + "rem";
    s.style.animationDuration = 4 + Math.random() * 3 + "s";
    floatBox.appendChild(s);
    setTimeout(() => s.remove(), 7200);
  }

  return {
    start(canvas, floats, opts) {
      this.stop();
      mega = !!(opts && opts.mega);
      cvs = canvas; ctx = cvs.getContext("2d"); floatBox = floats;
      size();
      addEventListener("resize", size);
      parts = []; last = 0; nextBurst = 0; nextFinale = 1200;
      raf = requestAnimationFrame(frame);
      if (!calm()) {
        for (let i = 0; i < (mega ? 12 : 6); i++) setTimeout(floater, i * 200);
        floatTimer = setInterval(floater, mega ? 260 : 600);
      }
    },
    stop() {
      cancelAnimationFrame(raf); raf = 0;
      clearInterval(floatTimer); floatTimer = 0;
      removeEventListener("resize", size);
      if (ctx && cvs) ctx.clearRect(0, 0, cvs.width, cvs.height);
      if (floatBox) floatBox.innerHTML = "";
      parts = [];
    }
  };
})();
