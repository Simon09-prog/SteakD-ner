#!/usr/bin/env python3
"""Website-Fabrik: baut Demo-Websites (mit mehreren Design-Entwürfen) für Gastro-Betriebe.

Befehle:
  python3 fabrik/fabrik.py katalog                      alle Farbwelten und Layouts (für die Design-Auswahl)
  python3 fabrik/fabrik.py neu "Name" [--ort Ort]       legt daten/laeden/<slug>.json als Gerüst an
  python3 fabrik/fabrik.py bauen <slug>                 Laden-Datei -> demos/<slug>/ (alle Entwürfe) + Briefing
  python3 fabrik/fabrik.py liste                        alle bekannten Läden (Duplikat-Schutz)
  python3 fabrik/fabrik.py pruefen "Name"               ist der Laden schon bekannt?
  python3 fabrik/fabrik.py ausschliessen "Name" --grund "..." [--adresse "..."]
  python3 fabrik/fabrik.py status <slug> <status> [--notiz "..."]

Aufbau der Laden-Datei: siehe CLAUDE.md und daten/laeden/030-doener-osnabrueck.json.
"""
import argparse
import base64
import datetime
import json
import re
import shutil
import sys
import unicodedata
from pathlib import Path
from urllib.parse import quote_plus

try:
    import jinja2
except ImportError:
    sys.exit("Jinja2 fehlt: pip install jinja2")

ROOT = Path(__file__).resolve().parent.parent
VORLAGE_DIR = ROOT / "fabrik" / "vorlage"
SCHRIFTEN_DIR = VORLAGE_DIR / "schriften"
DATEN = ROOT / "daten"
LAEDEN_DIR = DATEN / "laeden"
BRIEFINGS_DIR = DATEN / "briefings"
LEADS_FILE = DATEN / "leads.json"
CONFIG_FILE = DATEN / "config.json"
UEBERSICHT_FILE = DATEN / "UEBERSICHT.md"
DEMOS_DIR = ROOT / "demos"

STATUS = ["demo_erstellt", "praesentiert", "kunde", "kein_interesse", "ausgeschlossen"]
TAGE = ["mo", "di", "mi", "do", "fr", "sa", "so"]
TAGE_LANG = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"]
ZEIT_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-4]):[0-5]\d$")
TAG_LABELS = {"vegetarisch": "Vegetarisch", "vegan": "Vegan", "scharf": "Scharf", "beliebt": "Beliebt", "neu": "Neu"}

SANS = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
FALLBACK_SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
FALLBACK_SERIF = 'Georgia, "Times New Roman", serif'

# Schriften werden als Datei in die Seite eingebettet (kein Google-Fonts-Abruf, DSGVO-freundlich).
# Lizenzen: fabrik/vorlage/schriften/LIZENZEN.txt (alle SIL Open Font License).
SCHRIFTEN = {
    "Inter": {400: "inter-latin-400-normal.woff2", 700: "inter-latin-700-normal.woff2"},
    "Anton": {400: "anton-latin-400-normal.woff2"},
    "Archivo Black": {400: "archivo-black-latin-400-normal.woff2"},
    "Bebas Neue": {400: "bebas-neue-latin-400-normal.woff2"},
    "Fraunces": {700: "fraunces-latin-700-normal.woff2"},
}


def _theme(name, passt_zu, scheme, bg, surface, text, muted, line, line_strong, accent, accent_ink,
           accent_text, accent2, font, weight, transform="none", tracking="0", radius="12px"):
    return dict(name=name, passt_zu=passt_zu, scheme=scheme, bg=bg, surface=surface, text=text, muted=muted,
                line=line, line_strong=line_strong, accent=accent, accent_ink=accent_ink,
                accent_text=accent_text, accent2=accent2, display_font=font, display_weight=weight,
                transform=transform, tracking=tracking, radius=radius)


