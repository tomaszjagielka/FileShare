# FileShare - Tutorial

Cześć! Ten tutorial pomoże Ci stworzyć prostą aplikację do udostępniania plików. Jest przeznaczony dla studentów Politechniki Poznańskiej na przedmiot Aplikacje Internetowe.

## Co będziemy robić?

Zbudujemy aplikację webową składającą się z:

- Frontendu
- Backendu

Użyjemy do tego:

- JavaScript po stronie frontendu i backendu
- Frontend: React + Vite (lokalny serwer programistyczny frontendu)
- Backend: Node.js + Express.js (serwer backendu)

## Wymagania

- Zainstalowany Node.js (sprawdź wpisując `node -v` w terminal)
- Jeśli nie masz Node.js, [pobierz go stąd](https://nodejs.org/en/download/)

## Krok 1: Przygotowanie projektu

Najpierw stwórz główny folder projektu:

```bash
mkdir FileShare
cd FileShare
```

## Krok 2: Tworzenie frontendu

Użyjemy Vite do stworzenia projektu React:

```bash
npm create vite@latest fileshare-frontend -- --template react
cd frontend
npm install
npm run dev
```

Po uruchomieniu `npm run dev` zobaczysz przykładową stronę React w przeglądarce.

### Struktura plików frontendu:

- /public
  - vite.svg - ikona strony
- /src
  - assets - miejsce na obrazki i inne zasoby
  - App.css - główny plik ze stylami
  - App.jsx - główny komponent React
  - index.css - style globalne
  - main.jsx - punkt startowy aplikacji
- .gitignore - lista ignorowanych plików
- eslint.config.js - konfiguracja lintera
- index.html - główny plik HTML
- package.json - konfiguracja projektu
- vite.config.js - konfiguracja Vite

Teraz stworzymy dodatkowe foldery i pliki:

```
frontend
├── assets
│ └── react.svg - domyślne logo React
├── components - folder na komponenty React
│ ├── file - komponenty do obsługi plików
│ │ ├── FileItem.jsx - pojedynczy plik na liście
│ │ ├── FileList.jsx - lista wszystkich plików
│ │ └── FileUpload.jsx - formularz do wysyłania plików
│ ├── layout - komponenty układu strony
│ │ └── Header.jsx - nagłówek strony
├── hooks - własne hooki React
│ └── useFiles.js - hook do pobierania listy plików
│ └── useFileUpload.js - hook do wysyłania plików
├── services - komunikacja z API
│ └── api.js - funkcje do komunikacji z backendem
├── styles - pliki CSS
│ ├── base - podstawowe style
│ │ ├── global.css - style globalne
│ │ ├── reset.css - resetowanie domyślnych stylów
│ │ └── typography.css - style dla tekstu
│ │ └── variables.css - zmienne CSS
│ ├── components - style dla komponentów
│ │ ├── Feedback.module.css - style dla komunikatów
│ │ ├── FileList.module.css - style dla listy plików
│ │ ├── FileUpload.module.css - style dla formularza
│ │ └── Header.module.css - style dla nagłówka
│ ├── shared - współdzielone style
│ │ └── buttons.module.css - style dla przycisków
└── utils - funkcje pomocnicze
    └── formatters.js - formatowanie danych
```

## Krok 3: Tworzenie backendu

Otwórz nowy terminal i stwórz folder na backend:

```bash
mkdir backend
cd backend
npm init -y fileshare-backend
```

### Struktura plików backendu:

```
backend
├── src - kod źródłowy backendu
│ ├── config - konfiguracja
│ │ └── config.js - zmienne konfiguracyjne
│ ├── middleware - funkcje pośrednie Express
│ │ └── upload.js - obsługa wysyłania plików
│ ├── routes - endpointy API
│ │ └── file.js - endpointy do obsługi plików
│ ├── services - logika biznesowa
│ │ └── file.js - operacje na plikach
│ │ └── metadata.js - obsługa metadanych plików
│ ├── package.json - zależności projektu
│ ├── index.js - główny plik serwera
```

## Krok 4: Pierwsze zmiany

Zmieńmy tytuł strony. W pliku `frontend/index.html`:

```html
<title>FileShare</title>
```
