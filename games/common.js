/* Shared shell for the reward games.
   Every game is its own page inside an iframe; this file gives them the score
   bar, the best-score memory, the game-over card and the handful of words they
   need in NL / EN / TR. The language comes in as ?lang= from the app. */
const G = (() => {
  const WORDS = {
    nl: { score: "Punten", best: "Beste", over: "Game over", again: "Nog een keer", level: "Niveau", time: "Tijd" },
    en: { score: "Score",  best: "Best",  over: "Game over", again: "Play again",   level: "Level",  time: "Time" },
    tr: { score: "Puan",   best: "En iyi", over: "Bitti",    again: "Bir daha",     level: "Seviye", time: "Süre" }
  };

  let gameId = "game";
  let best = 0;
  let onRestart = null;
  const $ = sel => document.querySelector(sel);

  return {
    lang: "nl",

    w(key) { return (WORDS[this.lang] || WORDS.nl)[key] || key; },

    init(opts) {
      gameId = opts.id;
      onRestart = opts.onRestart;

      const q = new URLSearchParams(location.search).get("lang");
      this.lang = WORDS[q] ? q : "nl";
      document.documentElement.lang = this.lang;

      best = Number(localStorage.getItem("game_best_" + gameId)) || 0;
      $(".g-score-label").textContent = this.w("score");
      $(".g-best-label").textContent = this.w("best");
      $(".g-best-val").textContent = best;
      $(".g-over-title").textContent = this.w("over");
      $(".g-again").textContent = this.w("again");
      $(".g-again").addEventListener("click", () => {
        this.hideOver();
        if (onRestart) onRestart();
      });
    },

    score(n) { $(".g-score-val").textContent = n; },
    extra(text) { $(".g-extra").textContent = text; },

    /* remember a high score without interrupting play (endless games) */
    record(n) {
      if (n <= best) return;
      best = n;
      localStorage.setItem("game_best_" + gameId, best);
      $(".g-best-val").textContent = best;
    },

    over(n) {
      this.record(n);
      $(".g-over-score").textContent = this.w("score") + ": " + n;
      $(".g-over").classList.remove("hidden");
    },

    hideOver() { $(".g-over").classList.add("hidden"); },

    /* size a canvas to its parent box, crisp on retina, in CSS pixels */
    fit(canvas) {
      const r = canvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.floor(r.width));
      const h = Math.max(1, Math.floor(r.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { ctx, w, h };
    }
  };
})();
