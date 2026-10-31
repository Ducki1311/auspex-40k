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

`index.html` ersetzen und in `sw.js` die Zeile `const VERSION = 'vX'` (aktuell v31) hochzählen, damit installierte Apps die neue Version laden.

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


`game-data-11e.js` enthält das komplette Datenobjekt `GAME_DATA` (Fraktionen, Einheiten, Punkte, Profile, Waffen, Detachments, Enhancements, `hasErrata`/`errataNote`, Transportkapazitäten `transport`, Regel-Keywords `kx`, Enhancement-Voraussetzungen `req`) zum Weiterverwenden. Einheiten können optional `loadoutOptions` nach dem Schema `LOADOUT_SCHEMA` tragen. Übersetzbare Felder sind zweisprachig als `{ de, en }` abgelegt, z. B. `detachment.name = { de: 'Gladius-Einsatzgruppe', en: 'Gladius Task Force' }`.

## Community

Feedback, Fehler melden und Listen teilen: [Discord-Server](https://discord.gg/jN8Dg3GqZZ)

## Automatisches Deployment

`.github/workflows/deploy.yml` prüft bei jedem Push auf `main` die App (JSON, Skript-Syntax, CSP-Hashes, Icons, Offline-Dateien) und veröffentlicht sie auf GitHub Pages. Einmalig nötig: **Settings → Pages → Source: „GitHub Actions“**.
