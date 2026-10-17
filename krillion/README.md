# Krillion (Nachbau)

Ein inoffizieller Nachbau des täglichen Trivia-Spiels [krillion.io](https://krillion.io): Jeden Tag 7 Fragen, 40 Sekunden pro Frage. Jede richtige Antwort zählt, aber je **seltener** sie ist, desto mehr Punkte gibt es. Jeder Punkt bringt dich 10 m tiefer, ein perfekter Tauchgang (700 Punkte) erreicht den Grabenboden in 7.000 m Tiefe.

Das Spiel ist komplett auf Deutsch, inklusive aller Fragen und Antwortbögen. Fragen, die nur im Englischen funktionieren (Reime, Palindrome usw.), wurden durch deutsche Varianten ersetzt.

## Starten

Es gibt keinen Build-Schritt. `index.html` direkt im Browser öffnen oder einen statischen Server starten:

```bash
npx serve krillion
```

## Funktionen

- **Tagestauchgang**: 7 Fragen pro Tag, für alle gleich (deterministisch nach Datum ausgewählt). Der Fortschritt wird gespeichert. Wer die Seite mitten in einer Antwort neu lädt, bekommt diese Frage als verpasst gewertet.
- **Seltenheitsstufen**: Plankton (10), Neunmalklug (15), Mitschwimmer (30), Rarität (60), Tiefgang (85), Eins zu einer Million (100).
- **Endlos-Tauchgang** und **Themenpakete** (Wörter & Sprache, Kino & Film, Sport, Geografie; Musik folgt): unbegrenztes Üben, ohne Einfluss auf das Tagesergebnis.
- **Ergebnis-Screen** mit Tauchprofil, Emoji-Zeile zum Teilen und dem vollständigen Antwortbogen jeder Frage.
- **Tauchlogbuch** mit Statistiken und Streaks (im `localStorage` des Browsers).
- Die Antwortprüfung ignoriert Groß-/Kleinschreibung, Umlaute/Akzente, Artikel (der/die/das, the …) und Satzzeichen, versteht zusammengesetzte Wörter wie „Namibwüste" oder „Erzgebirge" erkennt „ae/oe/ue" statt Umlaut sowie deutsche Pluralformen. Ausnahme: Fragen, bei denen es auf die exakte Schreibweise ankommt (z. B. Palindrome).
- **Vorschläge**: Liegt eine Antwort knapp daneben (Tippfehler oder Anfang einer längeren Antwort), erscheint „Meintest du …?" mit bis zu drei Vorschlägen, die man per Tippen abgeben kann.

## Fragen hinzufügen

Alle Fragen stehen in `js/data.js`. Jede Frage hat einen Antwortbogen pro Stufe, getrennt durch `;`, Aliase mit `|` und optionale Notizen mit `::`:

```js
{
  id: 'germany-borders', pack: 'geo', q: `Nenne ein Nachbarland von Deutschland`,
  p: `Frankreich; Österreich; Polen; Schweiz`,
  s: `Niederlande|Holland; Belgien; Dänemark`,
  r: `Tschechien|Tschechische Republik`,
  k: `Luxemburg::Der kleinste der neun Nachbarn.`,
}
```

Da es kein Backend gibt, sind die Seltenheitsstufen von Hand kuratiert und nicht aus echten Spielerantworten berechnet.
