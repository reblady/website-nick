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

## Geplanter Neustart (Stand 2026-11-05)

Alles oberhalb beschreibt den **aktuellen** Code (Version 4.1). Die Seite wird komplett neu geschrieben. Dabei nicht auf alten Code, die Git-History oder Backups zurückgreifen. Nach dem Neustart diese Datei an den neuen Code anpassen.

**Richtung:** keine Linktree-Seite mehr, sondern eine immersive Seite im Poster-Stil mit vielen Animationen und kleinen 3D-Elementen.

- **Ablauf:** eine lange Scroll-Story, bei der beim Scrollen nacheinander Szenen kommen.
- **Retro-Stil:** PS1-Lowpoly-Optik mit dem typischen Texturstil (wackelnde Vertices, verpixelte und verzerrte Texturen, Dithering, niedrige Auflösung).
- **Glas:** Liquid Glass ähnlich wie bei Apple, oder vergleichbar, solange es zum Gesamtbild passt.
- **Mischung aus beidem:** Die PS1-Szenen laufen im Hintergrund, darüber liegen scharfe Liquid-Glass-Panels, wie ein modernes Interface über einem alten Spiel. Text und UI bleiben scharf und gut lesbar.
- **3D-Elemente:** Glas-Objekte, ein Avatar bzw. eine Figur von Nick und Retro-Gegenstände. Nick liefert dazu noch genauere Ideen, also vorher nachfragen.
- **Intro:** ein Bootscreen wie beim Einschalten einer PS1, mit „Press Start“.
- **Sound:** dezente Retro- bzw. Konsolen-Sounds, keine Hintergrundmusik.
- **Abschnitte:** Über mich, Aktuelles (aus `data/updates.json`), Projekte/Gaming.
- **Plattformen:** Instagram, Discord, GitHub, Steam. YouTube ist vorerst raus und kommt vielleicht später wieder dazu.
- **Discord:** Der Live-Status über Lanyard bleibt.
- **Farben:** Palette „Obsidian Gold, gealtert“, also die bisherigen Farben, nur staubiger und passend zum PS1-Stil. Dark/Light mit Kreis-Überblendung beim Umschalten bleibt.
  - Dunkel: Himmel `#4a4f57` → `#5a4a35` → `#1a1712`, Berge `#2a2620`, Boden `#100e0b`, Nebel `#3a352c`, Akzent/Objekte `#e0b46a` / `#8a6a3a`, Text `#f4ecdd`, gedämpfter Text `#c9bda6`
  - Hell: Himmel `#f6ead9` → `#ecc9a2` → `#cf8a63`, Berge `#b6795a`, Boden `#7e4d36`, Nebel `#e9cdb0`, Akzent/Objekte `#a8492a` / `#e08a62`, Text `#2c2117`, gedämpfter Text `#5e4a38`
- **Mobile:** genauso wichtig wie Desktop. Auch auf dem Handy das volle Erlebnis, nur angepasst.
- **Performance:** vorerst zweitrangig, die Optik geht vor. Keinen Leichten Modus, keine `prefers-reduced-motion`-Fallbacks und kein Drosseln einbauen. Darum kümmern wir uns gezielt, wenn das Design steht.

## Noch offen

Die echten Daten fehlen noch. Platzhalter drin lassen, bis Nick sie liefert, und nichts erfinden.

- Motto, Texte für „Über mich“ und „Projekte/Gaming“
- Alle Social-Links und die `DISCORD_USER_ID`
- Einträge in `data/updates.json`
- Details zu den 3D-Elementen
- Eigene Domain