# Farbwelten. Neue Branche? Einfach hier ein Theme ergänzen (display_font muss in SCHRIFTEN stehen,
# display_weight muss eine dort vorhandene Stärke sein).
THEMES = {
    "street": _theme("Street", "Streetfood, Döner mit urbanem Konzept, junges Publikum, Graffiti",
                     "dark", "#0e0e0f", "#18181b", "#f4f1ea", "#a9a59c", "#2a2a2e", "#47474d",
                     "#d7ff3a", "#0e0e0f", "#d7ff3a", "#ff3d81", "Anton", 400, "uppercase", "0", "14px"),
    "doener": _theme("Grill", "Döner, Kebap, Grill, klassischer Imbiss",
                     "dark", "#141110", "#1e1a18", "#f7efe6", "#b3a79b", "#2f2925", "#4d433c",
                     "#ff6b1a", "#141110", "#ff8a47", "#ffd23f", "Archivo Black", 400, "uppercase", "-0.01em", "14px"),
    "pizza": _theme("Trattoria", "Pizzeria, italienisch, Pasta",
                    "light", "#fbf6ee", "#ffffff", "#2a1f1a", "#6f6159", "#eadfce", "#cdbba4",
                    "#c8102e", "#ffffff", "#b00e28", "#2e7d32", "Fraunces", 700, "none", "-0.02em", "10px"),
    "asia": _theme("Nachtmarkt", "chinesisch, vietnamesisch, Thai, Asia-Imbiss",
                   "dark", "#101012", "#1a1a1e", "#f3efe8", "#a8a29a", "#2b2b30", "#46464d",
                   "#e0313f", "#ffffff", "#ff5a66", "#f2c14e", "Bebas Neue", 400, "uppercase", "0.02em", "6px"),
    "japan": _theme("Minimal Japan", "Sushi, Ramen, japanisch, koreanisch, Poke",
                    "light", "#f7f5f0", "#ffffff", "#121212", "#5f5b55", "#e6e1d8", "#c9c2b6",
                    "#c8102e", "#ffffff", "#b00e28", "#e9b8a9", "Inter", 700, "none", "-0.03em", "4px"),
    "cafe": _theme("Kaffeehaus", "Café, Bäckerei-Café, Frühstück, Kuchen",
                   "light", "#f6efe6", "#fffaf4", "#3b2a20", "#7a6555", "#e6d8c7", "#cbb59d",
                   "#8a5a3b", "#ffffff", "#7a4e32", "#c9a227", "Fraunces", 700, "none", "-0.02em", "18px"),
    "eiscafe": _theme("Gelato", "Eiscafé, Waffeln, Crêpes, Desserts",
                      "light", "#fff7f9", "#ffffff", "#3b2330", "#7d6370", "#f3dfe6", "#e2bfcc",
                      "#c93a6c", "#ffffff", "#b8325f", "#6cc4b2", "Fraunces", 700, "none", "-0.02em", "22px"),
    "griechisch": _theme("Ägäis", "griechisch, mediterran, Fisch",
                         "light", "#f6f9fc", "#ffffff", "#0d2b45", "#566b7f", "#dbe5ef", "#b5c6d7",
                         "#1560bd", "#ffffff", "#11519f", "#e3b23c", "Fraunces", 700, "none", "-0.01em", "8px"),
    "wirtshaus": _theme("Wirtshaus", "deutsche Küche, Gasthaus, Biergarten, Landgasthof",
                        "light", "#f4efe4", "#fbf8f1", "#1f2a22", "#5d665c", "#e2dacb", "#c7bca6",
                        "#2f5d3a", "#ffffff", "#2f5d3a", "#b5873a", "Fraunces", 700, "none", "-0.01em", "6px"),
    "bar": _theme("Nachtbar", "Bar, Cocktailbar, Weinbar, Kneipe, Shisha-Bar",
                  "dark", "#0d1320", "#151c2b", "#efe9dc", "#a49f93", "#232b3b", "#3a4458",
                  "#d4a24c", "#0d1320", "#e0b463", "#6b7cff", "Fraunces", 700, "none", "-0.01em", "10px"),
    "burger": _theme("Diner", "Burger, American Diner, Hot Dogs, Wings",
                     "light", "#fff8ec", "#ffffff", "#1d1d1d", "#6b6257", "#efe2cc", "#d8c3a2",
                     "#d62839", "#ffffff", "#c62835", "#f4a261", "Archivo Black", 400, "uppercase", "-0.01em", "12px"),
    "frisch": _theme("Frisch", "Bowls, vegan/vegetarisch, Salate, Säfte, Healthy Food",
                     "light", "#f5f9f1", "#ffffff", "#1d2b1f", "#5b6b5d", "#dfe9d8", "#bfd1b5",
                     "#2f7d3f", "#ffffff", "#2a6f38", "#f2a541", "Archivo Black", 400, "none", "-0.02em", "20px"),
    "modern": _theme("Modern", "alles ohne klaren Stil, Kantinen, Mittagstisch",
                     "light", "#fafaf9", "#ffffff", "#1c1917", "#66615c", "#e7e5e4", "#cfcac6",
                     "#0f766e", "#ffffff", "#0d6b63", "#f59e0b", "Inter", 700, "none", "-0.03em", "12px"),
}

