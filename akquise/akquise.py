#!/usr/bin/env python3
"""Akquise-Werkzeug: baut Demo-Websites für Gastro-Betriebe und führt die Lead-Liste.

Befehle:
  python3 akquise/akquise.py liste                      alle bekannten Läden (Duplikat-Schutz)
  python3 akquise/akquise.py pruefen "Name"             ist der Laden schon bekannt?
  python3 akquise/akquise.py bauen <slug>               Lead-Datei -> demos/<slug>/index.html + Briefing
  python3 akquise/akquise.py ausschliessen "Name" --grund "..." [--adresse "..."]
  python3 akquise/akquise.py status <slug> <status> [--notiz "..."]

Die Lead-Datei liegt unter akquise/leads/<slug>.json (Aufbau: siehe akquise/TAGESLAUF.md).
"""
import argparse
import base64
import datetime
import json
import re
import sys
import unicodedata
from pathlib import Path
from urllib.parse import quote_plus

try:
    import jinja2
except ImportError:
    sys.exit("Jinja2 fehlt: pip install jinja2")

ROOT = Path(__file__).resolve().parent.parent
AKQUISE = ROOT / "akquise"
LEADS_DIR = AKQUISE / "leads"
BRIEFINGS_DIR = AKQUISE / "briefings"
DEMOS_DIR = ROOT / "demos"
LEADS_FILE = AKQUISE / "leads.json"
CONFIG_FILE = AKQUISE / "config.json"

STATUS = ["demo_erstellt", "praesentiert", "kunde", "kein_interesse", "ausgeschlossen"]
TAGE = ["mo", "di", "mi", "do", "fr", "sa", "so"]
TAGE_LANG = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"]
ZEIT_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-4]):[0-5]\d$")

SANS = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
FALLBACK_SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
FALLBACK_SERIF = 'Georgia, "Times New Roman", serif'

# Schriften werden als Datei in die Seite eingebettet (kein Google-Fonts-Abruf, DSGVO-freundlich).
# Lizenzen: akquise/vorlage/schriften/LIZENZEN.txt (alle SIL Open Font License).
SCHRIFTEN_DIR = AKQUISE / "vorlage" / "schriften"
SCHRIFTEN = {
    "Inter": {400: "inter-latin-400-normal.woff2", 700: "inter-latin-700-normal.woff2"},
    "Anton": {400: "anton-latin-400-normal.woff2"},
    "Archivo Black": {400: "archivo-black-latin-400-normal.woff2"},
    "Bebas Neue": {400: "bebas-neue-latin-400-normal.woff2"},
    "Fraunces": {700: "fraunces-latin-700-normal.woff2"},
}

# Farbwelten für die Vorlage. Neue Branche? Einfach hier ein Theme ergänzen.
# display_font muss in SCHRIFTEN stehen, display_weight muss eine dort vorhandene Stärke sein.
THEMES = {
    "street": dict(scheme="dark", bg="#0e0e0f", surface="#18181b", text="#f4f1ea", muted="#a9a59c",
                   line="#2a2a2e", line_strong="#47474d", accent="#d7ff3a", accent_ink="#0e0e0f",
                   accent_text="#d7ff3a", accent2="#ff3d81", display_font="Anton", display_weight=400,
                   transform="uppercase", tracking="0", radius="14px"),
    "doener": dict(scheme="dark", bg="#141110", surface="#1e1a18", text="#f7efe6", muted="#b3a79b",
                   line="#2f2925", line_strong="#4d433c", accent="#ff6b1a", accent_ink="#141110",
                   accent_text="#ff8a47", accent2="#ffd23f", display_font="Archivo Black", display_weight=400,
                   transform="uppercase", tracking="-0.01em", radius="14px"),
    "pizza": dict(scheme="light", bg="#fbf6ee", surface="#ffffff", text="#2a1f1a", muted="#6f6159",
                  line="#eadfce", line_strong="#cdbba4", accent="#c8102e", accent_ink="#ffffff",
                  accent_text="#b00e28", accent2="#2e7d32", display_font="Fraunces", display_weight=700,
                  transform="none", tracking="-0.02em", radius="10px"),
    "asia": dict(scheme="dark", bg="#101012", surface="#1a1a1e", text="#f3efe8", muted="#a8a29a",
                 line="#2b2b30", line_strong="#46464d", accent="#e0313f", accent_ink="#ffffff",
                 accent_text="#ff5a66", accent2="#f2c14e", display_font="Bebas Neue", display_weight=400,
                 transform="uppercase", tracking="0.02em", radius="6px"),
    "cafe": dict(scheme="light", bg="#f6efe6", surface="#fffaf4", text="#3b2a20", muted="#7a6555",
                 line="#e6d8c7", line_strong="#cbb59d", accent="#8a5a3b", accent_ink="#ffffff",
                 accent_text="#7a4e32", accent2="#c9a227", display_font="Fraunces", display_weight=700,
                 transform="none", tracking="-0.02em", radius="18px"),
    "griechisch": dict(scheme="light", bg="#f6f9fc", surface="#ffffff", text="#0d2b45", muted="#566b7f",
                       line="#dbe5ef", line_strong="#b5c6d7", accent="#1560bd", accent_ink="#ffffff",
                       accent_text="#11519f", accent2="#e3b23c", display_font="Fraunces", display_weight=700,
                       transform="none", tracking="-0.01em", radius="8px"),
    "burger": dict(scheme="light", bg="#fff8ec", surface="#ffffff", text="#1d1d1d", muted="#6b6257",
                   line="#efe2cc", line_strong="#d8c3a2", accent="#d62839", accent_ink="#ffffff",
                   accent_text="#c62835", accent2="#f4a261", display_font="Archivo Black", display_weight=400,
                   transform="uppercase", tracking="-0.01em", radius="12px"),
    "modern": dict(scheme="light", bg="#fafaf9", surface="#ffffff", text="#1c1917", muted="#66615c",
                   line="#e7e5e4", line_strong="#cfcac6", accent="#0f766e", accent_ink="#ffffff",
                   accent_text="#0d6b63", accent2="#f59e0b", display_font="Inter", display_weight=700,
                   transform="none", tracking="-0.03em", radius="12px"),
}


