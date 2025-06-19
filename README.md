# NBC Board Export & Import

Dieses Repository enthält ein Userscript, das den Export und Import von Boards in der
[Niedersachsen Cloud](https://niedersachsen.cloud/) ermöglicht. Nach der Installation
werden im unteren rechten Bereich jeder Board-Seite zwei Schaltflächen eingeblendet:
**Export v8.8** und **Import**.

## Hauptfunktionen

* Exportiert Spalten, Karten und alle unterstützten Inhaltstypen (z. B. Textfelder,
  Dateien, Links, Videokonferenzen und Platzhalter für externe Tools) in eine
  strukturierte JSON-Datei.
* Importiert ein solches JSON-Archiv wieder und stellt dabei möglichst die gesamte
  Board-Struktur her.
* Erkennt verschiedene Exportversionen und passt den Import entsprechend an.
* Fügt eine kleine Benutzeroberfläche mit Export- und Import-Schaltflächen direkt
  in die Board-Seite ein.

## Installation

1. Einen Userscript-Manager wie **Tampermonkey** oder **Violentmonkey** im Browser
   installieren.
2. Die Datei `NBC Board Export & Import [8.5, stable]-8.5.user.js` in diesem
   Repository öffnen und im Userscript-Manager installieren.
3. Anschließend ein Board unter `https://niedersachsen.cloud/boards/` laden.
   Dort erscheinen die neuen Schaltflächen unten rechts.

## Benutzung

* **Export v8.8**: Erstellt eine JSON-Datei mit allen Spalten, Karten und deren
  Inhalten. Die Datei wird automatisch heruntergeladen.
* **Import**: Wähle eine zuvor exportierte JSON-Datei aus, um das Board
  wiederherzustellen. Die Struktur wird anhand der Datei rekonstruiert.

Das Skript ist besonders hilfreich, um komplette Boards zu sichern oder zwischen
Instanzen der NBC zu übertragen.
