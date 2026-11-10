# ⚡ Auspex 40k

> **Der ultimative, blitzschnelle 11th Edition Army Builder & Taktik-Begleiter für Warhammer 40,000.**
> *100% kostenlos, werbefrei, offline-fähig (PWA) und für Turnierspieler entwickelt.*

---

## 🎯 Über das Projekt

**Auspex 40k** ist kein gewöhnlicher Listen-Editor. Die Progressive Web App (PWA) wurde entwickelt, um den gesamten Lebenszyklus eines Turnierspiels abzudecken – von der intelligenten Listengenerierung über die Matchup-Analyse vor dem Turnier bis hin zum Live-Einsatz am Turniertisch.

Schluss mit unübersichtlichen Tools, veralteten Oberflächen und dem Jonglieren mit drei verschiedenen Apps während des Matches. Auspex 40k vereint alles in einer Hand.

---

## 🚀 Key Features

### 🛠️ 1. Intelligenter Auto-List-Generator (11th Edition)
* **3-Säulen-Armeestruktur:** Balanciert automatisch zwischen *Anvil* (Core/OC), *Hammer* (Offensive/Anti-Tank) und *Action-Monkeys* (Utility).
* **Smart Coupling:** Transporter werden niemals leer gelassen; Leader-Charaktere werden optimal an synergetische Einheiten gekoppelt.
* **Meta-Fokus Toggles:** Passe die Generierung dynamisch an (z. B. *Balanced*, *Anti-Tank* oder *Anti-Horde*).
* **Evolution Engine (Genetischer Algorithmus):** 200 Listen × bis zu 100 Generationen (Tournament Selection, Crossover, Mutation) bewerten Punktlandung, Anti-Tank-Output (T10+), Scoring-Mobilität und Detachment-Synergie – in ca. 1–1,5 s, ohne die Oberfläche zu blockieren.
* **Detachment-Zentrum:** Das gewählte Detachment steuert die Auswahl – Einheiten mit seinen bevorzugten Keywords erhalten +40 … 50 %, ausgeschlossene (z. B. Walker bei Ironstorm) werden zurückgestellt; Enhancements gehen bevorzugt an Charaktere, die passende Trupps führen.
* **Knapsack-Punktlandung:** Restpunkte werden per Dynamic Programming exakt verwertet (Enhancements › Truppgröße › schwere Variante › Action Monkeys).
* **Faction Driver Engine:** Jede Fraktion hat ein eigenes Profil (Truppgrößen-Policy MAX/MSU/BALANCED, Transport-Matrix, Anführer-Synergien, Kategorie-Bias je Detachment) – z. B. Drukhari-MSU im Venom, Ork-Mobs im Trukk, Astra-Militarum-Panzer bei Hammer of the Emperor.
* **Transport-Kombis:** Dedizierte Transporter kommen nur mit Fracht in die Liste (+35 % Synergie-Wert für Transporter + Trupp), die Fracht wird auf die größte Staffel skaliert, die noch hineinpasst (z. B. 10 Legionäre im Chaos Rhino). Detachments mit Transport-Fokus erzwingen die Kombi, Nahkampf-Detachments bevorzugen sie. Battleline wird nie als 5er-„Utility“ behandelt.
* **Top 3 + Tactical Coach:** Die Evolution liefert die drei besten unterschiedlichen Listen (alle punktgenau, per Tipp umschaltbar). Der Coach erklärt die Strategie in zwei Sätzen, nennt die drei stärksten Synergien und zwei Matchup-Tipps für den gewählten Gegner – lokal immer, mit eigenem API-Key (Claude, Gemini oder OpenAI) zusätzlich per KI. Ohne Key oder offline läuft alles lokal weiter; gesendet werden nur Einheitennamen, Größen, Punkte und Keywords, keine Regeltexte.

### 📊 2. Matchup-Coach & Turnieranalyse
* **Automatisierter Belastungstest:** Prüft die Liste vor dem Turnier auf kritische Lücken in den Bereichen Anti-Tank (T10+ Output), Horden-Bändigung und Secondary Scoring.
* **Coaching-Report:** Zeigt Ampel-Indikatoren (`Grün`, `Gelb`, `Rot`) und gibt konkrete Tausch-Empfehlungen aus.