def schrift_css(theme):
    """@font-face-Regeln mit eingebetteten Schriftdateien für Fließtext (Inter) + Theme-Überschriften."""
    regeln = []
    for familie in dict.fromkeys(["Inter", theme["display_font"]]):
        for gewicht, datei in SCHRIFTEN[familie].items():
            daten = base64.b64encode((SCHRIFTEN_DIR / datei).read_bytes()).decode()
            regeln.append(f'@font-face {{ font-family: "{familie}"; font-style: normal; font-weight: {gewicht}; '
                          f'font-display: swap; src: url(data:font/woff2;base64,{daten}) format("woff2"); }}')
    return "\n".join(regeln)


def display_stack(theme):
    fallback = FALLBACK_SERIF if theme["display_font"] == "Fraunces" else FALLBACK_SANS
    return f'"{theme["display_font"]}", {fallback}'


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
    teile = [adr.get("strasse", "").strip(), f'{adr.get("plz", "")} {adr.get("ort", "")}'.strip()]
    return ", ".join(t for t in teile if t)


def tel_href(nummer):
    ziffern = re.sub(r"[^\d+]", "", nummer or "")
    if ziffern.startswith("0") and not ziffern.startswith("00"):
        ziffern = "+49" + ziffern[1:]
    return "tel:" + ziffern


TAG_LABELS = {"vegetarisch": "Vegetarisch", "vegan": "Vegan", "scharf": "Scharf", "beliebt": "Beliebt", "neu": "Neu"}


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
            "streetAddress": adr.get("strasse", ""),
            "postalCode": adr.get("plz", ""),
            "addressLocality": adr.get("ort", ""),
            "addressCountry": "DE",
        },
    }
    if daten.get("telefon"):
        ld["telephone"] = daten["telefon"]
    zeiten = daten.get("oeffnungszeiten") or {}
    englisch = dict(zip(TAGE, ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]))
    ld["openingHours"] = [f"{englisch[t]} {b}" for t in TAGE for b in zeiten.get(t, [])] or None
    return {k: v for k, v in ld.items() if v}


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


# ---------------------------------------------------------------- Prüfung der Lead-Datei

def pruefe(daten):
    fehler, hinweise = [], []
    for feld in ["slug", "name", "kategorie", "theme", "adresse", "beschreibung", "speisekarte", "akquise"]:
        if not daten.get(feld):
            fehler.append(f"Pflichtfeld fehlt: {feld}")
    if daten.get("theme") and daten["theme"] not in THEMES:
        fehler.append(f"Unbekanntes theme '{daten['theme']}'. Erlaubt: {', '.join(THEMES)}")
    if daten.get("slug") and daten["slug"] != slugify(daten["slug"]):
        fehler.append(f"slug muss klein/ohne Sonderzeichen sein, z. B. '{slugify(daten['slug'])}'")

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

    for kat in daten.get("speisekarte", []):
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

