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
- **Niveau 1–5**, onzichtbaar voor het kind: twee keer foutloos → moeilijker,
  onder de 60% → makkelijker.

## De sommen

Gebaseerd op *Oefenen met leessommen (redactiesommen) voor groep 5* (Sietse Kuipers),
aangevuld met de onderwerpen die CITO en DIA toetsen: klokkijken, geld, meten en
wegen, tabellen lezen, schatten en "welke som hoort erbij?". Het niveau ligt
bewust een tikje boven CITO/DIA, zodat de echte toets meevalt.

Sommen worden gegenereerd uit sjablonen (`js/templates.js`): elk sjabloon heeft
meerdere formuleringen en wisselende namen, voorwerpen en getallen, dus dezelfde
som komt niet twee keer voorbij. De foute antwoorden zijn typische denkfouten
(verkeerde bewerking, ±10, half uur verkeerd om), geen willekeurige getallen.

## Opzet

Statische site, geen build en geen dependencies.

| Bestand | Rol |
| --- | --- |
| `index.html` | alle schermen |
| `css/style.css` | opmaak |
| `js/templates.js` | de sommen (sjablonen per categorie) |
| `js/engine.js` | bouwt een opdracht, kiest antwoorden, vertaalt teksten |
| `js/app.js` | schermen en spelverloop |
| `js/storage.js` | voortgang lokaal + synchroniseren |
| `js/cloud.js` | Supabase-aanroepen |
| `js/config.js` | Supabase-url en anon key |
| `js/i18n.js` | teksten NL / EN / TR |
| `js/celebrate.js` | confetti en de emoji van de dag |

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