LAYOUTS = {
    "buehne": "Bühne: riesiger Name + Deko-Schriftzug, laut und selbstbewusst. Für Streetfood, Neueröffnungen.",
    "split": "Zweispaltig: links Infos, rechts Karten-Vorschau mit Lieblingsgerichten. Wirkt wie ein Restaurant.",
    "karte": "Speisekarte zuerst: kompakter Kopf, sofort die Karte. Ideal als QR-Code-Speisekarte am Tisch/Tresen.",
    "mitte": "Elegant zentriert: ruhige Typografie, Karte im klassischen Menü-Stil. Für Cafés, Bars, gehobene Küche.",
}


# ---------------------------------------------------------------- Hilfsfunktionen

def lade_json(pfad, standard=None):
    if not pfad.exists():
        return standard
    with pfad.open(encoding="utf-8") as f:
        return json.load(f)


def speichere_json(pfad, daten):
    pfad.parent.mkdir(parents=True, exist_ok=True)
    with pfad.open("w", encoding="utf-8") as f:
        json.dump(daten, f, ensure_ascii=False, indent=2)
        f.write("\n")


def normalisiere(name):
    """'Café Ümit's' -> 'cafeumits' – für den Duplikat-Vergleich."""
    s = name.lower().replace("ß", "ss")
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]", "", s)


def slugify(name):
    s = name.lower().replace("ß", "ss").replace("ä", "ae").replace("ö", "oe").replace("ü", "ue")
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", s)).strip("-")


def heute():
    return datetime.date.today().isoformat()


def adresse_text(adr):
    if not adr:
        return ""
    teile = [(adr.get("strasse") or "").strip(), f'{adr.get("plz") or ""} {adr.get("ort") or ""}'.strip()]
    return ", ".join(t for t in teile if t)


def tel_href(nummer):
    ziffern = re.sub(r"[^\d+]", "", nummer or "")
    if ziffern.startswith("0") and not ziffern.startswith("00"):
        ziffern = "+49" + ziffern[1:]
    return "tel:" + ziffern


def schrift_css(familien):
    """@font-face-Regeln mit eingebetteten Schriftdateien."""
    regeln = []
    for familie in dict.fromkeys(familien):
        for gewicht, datei in SCHRIFTEN[familie].items():
            daten = base64.b64encode((SCHRIFTEN_DIR / datei).read_bytes()).decode()
            regeln.append(f'@font-face {{ font-family: "{familie}"; font-style: normal; font-weight: {gewicht}; '
                          f'font-display: swap; src: url(data:font/woff2;base64,{daten}) format("woff2"); }}')
    return "\n".join(regeln)


def display_stack(theme):
    fallback = FALLBACK_SERIF if theme["display_font"] == "Fraunces" else FALLBACK_SANS
    return f'"{theme["display_font"]}", {fallback}'


