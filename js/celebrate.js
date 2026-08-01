/* Daily celebration for a perfect (100%) task.
   A different fun emoji + message each day, plus a confetti burst.
   Deterministic per calendar day so it feels "new every day" but stable within the day. */

const PARTY_EMOJIS = [
  "🎉", "🥳", "🚀", "🦄", "🌟", "🍕", "🐙", "🎸",
  "🦖", "🏆", "🍩", "🎈", "🐳", "🧁", "🕺", "🎆",
  "🐧", "🦩", "🍦", "🎯", "🐨", "🌈", "🦸", "🍭",
  "🐢", "🎮", "🐝", "🦆", "🍀", "🐬"
];

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

function partyEmoji() {
  return PARTY_EMOJIS[dayIndex() % PARTY_EMOJIS.length];
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
