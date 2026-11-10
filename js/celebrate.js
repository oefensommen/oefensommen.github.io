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
   trophies and medals drifting up behind them. Started when the cup is won and
   stopped when the child taps Verder — nothing keeps running after that. */
const Fireworks = (() => {
  const COLORS = ["#ffd54a", "#ff6b6b", "#4dd0e1", "#b388ff", "#69f0ae", "#ff8a65", "#ffffff"];
  const FLOATERS = ["🏆", "⭐", "🥇", "🎉", "👑", "✨", "🎆"];
  let raf = 0, cvs = null, ctx = null, parts = [], last = 0, nextBurst = 0, floatBox = null, floatTimer = 0;

  const calm = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function size() {
    const r = window.devicePixelRatio || 1;
    cvs.width = Math.round(innerWidth * r);
    cvs.height = Math.round(innerHeight * r);
    ctx.setTransform(r, 0, 0, r, 0, 0);
  }

  function burst(x, y) {
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const shape = ["dot", "star", "heart"][Math.floor(Math.random() * 3)];
    const n = calm() ? 24 : 56 + Math.floor(Math.random() * 30);
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.2;
      const v = 1.6 + Math.random() * 4.4;
      parts.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: 1, decay: 0.009 + Math.random() * 0.009,
        color: Math.random() < 0.25 ? "#ffd54a" : color,
        size: 2.2 + Math.random() * 2.6,
        shape: Math.random() < 0.45 ? shape : "dot"
      });
    }
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
      burst(innerWidth * (0.12 + Math.random() * 0.76), innerHeight * (0.12 + Math.random() * 0.42));
      nextBurst = ts + (calm() ? 1400 : 320 + Math.random() * 420);
    }
    parts = parts.filter(p => p.life > 0);
    for (const p of parts) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.985; p.vy = p.vy * 0.985 + 0.05 * dt;
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
    const s = document.createElement("span");
    s.textContent = FLOATERS[Math.floor(Math.random() * FLOATERS.length)];
    s.style.left = Math.random() * 94 + "vw";
    s.style.fontSize = 1.4 + Math.random() * 1.8 + "rem";
    s.style.animationDuration = 4 + Math.random() * 3 + "s";
    floatBox.appendChild(s);
    setTimeout(() => s.remove(), 7200);
  }

  return {
    start(canvas, floats) {
      this.stop();
      cvs = canvas; ctx = cvs.getContext("2d"); floatBox = floats;
      size();
      addEventListener("resize", size);
      parts = []; last = 0; nextBurst = 0;
      raf = requestAnimationFrame(frame);
      if (!calm()) { for (let i = 0; i < 6; i++) setTimeout(floater, i * 250); floatTimer = setInterval(floater, 600); }
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
