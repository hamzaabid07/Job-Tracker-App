# Job Tracker

Track job applications, interviews and offers. A static site: no build step, no server, no database. Data is saved in the browser (localStorage) and can be exported/imported as JSON.

- `index.html`, `app.css`, `app.js` — the app
- `cards.html` — animated interface-card design demo
- `vercel.json` — clean URLs and security headers

## Run locally

    python3 -m http.server 3000

Then open http://localhost:3000

## Deploy to Vercel

    npx vercel          # preview deployment
    npx vercel --prod   # production

Or push this folder to a GitHub repo and import it at vercel.com/new (Framework preset: Other, no build command, output directory: `.`).
