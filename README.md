# Gastro-Website-Fabrik

Ladenname nennen → Claude recherchiert den Laden, entwirft **drei Designs** und baut eine fertige
Demo-Website mit digitaler Speisekarte. Dazu kommen eine Vergleichsseite für den Kunden und ein Verkaufs-Briefing für euch.
Zusätzlich sucht Claude jeden Morgen selbst einen neuen Laden in Osnabrück ohne Website.

## So benutzt ihr die Fabrik

**Website auf Zuruf:** In Claude Code (App, Web oder Terminal) eine Sitzung mit diesem Repo öffnen und schreiben:

```
/website Pizzeria Roma Osnabrück
```

oder einfach „Bau eine Website für das Café am Markt“. Claude recherchiert, wählt drei passende Designs,
baut alles, prüft es per Screenshot, speichert es hier und schickt euch die Entwürfe.
Änderungswünsche („Entwurf 2, aber heller“) einfach hinterherschreiben.

**Tägliche Akquise:** läuft automatisch jeden Morgen um 7:46 Uhr (geplante Aufgabe) über `/akquise`.
Ihr bekommt eine Push-Nachricht und eine E-Mail mit dem neuen Lead.

**Nach dem Termin:** Claude Bescheid sagen („030 Döner ist jetzt Kunde“) oder selbst:

```bash
python3 fabrik/fabrik.py status 030-doener-osnabrueck praesentiert --notiz "meldet sich Freitag"
python3 fabrik/fabrik.py status 030-doener-osnabrueck kunde
```

Alle Läden auf einen Blick: [`daten/UEBERSICHT.md`](daten/UEBERSICHT.md).

## Designs

Ein Entwurf besteht aus einer **Farbwelt** und einem **Layout**. `python3 fabrik/fabrik.py katalog` zeigt alle.

| Farbwelt | passt zu | | Layout | wofür |
|---|---|---|---|---|
| Street | Streetfood, urbane Döner-Konzepte | | **Bühne** | riesiger Name, laut, für Neueröffnungen |
| Grill | Döner, Kebap, Imbiss | | **Zweispaltig** | Infos + Karten-Vorschau, wirkt wie ein Restaurant |
| Trattoria | Pizzeria, italienisch | | **Speisekarte zuerst** | QR-Code-Karte für Tisch und Tresen |
| Nachtmarkt / Minimal Japan | asiatisch, Sushi | | **Elegant zentriert** | Cafés, Bars, gehobene Küche |
| Kaffeehaus / Gelato | Café, Eiscafé | | | |
| Ägäis / Wirtshaus | griechisch, deutsche Küche | | | |
| Nachtbar / Diner / Frisch / Modern | Bar, Burger, Bowls, alles andere | | | |

Pro Laden gibt es drei Entwürfe: **Favorit** (passt am besten), **Kontrast** (ganz andere Richtung) und
**Praktisch** (QR-Speisekarte). Die Vergleichsseite `demos/<laden>/entwuerfe/` zeigt alle drei nebeneinander in
Handy-Rahmen, ideal, um sie dem Inhaber auf dem Tablet oder Laptop zu zeigen.

Alle Seiten: eine einzige Datei, Schriften eingebettet (keine Google-Server, DSGVO-freundlich), durchsuchbare
Speisekarte mit Filtern (vegetarisch/vegan/scharf), „Jetzt geöffnet“-Anzeige, Anruf- und Routen-Buttons,
Handy-Leiste unten, strukturierte Daten für Google.

## Einmalig einrichten

1. **Agentur-Name** in `daten/config.json` → `agentur` eintragen (erscheint dezent auf den Demos).
2. **Live-Links (Netlify):** *Add new project* → *Import an existing project* → GitHub → dieses Repo, Branch `main`.
   Build-Einstellungen leer lassen (kommen aus `netlify.toml`, veröffentlicht wird nur `demos/`).
   Projektnamen setzen (z. B. `gastro-demos`) und die Adresse in `daten/config.json` → `demo_basis_url` eintragen.
   Dann hat jede Demo einen Link wie `https://gastro-demos.netlify.app/030-doener-osnabrueck/entwuerfe/`.
3. **Bestehende Kunden** mit Status `kunde` in `daten/leads.json` eintragen, damit sie nie als Lead auftauchen.

Die Demos sind für Suchmaschinen gesperrt (`noindex` + `robots.txt`) und nur über den direkten Link erreichbar.

## Wenn ein Laden zusagt

Echte Speisekarte, Öffnungszeiten, Telefon und eigene Fotos (`hero_bild`) in die Laden-Datei, den gewählten Entwurf
als einzigen behalten, neu bauen, `noindex` in `fabrik/vorlage/seite.html` für den Livegang entfernen,
Impressum und Datenschutz ergänzen und auf eigener Domain veröffentlichen.

## Rechtliches

- Läden werden **nie** automatisch angeschrieben (§ 7 UWG). Die Ansprache macht ihr persönlich.
- Keine fremden Fotos: Bilder von Google Maps, Instagram oder Lieferando sind urheberrechtlich geschützt.
- Schriften: SIL Open Font License, siehe `fabrik/vorlage/schriften/LIZENZEN.txt`.
