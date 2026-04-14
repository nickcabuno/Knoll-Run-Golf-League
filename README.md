# Knoll Run Golf League

A lightweight static site for tracking a golf league's leaderboard, weekly head-to-head matchups, and stat leaders.

## Pages

- **index.html** — Season standings (sortable by Record, Scoring Average, or Best Round) and this week's matchups with highlighted winners.
- **stats.html** — Category leaders (birdies, eagles, pars, bogeys, best round, lowest average) and league-wide totals.
- **admin.html** — Hidden passcode-protected admin dashboard for posting rounds, scheduling matchups, marking winners, managing players, and importing/exporting data.

## Running locally

Any static web server works. For example:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080/` in your browser.

## Admin access

Open `/admin.html` directly (it is not linked from the public pages). Default passcode: `knollrun2026`. Change it from the **Settings** tab after the first login.

## Data

Data is stored in the browser's `localStorage`. Use the **Data** tab to export a JSON backup or import one that another admin shared with you.
