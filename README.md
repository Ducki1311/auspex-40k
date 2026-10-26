# Auspex 40k – Smart Tabletop Companion

Universal Listbuilder und Strategie-Planer für Warhammer 40.000 (11. Edition) – eine einzige HTML-Datei, läuft komplett im Browser und offline.

**Funktionen:** alle Fraktionen mit Punkten und Ausrüstung, eigene Sammlung mit Miniatur-Fotos, Smart Auto-Build, Detachments und Enhancements, Datenblätter, Mathhammer mit Würfel-Simulation, Matchup-Analyse, Missions-Planer, Phasen-Assistent, Spiel-Modus, Turnierblatt zum Drucken.

**Neu (Oktober 2026):**
- Mobile-App-Oberfläche: untere Navigation (Katalog, Armeeliste, Sammlung, Play Mode), Bottom Sheets zum Wegwischen, Touch-Flächen ab 44 px, kein Querscrollen
- Regel-Schiedsrichter (⚖️): lokale Regel-Datenbank mit Bezug auf deine Armeeliste, Spracheingabe, optional KI-Antworten über eigenen API-Key (Claude, OpenAI, Gemini – der Key bleibt im Browser)
- Errata- und Balancing-Badges: Änderungshistorie je Einheit aus den MFM-Updates Juli bis Oktober 2026; eigene Einträge in `errataData.manual`
- Armeeliste im Vollbild: volle Breite mit Profilwerten und Waffenprofilen je Einheit; unter 1024 px Tabs statt zwei Spalten
- App teilen & installieren: QR-Code der App-Adresse (offline erzeugt), Link kopieren, natives Teilen, Installations-Button und Kurzanleitung für iOS/Android
- Sprache DE / EN: Umschalter oben rechts. Oberfläche, Fraktionen, Detachments, Regeln, Enhancements, Fähigkeiten, Keyword-Erklärungen, Schiedsrichter und Exporte wechseln sofort; Einheiten- und Waffennamen bleiben die englischen Originalnamen
- Smart Auto-List (⚙️ in Armeeliste und Sammlung): generiert eine punktgenaue Liste aus deiner Sammlung oder dem ganzen Katalog. Mathhammer-Scoring je Einheit (IE_off = erwarteter Schaden gegen einen Gegner-Mix, IE_def = effektive Lebenspunkte, Utility = OC, Infiltrators, Scouts, Deep Strike, Lone Operative), 4 Archetypen (Ausgewogen, Feuerkraft, Nahkampf, Kontrolle), Rule of Three, Pflicht-Kriegsherr, Lock-In fixierter Einheiten, Varianten und Rückgängig
- Loadout-Optimierung: Der Auto-List-Generator prüft für jede Einheit die Waffen-Setups (aus den Ausrüstungs-Slots abgeleitet oder per `loadoutOptions` hinterlegt), bewertet sie mit dem Mathhammer gegen das Zielprofil des Archetyps und übernimmt das beste; die Armeeliste zeigt es als ⚙️-Badge unter dem Einheitennamen
- Regel-Checks (Rules Compliance Engine): Epische Helden max. 1× und ohne Enhancements, Enhancement-Obergrenze je Spielgröße und 1 je Charakter, Enhancements nur aus gewählten Detachments und nur für berechtigte Charaktere (BSData-Voraussetzungen), Dedicated Transports nur mit passender Einheit (Keywords, Ausschlüsse, Kapazität), Verbündete max. 25 % der Punkte (einstellbar in `COMPLIANCE`)
- Cheat-Sheet drucken / PDF (🖨️ in der Armeeliste und im Spiel-Modus): kompakte A4-Turnierübersicht in Schwarz auf Weiß mit Kopfzeile (Armee, Spieler, Detachment, Punkte), Einheiten-Profilen (M, T, Sv, ReW, W, Ld, OC), Fern- und Nahkampf-Waffentabellen, Schlüssel-Keywords mit Kurz-Erklärung, Fähigkeiten und eigenen Stratagems; Inhalte wählbar, PDF-Dateiname nach der Armee
- Turnier-Export: „📋 Für Turnier kopieren“ legt die Liste als Klartext in die Zwischenablage, im EN-Modus rein englisch im Standard-Turnierformat
- Regel-Links: Keywords wie Blast, Lethal Hits oder Deep Strike sind antippbar und zeigen eine Kurz-Erklärung (Glossar `coreKeywords`), mit Sprung in den Schiedsrichter
- Detachments, Enhancements, Fähigkeiten, Detachment-Regeln, Kernregeln und Force Dispositions auf Deutsch, englischer Begriff in Klammern

## Nutzung

Einfach die veröffentlichte Seite öffnen und im Browser „Zum Startbildschirm hinzufügen“ wählen. Nach dem ersten Besuch funktioniert die App ohne Internet. Listen, Sammlungen und Fotos bleiben lokal im jeweiligen Browser (Backup unter „Listen“).

## Update

`index.html` ersetzen und in `sw.js` die Zeile `const VERSION = 'vX'` (aktuell v16) hochzählen, damit installierte Apps die neue Version laden.

## Sicherheit & Datenschutz

- **Speichern:** Jeder Zugriff auf den Browser-Speicher läuft über `SafeStore` (try/catch). Ist der Speicher voll, gibt es einen Hinweis statt eines Absturzes. Beschädigte Daten werden unter `…:corrupt` beiseitegelegt, und die App startet mit dem letzten gültigen Stand (`…:prev`). Ist dauerhaftes Speichern gesperrt (privater Modus), läuft die App mit einem Ersatzspeicher weiter.
- **Backups:** Vor dem Überschreiben prüft `validateBackup()` Format, Version, Größe und jedes Feld. Unbekannte Einheiten und ungültige Fotos werden aussortiert. Der vorherige Stand wird gesichert und lässt sich mit „Wiederherstellung rückgängig“ zurückholen.
- **Content Security Policy:** Ausgeführt wird nur das eine App-Skript, freigegeben über seinen SHA-256-Hash; der Build berechnet ihn automatisch. Eingeschleuste Skripte und Inline-Event-Handler werden blockiert. Netzwerkzugriffe sind nur zu Google Fonts und, falls eingerichtet, zu den KI-Anbietern erlaubt. Der QR-Code wird in der App selbst erzeugt, ohne externe Bibliothek.
- **Offline:** Der Service Worker übernimmt eine neue Version nur, wenn alle Dateien vollständig geladen wurden. Unter „Listen → Sicherung & Offline“ zeigt die App, ob sie offline bereit ist, und lädt fehlende Dateien automatisch nach.

## Hinweis

Inoffizielles, nicht-kommerzielles Fan-Tool, nicht mit Games Workshop verbunden. Einheiten, Punkte und Profile stammen aus den Community-Daten [BSData/wh40k-11e](https://github.com/BSData/wh40k-11e) – vor Turnieren bitte mit dem offiziellen Munitorum Field Manual abgleichen.

## Datenstamm

`game-data-11e.js` enthält das komplette Datenobjekt `GAME_DATA` (Fraktionen, Einheiten, Punkte, Profile, Waffen, Detachments, Enhancements, `hasErrata`/`errataNote`, Transportkapazitäten `transport`, Regel-Keywords `kx`, Enhancement-Voraussetzungen `req`) zum Weiterverwenden. Einheiten können optional `loadoutOptions` nach dem Schema `LOADOUT_SCHEMA` tragen. Übersetzbare Felder sind zweisprachig als `{ de, en }` abgelegt, z. B. `detachment.name = { de: 'Gladius-Einsatzgruppe', en: 'Gladius Task Force' }`.
