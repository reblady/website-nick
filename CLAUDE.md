# CLAUDE.md

Persönliche Website von Nick Tissen (@reblady). Eine immersive Seite im Poster-Stil: PS1-Lowpoly-3D-Szenen (Three.js) im Hintergrund, darüber scharfe Liquid-Glass-Panels. Rein statisch, ohne Build-Schritt, ohne package.json.

## Hosting & Deployment

- GitHub Pages, Branch `main`, Root `/` (legacy build). Jeder Push auf `main` geht direkt live.
- Aktuell erreichbar unter `reblady.de/website-nick/` (Custom Domain kommt aus dem Repo `reblady/reblady.github.io`). Es gibt hier keine `CNAME`-Datei.
- Eigene Domain ist noch offen: `nlck.de` war geplant (steht noch in der Repo-Beschreibung), ist aber vergeben. Bis das entschieden ist, keine `CNAME`-Datei anlegen.
- Weil die Seite unter einem Unterpfad laufen kann, Pfade immer **relativ** halten (`assets/...`, `js/...`), nie mit führendem `/`.

## Lokal starten

```bash
python3 -m http.server 4173
```

Ist auch als `reblady-static` in `.claude/launch.json` hinterlegt. `file://` funktioniert nicht, weil die Skripte ES-Module sind.

## Dateien

- `index.html` – Markup: Canvas für die 3D-Bühne, Bootscreen, Kamera-Sucher-Overlay, Steuerknöpfe (Ton, Theme), Hero-Panel und der SVG-Filter für die Glas-Lichtbrechung. Ein Inline-Script im `<head>` setzt `data-theme` vor dem ersten Paint.
- `styles.css` – alle Styles. Farben als Tokens pro Theme unter `html[data-theme='dark']` / `html[data-theme='light']`. Handy-Layout per `@media (max-aspect-ratio: 105/100)`, passend zur Umschaltung in `restingLayout()` in `main.js`.
- `js/ps1.js` – PS1-Render-Pipeline: rendert in 240p in ein Render-Target, dann Upscale ohne Filterung mit 4×4-Bayer-Dithering und 15-Bit-Farben, plus Überblendung nach Schwarz/Weiß (`fade`). `ps1Material()` baut Materialien mit Vertex-Snapping (wackelnde Polygone) und affinem Texture-Mapping (verzerrte Texturen). Dazu kleine Helfer für prozedurale Pixel-Texturen.
- `js/avatar.js` – lädt Nicks Avatar aus `assets/models/nick.glb`, ersetzt die Materialien durch `ps1Material` (Textur × Vertex-Farben) und spielt die Clips ab: „Idle“ in Schleife, „Wave“ einmal per `wave()`, danach bleibt der Arm oben.
- `assets/models/nick.glb` – Avatar-Export aus Blender (realistische Proportionen, dunkelblonde Haare, blaue Augen, olivgrüner Hoodie, Jeans, weiße Sneaker). Die Quelldatei ist `assets/models/nick.blend`, aktuell ist die Collection „NickTripoRig“ (`NickRig3`/`NickBody3`). „NickTripo“ ist die Vorversion mit selbst gebauten Ärmeln, „NickAvatar“ der alte Klötzchen-Avatar. Beide sind ausgeblendet.
- `js/handheld.js` – lädt die PSP aus `assets/models/psp.glb`, färbt sie über die Materialnamen (`PSP_Shell`, `PSP_Trim`, `PSP_Buttons`, `PSP_Accent` = Theme-Akzent, `PSP_Led`) und legt eine eigene, unterteilte Bildschirm-Fläche mit dem Foto darüber. `SCREEN` (Bildschirmgröße und -tiefe) und `BODY_WIDTH` müssen zum Export passen.
- `assets/models/psp.glb` – „PlayStation Portable (low poly)“ von Senkinsky (Sketchfab), Lizenz CC BY 4.0. Deshalb steht unten rechts auf der Seite (mobil oben links) ein Credit mit Links, der muss bleiben. Quelle in `assets/models/psp.blend` (Collection „PSP“, Objekt `PSPBody`).
- `js/sound.js` – Retro-Sounds, komplett per Web Audio synthetisiert. Ob der Ton aus ist, steht in `localStorage` unter `muted`.
- `js/main.js` – Ablauf, Kamera, Theme-Umschalter, Discord-Status, Glas-Reflex. Die Konfiguration steht oben in der Datei (`DISCORD_USER_ID`, `PALETTES`, `TIMING`).
- `data/updates.json` – Inhalte für den späteren Bereich „Aktuelles“ (`date` im ISO-Format, `title`, `text`, optional `link`). Wird noch nicht angezeigt.
- `assets/favicon.svg` – Favicon.

