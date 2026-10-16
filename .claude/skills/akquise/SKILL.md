---
name: akquise
description: Tägliche Akquise – sucht selbstständig einen Gastro-Betrieb in Osnabrück ohne eigene Website, der noch nicht in unserer Liste steht, und baut ihm eine Demo-Website mit drei Design-Entwürfen. Wird jeden Morgen von der geplanten Aufgabe gestartet; auch manuell mit "/akquise" nutzbar.
---

# Tägliche Akquise: ein neuer Lead pro Tag

Ziel: **genau einen** Gastro-Betrieb in Osnabrück finden, der noch keine eigene Website hat, und für ihn eine
Demo mit drei Design-Entwürfen bauen. Lies zuerst `CLAUDE.md` (Grundregeln, Laden-Datei, Design-Regeln).
Antworte auf Deutsch. Findest du nach ernsthafter Suche keinen passenden Laden, melde ehrlich, was du geprüft hast,
und baue keine Demo für einen unpassenden.

## 1. Stand holen

```bash
git pull
python3 fabrik/fabrik.py liste      # alles hier ist tabu
cat daten/config.json
```

## 2. Kandidaten suchen (Websuche)

**Immer zuerst Neueröffnungen** – das sind die besten Leads:
`Osnabrück Neueröffnung Restaurant/Café/Imbiss <Monat> <Jahr>`, `site:neueroeffnung.info osnabrueck`,
`site:hasepost.de eröffnet`, `site:osradio.de eröffnet`, `noz.de neu eröffnet Osnabrück`.

Danach Schwerpunkt nach Wochentag, damit sich die Suche abwechselt:

| Tag | Schwerpunkt | Beispiel-Suchen |
|---|---|---|
| Mo | Döner / Imbiss | `Osnabrück Imbiss <PLZ>`, Lieferando/Wolt-Listen nach PLZ |
| Di | Cafés, Bäckerei-Cafés, Eiscafés | `Café Osnabrück <Stadtteil>` |
| Mi | Restaurants (italienisch, griechisch, türkisch, deutsch) | `griechisches Restaurant Osnabrück` |
| Do | Asiatisch (vietnamesisch, chinesisch, Sushi, Thai) | `Sushi Osnabrück Lieferando` |
| Fr | Pizzeria, Burger, Streetfood | `Pizzeria Osnabrück <PLZ> Speisekarte` |
| Sa | Bars, Kneipen, Shisha-Bars | `Kneipe Osnabrück <Stadtteil>` |
| So | Stadtteile | Schinkel, Eversburg, Haste, Dodesheide, Sonnenhügel, Wüste, Kalkhügel, Sutthausen, Voxtrup, Darum, Lüstringen, Atter, Pye, Hellern, Nahne, Gartlage, Westerberg, Fledder, Schölerberg, Innenstadt |

Gute Quellen: Lieferando/Wolt/Uber-Eats-Listen, speisekarte.de, speisekarte.menu, golocal.de, dasoertliche.de,
gelbeseiten.de, 11880.com, Restaurant Guru ("new restaurants Osnabrück").

## 3. Kandidaten prüfen

`python3 fabrik/fabrik.py pruefen "<Name>"` – bekannt → überspringen. Dann per Websuche `"<Name>" Osnabrück`:

| Befund | Entscheidung |
|---|---|
| Eigene, richtige Website mit eigenen Inhalten | ausschließen (`hat eigene Website <domain>`) |
| Nur Lieferando-/Takeaway-Bestellseite ("… – Essen online bestellen in Osnabrück") | **guter Lead** – im Briefing vermerken |
| Nur Facebook/Instagram/Branchenbuch | **guter Lead** |
| Nur eine Eröffnungsmeldung | **sehr guter Lead** |
| Kette (`config.json` → `ketten_ausschliessen`) | überspringen, nicht eintragen |
| Dauerhaft geschlossen / PLZ nicht in `config.json` → `plz` | ausschließen |

Abgelehnte **immer** eintragen, damit sie morgen nicht wieder geprüft werden:
`python3 fabrik/fabrik.py ausschliessen "<Name>" --adresse "<Straße, PLZ Ort>" --grund "<kurz>"`

Rangfolge: Neueröffnung (< 3 Monate) > gut bewertet mit vielen Bewertungen > nur Bestellseite > nur Social Media.
Höchstens ~10 Kandidaten prüfen, dann entscheiden.

## 4. Bauen und abliefern

Ab hier genau wie bei `/website` (`.claude/skills/website/SKILL.md`, Schritte 2–5), mit `"herkunft": "akquise"`
und dem Commit-Text `Demo: <Name> (<slug>)`. In der Abschlussnachricht zusätzlich:
**Warum dieser Laden** (1–2 Sätze) und **heute geprüft und aussortiert** (Namen + Grund).
