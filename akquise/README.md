# Akquise-Automatik: jeden Tag eine Demo-Website

Jeden Morgen sucht Claude automatisch einen Gastro-Betrieb in Osnabrück ohne eigene Website,
baut dafür eine Demo-Website mit digitaler Speisekarte und schickt sie euch. Ihr geht mit der Demo
in den Laden und zeigt sie dem Inhaber.

## Ablauf

1. **Suchen:** Neueröffnungen, Lieferdienst-Listen, Branchenbücher (Websuche).
2. **Prüfen:** Hat der Laden schon eine Website? Ist er schon in unserer Liste? Kette?
3. **Bauen:** Lead-Datei (`akquise/leads/<slug>.json`) → `python3 akquise/akquise.py bauen <slug>`
   → fertige Seite `demos/<slug>/index.html` + Verkaufs-Briefing `akquise/briefings/<slug>.md`.
4. **Speichern:** Commit + Push auf den Branch `akquise`.
5. **Schicken:** Ihr bekommt eine Benachrichtigung mit Demo, Handy-Screenshot und Gesprächseinstieg.

Die genaue Anleitung, die Claude jeden Tag abarbeitet, steht in [`TAGESLAUF.md`](TAGESLAUF.md).

## Ordner

| Pfad | Inhalt |
|---|---|
| `akquise/leads.json` | Alle bekannten Läden mit Status (verhindert Doppelungen) |
| `akquise/leads/<slug>.json` | Recherchierte Daten je Laden (Quelle für die Website) |
| `akquise/briefings/<slug>.md` | Verkaufs-Briefing: warum der Laden, was fehlt, Gesprächseinstieg |
| `akquise/vorlage/` | Website-Vorlage, Briefing-Vorlage und eingebettete Schriften |
| `akquise/config.json` | Stadt, PLZ, Branchen, Ketten-Ausschluss, Agentur-Name, Live-URL |
| `demos/<slug>/index.html` | Die fertigen Demo-Websites (eine Datei, läuft auch offline) |

## Nach dem Termin: Status pflegen

```bash
python3 akquise/akquise.py status 030-doener-osnabrueck praesentiert --notiz "Inhaber meldet sich bis Freitag"
python3 akquise/akquise.py status 030-doener-osnabrueck kunde
python3 akquise/akquise.py status 030-doener-osnabrueck kein_interesse
python3 akquise/akquise.py liste
```

Status: `demo_erstellt` → `praesentiert` → `kunde` / `kein_interesse`; `ausgeschlossen` für aussortierte Läden.
Ihr könnt Claude auch einfach schreiben: "030 Döner ist jetzt Kunde".

Bestehende Kunden bitte mit Status `kunde` in `leads.json` eintragen, damit sie nie als Lead auftauchen.

## Einmalig einrichten

**Agentur-Name** in `config.json` → `agentur` eintragen (erscheint dezent im Demo-Hinweis und in der Fußzeile).

**Live-Links über Netlify (empfohlen):**
1. Netlify → *Add new project* → *Import an existing project* → GitHub → `simon09-prog/steakd-ner`.
2. *Branch to deploy*: `akquise`. Build-Einstellungen leer lassen (kommen aus `netlify.toml`, veröffentlicht wird nur `demos/`).
3. Projektnamen setzen, z. B. `demo-osnabrueck` → Demos liegen dann unter `https://demo-osnabrueck.netlify.app/<slug>/`.
4. Diese Adresse in `config.json` → `demo_basis_url` eintragen.

Die Steak-Döner-Seite (Branch `main`) bleibt davon unberührt. Die Demos sind für Suchmaschinen gesperrt
(`noindex` + `robots.txt`) und nur über den direkten Link erreichbar.

## Wenn ein Laden zusagt

Die Demo ist die Basis für die echte Seite: echte Speisekarte, Öffnungszeiten, Telefon und Fotos in
die Lead-Datei eintragen, neu bauen, `noindex`-Zeile in `vorlage/seite.html` für diesen Kunden entfernen,
Impressum und Datenschutz ergänzen und auf eigener Domain veröffentlichen.

## Rechtliches

- Läden werden **nicht** automatisch angeschrieben: Werbe-E-Mails ohne Einwilligung sind unzulässig (§ 7 UWG).
- Keine fremden Fotos: Bilder von Google Maps, Instagram oder Lieferando sind urheberrechtlich geschützt.
- Schriften sind eingebettet (SIL Open Font License, siehe `vorlage/schriften/LIZENZEN.txt`), es werden keine Google-Server abgefragt.
