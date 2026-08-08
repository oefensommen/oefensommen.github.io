/* Niveau.
   Eén niveau van 1 tot 5 voor alle sommen samen. De regel is hard en telbaar,
   geen gevoelskwestie:

     vijf dagen op rij alles goed      -> een niveau erbij
     vijf dagen op rij vier of meer fout -> een niveau eraf

   Omhoog en omlaag kosten even veel, en de ondergrens ligt precies waar de
   speeltijd ophoudt: vier fouten is de dag waarop geen spelletje wordt
   verdiend, en dezelfde dag telt mee voor een niveau eraf. Tussen die twee in
   — één tot drie fouten — verandert er niets: dat is gewoon een goede dag.

   Alleen de eerste afgeronde opdracht van de dag telt. Wie daarna nog een keer
   oefent verdient wel speeltijd, maar verandert de stand niet meer.

   Waarom niet per soort som: dat was het wel, en het werkte niet. Een niveau
   vroeg om zeven foutloze dagen in één categorie, terwijl de hoofdcategorie
   veertien sommen per dag levert — zelfs bij 95% per som is veertien op
   veertien maar de helft van de keren raak, en zeven van die dagen achter
   elkaar gebeurt zo goed als nooit. In een schooljaar van 180 dagen kwam
   alleen klokkijken (twee sommen per dag) ooit een niveau verder. */

/* De dagknop per soort som — de schokdemper van de dag.

   Elke soort begint de ochtend op 5. Een fout zet hem één lager, twee goede
   antwoorden op rij in die soort zetten hem één hoger. Onder de 5 worden de
   sommen van die soort kleiner — desnoods tot onder niveau 1, in de twee
   stille comfortbanden — zodat een kind dat net gestruikeld is meteen weer
   sommen krijgt die het kán. Niets hiervan is te zien; de sommen worden
   gewoon vriendelijker, en weer gewoon als het weer loopt.

   's Nachts wordt alles weer 5: gisteren blijft niet plakken. De stand reist
   met het record mee, dus wisselen van apparaat verandert er niets aan.
   Het niveau van de lange termijn (vijf foutloze dagen) staat hier los van:
   de knop dempt de dag, het niveau meet de maand. */
const Dial = {
  MAX: 5,
  RUN_NEEDED: 2,            // twee goede op rij om een stap terug omhoog te gaan

  ensure(data) {
    if (!data.dial || data.dial.date !== todayStr()) {
      data.dial = { date: todayStr(), lvl: {}, run: {} };
    }
    return data.dial;
  },

  of(data, cat) {
    const d = this.ensure(data);
    return typeof d.lvl[cat] === "number" ? d.lvl[cat] : this.MAX;
  },

  wrong(data, cat) {
    const d = this.ensure(data);
    d.lvl[cat] = Math.max(1, this.of(data, cat) - 1);
    d.run[cat] = 0;
  },

  right(data, cat) {
    const d = this.ensure(data);
    d.run[cat] = (d.run[cat] || 0) + 1;
    if (d.run[cat] >= this.RUN_NEEDED && this.of(data, cat) < this.MAX) {
      d.lvl[cat] = this.of(data, cat) + 1;
      d.run[cat] = 0;
    }
  },

  /* The level the generators actually see: the child's own niveau, pulled
     down one step for every notch the dial is under 5. May go to -1 — the
     comfort bands with genuinely smaller numbers. */
  eff(data, cat) {
    const down = this.MAX - this.of(data, cat);
    return Math.max(-1, Math.min(5, Levels.of(data) - down));
  }
};

const Levels = {
  MAX: 5,
  DAYS_NEEDED: 5,          // evenveel dagen omhoog als omlaag
  DROP_BELOW: 0.85,        // dezelfde grens als de speeltijd: vanaf vier fout

  ensure(data) {
    if (typeof data.level !== "number") data.level = 1;
    if (typeof data.streak !== "number") data.streak = 0;   // dagen op rij foutloos
    if (typeof data.bad !== "number") data.bad = 0;         // dagen op rij onder de grens
    if (typeof data.levelDay !== "string") data.levelDay = "";

    /* Een oudere versie hield een niveau per categorie bij. Neem het gemiddelde
       daarvan als startpunt, zodat een kind dat al vooruit was niet terugvalt. */
    if (data.catLevel && !data.levelMerged) {
      const vals = Object.keys(data.catLevel)
        .map(k => data.catLevel[k])
        .filter(v => typeof v === "number");
      if (vals.length) {
        const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
        data.level = Math.max(data.level, Math.min(this.MAX, Math.max(1, avg)));
      }
      data.levelMerged = true;
    }
    return data;
  },

  /* Eén niveau voor alle sommen; de categorie doet er niet meer toe. */
  of(data) {
    if (!data) return 1;
    this.ensure(data);
    return data.level;
  },

  /* Wat de gebruiker ziet: het niveau en hoeveel foutloze dagen er nog te gaan
     zijn naar het volgende. */
  overall(data) {
    this.ensure(data);
    return {
      level: data.level,
      toGo: data.level >= this.MAX ? 0 : Math.max(0, this.DAYS_NEEDED - data.streak),
      streak: data.streak
    };
  },

  /* Boek één afgeronde opdracht. `score` is {correct, total} van de eerste
     poging. Geeft het nieuwe niveau terug als het omhoog ging, anders null. */
  record(data, score) {
    this.ensure(data);
    if (!score || !score.total) return null;
    if (data.levelDay === todayStr()) return null;   // de eerste opdracht telt
    data.levelDay = todayStr();

    if (score.correct === score.total) {             // een foutloze dag
      data.bad = 0;
      data.streak++;
      if (data.streak >= this.DAYS_NEEDED && data.level < this.MAX) {
        data.level++;
        data.streak = 0;
        return data.level;
      }
    } else if (score.correct / score.total < this.DROP_BELOW) {   // vier of meer fout
      data.streak = 0;
      data.bad++;
      if (data.bad >= this.DAYS_NEEDED && data.level > 1) {
        data.level--;
        data.bad = 0;
      }
    } else {                                          // een tot drie fout
      data.streak = 0;
      data.bad = 0;
    }
    return null;
  }
};
