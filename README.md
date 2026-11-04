# The ReUp Movement

The website and team app for The ReUp Movement, a Houston nonprofit. Everybody deserves a new beginning.

## What is here

- **The community page** (`index.html`, thereupmovement.org): upcoming distributions, volunteer sign-up, and the forms
  for asking for help, giving, sharing a story and joining the team (`forms.js` shows the Google Forms inside the page).
- **The ReUp Hub** (`hub/`): the team's private app. Work, Schedule, Events, Inbox, Ask, Volunteers, Operations,
  Finance and more. This folder holds no team data: everything is served by the app's server, only to signed-in people.
- **The volunteer page** (`volunteer/`): each volunteer's own page.
- **The server** is a Google Apps Script project (not in this repository), and the data lives in Google Sheets.

## Getting started (new maintainer)

1. Read [MAINTAINING.md](MAINTAINING.md): how the pages, the server and the Sheets fit together.
2. Read [CLAUDE.md](CLAUDE.md): the rules for every change (phone and desktop, plain words, no personal data here).
3. Ask a ReUp leader for access to the Apps Script project and the Hub sheet.

## Publishing a change

Pages publish from `main` through GitHub Pages within about a minute. Run `node .github/check-pages.js` before you
commit. Server changes go live only after Deploy, Manage deployments, New version in the Apps Script editor.
Every change and how to undo it is in MAINTAINING.md.

## Contact

Reach the team through [thereupmovement.org](https://thereupmovement.org).
