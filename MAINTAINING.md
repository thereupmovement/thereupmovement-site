# Maintaining the ReUp app

For whoever keeps thereupmovement.org, the volunteer page and the Team Hub running. You do not need
to be a developer for most of this. The plain-language, step-by-step version with links to every sheet
and folder is the **ReUp Hub - Fix-It Guide** Google Doc in the ReUp app folder in Drive; ask the
coordinator for access. This file is the technical companion to it.

**This is a living document.** The app is still being built. Every change to the app updates this
file, the Fix-It Guide, the ReUp Hub Admin Guide and the ReUp App Build-Out Plan in the same pass.

## How the app fits together

Three doors, three parts.

| Door | Address | Who |
|---|---|---|
| Community page | `/` (index.html) | The public |
| Volunteer page | `/volunteer/` | Each volunteer (email and password, or the link in their confirmation email) |
| Team Hub | `/hub/` | The team (personal link or email and password, plus a 4-number PIN per phone) |

| Part | Where | What it does |
|---|---|---|
| Pages | This repository, published by GitHub Pages to thereupmovement.org (see `CNAME`) | Everything people see |
| Server | Google Apps Script project "ReUp Hub" | Reads and writes the Sheets, sends email. The pages call it with `fetch` POST `{fn, args}`; `doPost` in Code.gs runs only functions listed on `API_` |
| Data | Google Sheets "ReUp Hub - Access and Data" and "ReUp — Volunteer Sign-Up (Events and Roster)", Drive folder "ReUp Hub uploads" | All records. There is no other database (a move to one is planned for January 2027) |

## This repository

- `index.html`: the community page. Event dates, shop items and photos are written in this file.
- `hub/index.html`: the Team Hub. One file. The app itself is inside `<script type="text/plain" id="app">`
  and runs only after the loader at the bottom of the file has checked the person's link and PIN.
- `hub/version.json` and `var BUILD` in `hub/index.html`: the Hub's build number (see below).
- `hub/sw.js`: keeps the Hub working with a weak signal. It never stores server responses.
- `volunteer/index.html`, `volunteer/reset.html`, `hub/reset.html`: the volunteer page and the two
  password set/reset pages.
- `assets/`: images. `plan-img/`: sample-data screenshots only.
- `.github/check-pages.js`: the automatic check (below).

Nothing in this repository is private. It is public on GitHub. **Never put a password, key, token,
email address, phone number, home address or any community guest's or volunteer's details here.**
All team data comes from the server, only to people signed in.

## Publishing a change

**Pages:** commit to `main`. GitHub Pages publishes about a minute later.

- Hub change: raise the build number in **both** `hub/version.json` and `var BUILD = "..."` in
  `hub/index.html`, to the same value (date and time, `YYYYMMDDHHMMSS`). Phones with the Hub already
  open check `version.json` every minute and reload when it changes. Without this, an open Hub keeps
  running the old version.
- Check in a real browser at phone width (390px) and desktop width (1280px), with no sideways
  scrolling. Every screen must work on both.

**Server:** edit in the Apps Script editor and save. **Saving does not publish.** Deploy, Manage
deployments, pencil icon, Version: New version, Deploy. Never "New deployment": that makes a new web
address, and the pages keep calling the old one (the address is the `API` constant near the top of each
page's script).

New server functions the pages call must be added to `API_` (see the end of Portal.gs or volunteer.gs
for the pattern). Portal.gs wraps every `API_` function that exists when it loads with the Hub PIN
check, except names in `TP_OPEN` (the public ones: volunteer page, sign-in). Files that load after
Portal.gs are not wrapped, so a Hub function added there must check the PIN itself, and a public one
should be added to `TP_OPEN` too (volunteer.gs does this).

## The automatic check

`.github/workflows/check.yml` runs `.github/check-pages.js` on every change:

1. every inline script on every page is valid JavaScript (a syntax error blanks the whole page);
2. the Hub build number matches in both places;
3. a change to `hub/index.html` came with a new build number.

A red X next to a commit on GitHub means it failed; open it for a plain-language message. It flags a
problem, it does not stop publishing: the change is already live, so fix it or undo it. Run it yourself
before committing with `node .github/check-pages.js`.

## Undoing a change

- Pages: revert the commit on GitHub (`git revert <commit>` and push). Live again in about a minute.
- Server: Manage deployments, pencil, pick the last version that worked, Deploy. Instant, and nothing
  is deleted.
- Data: each Sheet's File, Version history.

## Things that break the app if changed by hand

- Sheet tab names and column order on the Hub and volunteer sheets: the server finds data by tab name
  and column position.
- The PIN, Password hash and Reset/setup columns on the Access tab: written by the server only.
- The deployment's web address (see above).

## Open handoff work

- Move ownership of the Sheets, uploads folder and Apps Script project to ReUp's own Google account
  once its mailbox works, and redeploy from there.
- Move the server code into a private repository so it has history like the pages. Move the secret
  written in Portal.gs into Script Properties first.
- Name a second maintainer.
- Database move, planned for January 2027.
