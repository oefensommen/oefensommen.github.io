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
  /* `compact` draws the same clock for a small space: only 12, 3, 6 and 9, and
     ticks without the minute hairlines. At answer size the full twelve numbers
     collide into each other and stop being readable, which defeats the point
     of asking a child to read a dial. */
  faceSVG(h, m, size, compact) {
    const S = size || 220, C = S / 2, R = C - 6;
    const ang = deg => (deg - 90) * Math.PI / 180;
    const at = (deg, r) => [C + r * Math.cos(ang(deg)), C + r * Math.sin(ang(deg))];

    let ticks = "";
    for (let i = 0; i < 60; i++) {
      const big = i % 5 === 0;
      if (compact && !big) continue;
      const [x1, y1] = at(i * 6, R - (big ? 13 : 7));
      const [x2, y2] = at(i * 6, R - 2);
      ticks += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
                 stroke-width="${big ? 2.4 : 1.1}"/>`;
    }
    let nums = "";
    for (let n = 1; n <= 12; n++) {
      if (compact && n % 3 !== 0) continue;
      const [x, y] = at(n * 30, R - 30);
      nums += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle"
                dominant-baseline="central" class="klok-num">${n}</text>`;
    }
    // the hour hand walks with the minutes — the whole trick of reading a clock
    const hDeg = ((h % 12) + m / 60) * 30, mDeg = m * 6;
    const [hx, hy] = at(hDeg, R * 0.52);
    const [mx, my] = at(mDeg, R * 0.80);

    // a size given here wins over the stylesheet, so the same dial can be the
    // whole question or one of four answers without a second rule anywhere
    const fit = size ? ` style="width:${S}px;height:${S}px;display:block;margin:0 auto"` : "";
    return `<svg viewBox="0 0 ${S} ${S}" class="klok-face" role="img" aria-label="klok"${fit}>
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

  /* Two dials side by side with an arrow between them: from this time, to
     that one. Used by the duration question, where the span between them IS
     the question. */
  facePairSVG(h1, m1, h2, m2, size) {
    const S = size || 132;
    return `<div class="klok-pair" style="display:flex;align-items:center;justify-content:center;gap:10px">
              ${this.faceSVG(h1, m1, S)}
              <span style="font-size:1.4rem;color:var(--muted)" aria-hidden="true">→</span>
              ${this.faceSVG(h2, m2, S)}
            </div>`;
  },

  /* A time as an option string: "4:30". The renderer draws it; the mirror and
     the report card fall back to reading it, which is still a time. */
  key(h, m) { return h + ":" + String(m).padStart(2, "0"); },

  /* The dials a child actually confuses with this one.

     The first is the one that only a drawn clock can ask about: the hands
     read the wrong way round. At ten to three the long hand points at the 10
     and the short one just before the 3 — a child who reads the long hand as
     the hour sees ten past two. That dial is the distractor. */
  faceWrongs(h, m) {
    const nxt = h % 12 + 1, prv = h === 1 ? 12 : h - 1;
    const swapH = (m / 5) % 12 || 12, swapM = (h % 12) * 5;
    const cands = [
      [swapH, swapM],              // the hands read the wrong way round
      [h, (60 - m) % 60],          // "over" read as "voor"
      [nxt, m], [prv, m],          // an hour too far, an hour short
      [h, (m + 5) % 60], [h, (m + 55) % 60],
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
    /* The reverse direction. Reading a dial and picturing one are two
       skills, and only the second one catches the child who reads the long
       hand as the hour: here that misreading is a dial of its own, sitting
       next to the right one. */
    id: "klok-face-kies", cat: "klokkijken", face: true, faceOptions: true,
    variants: [
      { nl: "Welke klok staat op {tijd}?", en: "Which clock says {tijd}?",
        tr: "Hangi saat {tijd} gösteriyor?" },
      { nl: "De trein vertrekt om {tijd}. Welke klok hoort erbij?",
        en: "The train leaves at {tijd}. Which clock goes with it?",
        tr: "Tren {tijd} kalkıyor. Hangi saat buna uyar?" }
    ],
    gen(level) {
      const { h, m } = Klok.pickTime(level);
      return {
        vars: { _qh: h, _qm: m },
        textCorrect: Klok.key(h, m),
        textWrongs: Klok.faceWrongs(h, m).map(([hh, mm]) => Klok.key(hh, mm))
      };
    }
  },
  {
    /* Half vijf is half an hour BEFORE five, and every Dutch child gets it
       wrong at least once. So it is asked on purpose, from both sides: the
       dial that belongs to the words, and the words that belong to the dial.
       The trap — the hour the words name — is always one of the four. */
    id: "klok-face-half", cat: "klokkijken", face: true, faceOptions: true, school: true,
    variants: [
      { nl: "Welke klok staat op {tijd}?", en: "Which clock says {tijd}?",
        tr: "Hangi saat {tijd} gösteriyor?" }
    ],
    gen(level) {
      const h = ri(1, 12), nxt = h % 12 + 1;
      // half past, quarter to, and five past half: the three phrasings that
      // name an hour the hands are not pointing at
      const m = level <= 1 ? 30 : pickArr([30, 30, 45, 35]);
      const trap = m === 45 ? [nxt, 45] : [nxt, m];      // the hour the words say
      const wrongs = [trap, [h, 0], [nxt, 0], [h, (m + 30) % 60]];
      const seen = new Set([Klok.key(h, m)]);
      const out = [];
      for (const [hh, mm] of wrongs) {
        const k = Klok.key(hh, mm);
        if (out.length >= 3 || seen.has(k)) continue;
        seen.add(k); out.push(k);
      }
      return { vars: { _qh: h, _qm: m, uur: h, valkuil: trap[0] },
               textCorrect: Klok.key(h, m), textWrongs: out };
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
  },
  {
    /* Two dials and the span between them. Not "what time will it be" — the
       time is given twice and the question is how far apart they are, which
       is the one a timetable actually asks. */
    id: "klok-face-duur", cat: "klokkijken", face: true,
    variants: [
      { nl: "De film begint bij de eerste klok en is afgelopen bij de tweede. Hoe lang duurt de film?",
        en: "The film starts at the first clock and ends at the second. How long does the film last?",
        tr: "Film birinci saatte başlıyor, ikincide bitiyor. Film ne kadar sürüyor?" },
      { nl: "{name} begint met huiswerk bij de eerste klok en stopt bij de tweede. Hoe lang heeft {hij} gewerkt?",
        en: "{name} starts homework at the first clock and stops at the second. How long did {he} work?",
        tr: "{name} ödeve birinci saatte başlıyor, ikincide bırakıyor. Ne kadar çalışmış?" }
    ],
    gen(level) {
      const { h, m } = Klok.pickTime(level);
      const span = level <= 1 ? pickArr([15, 30, 45]) : pickArr([25, 35, 40, 50, 55, 65, 70, 85]);
      const tot = ((h % 12) * 60 + m + span) % 720;
      const h2 = Math.floor(tot / 60) || 12, m2 = tot % 60;
      const L = typeof LANG === "string" ? LANG : "nl";
      const W = { nl: ["uur", "min", "en"], en: ["h", "min", "and"], tr: ["saat", "dk", "ve"] }[L]
             || ["uur", "min", "en"];
      const mins = n => n >= 60
        ? (n % 60 === 0 ? `${n / 60} ${W[0]}` : `${Math.floor(n / 60)} ${W[0]} ${W[2]} ${n % 60} ${W[1]}`)
        : `${n} ${W[1]}`;
      // the mistakes: counting only the hands' difference, the hour forgotten,
      // five minutes out on the far side
      const wrongs = [span + 60, Math.abs(span - 60) || 5, span + 5, span - 5]
        .filter(w => w > 0 && w !== span);
      return {
        vars: { _h: h, _m: m, _h2: h2, _m2: m2, span },
        textCorrect: mins(span),
        textWrongs: [...new Set(wrongs)].slice(0, 3).map(mins)
      };
    }
  },
  {
    /* A dial and a row of departure times: not reading one clock but holding
       it against three others. The trap is the time that has just gone. */
    id: "klok-face-rooster", cat: "klokkijken", face: true,
    variants: [
      { nl: "Het is nu zo laat. De bus vertrekt om {a}, {b}, {c} en {d}. Welke bus kan {name} nog halen?",
        en: "This is the time now. The bus leaves at {a}, {b}, {c} and {d}. Which bus can {name} still catch?",
        tr: "Şu an saat bu. Otobüs {a}, {b}, {c} ve {d} kalkıyor. {name} hangisine yetişebilir?" },
      { nl: "Dit is de tijd op de klok. De film begint om {a}, {b}, {c} of {d}. Naar welke voorstelling kan {name} nog?",
        en: "This is the time on the clock. The film starts at {a}, {b}, {c} or {d}. Which showing can {name} still make?",
        tr: "Saat bunu gösteriyor. Film {a}, {b}, {c} ya da {d} başlıyor. {name} hangi seansa yetişir?" }
    ],
    gen(level) {
      const { h, m } = Klok.pickTime(level);
      const base = (h % 12) * 60 + m;
      const gap = level <= 1 ? 15 : pickArr([10, 15, 20]);
      const two = n => String(n).padStart(2, "0");
      const fmt = tot => { const t = ((tot % 720) + 720) % 720;
                           return (Math.floor(t / 60) || 12) + ":" + two(t % 60); };
      // one bus just gone and three still to come — and the four on the board
      // are exactly the four to choose from, so nothing is offered that is
      // not on the timetable
      const times = [base - gap, base + gap, base + 2 * gap, base + 3 * gap].map(fmt);
      return {
        vars: { _h: h, _m: m, a: times[0], b: times[1], c: times[2], d: times[3] },
        textCorrect: times[1],                       // the first one still to come
        textWrongs: [times[0], times[2], times[3]]   // the one just missed, and later ones
      };
    }
  }
);

Object.assign(EXPLAIN, {
  "klok-face-kies": {
    nl: "Zoek eerst de lange wijzer: die moet op de minuten van {tijd} staan. Pas daarna de korte, en let op dat die al een stukje voorbij het uur is gekropen.",
    en: "Find the long hand first: it has to be on the minutes of {tijd}. Only then the short one, and mind that it has already crept past the hour.",
    tr: "Önce uzun ibreyi bul: {tijd} dakikasında olmalı. Sonra kısa ibreye bak — o saati biraz geçmiş olur."
  },
  "klok-face-half": {
    nl: "{tijd} is een half uur VÓÓR {valkuil} uur, dus de korte wijzer staat nog bij de {uur} en de lange op de 6. De klok bij {valkuil} uur is de valkuil.",
    en: "{tijd} is half an hour BEFORE {valkuil} o'clock, so the short hand is still at the {uur} and the long one at the 6. The clock at {valkuil} is the trap.",
    tr: "{tijd}, saat {valkuil}'den yarım saat ÖNCEdir: kısa ibre hâlâ {uur} civarında, uzun ibre 6'da. {valkuil} gösteren saat tuzaktır."
  },
  "klok-face-duur": {
    nl: "Van de eerste klok naar de tweede: tel eerst naar het volgende hele uur en dan verder. Dat is {span} minuten, dus {ans}.",
    en: "From the first clock to the second: count to the next full hour first, then on. That is {span} minutes, so {ans}.",
    tr: "Birinci saatten ikinciye: önce bir sonraki tam saate say, sonra devam et. Bu {span} dakika eder, yani {ans}."
  },
  "klok-face-rooster": {
    nl: "De klok zegt hoe laat het nú is. De bus van {a} is al weg — die kun je niet meer halen. De eerste tijd die nog moet komen is {ans}.",
    en: "The clock says what time it is NOW. The {a} bus has gone — that one cannot be caught. The first time still to come is {ans}.",
    tr: "Saat şu anı gösteriyor. {a} otobüsü gitti — ona yetişilmez. Gelecek ilk saat {ans}."
  },
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
  "klok-face-kies": {
    nl: "Twee wijzers, en ze lijken op elkaar. Kijk naar de lengte: de lange telt de minuten. Eén van deze klokken heeft de wijzers precies omgewisseld.",
    en: "Two hands, and they look alike. Look at the length: the long one counts the minutes. One of these clocks has the hands the wrong way round.",
    tr: "İki ibre var ve birbirine benziyor. Uzunluğa bak: uzun olan dakikayı sayar. Bu saatlerden birinde ibreler ters takılmış."
  },
  "klok-face-half": {
    nl: "Let op: bij 'half' en 'kwart voor' noem je het uur dat nog moet komen, maar de korte wijzer staat nog bij het uur ervóór.",
    en: "Careful: with 'half' and 'quarter to' you name the hour still to come, while the short hand is still at the hour before it.",
    tr: "Dikkat: 'buçuk' ve 'çeyrek kala' derken söylediğin saat henüz gelmemiştir; kısa ibre bir önceki saatin yanındadır."
  },
  "klok-face-duur": {
    nl: "Je zoekt het verschil tussen twee tijden, niet een nieuwe tijd. Ga van de eerste klok in stappen naar de tweede en tel de minuten onderweg op.",
    en: "You want the difference between two times, not a new time. Step from the first clock to the second and add up the minutes on the way.",
    tr: "Yeni bir saat değil, iki saat arasındaki farkı arıyorsun. Birinciden ikinciye adım adım git ve dakikaları topla."
  },
  "klok-face-rooster": {
    nl: "Eerst lezen hoe laat het is, dan pas de lijst. Een tijd die al voorbij is telt niet mee, ook al staat hij er het dichtst bij.",
    en: "Read the time first, the list second. A time that has already gone does not count, even if it is the closest one there.",
    tr: "Önce saati oku, sonra listeye bak. Geçmiş bir saat sayılmaz — listede en yakın duran o olsa bile."
  },
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
