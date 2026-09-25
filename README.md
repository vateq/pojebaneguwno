# SZYB 09

Przeglądarkowy survival horror 3D w proceduralnym labiryncie wentylacyjnym. Każda próba generuje nowy układ dwóch poziomów 14 × 14, ślepych odnóg, paneli do rozbicia, niskich przejść i drabin. Wyjście powstaje w losowym, odległym miejscu na górnym poziomie. Potwór patroluje kanały, słyszy kroki, skoki i niszczony metal, reaguje na światło latarki i potrafi dotrzeć drabinami na drugi poziom. Nie przenika przez zamknięte panele ani niskie przejścia; może dojść do przeszkody po usłyszeniu dźwięku. Po zauważeniu gracza potrzebuje chwili, by rozpocząć pościg, a zetknięcie daje krótki czas na ucieczkę. Ma również oko z tyłu ciała, które otwiera się, gdy gracz pozostaje za nim.

## Gra online

[Otwórz grę w przeglądarce](https://raw.githack.com/vateq/pojebaneguwno/main/index.html). Podgląd przez rawgit.hack wyświetla jednorazowy ekran potwierdzenia z adresem pliku. Przeglądarka musi obsługiwać WebGL 2.

Workflow `.github/workflows/pages.yml` publikuje tę samą grę na GitHub Pages, gdy Actions mogą uruchamiać zadania w repozytorium i Pages jest włączone w ustawieniach.

## Uruchomienie

Projekt jest statyczny. W katalogu repozytorium uruchom `python3 -m http.server 8080` i otwórz `http://localhost:8080/`. Przeglądarka musi obsługiwać WebGL 2, Web Audio i Pointer Lock. Gra wymaga klawiatury i myszy. Nie otwieraj `index.html` protokołem `file://`, ponieważ moduły i dźwięki są pobierane przez HTTP.

## Sterowanie

| Klawisz | Działanie |
|---|---|
| WASD + mysz | Ruch i rozglądanie |
| Shift | Powolny, cichy krok |
| C | Kucanie pod niskimi przeszkodami |
| Spacja | Skok; lądowanie słychać z daleka |
| F | Latarka |
| E | Wejście na drabinę i zejście z niej; W podczas wspinania |
| Lewy przycisk myszy | Kilka uderzeń w metalowy panel |
| Esc | Pauza |

Można uciec bez podnoszenia przedmiotów. Gra nie zawiera mapy ani wskazówek dotyczących trasy.

## Zawartość

- `src/maze.js` — generator labiryntu i graf przejść.
- `src/world.js` — geometria kanałów, przeszkody, drabiny, scenografia.
- `src/creature.js` — organiczny model 3D z ciągłą powierzchnią tułowia, deformowanymi kończynami, teksturą skóry, paszczą i tylnym okiem.
- `src/ai.js` — zasięg wzroku i czas chwytu.
- `src/audio.js` — wszystkie dostarczone efekty w Web Audio z pozycjonowaniem HRTF.
- `src/main.js` — ruch, kolizje, AI, scenka na drabinie, śmierć i wygrana.
- `vendor/` — lokalna kopia Three.js 0.186.1, bez zależności od CDN.
- `audio/` — dostarczone nagrania; pochodzenie nazw opisano w [AUDIO_CREDITS.md](AUDIO_CREDITS.md).

Grafika i animacja potwora powstają w czasie działania gry z geometrii Three.js, inspirowane przesłanymi referencjami. To proceduralny model, nie fotogrametryczny skan. Licznik porażek jest lokalny dla przeglądarki. Nie ma zapisu postępu w labiryncie.
