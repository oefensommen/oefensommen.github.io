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
  /* Iedere fout kost speeltijd, en de vierde kost alles wat er nog was:

       0 fout  15 min      2 fout  6 min
       1 fout   8 min      3 fout  4 min      4 of meer  niets

     Zo levert elke som die goed gaat iets op, in plaats van alleen de
     foutloze dag. Vier fouten is ook precies de dag die meetelt voor een
     makkelijker niveau: wie geen speeltijd meer haalt, krijgt makkelijker
     sommen — de twee grenzen liggen op dezelfde plek. */
  MINUTES: [15, 8, 6, 4],

  minutesForScore(correct, total) {
    if (!total) return 0;
    const wrong = Math.max(0, total - correct);
    return wrong < this.MINUTES.length ? this.MINUTES[wrong] : 0;
  },

  _today(data) {
    return (data && data.days && data.days[todayStr()]) || null;
  },

  /* Called the moment an opdracht is finished. Every finished opdracht earns
     its own speeltijd on its own score, so a day that started badly can still
     be turned around by sitting down and doing another twenty properly. The
     minutes go into one pot for the day, which is what the games spend from.
     Returns the minutes just earned. */
  grant(data, correct, total) {
    const day = this._today(data);
    if (!day) return 0;
    const min = this.minutesForScore(correct, total);
    if (!day.reward) day.reward = { sec: 0, used: 0 };
    day.reward.sec += min * 60;
    return min;
  },

  /* The floor under a hard day: finishing the whole opdracht and going over
     every fout on the report card is worth three minutes, even when the score
     itself earned none. Facing the fouten IS the work being rewarded. */
  grantFloor(data) {
    const day = this._today(data);
    if (!day) return 0;
    if (!day.reward) day.reward = { sec: 0, used: 0 };
    day.reward.sec += 180;
    return 3;
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
