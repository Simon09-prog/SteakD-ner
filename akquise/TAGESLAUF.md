# Tagesablauf: eine neue Demo-Website pro Tag

Diese Anleitung wird jeden Morgen automatisch von Claude ausgeführt (geplante Aufgabe).
Ziel: **einen** Gastro-Betrieb in Osnabrück finden, der noch keine eigene Website hat,
für ihn eine Demo-Website bauen und das Ergebnis ans Team schicken. Das Team stellt die Demo
dem Laden dann persönlich vor.

Arbeite die Schritte der Reihe nach ab. Antworte auf Deutsch.

---

## Grundregeln (immer)

1. **Niemals den Betrieb selbst kontaktieren.** Keine E-Mails, Anrufe, Nachrichten oder Kontaktformulare.
   Werbe-E-Mails ohne Einwilligung sind in Deutschland unzulässig (§ 7 UWG). Die Ansprache macht das Team persönlich.
2. **Nichts erfinden.** Telefonnummer, Hausnummer, Öffnungszeiten, Inhaber-Namen, Gründungsjahr,
   Auszeichnungen, Bewertungen, "Familienbetrieb", "hausgemacht", "seit 19xx" – nur wenn eine Quelle es belegt.
   Unbekannt → Feld auf `null` lassen bzw. weglassen; die Vorlage kommt damit klar.
3. **Keine fremden Fotos** (Google Maps, Instagram, Lieferando usw. sind urheberrechtlich geschützt). `hero_bild` leer lassen.
4. **Keine Namen von Personen** auf der Website.
5. Die Demo ist als Entwurf gekennzeichnet und `noindex` – daran nichts ändern.
6. Pro Tag **genau ein** Lead. Findest du nach ernsthafter Suche keinen passenden, melde das ehrlich
   (was du geprüft hast) und baue keine Demo für einen unpassenden Laden.

---

## Schritt 0 – Arbeitsstand holen

```bash
git fetch origin akquise && git checkout akquise && git pull origin akquise
python3 akquise/akquise.py liste
cat akquise/config.json
```

Alles in `liste` ist tabu (Kunden, schon gebaute Demos, ausgeschlossene Läden).

## Schritt 1 – Kandidaten suchen

Nutze die Websuche (WebSearch). Fang **immer** mit Neueröffnungen an – das sind die besten Leads:

- `Osnabrück Neueröffnung Restaurant/Café/Imbiss <Monat> <Jahr>`
- `site:neueroeffnung.info osnabrueck`, `site:hasepost.de eröffnet`, `site:osradio.de eröffnet`, `noz.de neu eröffnet Osnabrück`

Danach je nach Wochentag ein Schwerpunkt, damit sich die Suche abwechselt:

| Tag | Schwerpunkt | Beispiel-Suchen |
|---|---|---|
| Mo | Döner / Imbiss | `Osnabrück Imbiss <PLZ>`, Lieferando/Wolt-Listen nach PLZ |
| Di | Cafés, Bäckerei-Cafés, Eiscafés | `Café Osnabrück <Stadtteil>` |
| Mi | Restaurants (italienisch, griechisch, türkisch, deutsch) | `griechisches Restaurant Osnabrück` |
| Do | Asiatisch (vietnamesisch, chinesisch, Sushi, Thai) | `Sushi Osnabrück Lieferando` |
| Fr | Pizzeria, Burger, Streetfood | `Pizzeria Osnabrück <PLZ> Speisekarte` |
| Sa | Bars, Kneipen, Shisha-Bars | `Kneipe Osnabrück <Stadtteil>` |
| So | Stadtteile abklappern | Schinkel, Eversburg, Haste, Dodesheide, Sonnenhügel, Wüste, Kalkhügel, Sutthausen, Voxtrup, Darum, Lüstringen, Atter, Pye, Hellern, Nahne, Gartlage, Westerberg, Fledder, Schölerberg, Innenstadt |

Gute Quellen für Kandidaten: Lieferando/Wolt/Uber-Eats-Listen, speisekarte.de, speisekarte.menu,
golocal.de, dasoertliche.de, gelbeseiten.de, 11880.com, Restaurant Guru ("new restaurants Osnabrück").

## Schritt 2 – Kandidaten prüfen

Für jeden Kandidaten:

```bash
python3 akquise/akquise.py pruefen "<Name>"     # schon bekannt? -> überspringen
```

Dann mit der Websuche `"<Name>" Osnabrück` prüfen:

| Befund | Entscheidung |
|---|---|
| Eigene, richtige Website mit eigenen Inhalten | ausschließen (`hat eigene Website <domain>`) |
| Nur Lieferando-/Takeaway-Bestellseite (typisch: Titel "… – Essen online bestellen in Osnabrück") | **guter Lead** – im Briefing vermerken |
| Nur Facebook/Instagram/Branchenbuch-Einträge | **guter Lead** |
| Gar nichts außer Eröffnungsmeldung | **sehr guter Lead** |
| Kette/Franchise (siehe `config.json` → `ketten_ausschliessen`) | überspringen, nicht eintragen |
| Dauerhaft geschlossen / außerhalb der Osnabrücker PLZ (`config.json` → `plz`) | ausschließen |