def favicon(text, theme):
    zeichen = re.sub(r"[^\w]", "", text)[:3] or "•"
    groesse = {1: 40, 2: 30}.get(len(zeichen), 22)
    svg = (f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>"
           f"<rect width='64' height='64' rx='14' fill='{theme['accent']}'/>"
           f"<text x='32' y='{32 + groesse * 0.36:.0f}' font-size='{groesse}' font-family='Arial Black,Arial,sans-serif' "
           f"font-weight='900' text-anchor='middle' fill='{theme['accent_ink']}'>{zeichen}</text></svg>")
    return "data:image/svg+xml," + quote_plus(svg, safe="/:='<> ,.").replace("+", "%20")


def jsonld(daten):
    adr = daten["adresse"]
    ld = {
        "@context": "https://schema.org",
        "@type": "Restaurant",
        "name": daten["name"],
        "servesCuisine": daten["kategorie"],
        "address": {
            "@type": "PostalAddress",
            "streetAddress": adr.get("strasse") or "",
            "postalCode": adr.get("plz") or "",
            "addressLocality": adr.get("ort") or "",
            "addressCountry": "DE",
        },
    }
    if daten.get("telefon"):
        ld["telephone"] = daten["telefon"]
    zeiten = daten.get("oeffnungszeiten") or {}
    englisch = dict(zip(TAGE, ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]))
    ld["openingHours"] = [f"{englisch[t]} {b}" for t in TAGE for b in zeiten.get(t, [])] or None
    return {k: v for k, v in ld.items() if v}


def karten_vorschau(speisekarte, anzahl=4):
    """Lieblingsgerichte für das Split-Layout: erst 'beliebt', dann das erste Gericht jeder Kategorie."""
    alle = [e for kat in speisekarte for e in kat["eintraege"]]
    auswahl = [e for e in alle if "beliebt" in e.get("tags", [])]
    auswahl += [kat["eintraege"][0] for kat in speisekarte]
    auswahl += alle
    ergebnis, namen = [], set()
    for e in auswahl:
        if e["name"] not in namen and (e.get("preis") or e.get("varianten")):
            ergebnis.append(e)
            namen.add(e["name"])
    return ergebnis[:anzahl]


def entwuerfe_von(daten):
    """Liste der Design-Entwürfe; alte Laden-Dateien mit nur 'theme' werden zu einem Entwurf."""
    if daten.get("entwuerfe"):
        return daten["entwuerfe"]
    return [{"theme": daten.get("theme", "modern"), "layout": "buehne", "titel": "Entwurf", "idee": ""}]


def finde_todos(wert, pfad=""):
    if isinstance(wert, str):
        return [pfad] if "TODO" in wert else []
    if isinstance(wert, dict):
        return [p for k, v in wert.items() for p in finde_todos(v, f"{pfad}.{k}" if pfad else k)]
    if isinstance(wert, list):
        return [p for i, v in enumerate(wert) for p in finde_todos(v, f"{pfad}[{i}]")]
    return []


# ---------------------------------------------------------------- Lead-Liste

def lade_leads():
    return lade_json(LEADS_FILE, {"leads": []})


def finde_lead(leads, name=None, slug=None):
    for lead in leads["leads"]:
        if slug and lead.get("slug") == slug:
            return lead
        if name and normalisiere(lead["name"]) == normalisiere(name):
            return lead
    return None


def upsert_lead(eintrag):
    leads = lade_leads()
    vorhanden = finde_lead(leads, name=eintrag["name"], slug=eintrag.get("slug"))
    if vorhanden:
        # Status nie zurückdrehen (z. B. 'kunde' bleibt 'kunde', auch wenn neu gebaut wird).
        if STATUS.index(vorhanden.get("status", "demo_erstellt")) > STATUS.index(eintrag["status"]):
            eintrag["status"] = vorhanden["status"]
        vorhanden.update({k: v for k, v in eintrag.items() if v not in (None, "")})
    else:
        leads["leads"].append(eintrag)
    speichere_json(LEADS_FILE, leads)
    schreibe_uebersicht(leads)


