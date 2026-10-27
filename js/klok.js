/* Klokkijken — the clock with hands on it.

   The school's werkblad for this is a page of drawn clock faces with a line
   under each one: no story, no numbers, just "what time is it". Our klok
   questions until now were all stories with a time written in them, which is
   a different skill — reading a sentence, not reading a dial. So the dial
   gets drawn here, and the child reads it.

   The face is the whole question, so it is drawn rather than described: an
   hour hand that really does creep towards the next hour as the minutes pass
   (at 10 to 2 it sits just before the 2, which is exactly the thing that
   makes "10 voor 2" hard to see), sixty minute ticks, and the twelve numbers
   the worksheet prints.

   These templates carry `face: true` and a category of their own, so the
   engine never slips one into the redactiesommen. */

const Klok = {
  /* One clock, drawn. h is 1..12, m a multiple of five. */
  faceSVG(h, m, size) {
    const S = size || 220, C = S / 2, R = C - 6;
    const ang = deg => (deg - 90) * Math.PI / 180;
    const at = (deg, r) => [C + r * Math.cos(ang(deg)), C + r * Math.sin(ang(deg))];

    let ticks = "";
    for (let i = 0; i < 60; i++) {
      const big = i % 5 === 0;
      const [x1, y1] = at(i * 6, R - (big ? 13 : 7));
      const [x2, y2] = at(i * 6, R - 2);
      ticks += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
                 stroke-width="${big ? 2.4 : 1.1}"/>`;
    }
    let nums = "";
    for (let n = 1; n <= 12; n++) {
      const [x, y] = at(n * 30, R - 30);
      nums += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle"
                dominant-baseline="central" class="klok-num">${n}</text>`;
    }
    // the hour hand walks with the minutes — the whole trick of reading a clock
    const hDeg = ((h % 12) + m / 60) * 30, mDeg = m * 6;
    const [hx, hy] = at(hDeg, R * 0.52);
    const [mx, my] = at(mDeg, R * 0.80);

    return `<svg viewBox="0 0 ${S} ${S}" class="klok-face" role="img" aria-label="klok">
      <circle cx="${C}" cy="${C}" r="${R}" class="klok-rim"/>
      <g class="klok-ticks">${ticks}</g>
      ${nums}
      <line x1="${C}" y1="${C}" x2="${hx.toFixed(1)}" y2="${hy.toFixed(1)}" class="klok-hand hour"/>
      <line x1="${C}" y1="${C}" x2="${mx.toFixed(1)}" y2="${my.toFixed(1)}" class="klok-hand minute"/>
      <circle cx="${C}" cy="${C}" r="4.5" class="klok-pin"/>
    </svg>`;
  },

  /* Times that are worth asking. The round, half and quarter hours are the
     easy half of a clock; the five-minute marks around "half" are where it
     actually gets read wrong, so those come up more often. */
  pickTime(level) {
    const easy = [0, 30, 15, 45];
    const hard = [5, 10, 20, 25, 35, 40, 50, 55];
    const m = level <= 1 ? pickArr(easy)
            : (Math.random() < 0.72 ? pickArr(hard) : pickArr(easy));
    return { h: ri(1, 12), m };
  },

  /* Four readings that are all a believable misreading of this face: the
     hands swapped, the hour taken one too far, "over" read as "voor". */
  wordOptions(h, m) {
    const nxt = h % 12 + 1;
    const cands = [
      [h, (m + 5) % 60], [h, (m + 55) % 60],      // five minutes out
      [nxt, m], [h === 1 ? 12 : h - 1, m],        // the wrong hour
      [h, (60 - m) % 60],                          // "over" read as "voor"
      [h, (m + 30) % 60]
    ];
    const out = [];
    for (const [hh, mm] of cands) {
      if (out.length >= 3) break;
      if (hh === h && mm === m) continue;
      if (out.some(o => o[0] === hh && o[1] === mm)) continue;
      out.push([hh, mm]);
    }
    return out;
  }
};

/* ---------- the templates themselves ----------
   They join the ordinary bank so that everything built on it — the report
   card, the second chance, the uitleg, the kalender — works on a clock
   question exactly as it does on a som. */