Abgelehnte Kandidaten **immer** eintragen, damit sie morgen nicht wieder geprüft werden:

```bash
python3 akquise/akquise.py ausschliessen "<Name>" --adresse "<Straße, PLZ Ort>" --grund "<kurzer Grund>"
```

Rangfolge, wenn mehrere passen: Neueröffnung (< 3 Monate) > gut bewertet mit vielen Bewertungen >
nur Lieferando-Bestellseite > nur Social Media. Prüfe höchstens ~10 Kandidaten, dann entscheide dich.

## Schritt 3 – Infos sammeln

Für den gewählten Laden per Websuche zusammentragen und Quellen notieren:
Adresse (mit Hausnummer, falls auffindbar), Telefon, Öffnungszeiten, Küche/Spezialitäten,
Speisekarte mit Preisen (Lieferando, Wolt, Uber Eats, speisekarte.de liefern oft echte Karten),
Instagram-Handle, Besonderheiten (Außenbereich, Mittagstisch, Lieferung …).

**Speisekarte:**
- Echte Karte gefunden → echte Namen und Preise, `"speisekarte_quelle": "echt"` (oder `"teilweise"`, wenn du ergänzt hast).
- Nichts gefunden → 12–20 typische Gerichte dieser Küche mit realistischen Osnabrücker Preisen,
  `"speisekarte_quelle": "beispiel"`. Die Seite zeigt dann automatisch einen Platzhalter-Hinweis.

## Schritt 4 – Lead-Datei schreiben

Datei: `akquise/leads/<slug>.json`. **Vorlage zum Abschauen:** `akquise/leads/030-doener-osnabrueck.json`.

- `slug`: Kleinbuchstaben mit Bindestrichen, mit `-osnabrueck` am Ende (z. B. `pizzeria-roma-osnabrueck`)
- `theme`: passend zur Küche wählen
  `street` (urbanes Streetfood, dunkel/neon) · `doener` (dunkel/orange) · `pizza` (hell, rot/grün) ·
  `asia` (dunkel, rot/gold) · `cafe` (hell, warm) · `griechisch` (hell, blau) · `burger` (hell, rot) · `modern` (neutral)
- `deko_text`: kurzes Wort/Zahl als große Hintergrund-Deko im Kopfbereich (z. B. Anfangsbuchstabe oder "030")
- `untertitel`: ein Satz, was den Laden ausmacht
- `beschreibung`: 2 kurze Absätze (getrennt durch `\n\n`), Wir-Form, max. ~90 Wörter, nur belegte Aussagen
- `oeffnungszeiten`: `{"mo": ["11:00-22:00"], "di": [...], ..., "so": []}` – leere Liste = Ruhetag,
  über Mitternacht so: `"18:00-02:00"`. Unbekannt → `null` und `status_hinweis` setzen (z. B. "Öffnungszeiten folgen").
  `oeffnungszeiten_bestaetigt`: nur `true`, wenn aus einer aktuellen, verlässlichen Quelle.
- Preise immer als `"8,50"` (Komma, zwei Nachkommastellen, ohne €). Größen über `"varianten": [{"name": "klein", "preis": "7,50"}]`.
- `tags` je Gericht (optional): `vegetarisch`, `vegan`, `scharf`, `beliebt`, `neu`
- `akquise`: `grund`, `quellen` (URLs mit Stichwort), `fehlende_infos`, `gespraechseinstieg` (2–4 Sätze, locker, konkret
  auf den Laden bezogen), `angebot` (2–3 Punkte)

## Schritt 5 – Bauen und prüfen

```bash
python3 akquise/akquise.py bauen <slug>
node akquise/screenshot.mjs <slug>
```

`bauen` meldet Fehler in der Lead-Datei – beheben und erneut bauen. Dann die Screenshots
`akquise/screenshots/<slug>-mobil.png` und `-desktop.png` ansehen (Read-Tool) und prüfen:
Name richtig geschrieben? Texte sinnvoll, keine abgeschnittenen Wörter, nichts überlappt?
Probleme beheben und neu bauen.

## Schritt 6 – Speichern

```bash
git add akquise/ demos/
git commit -m "Demo: <Name> (<slug>)"
git push -u origin akquise
```

Bei Netzwerkfehlern bis zu 4-mal wiederholen (2 s, 4 s, 8 s, 16 s warten). Wird der Push abgelehnt,
weil der Branch weiter ist: `git pull --rebase origin akquise`, dann erneut pushen.

## Schritt 7 – Ans Team schicken

1. Mit `SendUserFile` schicken: `demos/<slug>/index.html` (display `render`) und
   `akquise/screenshots/<slug>-mobil.png`, status `proactive`.
2. Abschlussnachricht (kurz, auf Deutsch):

```
**Neuer Lead: <Name>** – <Kategorie>, <Adresse>
Warum: <1–2 Sätze>
Demo: <Live-URL aus config.json demo_basis_url + slug, sonst: Datei oben / GitHub-Branch akquise>
Echt vs. Platzhalter: <Speisekarte / Zeiten / Telefon>
Gesprächseinstieg: <1–2 Sätze>
Heute geprüft und aussortiert: <Namen + Grund, kurz>
```