def schreibe_uebersicht(leads):
    """daten/UEBERSICHT.md: Tabelle aller Läden – auf GitHub direkt lesbar."""
    reihen = sorted(leads["leads"], key=lambda l: l.get("datum", ""), reverse=True)
    zeilen = ["# Übersicht aller Läden", "",
              "Automatisch erzeugt von `fabrik/fabrik.py` – nicht von Hand bearbeiten.", "",
              "| Datum | Laden | Status | Adresse | Demo | Briefing |", "|---|---|---|---|---|---|"]
    for l in reihen:
        demo = f'[ansehen]({l["url"]})' if l.get("url") else (f'`{l["demo"]}`' if l.get("demo") else "")
        briefing = f'[Briefing](briefings/{l["slug"]}.md)' if l.get("demo") else (l.get("grund") or "")
        zeilen.append(f'| {l.get("datum", "")} | {l["name"]} | {l.get("status", "")} | '
                      f'{l.get("adresse", "")} | {demo} | {briefing} |')
    UEBERSICHT_FILE.write_text("\n".join(zeilen) + "\n", encoding="utf-8")


# ---------------------------------------------------------------- Prüfung der Laden-Datei

def pruefe(daten):
    fehler, hinweise = [], []
    for feld in ["slug", "name", "kategorie", "adresse", "beschreibung", "speisekarte", "akquise"]:
        if not daten.get(feld):
            fehler.append(f"Pflichtfeld fehlt: {feld}")
    for pfad in finde_todos(daten):
        fehler.append(f"Noch 'TODO' in {pfad}")
    if daten.get("slug") and daten["slug"] != slugify(daten["slug"]):
        fehler.append(f"slug muss klein/ohne Sonderzeichen sein, z. B. '{slugify(daten['slug'])}'")

    entwuerfe = entwuerfe_von(daten)
    if not 1 <= len(entwuerfe) <= 4:
        fehler.append("entwuerfe: 1 bis 4 Entwürfe angeben.")
    for i, e in enumerate(entwuerfe, 1):
        if e.get("theme") not in THEMES:
            fehler.append(f"Entwurf {i}: unbekanntes theme '{e.get('theme')}'. Erlaubt: {', '.join(THEMES)}")
        if e.get("layout", "buehne") not in LAYOUTS:
            fehler.append(f"Entwurf {i}: unbekanntes layout '{e.get('layout')}'. Erlaubt: {', '.join(LAYOUTS)}")
    if len(entwuerfe) > 1:
        for i, e in enumerate(entwuerfe, 1):
            if not e.get("titel") or not e.get("idee"):
                fehler.append(f"Entwurf {i}: 'titel' und 'idee' angeben (werden in der Entwurfs-Übersicht gezeigt).")
        kombis = [(e.get("theme"), e.get("layout", "buehne")) for e in entwuerfe]
        if len(set(kombis)) != len(kombis):
            fehler.append("Zwei Entwürfe sind identisch (gleiches theme + layout).")

    zeiten = daten.get("oeffnungszeiten")
    if zeiten:
        for tag, bereiche in zeiten.items():
            if tag not in TAGE:
                fehler.append(f"oeffnungszeiten: unbekannter Tag '{tag}' (erlaubt: {', '.join(TAGE)})")
            for b in bereiche:
                if not ZEIT_RE.match(b):
                    fehler.append(f"oeffnungszeiten.{tag}: '{b}' hat nicht das Format HH:MM-HH:MM")
    else:
        hinweise.append("Keine Öffnungszeiten – auf der Seite steht 'folgen in Kürze'.")

    for kat in daten.get("speisekarte") or []:
        if not kat.get("kategorie") or not kat.get("eintraege"):
            fehler.append("Jede Speisekarten-Kategorie braucht 'kategorie' und 'eintraege'.")
        for e in kat.get("eintraege", []):
            if not e.get("name"):
                fehler.append(f"Eintrag ohne Namen in Kategorie '{kat.get('kategorie')}'.")
            preise = [e.get("preis")] + [v.get("preis") for v in e.get("varianten", [])]
            for preis in filter(None, preise):
                if not re.match(r"^\d+,\d{2}$", preis):
                    fehler.append(f"Preis '{preis}' bei '{e.get('name')}' bitte als '8,50' (ohne €).")

    if daten.get("speisekarte_quelle") not in ("echt", "teilweise", "beispiel"):
        fehler.append("speisekarte_quelle muss 'echt', 'teilweise' oder 'beispiel' sein.")
    akq = daten.get("akquise") or {}
    for feld in ["grund", "quellen", "fehlende_infos", "gespraechseinstieg"]:
        if not akq.get(feld):
            fehler.append(f"akquise.{feld} fehlt")
    if not daten.get("telefon"):
        hinweise.append("Keine Telefonnummer – Anruf-Button wird ausgeblendet.")
    return fehler, hinweise