def cmd_bauen(args):
    config = lade_json(CONFIG_FILE, {})
    pfad = LEADS_DIR / f"{args.slug}.json"
    daten = lade_json(pfad)
    if daten is None:
        sys.exit(f"Lead-Datei fehlt: {pfad.relative_to(ROOT)}")

    fehler, hinweise = pruefe(daten)
    for h in hinweise:
        print("Hinweis:", h)
    if fehler:
        print("\nFEHLER in", pfad.relative_to(ROOT))
        for f in fehler:
            print(" -", f)
        sys.exit(1)

    theme = THEMES[daten["theme"]]
    adresse = adresse_text(daten["adresse"])
    zeiten = daten.get("oeffnungszeiten")
    tabelle = None
    if zeiten:
        tabelle = [(TAGE_LANG[i], [b.replace("-", "–") for b in zeiten.get(t, [])]) for i, t in enumerate(TAGE)]

    tags = {t for kat in daten["speisekarte"] for e in kat["eintraege"] for t in e.get("tags", [])}
    filter_tags = [{"key": k, "label": TAG_LABELS[k]} for k in ("vegetarisch", "vegan", "scharf")
                   if k in tags or (k == "vegetarisch" and "vegan" in tags)]

    env = jinja2.Environment(
        loader=jinja2.FileSystemLoader(AKQUISE / "vorlage"),
        autoescape=jinja2.select_autoescape(["html"]),
        trim_blocks=True,
        lstrip_blocks=True,
    )
    html = env.get_template("seite.html").render(
        d=daten,
        t=theme,
        fonts={"sans": SANS, "display": display_stack(theme), "css": schrift_css(theme)},
        agentur=config.get("agentur", {}),
        adresse=adresse,
        maps_url="https://www.google.com/maps/search/?api=1&query=" + quote_plus(f'{daten["name"]} {adresse}'),
        tel_href=tel_href(daten.get("telefon")),
        tabelle=tabelle,
        filter_tags=filter_tags,
        tag_labels=TAG_LABELS,
        favicon=favicon(daten.get("deko_text") or daten["name"], theme),
        jsonld=jsonld(daten),
        jahr=datetime.date.today().year,
    )
    ziel = DEMOS_DIR / daten["slug"] / "index.html"
    ziel.parent.mkdir(parents=True, exist_ok=True)
    ziel.write_text(html, encoding="utf-8")

    url = demo_url(config, daten["slug"])
    briefing = env.get_template("briefing.md").render(
        d=daten, a=daten["akquise"], adresse=adresse, url=url, datum=heute(),
        pfad=ziel.relative_to(ROOT),
    )
    BRIEFINGS_DIR.mkdir(parents=True, exist_ok=True)
    (BRIEFINGS_DIR / f'{daten["slug"]}.md').write_text(briefing, encoding="utf-8")

    upsert_lead({
        "slug": daten["slug"],
        "name": daten["name"],
        "adresse": adresse,
        "kategorie": daten["kategorie"],
        "status": "demo_erstellt",
        "datum": heute(),
        "demo": str(ziel.relative_to(ROOT)),
        "url": url,
    })
    print(f"\nFertig: {ziel.relative_to(ROOT)}")
    print(f"Briefing: akquise/briefings/{daten['slug']}.md")
    if url:
        print(f"Live (nach Push + Netlify-Deploy): {url}")


def demo_url(config, slug):
    basis = (config.get("demo_basis_url") or "").rstrip("/")
    return f"{basis}/{slug}/" if basis else ""


def cmd_liste(args):
    leads = lade_leads()["leads"]
    if not leads:
        print("Noch keine Leads.")
    for lead in sorted(leads, key=lambda l: (l.get("status", ""), l["name"].lower())):
        print(f'{lead.get("status", "?"):15} {lead["name"]}  |  {lead.get("adresse", "")}'
              + (f'  |  {lead["grund"]}' if lead.get("grund") else ""))
    print(f"\n{len(leads)} Läden bekannt – diese NICHT erneut nehmen.")


def cmd_pruefen(args):
    lead = finde_lead(lade_leads(), name=args.name)
    if lead:
        print(f'BEKANNT ({lead.get("status")}): {lead["name"]} – {lead.get("adresse", "")}')
        sys.exit(1)
    print(f'Neu: "{args.name}" ist noch nicht in der Lead-Liste.')


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
        sys.exit(f"Kein Lead mit slug '{args.slug}'.")
    lead["status"] = args.status
    lead["status_datum"] = heute()
    if args.notiz:
        lead["notiz"] = args.notiz
    speichere_json(LEADS_FILE, leads)
    print(f'{lead["name"]}: Status -> {args.status}')


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="befehl", required=True)
    sub.add_parser("liste").set_defaults(func=cmd_liste)
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
