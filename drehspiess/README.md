# Website „Zum Drehspieß“ Osnabrück

Statische Website (HTML/CSS/JS, kein Build nötig) für den Dönerladen **Zum Drehspieß**, Große Hamkenstraße 21, 49074 Osnabrück.
Aufbau und Stil orientieren sich an der Steak-Döner-Seite im Hauptordner: dunkle Navigation, Video-Hero und Speisekarte als eigene Seite.

- `index.html` – Startseite: Hero-Video, Auszeichnungen, Über uns, Lieblinge, Vegan, Presse, Insta & News, Kontakt/Öffnungszeiten
- `speisekarte.html` – komplette Karte mit Filter „Alle / Vegetarisch / Vegan“ (Direktlink: `speisekarte.html?filter=vegan`)
- `assets/` – Styles, Script, lokal eingebundene Schriften (Bebas Neue, Inter – SIL OFL) und Video/Bilder

Lokal ansehen: `index.html` im Browser öffnen oder im Ordner `python3 -m http.server` starten.

## Woher die Inhalte stammen

| Inhalt | Quelle |
| --- | --- |
| Instagram-Bio, Posts „Broich Brot“ und „Burger News“ (Juni 2026) | [@zumdrehspiess](https://www.instagram.com/zumdrehspiess/) (über foodyas.com gespiegelt) |
| Eröffnung 1. April 2015, 3-€-Jubiläumsaktion, Inhaber Davud Kücükugurlu | [HASEPOST – 10 Jahre](https://hasepost.de/grosser-andrang-zum-drehspiess-feiert-zehnjaehriges-bestehen-mit-doener-fuer-drei-euro-583549/) |
| EM-Aktion 2024, „erster veganer Seitan- und Sucuk-Döner in Osnabrück“ | [HASEPOST – EM](https://www.hasepost.de/osnabruecker-doener-restaurant-zum-drehspiess-ueberrascht-mit-marketing-coup-zur-em-490603/) |
| Zitat „Osnabrücks Nummer 1 für Döner!“, Iskender-Highlight | [@foodbroz auf TikTok](https://www.tiktok.com/@foodbroz/video/7472791710972644631) |
| Veganer Spieß, separates Besteck, vegane Soßen, Öffnungszeiten | [HappyCow](https://www.happycow.net/reviews/zum-drehspiess-osnabruck-60383), Das Örtliche |
| Preise und Gerichte | [zum-drehspiess.de](https://www.zum-drehspiess.de/), [speisekarte.de](https://www.speisekarte.de/osnabr%C3%BCck/restaurant/zum_drehspiess/speisekarte) (Stand 2025) |
| Google-Bewertung 4,6 ★ / 1.700+ | [doener.io](https://doener.io/doener/osnabrueck) |

Das Hero-Video ist das Spieß-Video aus dem Hauptordner (`v24044gl0000d25jalnog65g8laa1il0.mov`), umgewandelt in MP4 und WebM, damit es in allen Browsern läuft.

## Vor dem Livegang prüfen

- **Preise & Beschreibungen** mit der aktuellen Karte im Laden abgleichen. Die Quellen widersprechen sich teilweise. Für Iskender, Burger, Broich-Brot-Döner, Sucuk- und Hähnchen-Döner war kein Preis zu finden; dort steht „im Laden“.
- **Öffnungszeiten** bestätigen. Die Verzeichnisse sind sich nicht ganz einig. Die Zeiten stehen in `index.html` und in `assets/main.js` (`HOURS`).
- **Echte Fotos** von Instagram bzw. vom Laden einbauen (nur mit Erlaubnis) – zurzeit gibt es nur Standbilder aus dem Spieß-Video.
- **Impressum und Datenschutzerklärung** ergänzen. Für eine geschäftliche Website in Deutschland sind sie Pflicht, die Angaben müssen vom Betreiber kommen.