### 📱 3. Der Live "Match Mode" (Am Spieltisch)
* **One-Handed Ergonomics:** Optimierte Daumen-Bedienung für Smartphones mit fixierter Bottom-Navigation.
* **Digitaler Wound- & Modell-Tracker:** Direktes Mitführen von Lebenspunkten und Modellen per Touch (+/-).
* **Reserve- & Aufstellungs-Manager:** Behalte den Überblick über Deep Strike und Strategische Reserven (inkl. 50%-Regel-Warnung).
* **Integriertes Regel-Glossar (Rule-Ref):** Anklickbare Keywords und Live-Nachschlagewerk für 11th-Edition-Regeln (*Lethal Hits*, *Fights First* etc.).
* **AI Rules Referee:** Schnelles Widget für komplexe Regelfragen direkt während des Matches.

### 🏆 4. Turnier- & Community-Ready
* **BCP- & Text-Export:** Reibungsloser Export im Format der Warhammer-40,000-App für Best Coast Pairings sowie als Klartext für Turniere.
* **QR-Code Sharing:** Teile deine Liste in Sekundenschnelle per QR-Scan mit deinem Gegner (Read-Only Ansicht).
* **Turnier-Cheat-Sheet (Druck/PDF):** Kompakte A4-Übersicht mit Einheiten-Profilen, Fern- und Nahkampfwaffen, Schlüssel-Keywords mit Kurz-Erklärung, Fähigkeiten und Stratagems (mit Phase und CP).
* **Offline-First:** Läuft in jeder Messehalle mit schlechtem Empfang absolut zuverlässig dank lokaler PWA-Architektur.

---

## 🛠️ Tech Stack
* **Frontend:** HTML5, Modern JavaScript (ES6+), Tailwind CSS (Grimdark Amber & Dark-Mode Design)
* **Architecture:** Progressive Web App (PWA) mit Service Workers für Offline-Nutzung
* **Hosting & CI/CD:** GitHub Pages mit automatisierter GitHub Actions Deployment Pipeline

---

## Nutzung

🌐 **App:** https://ducki1311.github.io/auspex-40k/ · 💬 **Discord:** https://discord.gg/jN8Dg3GqZZ

Einfach die veröffentlichte Seite öffnen und im Browser „Zum Startbildschirm hinzufügen“ wählen. Nach dem ersten Besuch funktioniert die App ohne Internet. Listen, Sammlungen und Fotos bleiben lokal im jeweiligen Browser (Backup unter „Listen“).

## Update

`index.html` ersetzen und in `sw.js` die Zeile `const VERSION = 'vX'` (aktuell v73) hochzählen, damit installierte Apps die neue Version laden.

## Offline-first

- **Service Worker (`sw.js`):** App-Dateien Cache-First (sofortiger Start, Update im Hintergrund), Spieldaten (`assets/data/*.json`, `all_detachments.json`, `datasheets.json`, `game-data-11e.js`, `version.json`) Stale-While-Revalidate in einem eigenen, versionsübergreifenden Cache. Nach dem ersten Öffnen läuft die App komplett offline.
- **IndexedDB (`AuspexDB`):** Jeder Speichervorgang (Armeelisten, Sammlung, Fotos, Einstellungen) wird zusätzlich in IndexedDB gespiegelt. Fehlen Daten in localStorage (geleert, Speicher voll, beschädigt), holt die App sie beim Start automatisch zurück. Dazu automatische Sicherungen (höchstens alle 5 min und beim Verlassen der App, die letzten 12) – zurückholbar unter „Gespeicherte Listen“.
- **Backup & Restore:** JSON-Export/Import mit Prüfung und „Rückgängig“; „Aufs Gerät teilen“ nutzt den Teilen-Dialog des Systems (AirDrop, Nearby Share, Messenger) für PC ↔ Handy.
- **SYS-HUD:** `[SYS: ONLINE · CACHE v73 · DB ✓]` bzw. `[SYS: OFFLINE CACHE ACTIVE]` – antippen öffnet Sicherung & Offline.

