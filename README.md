# Oefensommen

Dagelijkse rekenoefening (leessommen / redactiesommen) voor groep 5.

Een kind doet elke dag één opdracht van 20 sommen, verbetert daarna zijn fouten
tot alles goed is, en ziet de voortgang terug op een kalender. De voortgang
staat in de cloud, dus telefoon, tablet en laptop gaan verder waar de vorige
stopte.

**Live:** https://oefensommen.github.io

## Wat het is

- **Eén som per scherm**, vier antwoorden, geen tijdsdruk (de tijd wordt wel stil gemeten).
- **20 sommen per dag**; fout of overgeslagen sommen komen terug in een verbeterronde
  tot alles goed is — het goede antwoord wordt nooit voorgezegd.
- **Kalender + overzicht**: groen vakje bij 100%, streak, en per soort som hoe het gaat.
- **Vlaggen NL / EN / TR**: Nederlands is de basis, Engels en Turks zijn er alleen
  om een som te begrijpen. De app start altijd in het Nederlands.
- **Niveau 1–5 per soort som**, te zien in de balk bovenaan: zeven dagen op rij
  foutloos in een onderdeel → dat onderdeel wordt een stapje moeilijker, onder
  de 60% → een stapje makkelijker. Goed zijn in tafels maakt de klok dus niet
  zwaarder. Een tweede foutloze opdracht op dezelfde dag telt niet mee: zeven
  dagen moet ook echt zeven dagen zijn.
- **Speeltijd als beloning**: een afgeronde dag levert minuten op voor een
  spelletje in de app zelf — reclamevrij, want de spelletjes staan in deze repo.

## De sommen

Gebaseerd op *Oefenen met leessommen (redactiesommen) voor groep 5* (Sietse Kuipers),
aangevuld met de onderwerpen die CITO en DIA toetsen: klokkijken, geld, meten en
wegen, tabellen lezen, schatten en "welke som hoort erbij?". Het niveau ligt
bewust een tikje boven CITO/DIA, zodat de echte toets meevalt.

Sommen worden gegenereerd uit sjablonen (`js/templates.js`): elk sjabloon heeft
meerdere formuleringen en wisselende namen, voorwerpen en getallen, dus dezelfde
som komt niet twee keer voorbij. De foute antwoorden zijn typische denkfouten
(verkeerde bewerking, ±10, half uur verkeerd om), geen willekeurige getallen.

## Speeltijd

Wie de dag afmaakt, verdient speeltijd. Hoeveel hangt af van het cijfer van de
eerste poging:

| Eerste poging | Speeltijd |
| --- | --- |
| alles goed (20 uit 20) | 15 minuten |
| al het andere | 5 minuten |

De fouten moeten nog steeds allemaal verbeterd worden voordat de dag afgerond
is; het cijfer bepaalt alleen hoeveel tijd het oplevert.

Eén beloning per dag: een tweede opdracht op dezelfde dag mag, maar levert geen
extra tijd op. Wat niet opgemaakt is, vervalt om middernacht.

Het spelletje draait in een eigen pagina in de witte kaart (`<iframe>`), dus het
kan niet bij de sommen of de voortgang. De klok loopt in de app, niet in het
spel, en wordt elke tien seconden weggeschreven: een dichtgeklapte tablet levert
geen gratis minuten op. De verbruikte tijd staat in het dagrecord en gaat mee
met de synchronisatie, dus op de tablet gespeelde minuten zijn ook op de laptop
op.

De spelletjes zijn zelfgeschreven en staan in `games/`: geheugenspel, mollen
meppen, blokkentoren en slang. Allemaal met de vinger te spelen — dat is de
reden dat het geen bestaande spelletjessite is geworden: die weigeren een
`<iframe>` (Poki, CrazyGames, ABCya) of staan vol reclame, en de Scratch-
spelletjes die je wél mag insluiten werken bijna allemaal alleen met pijltjes-
toetsen.

## Opzet

Statische site, geen build en geen dependencies.

| Bestand | Rol |
| --- | --- |
| `index.html` | alle schermen |
| `css/style.css` | opmaak |
| `css/games.css` | opmaak van het spelgedeelte |
| `js/templates.js` | de sommen (sjablonen per categorie) |
| `js/levels.js` | niveau per soort som (regels, teller, het getal op het scherm) |
| `js/engine.js` | bouwt een opdracht, kiest antwoorden, vertaalt teksten |
| `js/app.js` | schermen en spelverloop |
| `js/storage.js` | voortgang lokaal + synchroniseren |
| `js/cloud.js` | Supabase-aanroepen |
| `js/config.js` | Supabase-url en anon key |
| `js/i18n.js` | teksten NL / EN / TR |
| `js/celebrate.js` | confetti en de emoji van de dag |
| `js/reward.js` | verdiende speeltijd (regels, teller, teksten) |
| `games/` | de spelletjes zelf, elk een eigen pagina |

## Zelf draaien

```bash
python3 -m http.server 3006
```

Daarna http://localhost:3006. Zonder ingevulde `js/config.js` werkt alles lokaal
(zonder synchroniseren); het wachtwoord is dan `2026`.

## Supabase

Voer `supabase-setup.sql` één keer uit in de SQL Editor van het Supabase-project
en zet daarna de project-url en de anon key in `js/config.js`.

De anon key hoort in de broncode te staan — die is publiek. De beveiliging zit in
de database: op de tabel staat RLS aan zonder policies, dus de sleutel komt er
niet bij. Alleen de twee functies uit het sql-bestand kunnen erbij, en die
controleren eerst het wachtwoord (bcrypt). Het wachtwoord staat dus nergens in
de website. Wel eerlijk vermelden: een kort wachtwoord blijft te raden — voor
oefenscores is dat een prima afweging.

## Publiceren

De site staat op GitHub Pages vanaf de `main`-branch. Elke push is meteen live.
