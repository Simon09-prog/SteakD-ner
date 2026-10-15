# Krillion (Nachbau)

Ein inoffizieller Nachbau des täglichen Trivia-Spiels [krillion.io](https://krillion.io): Jeden Tag 7 Fragen, 25 Sekunden pro Frage. Jede richtige Antwort zählt, aber je **seltener** sie ist, desto mehr Punkte gibt es. Jeder Punkt bringt dich 10 m tiefer, ein perfekter Tauchgang (700 Punkte) erreicht den Grabenboden in 7.000 m Tiefe.

Das Spiel selbst ist auf Englisch, wie das Original.

## Starten

Es gibt keinen Build-Schritt. `index.html` direkt im Browser öffnen oder einen statischen Server starten:

```bash
npx serve krillion
```

## Funktionen

- **Daily Dive**: 7 Fragen pro Tag, für alle gleich (deterministisch nach Datum ausgewählt). Der Fortschritt wird gespeichert. Wer die Seite mitten in einer Antwort neu lädt, bekommt diese Frage als verpasst gewertet.
- **Seltenheitsstufen**: Plankton (10), Too Clever (15), Schooler (30), Rare (60), Deep Cut (85), One in a Krillion (100).
- **Endless Dive** und **Themenpakete** (Words & Language, At the Movies, Sports, Geography; Music folgt): unbegrenztes Üben, ohne Einfluss auf das Tagesergebnis.
- **Ergebnis-Screen** mit Tauchprofil, Emoji-Zeile zum Teilen und dem vollständigen Antwortbogen jeder Frage.
- **Dive Log** mit Statistiken und Streaks (im `localStorage` des Browsers).
- Die Antwortprüfung ignoriert Groß-/Kleinschreibung, Akzente, Artikel und Satzzeichen, faltet Pluralformen und toleriert kleine Tippfehler. Ausnahme: Fragen, bei denen es auf die exakte Schreibweise ankommt (z. B. Palindrome).

## Fragen hinzufügen

Alle Fragen stehen in `js/data.js`. Jede Frage hat einen Antwortbogen pro Stufe, getrennt durch `;`, Aliase mit `|` und optionale Notizen mit `::`:

```js
{
  id: 'germany-borders', pack: 'geo', q: `Name a country that borders Germany`,
  p: `France; Austria; Poland; Switzerland`,
  s: `Netherlands|Holland; Belgium; Denmark`,
  r: `Czech Republic|Czechia`,
  k: `Luxembourg::The smallest of Germany's nine neighbours.`,
}
```

Da es kein Backend gibt, sind die Seltenheitsstufen von Hand kuratiert und nicht aus echten Spielerantworten berechnet.
