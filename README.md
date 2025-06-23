# NBC Board Export & Import

Dieses Repository enthält ein Userscript, das den Export und Import von Boards in der
[Niedersachsen Cloud](https://niedersachsen.cloud/) ermöglicht. Nach der Installation
werden im unteren rechten Bereich jeder Board-Seite zwei Schaltflächen eingeblendet:
**Export v0.9** und **Import**.

## Hauptfunktionen

* Exportiert Spalten, Karten, den Boardtitel und alle unterstützten Inhaltstypen
  (z. B. Textfelder, Dateien, Links, Videokonferenzen und Platzhalter für externe
  Tools) in eine strukturierte JSON-Datei.
* Importiert ein solches JSON-Archiv wieder und stellt dabei möglichst die
  gesamte Board-Struktur inklusive des Boardtitels her.
* Erkennt verschiedene Exportversionen und passt den Import entsprechend an.
* Fügt eine kleine Benutzeroberfläche mit Export- und Import-Schaltflächen direkt
  in die Board-Seite ein.

## Installation

1. Einen Userscript-Manager wie **Tampermonkey** oder **Violentmonkey** im Browser
   installieren.
2. Die Datei `NBC Board Export & Import [0.9, stable]-0.9.user.js` in diesem
   Repository öffnen und im Userscript-Manager installieren.
3. Anschließend ein Board unter `https://niedersachsen.cloud/boards/` laden.
   Dort erscheinen die neuen Schaltflächen unten rechts.

## Benutzung

* **Export v0.9**: Erstellt eine JSON-Datei mit allen Spalten, Karten und deren
  Inhalten. Die Datei wird automatisch heruntergeladen.
* **Import**: Wähle eine zuvor exportierte JSON-Datei aus, um das Board
  wiederherzustellen. Die Struktur wird anhand der Datei rekonstruiert.

Das Skript ist besonders hilfreich, um komplette Boards zu sichern oder zwischen
Instanzen der NBC zu übertragen.

### Schritt-für-Schritt-Anleitung

1. Das Userscript in **Tampermonkey** importieren und aktivieren.
2. Ein NBC-Board öffnen und vor jedem Klick auf **Export v0.9** oder **Import** die Seite neu laden.
3. Zum Export auf **Export v0.9** klicken und die heruntergeladene Datei speichern.
4. Einen neuen Bereich anlegen, das Zielboard laden und erneut die Seite neu laden.
5. Über **Import** die exportierte Datei auswählen.
6. Im Fenster bleiben und warten, bis das Board komplett erstellt wurde. Je nach Größe kann dies einige Minuten dauern.

## Konfiguration

Im Skript befindet sich ein `CONFIG`-Block. 
Mit der neuen Einstellung `CACHE_ENABLED` lassen sich Antworten von API-Aufrufen
im Browser-Cache speichern und erneut verwenden. Ist das Flag aktiviert, werden
keine "no-cache"-Header gesetzt und abgelegte Responses zuerst aus dem Cache
geladen.