## Sicherheit & Datenschutz

- **Speichern:** Jeder Zugriff auf den Browser-Speicher läuft über `SafeStore` (try/catch). Ist der Speicher voll, gibt es einen Hinweis statt eines Absturzes. Beschädigte Daten werden unter `…:corrupt` beiseitegelegt, und die App startet mit dem letzten gültigen Stand (`…:prev`). Ist dauerhaftes Speichern gesperrt (privater Modus), läuft die App mit einem Ersatzspeicher weiter.
- **Backups:** Vor dem Überschreiben prüft `validateBackup()` Format, Version, Größe und jedes Feld. Unbekannte Einheiten und ungültige Fotos werden aussortiert. Der vorherige Stand wird gesichert und lässt sich mit „Wiederherstellung rückgängig“ zurückholen.
- **Content Security Policy:** Ausgeführt wird nur das eine App-Skript, freigegeben über seinen SHA-256-Hash; der Build berechnet ihn automatisch. Eingeschleuste Skripte und Inline-Event-Handler werden blockiert. Netzwerkzugriffe sind nur zu Google Fonts und, falls eingerichtet, zu den KI-Anbietern erlaubt. Der QR-Code wird in der App selbst erzeugt, ohne externe Bibliothek.
- **Offline:** Der Service Worker übernimmt eine neue Version nur, wenn alle Dateien vollständig geladen wurden. Unter „Listen → Sicherung & Offline“ zeigt die App, ob sie offline bereit ist, und lädt fehlende Dateien automatisch nach.

## Hinweis

