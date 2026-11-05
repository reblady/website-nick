# CLAUDE.md

Persönliche Link-/Profilseite von Nick Tissen (@reblady). Reine statische Seite ohne Build-Schritt, ohne Framework, ohne package.json.

## Hosting & Deployment

- GitHub Pages, Branch `main`, Root `/` (legacy build). Jeder Push auf `main` geht direkt live.
- Aktuell erreichbar unter `reblady.de/website-nick/` (Custom Domain kommt aus dem Repo `reblady/reblady.github.io`). Es gibt hier keine `CNAME`-Datei.
- Eigene Domain ist noch offen: `nlck.de` war geplant (steht noch in der Repo-Beschreibung), ist aber vergeben. Bis das entschieden ist, keine `CNAME`-Datei anlegen.
- Weil die Seite unter einem Unterpfad laufen kann, Pfade immer **relativ** halten (`assets/...`, `data/...`), nie mit führendem `/`.

## Lokal starten

```bash
python3 -m http.server 4173
```

Ist auch als `reblady-static` in `.claude/launch.json` hinterlegt. `file://` funktioniert nicht, weil `data/updates.json` per `fetch` geladen wird und `intro.js` ein ES-Modul ist.

## Dateien

- `index.html` – gesamtes Markup. Ein Inline-Script im `<head>` setzt `data-theme` vor dem ersten Paint (gegen Flackern).
- `styles.css` – alle Styles. Design-Tokens als CSS-Variablen in `:root`, Farben pro Theme unter `html[data-theme='dark']` / `html[data-theme='light']`. Mobile-Breakpoint: `max-width: 700px`.
- `script.js` – klassisches Script (`defer`), alle Features als `initXxx()`-Funktionen, gestartet in `DOMContentLoaded`.
- `intro.js` – ES-Modul, lädt Three.js `0.160.1` von esm.sh und rendert die 3D-Intro-Figur, die winkt.
- `data/updates.json` – Inhalte für den Bereich „Aktuelles“ (`date` im ISO-Format, `title`, `text`, optional `link`). Neueste zuerst.
- `assets/` – Favicon (SVG, passt sich dem Farbschema an).

## Wie die Teile zusammenhängen

- **Intro-Gate:** `body.intro-locked` sperrt die Seite, bis geklickt wird. `script.js` ist die einzige Stelle, die das Gate wirklich schließt (`dismissIntro()`). Wenn `intro.js` erfolgreich lädt, meldet es sich über `window.__setIntroEnhanced()` an, lässt die Figur winken und ruft danach `window.dismissIntro()` auf. Schlägt Three.js/WebGL fehl, funktioniert der einfache Klick trotzdem. Diese Fallback-Logik nicht kaputt machen.
- `dismissIntro` und `getAudioContext` werden von `intro.js` über `window` aufgerufen. Sie müssen deshalb globale Funktionsdeklarationen in `script.js` bleiben (kein Modul, kein IIFE).
- **Sounds:** werden komplett per Web Audio synthetisiert, es gibt keine Audiodateien. Der Name-Reveal-Sound ist an die CSS-Animation `name-reveal` (1350 ms, Aufsetzpunkt bei 65 %) gekoppelt. Wenn sich die Animation in `styles.css` ändert, die Konstanten in `playNameReveal()` mit anpassen (und umgekehrt).
- **Theme-Toggle:** kreisförmige Überblendung per View Transitions API mit Fallback. Die Auswahl wird in `localStorage` unter `theme` gespeichert.
- **Scroll-Effekte:** Der Hero schrumpft beim Scrollen (`--condense`), dann erscheint der Mini-Header. Die Link-Karten werden auf Desktop (`min-width: 701px`) horizontal mitgescrollt, auf Mobile normal gestapelt.
- **Discord-Status:** wird über die Lanyard-API (`api.lanyard.rest`) jede Minute abgefragt. `DISCORD_USER_ID` oben in `script.js` ist noch ein Platzhalter.

## Konventionen

- UI-Texte auf Deutsch, Code-Kommentare auf Englisch.
- Vanilla JS mit `'use strict'`. Keine Abhängigkeiten außer Three.js (CDN) und Google Fonts (Fraunces, Space Grotesk).
- Neue Farben immer als Token für **beide** Themes anlegen, keine hart codierten Farbwerte in Komponenten.
- Glas-Optik über die vorhandenen Klassen `glass-shine` / `glass-chip` wiederverwenden.
- Änderungen direkt auf `main` committen und pushen, ohne Branch oder PR (geht sofort live).
- Commits werden mit Versionsnummern benannt (`4.0`, `3.3`, …), optional mit kurzer Beschreibung dahinter.

## Noch offene Platzhalter

Die echten Daten fehlen noch. Platzhalter drin lassen, bis Nick sie liefert, und nichts erfinden.


- Motto im Hero (`hero__motto`)
- Alle Social-Links (`href="#"`) und ihre Untertitel
- `DISCORD_USER_ID`
- Einträge in `data/updates.json`