# ---------------------------------------------------------------- Befehle

def jinja_env():
    return jinja2.Environment(
        loader=jinja2.FileSystemLoader(VORLAGE_DIR),
        autoescape=jinja2.select_autoescape(["html"]),
        trim_blocks=True,
        lstrip_blocks=True,
    )


def demo_url(config, slug):
    basis = (config.get("demo_basis_url") or "").rstrip("/")
    return f"{basis}/{slug}/" if basis else ""


def entwurf_pfad(slug, nummer):
    """Entwurf 1 liegt direkt unter demos/<slug>/, weitere unter demos/<slug>/<n>/."""
    return DEMOS_DIR / slug / ("index.html" if nummer == 1 else f"{nummer}/index.html")


def cmd_bauen(args):
    config = lade_json(CONFIG_FILE, {})
    pfad = LAEDEN_DIR / f"{args.slug}.json"
    daten = lade_json(pfad)
    if daten is None:
        sys.exit(f"Laden-Datei fehlt: {pfad.relative_to(ROOT)}  (anlegen mit: fabrik.py neu \"Name\")")

    fehler, hinweise = pruefe(daten)
    for h in hinweise:
        print("Hinweis:", h)
    if fehler:
        print("\nFEHLER in", pfad.relative_to(ROOT))
        for f in fehler:
            print(" -", f)
        sys.exit(1)

    slug = daten["slug"]
    adresse = adresse_text(daten["adresse"])
    zeiten = daten.get("oeffnungszeiten")
    tabelle = None
    if zeiten:
        tabelle = [(TAGE_LANG[i], [b.replace("-", "–") for b in zeiten.get(t, [])]) for i, t in enumerate(TAGE)]
    tags = {t for kat in daten["speisekarte"] for e in kat["eintraege"] for t in e.get("tags", [])}
    filter_tags = [{"key": k, "label": TAG_LABELS[k]} for k in ("vegetarisch", "vegan", "scharf")
                   if k in tags or (k == "vegetarisch" and "vegan" in tags)]
    entwuerfe = entwuerfe_von(daten)
    env = jinja_env()

    # Alte Entwurfs-Ordner entfernen, falls es jetzt weniger Entwürfe gibt.
    ordner = DEMOS_DIR / slug
    if ordner.exists():
        for unter in ordner.iterdir():
            if unter.is_dir() and unter.name.isdigit() and int(unter.name) > len(entwuerfe):
                shutil.rmtree(unter)
    if len(entwuerfe) == 1 and (ordner / "entwuerfe").exists():
        shutil.rmtree(ordner / "entwuerfe")

    gebaut = []
    for nummer, entwurf in enumerate(entwuerfe, 1):
        theme = THEMES[entwurf["theme"]]
        zurueck = "" if nummer == 1 else "../"
        html = env.get_template("seite.html").render(
            d=daten,
            t=theme,
            layout=entwurf.get("layout", "buehne"),
            entwurf={"nummer": nummer, "anzahl": len(entwuerfe), "titel": entwurf.get("titel", ""),
                     "uebersicht": f"{zurueck}entwuerfe/index.html" if len(entwuerfe) > 1 else ""},
            fonts={"sans": SANS, "display": display_stack(theme),
                   "css": schrift_css(["Inter", theme["display_font"]])},
            agentur=config.get("agentur", {}),
            adresse=adresse,
            maps_url="https://www.google.com/maps/search/?api=1&query=" + quote_plus(f'{daten["name"]} {adresse}'),
            tel_href=tel_href(daten.get("telefon")),
            tabelle=tabelle,
            filter_tags=filter_tags,
            tag_labels=TAG_LABELS,
            vorschau=karten_vorschau(daten["speisekarte"]),
            favicon=favicon(daten.get("deko_text") or daten["name"], theme),
            jsonld=jsonld(daten),
            jahr=datetime.date.today().year,
        )
        ziel = entwurf_pfad(slug, nummer)
        ziel.parent.mkdir(parents=True, exist_ok=True)
        ziel.write_text(html, encoding="utf-8")
        gebaut.append(ziel)

    if len(entwuerfe) > 1:
        karten = []
        for nummer, entwurf in enumerate(entwuerfe, 1):
            theme = THEMES[entwurf["theme"]]
            karten.append({
                "nummer": nummer,
                "link": "../index.html" if nummer == 1 else f"../{nummer}/index.html",
                "titel": entwurf["titel"],
                "idee": entwurf["idee"],
                "theme": theme,
                "layout_text": LAYOUTS[entwurf.get("layout", "buehne")].split(":")[0],
            })
        uebersicht = env.get_template("entwuerfe.html").render(
            d=daten, karten=karten, agentur=config.get("agentur", {}),
            css=schrift_css(["Inter"]), adresse=adresse)
        ziel = DEMOS_DIR / slug / "entwuerfe" / "index.html"
        ziel.parent.mkdir(parents=True, exist_ok=True)
        ziel.write_text(uebersicht, encoding="utf-8")
        gebaut.append(ziel)

    url = demo_url(config, slug)
    briefing = env.get_template("briefing.md").render(
        d=daten, a=daten["akquise"], adresse=adresse, url=url, datum=heute(),
        pfad=entwurf_pfad(slug, 1).relative_to(ROOT), entwuerfe=entwuerfe, themes=THEMES, layouts=LAYOUTS,
    )
    BRIEFINGS_DIR.mkdir(parents=True, exist_ok=True)
    (BRIEFINGS_DIR / f"{slug}.md").write_text(briefing, encoding="utf-8")

    upsert_lead({
        "slug": slug,
        "name": daten["name"],
        "adresse": adresse,
        "kategorie": daten["kategorie"],
        "status": "demo_erstellt",
        "herkunft": daten.get("herkunft", "akquise"),
        "datum": heute(),
        "demo": str(entwurf_pfad(slug, 1).relative_to(ROOT)),
        "entwuerfe": len(entwuerfe),
        "url": url,
    })
    print()
    for g in gebaut:
        print("Gebaut:", g.relative_to(ROOT))
    print(f"Briefing: daten/briefings/{slug}.md")
    if url:
        print(f"Live (nach Push + Netlify-Deploy): {url}" + (f"  ·  Entwürfe: {url}entwuerfe/" if len(entwuerfe) > 1 else ""))