TEMPLATES.push(
  {
    id: "klok-face-woord", cat: "klokkijken", face: true, school: true,
    variants: [
      { nl: "Hoe laat is het?", en: "What time is it?", tr: "Saat kaç?" }
    ],
    gen(level) {
      const { h, m } = Klok.pickTime(level);
      // spoken in the language the round is built in; the child always works
      // in Dutch, which is the language these words have to be learned in
      const say = (hh, mm) => timeWords(hh, mm, typeof LANG === "string" ? LANG : "nl");
      return {
        vars: { _h: h, _m: m },
        textCorrect: say(h, m),
        textWrongs: Klok.wordOptions(h, m).map(([hh, mm]) => say(hh, mm))
      };
    }
  },
  {
    id: "klok-face-digitaal", cat: "klokkijken", face: true, school: true,
    variants: [
      { nl: "Het is 's middags. Hoe laat is het op een digitale klok?",
        en: "It is the afternoon. What time is it on a digital clock?",
        tr: "Öğleden sonra. Dijital saatte kaç?" },
      { nl: "Het is 's ochtends. Hoe laat is het op een digitale klok?",
        en: "It is the morning. What time is it on a digital clock?",
        tr: "Sabah. Dijital saatte kaç?" }
    ],
    gen(level, v) {
      const { m } = Klok.pickTime(level);
      const h = v === 1 ? ri(7, 11) : ri(1, 6);          // morning / afternoon
      const H = v === 1 ? h : h + 12;
      const two = n => String(n).padStart(2, "0");
      const fmt = (hh, mm) => hh + ":" + two(mm);
      return {
        vars: { _h: h, _m: m },
        textCorrect: fmt(H, m),
        textWrongs: [fmt(v === 1 ? h + 1 : H + 1, m), fmt(v === 1 ? H + 12 : h, m),
                     fmt(H, (m + 30) % 60)]
      };
    }
  },
  {
    id: "klok-face-straks", cat: "klokkijken", face: true, school: true,
    variants: [
      { nl: "Hoe laat is het over {n} minuten?", en: "What time is it in {n} minutes?",
        tr: "{n} dakika sonra saat kaç olur?" },
      { nl: "Hoe laat was het {n} minuten geleden?", en: "What time was it {n} minutes ago?",
        tr: "{n} dakika önce saat kaçtı?" }
    ],
    gen(level, v) {
      const { h, m } = Klok.pickTime(level);
      const step = level <= 1 ? pickArr([15, 30]) : pickArr([20, 25, 35, 40, 45, 50]);
      const sign = v === 1 ? -1 : 1;
      let tot = ((h % 12) * 60 + m + sign * step + 720) % 720;
      const H = Math.floor(tot / 60) || 12, M = tot % 60;
      const say = (hh, mm) => timeWords(hh, mm, typeof LANG === "string" ? LANG : "nl");
      const miss = [[h, m], [H % 12 + 1, M], [H, (M + 5) % 60]];
      return {
        vars: { _h: h, _m: m, n: step },
        textCorrect: say(H, M),
        textWrongs: miss.filter(([hh, mm]) => !(hh === H && mm === M))
                        .map(([hh, mm]) => say(hh, mm))
      };
    }
  }
);

Object.assign(EXPLAIN, {
  "klok-face-woord": {
    nl: "De korte wijzer zegt het uur, de lange de minuten. Kijk eerst waar de korte wijzer net vandaan komt — dát is het uur. Hier is het {klok}.",
    en: "The short hand gives the hour, the long one the minutes. Look at which hour the short hand has just passed — that is the hour. Here it is {klok}.",
    tr: "Kısa ibre saati, uzun ibre dakikayı söyler. Kısa ibrenin hangi sayıyı yeni geçtiğine bak — saat odur. Burada {klok}."
  },
  "klok-face-digitaal": {
    nl: "Lees eerst de wijzers: het is {klok}. 's Middags tel je er 12 uur bij op, 's ochtends niet. Zo kom je op {ans}.",
    en: "Read the hands first: it is {klok}. In the afternoon you add 12 hours, in the morning you do not. That gives {ans}.",
    tr: "Önce ibreleri oku: saat {klok}. Öğleden sonra 12 saat eklersin, sabah eklemezsin. Böylece {ans} olur."
  },
  "klok-face-straks": {
    nl: "De klok staat op {klok}. Spring eerst met hele kwartieren of halve uren en dan de rest van de {n} minuten — zo kom je op {ans}.",
    en: "The clock says {klok}. Jump in quarters or half hours first and then the rest of the {n} minutes — that brings you to {ans}.",
    tr: "Saat {klok}. Önce çeyrek ya da yarım saatlik sıçra, sonra {n} dakikanın kalanını ekle — böylece {ans} olur."
  }
});

Object.assign(HINTS, {
  "klok-face-woord": {
    nl: "Twee wijzers, twee dingen. De lange wijzer telt de minuten vanaf de 12; zit hij voorbij de 6, dan zeg je het als 'voor' het volgende uur.",
    en: "Two hands, two things. The long hand counts minutes from the 12; once it is past the 6 you say it as 'to' the next hour.",
    tr: "İki ibre, iki bilgi. Uzun ibre dakikayı 12'den itibaren sayar; 6'yı geçtiyse bir sonraki saate 'kala' dersin."
  },
  "klok-face-digitaal": {
    nl: "Een digitale klok telt door tot 24. Kijk dus eerst hoe laat het is, en bedenk daarna of er 12 uur bij moet.",
    en: "A digital clock counts on to 24. So read the time first, then work out whether 12 hours have to be added.",
    tr: "Dijital saat 24'e kadar sayar. Önce saati oku, sonra 12 eklenmesi gerekip gerekmediğine karar ver."
  },
  "klok-face-straks": {
    nl: "Niet in één sprong. Ga eerst naar het volgende hele of halve uur en kijk hoeveel minuten je dan nog over hebt.",
    en: "Not in one jump. Go to the next whole or half hour first, then see how many minutes are left over.",
    tr: "Tek hamlede değil. Önce bir sonraki tam ya da buçuk saate git, sonra kaç dakika kaldığına bak."
  }
});