## 3D-Modelle (Blender)

Modelle entstehen in Blender. Blender MCP ist eingerichtet, Claude kann Blender also direkt steuern.

- Der Avatar ist ein Lowpoly-Mesh aus Tripo (752 Vertices, 1.500 Dreiecke) mit Tripos Auto-Rig: ein Mixamo-Skelett (`mixamorig:*`, 53 Knochen inkl. Finger) mit Gewichten. Texturen gab es keine. In Blender kam dazu:
  - Flächen per Höhe und Position in Bereiche eingeteilt (Hoodie, Jeans, Schuhe, Sohle, Haut, Gesicht, Haare), jeder Bereich mit eigenem Material. Feinregeln: Handgelenk entlang der Unterarm-Achse geschnitten, gerader Saum (Hoodie nur, wenn alle Vertices z ≥ 0,925), Kapuzen-Innenseite Hoodie, Hinterkopf (z ≥ 1,715, −0,03 < y < 0,095) Haar.
  - UVs per Box-Projektion mit fester Größe (`cube_size` 0,45), damit alle Stoff-Texturen gleich dicht sind. Das Gesicht bekommt eine Planar-Projektion von vorne auf eine 64×64-Gesichtstextur.
  - Ambient Occlusion ist in die Vertex-Farbe `AO` gebacken (Cycles) und auf 0,35–1 angehoben, das ergibt die „gemalte“ Schattierung.
  - Die Arme sind im Mesh seitlich mit dem Oberkörper verschmolzen. Beim Winken zieht der Arm deshalb etwas Hoodie mit, das Mesh bleibt aber geschlossen. Diese Variante war Nick lieber als selbst gebaute Ärmel.
  - Die Animationen „Idle“ und „Wave“ sind von Hand gekeyt, als Rotationen um Welt-Achsen in den Ruherahmen der Knochen umgerechnet.
- PS1-Stil: wenige Polygone, kleine Pixel-Texturen (8–64 px) mit Interpolation „Closest“.
- Die PSP: Original-Bildschirm entfernt, alles zu einem Mesh mit fünf Materialien zusammengeführt, so skaliert, dass der Bildschirm 0,96 breit ist und auf dem Ursprung liegt (Bildschirmebene bei z = 0,0765). AO ist wie beim Avatar in die Vertex-Farben gebacken. Exportiert ohne UVs, weil keine Texturen nötig sind.
- glTF speichert Vertex-Farben linear. `vertexColorsToSRGB()` in `ps1.js` rechnet sie beim Laden zurück auf sRGB, weil die Bühne ohne Color Management arbeitet.
- Blickrichtung in Blender ist −Y, Z zeigt nach oben. Der glTF-Export macht daraus +Z vorne und Y oben, also schaut das Modell in Three.js zur Kamera.
- Export: GLB, nur Rig und Mesh ausgewählt, `export_animation_mode='NLA_TRACKS'` (Tracks dafür kurz entmuten), `export_vertex_color='ACTIVE'`. Im Modus „Actions“ würden auch die Actions der alten Rigs aus der Datei mitkommen.
- Texturen werden im Code roh gesampelt (`colorSpace = NoColorSpace`, kein Mipmapping), passend zu `ColorManagement.enabled = false`.
- Three.js-Addons kommen über die Importmap in `index.html` (`three/addons/...`). Deshalb `three` immer per Bare Import einbinden, nicht per URL, sonst landen zwei Instanzen im Browser.