GERUEST = {
    "slug": None,
    "name": None,
    "herkunft": "auftrag",
    "untertitel": "TODO: ein Satz, was den Laden ausmacht",
    "kategorie": "TODO: z. B. Pizzeria, Döner & Grill, Café",
    "stadtteil": None,
    "deko_text": None,
    "adresse": {"strasse": "TODO", "plz": "TODO", "ort": None},
    "anfahrt": None,
    "telefon": None,
    "email": None,
    "instagram": None,
    "status_hinweis": None,
    "oeffnungszeiten": None,
    "oeffnungszeiten_bestaetigt": False,
    "highlights": [],
    "ueber_titel": None,
    "beschreibung": "TODO: 2 kurze Absätze, getrennt durch \\n\\n",
    "services": [],
    "entwuerfe": [
        {"theme": "TODO", "layout": "buehne", "titel": "TODO", "idee": "TODO"},
        {"theme": "TODO", "layout": "split", "titel": "TODO", "idee": "TODO"},
        {"theme": "TODO", "layout": "karte", "titel": "TODO", "idee": "TODO"},
    ],
    "speisekarte_quelle": "beispiel",
    "speisekarte": [{"kategorie": "TODO", "eintraege": [{"name": "TODO", "beschreibung": None, "preis": "0,00"}]}],
    "akquise": {
        "grund": "TODO",
        "quellen": ["TODO"],
        "fehlende_infos": ["TODO"],
        "gespraechseinstieg": "TODO",
        "angebot": [],
    },
}


