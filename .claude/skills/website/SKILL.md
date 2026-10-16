---
name: website
description: Baut auf Zuruf eine Demo-Website mit digitaler Speisekarte und drei Design-Entwürfen für einen genannten Gastro-Betrieb (Restaurant, Imbiss, Café, Bar …). Verwenden, wenn jemand einen Laden nennt und eine Website, Demo oder Speisekarte dafür haben möchte, z. B. "/website Pizzeria Roma" oder "bau mal was für das Café am Markt".
argument-hint: "<Ladenname> [Ort / Adresse / Hinweise]"
---

# Website auf Zuruf

Auftrag: **$ARGUMENTS**

Fehlt der Ort, nimm `stadt` aus `daten/config.json` (Osnabrück). Lies zuerst `CLAUDE.md` – dort stehen
Grundregeln, Aufbau der Laden-Datei und die Design-Regeln. Antworte auf Deutsch.

## 1. Stand holen und prüfen

```bash
git pull
python3 fabrik/fabrik.py pruefen "<Name>"
```

- Status `kunde`: sag Bescheid und frag, ob die bestehende Seite überarbeitet werden soll.
- Schon eine Demo vorhanden: bestehende Laden-Datei aktualisieren statt neu anlegen.
- Mehrere Läden mit diesem Namen in der Stadt: den passendsten nehmen (Hinweise im Auftrag beachten) und im Ergebnis nennen.

## 2. Recherche (Websuche)

Suche mit mehreren Anfragen, z. B. `"<Name>" <Ort>`, `"<Name>" <Ort> Speisekarte`, `"<Name>" <Ort> Lieferando`,
`"<Name>" <Ort> Öffnungszeiten`, `"<Name>" <Ort> Instagram`. Sammle mit Quellen:

- Adresse, Telefon, Öffnungszeiten, Küche, Spezialitäten, Services (Lieferung, Mittagstisch, Außenbereich …)
- Speisekarte mit Preisen (Lieferando, Wolt, Uber Eats, speisekarte.de, speisekarte.menu sind gute Quellen)
- **Für das Design:** Einrichtung/Atmosphäre, Publikum, Lage, was Bewertungen loben, Logo-/Markenfarben, falls erwähnt
- Hat der Laden schon eine eigene Website? Dann trotzdem bauen und in `akquise.grund` als Redesign-Chance festhalten
  (was der neuen Seite fehlt: Handy-Ansicht, Online-Karte, Öffnungszeiten …)

Findest du den Laden gar nicht, frag nach (Adresse? Schreibweise?) statt zu raten.

## 3. Design-Ideen entwickeln

`python3 fabrik/fabrik.py katalog` ansehen und **drei** Entwürfe nach den Design-Regeln in `CLAUDE.md` festlegen:
Favorit, Kontrast, Praktisch. Jede `idee` nennt konkrete Fakten aus der Recherche.

## 4. Laden-Datei schreiben und bauen

```bash
python3 fabrik/fabrik.py neu "<Name>" --ort "<Ort>"     # nur wenn es noch keine Datei gibt
# daten/laeden/<slug>.json vollständig ausfüllen (alle TODO ersetzen, herkunft: "auftrag")
python3 fabrik/fabrik.py bauen <slug>
node fabrik/screenshot.mjs <slug>
```

Screenshots ansehen und Probleme beheben (siehe CLAUDE.md, "Prüfen und abliefern").

## 5. Speichern und abliefern

```bash
git add daten demos fabrik
git commit -m "Website: <Name> (<slug>)"
git push
```

Dann mit `SendUserFile` schicken (`screenshots/<slug>-entwuerfe.png`, `screenshots/<slug>-1-mobil.png`,
`demos/<slug>/index.html`) und kurz zusammenfassen:

```
**<Name>** – <Kategorie>, <Adresse>
Entwürfe: 1) <Titel> – <Idee in einem Satz> · 2) … · 3) …
Live: <demo_basis_url>/<slug>/entwuerfe/ (falls eingerichtet)
Echt vs. Platzhalter: <Speisekarte / Zeiten / Telefon>
Gesprächseinstieg: <1–2 Sätze>
```

Wünsche zum Design ("Entwurf 2, aber heller", "andere Farbe") direkt in der Laden-Datei umsetzen, neu bauen, neu schicken.
