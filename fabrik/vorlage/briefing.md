# Verkaufs-Briefing: {{ d.name }}

Erstellt am {{ datum }} · {{ d.kategorie }} · {{ adresse }}

{% if url %}
{% set demo = url ~ ((" · Entwürfe vergleichen: " ~ url ~ "entwuerfe/") if entwuerfe | length > 1 else "") %}
{% else %}
{% set demo = "`" ~ pfad ~ "` (noch keine Live-URL eingerichtet)" %}
{% endif %}
{% if d.speisekarte_quelle == "echt" %}
{% set karte = "echte Karte aus öffentlichen Quellen" %}
{% elif d.speisekarte_quelle == "teilweise" %}
{% set karte = "teilweise echt, teilweise ergänzt" %}
{% else %}
{% set karte = "Beispielkarte (Platzhalter), echte Karte beim Termin einsammeln" %}
{% endif %}
{% if not d.oeffnungszeiten %}
{% set zeiten = "fehlen" %}
{% elif d.oeffnungszeiten_bestaetigt %}
{% set zeiten = "bestätigt" %}
{% else %}
{% set zeiten = "aus Verzeichnissen, ungeprüft" %}
{% endif %}
**Demo:** {{ demo }}

## Warum dieser Laden?

{{ a.grund }}

## Was steht schon fest, was ist Platzhalter?

- **Speisekarte:** {{ karte }}
- **Öffnungszeiten:** {{ zeiten }}
- **Telefon:** {{ d.telefon or "fehlt" }}
{% for info in a.fehlende_infos %}
- Fehlt noch: {{ info }}
{% endfor %}

## Design-Entwürfe

{% for e in entwuerfe %}
{{ loop.index }}. **{{ e.titel or "Entwurf" }}** ({{ themes[e.theme].name }}, {{ layouts[e.layout or "buehne"].split(":")[0] }}){{ (": " ~ e.idee) if e.idee else "" }}
{% endfor %}

## Gesprächseinstieg

{{ a.gespraechseinstieg }}
{% if a.angebot %}

## Passendes Angebot

{% for punkt in a.angebot %}
- {{ punkt }}
{% endfor %}
{% endif %}

## Quellen

{% for q in a.quellen %}
- {{ q }}
{% endfor %}
