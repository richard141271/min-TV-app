# Min TV

Min TV er en personlig TV-planlegger som fungerer bra på stor skjerm (Apple TV via nettleser), nettbrett og mobil. Appen viser programmer per dag og lar deg starte dem direkte.

## Starte lokalt

Åpne appen via en enkel lokal webserver (anbefalt, fordi appen henter `data.json` ved første oppstart):

```bash
cd mintv
python3 -m http.server 5173
```

Åpne deretter `http://localhost:5173/` i nettleseren.

## Bruk

- **I dag**: viser alle programmer som matcher dagens ukedag.
- **Start**: åpner startlink i ny fane.
- **LIVE NÅ**: vises når et program er innenfor ±30 minutter fra nåtid.
- **Legg til**: legg inn programnavn, tjeneste, ukedag, klokkeslett og startlink.
- **Rediger / Slett**: tilgjengelig på hvert programkort.

All data lagres i **LocalStorage** i nettleseren. Ved første oppstart seedes eksempeldata fra `data.json` (kun hvis du ikke allerede har data lagret).

## Deploy (statisk)

### Netlify

1. Dra og slipp `mintv/`-mappen i Netlify (Deploy manually), eller koble repoet ditt.
2. Build command: ingen.
3. Publish directory: `mintv`

### Vercel

1. Importer GitHub-repoet i Vercel.
2. Framework preset: “Other”.
3. Output/public directory: `mintv`

## GitHub (push)

Hvis du allerede har initialisert repo lokalt:

```bash
git remote add origin https://github.com/richard141271/min-TV-app.git
git branch -M main
git push -u origin main
```

## Filer

- `index.html` – UI og templates
- `style.css` – TV-vennlig design
- `app.js` – logikk, LocalStorage, live-markering, redigering/sletting
- `data.json` – eksempeldata brukt ved første oppstart
