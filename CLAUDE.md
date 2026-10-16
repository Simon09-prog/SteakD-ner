# Gastro-Website-Fabrik

Dieses Repo baut Demo-Websites mit digitaler Speisekarte für Gastro-Betriebe, die wir dann
verkaufen. Pro Laden entstehen bis zu drei **Design-Entwürfe**, dazu eine Vergleichsseite und
ein Verkaufs-Briefing. Antworte immer auf Deutsch.

Zwei Wege, wie eine Website entsteht:

- **Auf Zuruf:** Jemand nennt einen Laden ("Bau eine Website für Pizzeria Roma") → Skill `/website`
  (`.claude/skills/website/SKILL.md`). Auch ohne Slash-Befehl genau so vorgehen.
- **Tägliche Akquise:** Eine geplante Aufgabe sucht jeden Morgen selbst einen Laden in Osnabrück ohne
  Website → Skill `/akquise` (`.claude/skills/akquise/SKILL.md`).

## Aufbau

| Pfad | Inhalt |
|---|---|
| `fabrik/fabrik.py` | Werkzeug: `katalog`, `neu`, `bauen`, `liste`, `pruefen`, `ausschliessen`, `status` |
| `fabrik/screenshot.mjs` | Screenshots aller Entwürfe (Handy + Desktop) + Vergleichsseite → `screenshots/` (nicht im Git) |
| `fabrik/vorlage/` | `seite.html` (Website), `entwuerfe.html` (Vergleichsseite), `briefing.md`, eingebettete Schriften |
| `daten/laeden/<slug>.json` | Recherchierte Daten je Laden – die einzige Quelle für die Website |
| `daten/leads.json` | Alle bekannten Läden mit Status (Duplikat-Schutz) |
| `daten/UEBERSICHT.md` | Automatisch erzeugte Tabelle aller Läden |
| `daten/briefings/<slug>.md` | Verkaufs-Briefing je Laden |
| `daten/config.json` | Stadt, PLZ, Ketten-Ausschluss, Agentur-Name, `demo_basis_url` |
| `demos/<slug>/` | Fertige Seiten: `index.html` (Entwurf 1), `2/`, `3/`, `entwuerfe/` (Vergleich) |

Veröffentlicht (Netlify) wird nur `demos/`. Alles unter `daten/` bleibt intern.

## Befehle

```bash
python3 fabrik/fabrik.py katalog                 # Farbwelten + Layouts für die Design-Auswahl
python3 fabrik/fabrik.py neu "Name" --ort Osnabrück
python3 fabrik/fabrik.py bauen <slug>
node fabrik/screenshot.mjs <slug>
python3 fabrik/fabrik.py status <slug> praesentiert|kunde|kein_interesse [--notiz "..."]
```

## Grundregeln (immer)

1. **Niemals den Betrieb selbst kontaktieren** – keine E-Mails, Anrufe, Nachrichten, Formulare.
   Werbe-E-Mails ohne Einwilligung sind unzulässig (§ 7 UWG). Die Ansprache macht das Team persönlich.
2. **Nichts erfinden.** Telefon, Hausnummer, Öffnungszeiten, Inhaber, Gründungsjahr, Auszeichnungen,
   Bewertungen, "Familienbetrieb", "hausgemacht", "seit 19xx" nur mit Quelle. Unbekannt → `null`.
3. **Keine fremden Fotos** (Google Maps, Instagram, Lieferando … sind urheberrechtlich geschützt). `hero_bild` leer lassen,
   außer der Kunde hat eigene Fotos geliefert.
4. **Keine Personennamen** auf der Website.
5. Demos bleiben als Entwurf gekennzeichnet und `noindex`.
6. Kein Netzwerk-Zugriff auf die meisten Websites in der Cloud-Umgebung: recherchiere mit der **Websuche**.

## Laden-Datei (`daten/laeden/<slug>.json`)

Gerüst mit `fabrik.py neu` anlegen, Vorbild: `daten/laeden/030-doener-osnabrueck.json`.
`bauen` verweigert den Bau, solange irgendwo noch `TODO` steht.

- `slug`: klein, Bindestriche, Ort am Ende (`pizzeria-roma-osnabrueck`) – setzt `neu` automatisch
- `herkunft`: `auftrag` (auf Zuruf) oder `akquise` (tägliche Suche)
- `untertitel`: ein Satz, was den Laden ausmacht · `kategorie`: z. B. "Pizzeria", "Döner & Grill"
- `stadtteil`, `anfahrt` (optional) · `deko_text`: 1–3 Zeichen oder kurzes Wort als große Hintergrund-Deko
- `adresse`: `{"strasse", "plz", "ort"}` · `telefon`, `email`, `instagram` (Handle ohne @) – sonst `null`
- `oeffnungszeiten`: `{"mo": ["11:00-22:00"], …, "so": []}` (leere Liste = Ruhetag, über Mitternacht `"18:00-02:00"`),
  unbekannt → `null` + `status_hinweis` (z. B. "Öffnungszeiten folgen"). `oeffnungszeiten_bestaetigt` nur `true` mit
  aktueller, verlässlicher Quelle.
