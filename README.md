# Auspex 40k – Smart Tabletop Companion

Universal Listbuilder und Strategie-Planer für Warhammer 40.000 (11. Edition) – eine einzige HTML-Datei, läuft komplett im Browser und offline.

**Funktionen:** alle Fraktionen mit Punkten und Ausrüstung, eigene Sammlung mit Miniatur-Fotos, Smart Auto-Build, Detachments und Enhancements, Datenblätter, Mathhammer mit Würfel-Simulation, Matchup-Analyse, Missions-Planer, Phasen-Assistent, Spiel-Modus, Turnierblatt zum Drucken.

**Neu (Oktober 2026):**
- Mobile-App-Oberfläche: untere Navigation (Katalog, Armeeliste, Sammlung, Play Mode), Bottom Sheets zum Wegwischen, Touch-Flächen ab 44 px, kein Querscrollen
- Regel-Schiedsrichter (⚖️): lokale Regel-Datenbank mit Bezug auf deine Armeeliste, Spracheingabe, optional KI-Antworten über eigenen API-Key (Claude, OpenAI, Gemini – der Key bleibt im Browser)
- Errata- und Balancing-Badges: Änderungshistorie je Einheit aus den MFM-Updates Juli bis Oktober 2026; eigene Einträge in `errataData.manual`
- Armeeliste im Vollbild: volle Breite mit Profilwerten und Waffenprofilen je Einheit; unter 1024 px Tabs statt zwei Spalten
- Regel-Links: Keywords wie Blast, Lethal Hits oder Deep Strike sind antippbar und zeigen eine Kurz-Erklärung (Glossar `coreKeywords`), mit Sprung in den Schiedsrichter
- Detachments, Enhancements, Fähigkeiten, Detachment-Regeln, Kernregeln und Force Dispositions auf Deutsch, englischer Begriff in Klammern

## Nutzung

Einfach die veröffentlichte Seite öffnen und im Browser „Zum Startbildschirm hinzufügen“ wählen. Nach dem ersten Besuch funktioniert die App ohne Internet. Listen, Sammlungen und Fotos bleiben lokal im jeweiligen Browser (Backup unter „Listen“).

## Update

`index.html` ersetzen und in `sw.js` die Zeile `const CACHE = 'auspex40k-vX'` (aktuell v8) hochzählen, damit installierte Apps die neue Version laden.

## Hinweis

Inoffizielles, nicht-kommerzielles Fan-Tool, nicht mit Games Workshop verbunden. Einheiten, Punkte und Profile stammen aus den Community-Daten [BSData/wh40k-11e](https://github.com/BSData/wh40k-11e) – vor Turnieren bitte mit dem offiziellen Munitorum Field Manual abgleichen.

## Datenstamm

`game-data-11e.js` enthält das komplette Datenobjekt `GAME_DATA` (Fraktionen, Einheiten, Punkte, Profile, Waffen, Detachments, Enhancements, `hasErrata`/`errataNote`) zum Weiterverwenden.