## Ablauf der Startsequenz

`boot` → `bootOut` → `world` → `zoom` → `hero` (Phasen in `main.js`, Zeiten in `TIMING`):

1. **Bootscreen:** Ein Gold-Kristall dreht sich, darunter steht „PRESS START“. Erst mit Klick, Tippen oder Enter geht es weiter, denn erst nach dieser Geste dürfen Browser Ton abspielen.
2. **World:** Der Avatar steht in einer Lowpoly-Landschaft und winkt (der Clip „Wave“ startet bei `TIMING.waveAt`). Den Bootscreen verlässt die Seite erst, wenn Avatar und PSP geladen sind. Dann erscheint der Kamera-Sucher, es piept zweimal (Fokus) und der Auslöser klickt.
3. **Foto:** `capturePhoto()` rendert die Szene mit der `photoCamera` (im Seitenverhältnis des PSP-Bildschirms, näherer Ausschnitt) in `photoTarget`. Diese Textur liegt auf dem Bildschirm der Konsole.
4. **Zoom:** Weißer Blitz. Die Kamera startet so nah, dass der Konsolenbildschirm den ganzen Viewport füllt (`coverDistance`), und zoomt dann heraus, bis die Konsole schwebt (`restingLayout`).
5. **Hero:** Das Glas-Panel mit Name, Motto und Discord-Chip erscheint, oben rechts die Knöpfe für Ton und Theme. Der Hintergrund ist jetzt interaktiv (nur in dieser Phase und nur direkt auf dem Canvas, `pick()` in `main.js`):
   - Fährt die Maus über einen Kristall, leuchtet er auf, wird größer und dreht sich schneller.
   - Ein Klick oder Tipp lässt ihn in Splitter zerspringen. 2,5–4,5 s später wächst er an einer neuen Stelle nach.
   - Ein Klick auf die PSP dreht sie einmal mit einem kleinen Hüpfer.
   - Die Kristall-Positionen sind relativ zum sichtbaren Bereich gespeichert (`nx`/`ny`), damit sie sich auf jedem Bildschirmformat verteilen.

Wechselt das Theme, wird das Foto in den neuen Farben noch einmal aufgenommen, mit derselben eingefrorenen Pose.

## Stolperfallen

- `THREE.ColorManagement` ist absichtlich aus. Hex-Werte landen 1:1 auf dem Bildschirm, deshalb nichts auf sRGB/linear umstellen.
- Die Shader-Anpassungen in `ps1Material()` ersetzen `#include`-Zeilen (`project_vertex`, `map_fragment`). Ein String-Replace auf den aufgelösten Chunk-Inhalt greift nicht, weil `onBeforeCompile` die Includes noch nicht aufgelöst hat.
- Affines Mapping verzerrt große, schräge Flächen stark. Flächen, auf denen ein Bild erkennbar sein muss (z. B. der Konsolenbildschirm), deshalb unterteilen.
- Flächen, die direkt auf anderen liegen, mit etwas Abstand in z platzieren (≥ 0,005), sonst flackern sie (Z-Fighting).
- `PALETTES` in `main.js` und die Farb-Tokens in `styles.css` müssen zusammenpassen.
- Der Bootscreen ist immer dunkel, auch im hellen Theme.
- Die Lichtbrechung im Glas (`backdrop-filter: url(#liquid)`) funktioniert nur in Chromium. Dafür setzt `main.js` die Klasse `has-refraction`, die anderen Browser bekommen nur Blur.
- Three.js wird als festes Modul `three@0.160.1` von jsDelivr geladen (über die Importmap).

## Konventionen