- `highlights`: 2–4 kurze Stichworte · `services`: z. B. "Lieferung", "Mittagstisch", "Außenbereich"
- `ueber_titel` + `beschreibung`: 2 kurze Absätze (getrennt durch `\n\n`), Wir-Form, max. ~90 Wörter, nur Belegtes
- `speisekarte`: Kategorien mit `eintraege` (`name`, `beschreibung`, `preis` als `"8,50"`, optional
  `varianten: [{"name": "klein", "preis": "7,50"}]`, `tags`: `vegetarisch`, `vegan`, `scharf`, `beliebt`, `neu`)
- `speisekarte_quelle`: `echt` (aus Lieferando/Wolt/speisekarte.de usw.), `teilweise` oder `beispiel`
  (dann 12–20 typische Gerichte mit realistischen örtlichen Preisen; die Seite zeigt automatisch einen Platzhalter-Hinweis)
- `entwuerfe`: siehe unten
- `akquise`: `grund`, `quellen` (URLs mit Stichwort), `fehlende_infos`, `gespraechseinstieg` (2–4 Sätze, locker,
  konkret auf den Laden bezogen), `angebot` (2–3 Punkte)

## Design-Entwürfe (das Herzstück)

Jeder Laden bekommt **drei klar unterschiedliche Entwürfe**. Erst `python3 fabrik/fabrik.py katalog` ansehen, dann wählen.
Jeder Entwurf: `{"theme": "...", "layout": "...", "titel": "2–4 bildhafte Wörter", "idee": "1–2 Sätze, warum genau dieser Laden"}`.

1. **Favorit** – trifft Küche und Stimmung am besten. Nutze, was die Recherche hergibt: Einrichtung, Publikum,
   Lage, Bewertungen ("gemütlich", "modern", "authentisch"), Name. Layout `buehne` (laut/jung/Neueröffnung),
   `split` (Restaurant mit Lieblingsgerichten) oder `mitte` (Café, Bar, gehobene Küche).
2. **Kontrast** – andere Farbwelt (hell ↔ dunkel tauschen) und anderes Layout. Zeigt dem Kunden die Bandbreite.
3. **Praktisch** – Layout `karte` (Speisekarte zuerst, QR-Code-tauglich). Bei Restaurants/Cafés alternativ `mitte`,
   wenn Entwurf 1 nicht schon `mitte` ist.

Regeln: nie zweimal dieselbe Kombination, mindestens ein heller und ein dunkler Entwurf, die `idee` nennt konkrete
Fakten zum Laden (nicht "modernes Design"). Grobe Zuordnung: Döner/Grill → `doener`, `street` · Pizza/Italienisch →
`pizza` · Asiatisch → `asia`, `japan` · Café/Bäckerei → `cafe` · Eis → `eiscafe` · Griechisch → `griechisch` ·
Deutsch/Gasthaus → `wirtshaus` · Bar/Kneipe/Shisha → `bar` · Burger → `burger` · Bowls/vegan → `frisch` · sonst `modern`.
Passt keine Farbwelt wirklich (z. B. Markenfarbe des Ladens bekannt), neue Farbwelt in `THEMES` in `fabrik/fabrik.py` ergänzen.

## Prüfen und abliefern

1. `python3 fabrik/fabrik.py bauen <slug>` – Fehler beheben, bis es durchläuft.
2. `node fabrik/screenshot.mjs <slug>` – Screenshots ansehen (`screenshots/<slug>-<n>-mobil.png`, `-desktop.png`,
   `<slug>-entwuerfe.png`): Name korrekt? Nichts abgeschnitten oder überlappend? Texte sinnvoll? Bei Bedarf korrigieren.
3. Commit (`Website: <Name> (<slug>)`) und `git push` (aktueller Branch).
4. Mit `SendUserFile` schicken: `screenshots/<slug>-entwuerfe.png`, `screenshots/<slug>-1-mobil.png` und
   `demos/<slug>/index.html`. Dazu kurz: Name, die drei Design-Ideen in je einem Satz, Live-Link
   (`demo_basis_url` + `<slug>/` und `<slug>/entwuerfe/`, falls gesetzt), was echt und was Platzhalter ist, Gesprächseinstieg.