Inoffizielles, nicht-kommerzielles Fan-Tool, nicht mit Games Workshop verbunden. Einheiten, Punkte und Profile stammen aus den Community-Daten [BSData/wh40k-11e](https://github.com/BSData/wh40k-11e) – vor Turnieren bitte mit dem offiziellen Munitorum Field Manual abgleichen.

## Datenstamm

- `version.json`: Datenversion (`dataVersion`, z. B. `2026.10.26`), Update-Datum, BSData-Commit, offizielle Grundlage (Munitorum Field Manual) und die Änderungen des letzten Abgleichs.
- `datasheets.json`: das komplette Datenobjekt als reines JSON (für andere Tools); identisch mit `GAME_DATA` in `game-data-11e.js`.


### Datenimport aus BSData (`npm run fetch-data`)

`scripts/fetch-data.js` lädt die aktuellen Kataloge aus [BSData/wh40k-11e](https://github.com/BSData/wh40k-11e) und schreibt kompakte JSON-Dateien nach `assets/data/`: je Fraktion eine Datei (`space_marines.json`, `tyranids.json` …) mit Punkte-Staffeln, Staffelkosten, Profilen (M, T, SV, W, LD, OC), Keywords, Waffen, Fähigkeiten, Ausrüstungsoptionen und Leader-Zielen, außerdem `detachments.json`, `enhancements.json`, `stratagems.json` und `index.json`. Benötigt Node.js ≥ 18, sonst keine Abhängigkeiten.

```bash
npm run fetch-data                          # neuester Stand (main)
npm run fetch-data -- --ref c729d46         # bestimmter Commit
npm run fetch-data -- --only "space marines,tyranids"
npm run fetch-data -- --compare             # Punkte mit datasheets.json abgleichen
npm run fetch-data -- --git                 # per git clone statt GitHub-API (kein Ratenlimit)
npm run fetch-data -- --with-text           # Regeltexte mit exportieren (GW-Texte – nur wenn du sie veröffentlichen darfst)
```

**Detachments:** `npm run fetch-detachments` schreibt `assets/data/all_detachments.json` – je Detachment `faction`, `detachmentName`, `dp`, `keywordsBonus` (bevorzugte Keywords, z. B. `["VEHICLE"]`), `keywordWeights`, `excludedKeywords`/`excludedWeights` (z. B. `WALKER` bei Ironstorm), `weaponAbilities`, `abilities`, `style`, `enhancements` (`{ name, cost, description }`) und `stratagems`. Das Profil wird aus den BSData-Regeltexten abgeleitet; die App lädt die Datei beim Start (`loadDetachmentData()`) und nutzt dieselben Profile auch eingebaut. Der Auto-List-Generator gewichtet passende Einheiten mit +40 … 50 % (`applyDetachmentBonus`), ausgeschlossene/fremde mit bis zu −30 %.

BSData enthält **keine Stratagems** – `stratagems.json` bleibt deshalb leer. Ohne `--with-text` werden wie in der App nur Namen und Werte exportiert. `BSData/wh40k-10e` nutzt ein XML-Format und wird nicht gelesen.

`game-data-11e.js` enthält das komplette Datenobjekt `GAME_DATA` (Fraktionen, Einheiten, Punkte, Profile, Waffen, Detachments, Enhancements, `hasErrata`/`errataNote`, Transportkapazitäten `transport`, Regel-Keywords `kx`, Enhancement-Voraussetzungen `req`) zum Weiterverwenden. Einheiten können optional `loadoutOptions` nach dem Schema `LOADOUT_SCHEMA` tragen. Übersetzbare Felder sind zweisprachig als `{ de, en }` abgelegt, z. B. `detachment.name = { de: 'Gladius-Einsatzgruppe', en: 'Gladius Task Force' }`.

### Wöchentlicher Datenabgleich (`.github/workflows/wahapedia-sync.yml`)

Jeden Montag vergleicht eine GitHub Action `game-data-11e.js` mit dem öffentlichen Wahapedia-Export der 11. Edition (Stand des offiziellen Munitorum Field Manual). Geprüft werden Punkte und Truppgrößen, Staffelpreise für 2./3./4. Exemplare, Profile (M, T, Sv, W, Ld, OC, Rettungswurf), Waffenprofile **je Einheit**, Ausrüstungspreise, Anführer-Ziele, Leader/Support-Typ, regelrelevante Keywords (Battleline, Epic Hero, Character, Psyker …), Waffenfähigkeiten (Lethal Hits, Melta, Blast …), Kernfähigkeiten (Deep Strike, Scouts, Feel No Pain …), Enhancement- und Detachment-Punkte, Detachment-Ausrichtungen, Modellzusammensetzung je Typ, Grenzen der Ausrüstungsoptionen je Truppgröße sowie fehlende Detachments, Enhancements und Waffen. Abweichungen landen als Issue mit dem Label `data-sync` (vollständiger Bericht, bei Bedarf in mehreren Kommentaren); es werden keine Wahapedia-Daten ins Repository übernommen. Manuell starten: *Actions → Wahapedia-Abgleich → Run workflow*.

- Der Bericht enthält am Ende einen fertigen **Korrekturvorschlag** im Format von `manual-fixes.json`.
- Tests: `node tests/run.mjs` führt alle Testreihen aus (läuft auch bei jedem Push als GitHub Action *Tests*).
- Bewusst akzeptierte Unterschiede (z. B. eigene Sturmschild-Profile) stehen in `.github/scripts/wahapedia-accepted.json`.
- Korrekturen gegenüber BSData stehen in `assets/data/manual-fixes.json` und werden bei jedem Build angewendet, damit sie eine neue Konvertierung überleben.

## Community

Feedback, Fehler melden und Listen teilen: [Discord-Server](https://discord.gg/jN8Dg3GqZZ)

## Automatisches Deployment

`.github/workflows/deploy.yml` prüft bei jedem Push auf `main` die App (JSON, Skript-Syntax, CSP-Hashes, Icons, Offline-Dateien) und veröffentlicht sie auf GitHub Pages. Einmalig nötig: **Settings → Pages → Source: „GitHub Actions“**.

## Schriften

Oswald und Barlow Condensed (SIL Open Font License 1.1) sind in die App eingebettet. Lizenztexte: `assets/fonts/`.
