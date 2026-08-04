/* Speeltijd verdienen.

   Een afgeronde dag levert altijd speeltijd op, maar hoe eerder alles goed is,
   hoe meer: in één keer 20 uit 20 is het meest waard, elke extra verbeterronde
   is minder waard, met één minuut als bodem. Zo blijft foutloos werken duidelijk
   het beste, zonder dat een moeilijke dag helemaal zonder beloning eindigt.

   De tijd geldt alleen vandaag — wat niet opgemaakt is, gaat niet mee naar
   morgen. De teller staat in het dagrecord (day.reward), dus hij loopt mee met
   de cloud-synchronisatie: op de tablet gespeelde minuten zijn ook op de laptop
   op. */
const Reward = {
  /* Alles goed is 20 minuten waard, één tot drie fouten 5, en vanaf vier
     fouten is er vandaag geen speeltijd. Het verschil tussen foutloos en
     bijna-foutloos moet groot genoeg zijn om de moeite waard te zijn. */
  minutesForScore(correct, total) {
    if (!total) return 0;
    const wrong = Math.max(0, total - correct);
    if (wrong === 0) return 20;
    return wrong <= 3 ? 5 : 0;
  },

  _today(data) {
    return (data && data.days && data.days[todayStr()]) || null;
  },

  /* Called the moment a day becomes 100%. One reward per day: a second task on
     the same day is welcome, but it does not earn extra time.
     Returns the minutes awarded, or 0 when there was already a reward. */
  grant(data, correct, total) {
    const day = this._today(data);
    if (!day || day.reward) return 0;
    const min = this.minutesForScore(correct, total);
    day.reward = { sec: min * 60, used: 0 };
    return min;
  },

  earnedMin(data) {
    const day = this._today(data);
    return day && day.reward ? Math.round(day.reward.sec / 60) : 0;
  },

  remaining(data) {
    const day = this._today(data);
    if (!day || !day.reward) return 0;
    return Math.max(0, day.reward.sec - day.reward.used);
  },

  spend(data, sec) {
    const day = this._today(data);
    if (!day || !day.reward || sec <= 0) return;
    day.reward.used = Math.min(day.reward.sec, day.reward.used + sec);
  }
};

/* The games themselves live in games/<id>/index.html;
   frame is the shape the game wants its box in (width / height). */
const GAMES = [
  { id: "memory", emoji: "🃏", key: "game_memory", frame: "1 / 1" },
  { id: "mol",    emoji: "🐹", key: "game_mol",    frame: "1 / 1.2" },
  { id: "stack",  emoji: "🧱", key: "game_stack",  frame: "1 / 1.5" },
  { id: "snake",  emoji: "🐍", key: "game_snake",  frame: "1 / 1.4" }
];

/* The words for this screen live here instead of in i18n.js, so the whole
   reward feature is one file plus css/games.css plus the games/ folder. */
Object.assign(I18N.nl, {
  play_btn: "Spelen",
  games_title: "Spelletjes",
  games_pick: "Kies een spelletje",
  games_none: "Je speeltijd is op. Morgen weer!",
  reward_earned: "Je hebt {m} minuten speeltijd verdiend! 🎮",
  game_memory: "Geheugenspel",
  game_mol: "Mollen meppen",
  game_stack: "Blokkentoren",
  game_snake: "Slang"
});
Object.assign(I18N.en, {
  play_btn: "Play",
  games_title: "Games",
  games_pick: "Pick a game",
  games_none: "Your game time is up. See you tomorrow!",
  reward_earned: "You earned {m} minutes of game time! 🎮",
  game_memory: "Memory",
  game_mol: "Whack-a-mole",
  game_stack: "Block tower",
  game_snake: "Snake"
});
Object.assign(I18N.tr, {
  play_btn: "Oyna",
  games_title: "Oyunlar",
  games_pick: "Bir oyun seç",
  games_none: "Oyun süren bitti. Yarın görüşürüz!",
  reward_earned: "{m} dakika oyun süresi kazandın! 🎮",
  game_memory: "Hafıza",
  game_mol: "Köstebek",
  game_stack: "Blok kulesi",
  game_snake: "Yılan"
});