- UI-Texte auf Deutsch, Code-Kommentare auf Englisch.
- Vanilla JS als ES-Module. Keine Abhängigkeiten außer Three.js (CDN) und Google Fonts (Fraunces, Space Grotesk, VT323).
- Neue Farben immer als Token für **beide** Themes anlegen, keine hart codierten Farbwerte in Komponenten (Ausnahmen: Bootscreen und Sucher, die immer gleich aussehen).
- Glas-Optik über die Klasse `glass` wiederverwenden. Glas hat keine runden Ecken, sondern ist per `clip-path` mit Pixel-Treppenecken geschnitten (`--px-shape`, kleine Elemente `--px-shape-sm`). Der Rand ist ein 2px-Ring mit derselben Treppe (`--px-ring`). Weil `clip-path` alles außerhalb abschneidet, funktioniert kein äußerer `box-shadow` auf Glas. Die Polygone sind generiert: Bei einer anderen Stufengröße neu berechnen statt von Hand ändern.
- Änderungen direkt auf `main` committen und pushen, ohne Branch oder PR (geht sofort live).
- Commits werden mit Versionsnummern benannt (`4.0`, `3.3`, …), optional mit kurzer Beschreibung dahinter.

## Design-Richtung

- **Ablauf:** eine lange Scroll-Story, bei der beim Scrollen nacheinander Szenen kommen. Bisher gibt es nur die Startsequenz, die Seite scrollt noch nicht.
- **Retro-Stil:** PS1-Lowpoly-Optik mit dem typischen Texturstil.
- **Glas:** Liquid Glass ähnlich wie bei Apple, aber mit Retro-Schnitt (Nick hat Variante „B“ gewählt): Pixel-Treppenecken, 2px-Kante mit heller Oberseite, Scanlines, ein dezenter Lichtfleck unter dem Cursor (nur beim Hovern: Akzentfarbe durch eine Bayer-Dither-Maske in 3px-Zellen, die `createGlintMask()` erzeugt), ein Regenbogen-Rand, der sich ruckelnd dreht, und ein harter Pixel-Schatten am Namen. Die PS1-Szenen liegen im Hintergrund, Text und UI bleiben gut lesbar.
- **3D-Elemente:** Glas-Objekte, Nicks Avatar und Retro-Gegenstände (zuerst die PSP, ein DS-artiges Gerät wäre auch denkbar). Der Avatar soll vorerst nur winken, später kommt vielleicht mehr dazu. Wo die Elemente in der Scroll-Story auftauchen, ist noch offen, also vorher fragen.
- **Sound:** dezente Retro- bzw. Konsolen-Sounds, keine Hintergrundmusik.
- **Abschnitte (geplant):** Über mich, Aktuelles (aus `data/updates.json`), Projekte/Gaming.
- **Plattformen:** Instagram, Discord, GitHub, Steam. YouTube ist vorerst raus und kommt vielleicht später wieder dazu.
- **Discord:** Live-Status über Lanyard.
- **Farben:** Palette „Obsidian Gold, gealtert“, Dark/Light mit Kreis-Überblendung beim Umschalten.
  - Dunkel: Himmel `#4a4f57` → `#5a4a35` → `#1a1712`, Berge `#2a2620`, Boden `#100e0b`, Nebel `#3a352c`, Akzent/Objekte `#e0b46a` / `#8a6a3a`, Text `#f4ecdd`, gedämpfter Text `#c9bda6`
  - Hell: Himmel `#f6ead9` → `#ecc9a2` → `#cf8a63`, Berge `#b6795a`, Boden `#7e4d36`, Nebel `#e9cdb0`, Akzent/Objekte `#a8492a` / `#e08a62`, Text `#2c2117`, gedämpfter Text `#5e4a38`
- **Mobile:** genauso wichtig wie Desktop. Auch auf dem Handy das volle Erlebnis, nur angepasst.
- **Performance:** vorerst zweitrangig, die Optik geht vor. Keinen Leichten Modus, keine `prefers-reduced-motion`-Fallbacks und kein Drosseln einbauen. Darum kümmern wir uns gezielt, wenn das Design steht.

## Noch offen

Die echten Daten fehlen noch. Platzhalter drin lassen, bis Nick sie liefert, und nichts erfinden.

- Motto, Texte für „Über mich“ und „Projekte/Gaming“
- Alle Social-Links und die `DISCORD_USER_ID`
- Einträge in `data/updates.json`
- Wo die weiteren 3D-Elemente in der Scroll-Story auftauchen
- Eigene Domain