def cmd_neu(args):
    config = lade_json(CONFIG_FILE, {})
    ort = args.ort or config.get("stadt", "")
    slug = slugify(f"{args.name} {ort}")
    pfad = LAEDEN_DIR / f"{slug}.json"
    if pfad.exists():
        sys.exit(f"Gibt es schon: {pfad.relative_to(ROOT)} – bearbeiten und mit 'bauen {slug}' neu bauen.")
    lead = finde_lead(lade_leads(), name=args.name)
    if lead:
        print(f'Achtung: "{lead["name"]}" steht schon in der Liste (Status {lead.get("status")}).')
    geruest = json.loads(json.dumps(GERUEST))
    geruest.update(slug=slug, name=args.name)
    geruest["adresse"]["ort"] = ort
    speichere_json(pfad, geruest)
    print(f"Angelegt: {pfad.relative_to(ROOT)}  ->  alle 'TODO' ausfüllen, dann: fabrik.py bauen {slug}")


def cmd_katalog(args):
    print("FARBWELTEN (theme)\n")
    for key, t in THEMES.items():
        print(f'  {key:11} {t["name"]:14} {t["scheme"]:5}  Schrift: {t["display_font"]:13} passt zu: {t["passt_zu"]}')
    print("\nLAYOUTS (layout)\n")
    for key, text in LAYOUTS.items():
        print(f"  {key:8} {text}")


def cmd_liste(args):
    leads = lade_leads()["leads"]
    if not leads:
        print("Noch keine Leads.")
    for lead in sorted(leads, key=lambda l: (l.get("status", ""), l["name"].lower())):
        print(f'{lead.get("status", "?"):15} {lead["name"]}  |  {lead.get("adresse", "")}'
              + (f'  |  {lead["grund"]}' if lead.get("grund") else ""))
    print(f"\n{len(leads)} Läden bekannt – diese NICHT erneut als Lead nehmen.")


def cmd_pruefen(args):
    lead = finde_lead(lade_leads(), name=args.name)
    if lead:
        print(f'BEKANNT ({lead.get("status")}): {lead["name"]} – {lead.get("adresse", "")}')
        sys.exit(1)
    print(f'Neu: "{args.name}" ist noch nicht in der Liste.')


def cmd_ausschliessen(args):
    upsert_lead({
        "slug": slugify(args.name),
        "name": args.name,
        "adresse": args.adresse or "",
        "status": "ausgeschlossen",
        "datum": heute(),
        "grund": args.grund,
    })
    print(f'Ausgeschlossen: {args.name} ({args.grund})')


def cmd_status(args):
    leads = lade_leads()
    lead = finde_lead(leads, slug=args.slug)
    if not lead:
        sys.exit(f"Kein Laden mit slug '{args.slug}'.")
    lead["status"] = args.status
    lead["status_datum"] = heute()
    if args.notiz:
        lead["notiz"] = args.notiz
    speichere_json(LEADS_FILE, leads)
    schreibe_uebersicht(leads)
    print(f'{lead["name"]}: Status -> {args.status}')


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="befehl", required=True)
    sub.add_parser("katalog").set_defaults(func=cmd_katalog)
    sub.add_parser("liste").set_defaults(func=cmd_liste)
    s = sub.add_parser("neu")
    s.add_argument("name")
    s.add_argument("--ort")
    s.set_defaults(func=cmd_neu)
    s = sub.add_parser("pruefen")
    s.add_argument("name")
    s.set_defaults(func=cmd_pruefen)
    s = sub.add_parser("bauen")
    s.add_argument("slug")
    s.set_defaults(func=cmd_bauen)
    s = sub.add_parser("ausschliessen")
    s.add_argument("name")
    s.add_argument("--grund", required=True)
    s.add_argument("--adresse")
    s.set_defaults(func=cmd_ausschliessen)
    s = sub.add_parser("status")
    s.add_argument("slug")
    s.add_argument("status", choices=STATUS)
    s.add_argument("--notiz")
    s.set_defaults(func=cmd_status)
    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
